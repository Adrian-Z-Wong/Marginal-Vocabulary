//! 应用内更新。
//! macOS：从 GitHub Releases 下载新版的 .app 压缩包，替换当前应用，再重新打开（只用系统自带的 curl、tar、xattr）。
//! Windows：下载新版的安装程序（…-setup.exe），打开它，应用自己退出，由安装程序覆盖旧版本（用系统自带的 curl.exe）。

#[cfg(any(target_os = "macos", target_os = "windows"))]
use std::fs;
#[cfg(any(target_os = "macos", target_os = "windows"))]
use std::path::{Path, PathBuf};
#[cfg(any(target_os = "macos", target_os = "windows"))]
use std::process::Command;

/// 只接受本项目 Releases 里的下载地址
pub const RELEASE_PREFIX: &str = "https://github.com/Adrian-Z-Wong/Marginal-Vocabulary/releases/download/";

#[cfg(any(target_os = "macos", target_os = "windows"))]
fn run(cmd: &mut Command, what: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        // 不弹出黑色的命令行窗口
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }
    let out = cmd.output().map_err(|e| format!("{what}失败：{e}"))?;
    if out.status.success() {
        Ok(())
    } else {
        Err(format!("{what}失败：{}", String::from_utf8_lossy(&out.stderr).trim()))
    }
}

// ---------------- macOS ----------------

/// 当前运行的 .app：.../Marginal Vocabulary.app/Contents/MacOS/margin 往上三级
#[cfg(target_os = "macos")]
pub fn current_bundle() -> Result<PathBuf, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe = fs::canonicalize(&exe).unwrap_or(exe);
    bundle_of(&exe)
}

#[cfg(target_os = "macos")]
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

/// 下载 url（.app.tar.gz），解压后替换 bundle。中途失败会把旧版本放回原处。
/// 临时文件放在应用旁边的隐藏文件夹里，保证和应用在同一个磁盘上，替换只是改名。
#[cfg(target_os = "macos")]
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

// ---------------- Windows ----------------

/// 把安装程序下载到临时文件夹，返回它的路径
#[cfg(target_os = "windows")]
pub fn download_installer(url: &str) -> Result<PathBuf, String> {
    let name = url.rsplit('/').next().filter(|n| n.ends_with("-setup.exe")).ok_or("更新地址不对")?;
    let dir = std::env::temp_dir().join("marginal-vocabulary-update");
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).map_err(|e| format!("没法创建临时文件夹：{e}"))?;
    let file = dir.join(name);
    run(Command::new("curl.exe").args(["-fsSL", "--max-time", "600", "-o"]).arg(&file).arg(url), "下载")?;
    let size = fs::metadata(&file).map(|m| m.len()).unwrap_or(0);
    if size < 100_000 {
        return Err("下载的安装程序不完整".into());
    }
    Ok(file)
}

/// 打开下载好的安装程序
#[cfg(target_os = "windows")]
pub fn launch_installer(path: &Path) -> Result<(), String> {
    Command::new(path).spawn().map(|_| ()).map_err(|e| format!("打开安装程序失败：{e}"))
}
