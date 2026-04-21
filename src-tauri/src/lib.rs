#[cfg(target_os = "macos")]
#[tauri::command]
fn set_dock_icon(path: String) -> Result<(), String> {
    use cocoa::appkit::{NSApp, NSApplication, NSImage};
    use cocoa::base::{id, nil};
    use cocoa::foundation::NSString;
    use objc::{msg_send, sel, sel_impl};

    unsafe {
        let ns_path = NSString::alloc(nil).init_str(&path);
        let image: id = NSImage::alloc(nil).initByReferencingFile_(ns_path);
        if image == nil {
            return Err(format!("couldn't load image at {}", path));
        }
        let app: id = NSApp();
        let _: () = msg_send![app, setApplicationIconImage: image];
    }
    Ok(())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn set_dock_icon(_path: String) -> Result<(), String> {
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![set_dock_icon])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
