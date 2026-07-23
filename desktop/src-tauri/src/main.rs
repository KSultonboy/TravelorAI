// TravelorAI CRM — desktop qobiq (yupqa klient).
// Hostlangan CRMni (travelorai.com) native oynada ochadi; login/yangilanish
// o'sha saytdan. Remote sahifaga Tauri API BERILMAYDI (xavfsiz).
// "Ko'rinish" menyusi: To'liq ekran (F11), Yangilash (Ctrl+R).
// Zoom (katta/kichik) CRM headeridan boshqariladi (CSS zoom) — bu yerda emas.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let fullscreen = MenuItemBuilder::with_id("fullscreen", "To'liq ekran")
                .accelerator("F11")
                .build(app)?;
            let reload = MenuItemBuilder::with_id("reload", "Yangilash")
                .accelerator("CmdOrControl+R")
                .build(app)?;
            let view = SubmenuBuilder::new(app, "Ko'rinish")
                .item(&fullscreen)
                .separator()
                .item(&reload)
                .build()?;
            let menu = MenuBuilder::new(app).item(&view).build()?;
            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            let win = match app.get_webview_window("main") {
                Some(w) => w,
                None => return,
            };
            match event.id().as_ref() {
                "fullscreen" => {
                    let is_fs = win.is_fullscreen().unwrap_or(false);
                    let _ = win.set_fullscreen(!is_fs);
                }
                "reload" => {
                    let _ = win.eval("window.location.reload()");
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("TravelorAI CRM ishga tushmadi");
}
