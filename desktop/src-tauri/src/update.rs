//! 应用内更新：从 GitHub Releases 下载新版的 .app 压缩包，替换当前应用，再重新打开。
//! 只用 macOS 自带的 curl、tar、xattr，不引入额外依赖。

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

/// 只接受本项目 Releases 里的下载地址
pub const RELEASE_PREFIX: &str = "https://github.com/Adrian-Z-Wong/Marginal-Vocabulary/releases/download/";

/// 当前运行的 .app：.../Marginal Vocabulary.app/Contents/MacOS/margin 往上三级
pub fn current_bundle() -> Result<PathBuf, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe = fs::canonicalize(&exe).unwrap_or(exe);
    bundle_of(&exe)
}

pub fn bundle_of(exe: &Path) -> Result<PathBuf, String> {
    let bundle = exe
        .parent()
        .and_then(|p| p.parent())
        .and_then(|p| p.parent())
        .ok_or_else(|| "找不到应用所在的位置".to_string())?;
    if bundle.extension().and_then(|e| e.to_str()) != Some("app") {
        return Err("当前不是从 .app 应用运行的，没法自动更新".into());
    }
    Ok(bundle.to_path_buf())
}

fn run(cmd: &mut Command, what: &str) -> Result<(), String> {
    let out = cmd.output().map_err(|e| format!("{what}失败：{e}"))?;
    if out.status.success() {
        Ok(())
    } else {
        Err(format!("{what}失败：{}", String::from_utf8_lossy(&out.stderr).trim()))
    }
}

/// 下载 url（.app.tar.gz），解压后替换 bundle。中途失败会把旧版本放回原处。
/// 临时文件放在应用旁边的隐藏文件夹里，保证和应用在同一个磁盘上，替换只是改名。
pub fn install(url: &str, bundle: &Path) -> Result<PathBuf, String> {
    let parent = bundle.parent().ok_or("找不到应用所在的文件夹")?;
    let stage = parent.join(".marginal-vocabulary-update");
    let backup = parent.join(".marginal-vocabulary-old.app");
    let _ = fs::remove_dir_all(&stage);
    fs::create_dir_all(&stage).map_err(|e| format!("没有权限写入「{}」：{e}", parent.display()))?;
    let result: Result<PathBuf, String> = (|| {
        let archive = stage.join("update.tar.gz");
        run(Command::new("curl").args(["-fsSL", "--max-time", "600", "-o"]).arg(&archive).arg(url), "下载")?;
        run(Command::new("tar").arg("-xzf").arg(&archive).arg("-C").arg(&stage), "解压")?;
        let new_app = fs::read_dir(&stage)
            .map_err(|e| e.to_string())?
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .find(|p| p.extension().and_then(|e| e.to_str()) == Some("app") && p.join("Contents").join("MacOS").is_dir())
            .ok_or("下载的文件里没有找到应用")?;
        // 去掉「从网上下载」的隔离标记，免得系统再拦一次（没有这个命令或没有标记都不要紧）
        let _ = Command::new("xattr").args(["-dr", "com.apple.quarantine"]).arg(&new_app).output();
        let _ = fs::remove_dir_all(&backup);
        fs::rename(bundle, &backup).map_err(|e| format!("挪开旧版本失败：{e}"))?;
        if let Err(e) = fs::rename(&new_app, bundle) {
            let _ = fs::rename(&backup, bundle);
            return Err(format!("放入新版本失败：{e}"));
        }
        let _ = fs::remove_dir_all(&backup);
        Ok(bundle.to_path_buf())
    })();
    let _ = fs::remove_dir_all(&stage);
    result
}
