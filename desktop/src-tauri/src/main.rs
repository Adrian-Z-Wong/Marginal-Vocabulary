// Marginal Vocabulary 桌面版：用系统自带的网页引擎打开打包好的 Margin.html
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod update;

use std::path::Path;
#[cfg(target_os = "macos")]
use tauri::menu::{Menu, MenuItem, MenuItemKind};
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

/// 下载并安装新版本（地址来自 GitHub Releases），在后台线程里跑，不卡界面。
/// macOS：直接替换应用，装好后由页面提示重新打开；Windows：打开安装程序，应用自己退出
#[tauri::command(async)]
fn install_update(app: tauri::AppHandle, url: String) -> Result<String, String> {
    if !url.starts_with(update::RELEASE_PREFIX) {
        return Err("更新地址不对".into());
    }
    #[cfg(target_os = "macos")]
    {
        let _ = &app;
        if !url.ends_with(".app.tar.gz") {
            return Err("更新地址不对".into());
        }
        let bundle = update::current_bundle()?;
        update::install(&url, &bundle).map(|p| p.to_string_lossy().into_owned())
    }
    #[cfg(target_os = "windows")]
    {
        if !url.ends_with("-setup.exe") {
            return Err("更新地址不对".into());
        }
        let installer = update::download_installer(&url)?;
        update::launch_installer(&installer)?;
        app.exit(0);
        Ok(installer.to_string_lossy().into_owned())
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = &app;
        Err("这个系统还不支持自动更新".into())
    }
}

/// 更新前把全部进度存一份到应用自己的数据文件夹（每次覆盖，只留最新一份）
/// macOS 上是 ~/Library/Application Support/io.github.adrian-z-wong.margin/update-backup.json
#[tauri::command]
fn save_update_backup(app: tauri::AppHandle, contents: String) -> Result<String, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join("update-backup.json");
    std::fs::write(&path, contents).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

/// 装好新版本后重新打开应用
#[tauri::command]
fn relaunch(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let bundle = update::current_bundle()?;
        std::process::Command::new("open").arg("-n").arg(&bundle).spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "macos"))]
    {
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        std::process::Command::new(exe).spawn().map_err(|e| e.to_string())?;
    }
    app.exit(0);
    Ok(())
}

fn main() {
    tauri::Builder::default()
        // Mac：在应用菜单（Marginal Vocabulary）里「About」下面加一项「Check for Updates…」
        // Windows 不要菜单栏，检查更新在「设置」里
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                let handle = app.handle();
                let menu = Menu::default(handle)?;
                let check = MenuItem::with_id(handle, "check_updates", "Check for Updates…", true, None::<&str>)?;
                if let Some(MenuItemKind::Submenu(app_menu)) = menu.items()?.first() {
                    app_menu.insert(&check, 1)?;
                }
                app.set_menu(menu)?;
            }
            #[cfg(not(target_os = "macos"))]
            let _ = app;
            Ok(())
        })
        .on_menu_event(|app, event| {
            if event.id().as_ref() == "check_updates" {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_focus();
                    let _ = window.eval("window.__marginCheckUpdate && window.__marginCheckUpdate()");
                }
            }
        })
        .invoke_handler(tauri::generate_handler![save_to_downloads, save_update_backup, install_update, relaunch])
        .run(tauri::generate_context!())
        .expect("Marginal Vocabulary 启动失败");
}
