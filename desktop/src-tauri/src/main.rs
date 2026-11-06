// Marginal Vocabulary 桌面版：用系统自带的网页引擎打开打包好的 Margin.html
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod update;

use std::path::Path;
use tauri::Manager;

/// 把导出的备份或词表存到「下载」文件夹（网页版由浏览器下载，桌面版走这里）
#[tauri::command]
fn save_to_downloads(app: tauri::AppHandle, name: String, contents: String) -> Result<String, String> {
    // 只取文件名本身，避免写到「下载」以外的地方
    let file_name = Path::new(&name)
        .file_name()
        .ok_or_else(|| "文件名不对".to_string())?
        .to_owned();
    let path = app.path().download_dir().map_err(|e| e.to_string())?.join(file_name);
    std::fs::write(&path, contents).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

/// 下载并安装新版本（地址来自 GitHub Releases），在后台线程里跑，不卡界面
#[tauri::command(async)]
fn install_update(url: String) -> Result<String, String> {
    if !url.starts_with(update::RELEASE_PREFIX) || !url.ends_with(".app.tar.gz") {
        return Err("更新地址不对".into());
    }
    let bundle = update::current_bundle()?;
    update::install(&url, &bundle).map(|p| p.to_string_lossy().into_owned())
}

/// 装好新版本后重新打开应用
#[tauri::command]
fn relaunch(app: tauri::AppHandle) -> Result<(), String> {
    let bundle = update::current_bundle()?;
    std::process::Command::new("open").arg("-n").arg(&bundle).spawn().map_err(|e| e.to_string())?;
    app.exit(0);
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![save_to_downloads, install_update, relaunch])
        .run(tauri::generate_context!())
        .expect("Marginal Vocabulary 启动失败");
}
