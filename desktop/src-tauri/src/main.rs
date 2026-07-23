// TravelorAI CRM — desktop qobiq (yupqa klient).
// Hostlangan CRMni (travelorai.com) native oynada ochadi; login/yangilanish
// o'sha saytdan. Remote sahifaga Tauri API BERILMAYDI (xavfsiz).
// "Ko'rinish" menyusi: To'liq ekran (F11), zoom (Ctrl +/-/0), Yangilash (Ctrl+R).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::Manager;

// Joriy zoom darajasi (menyu orqali boshqariladi)
struct Zoom(Mutex<f64>);

fn main() {
    tauri::Builder::default()
        .manage(Zoom(Mutex::new(1.0)))
        .setup(|app| {
            let fullscreen = MenuItemBuilder::with_id("fullscreen", "To'liq ekran")
                .accelerator("F11")
                .build(app)?;
            let zoom_in = MenuItemBuilder::with_id("zoom_in", "Kattalashtirish")
                .accelerator("CmdOrControl+Plus")
                .build(app)?;
            let zoom_out = MenuItemBuilder::with_id("zoom_out", "Kichiklashtirish")
                .accelerator("CmdOrControl+Minus")
                .build(app)?;
            let zoom_reset = MenuItemBuilder::with_id("zoom_reset", "Asl hajm")
                .accelerator("CmdOrControl+0")
                .build(app)?;
            let reload = MenuItemBuilder::with_id("reload", "Yangilash")
                .accelerator("CmdOrControl+R")
                .build(app)?;
            let view = SubmenuBuilder::new(app, "Ko'rinish")
                .item(&fullscreen)
                .separator()
                .item(&zoom_in)
                .item(&zoom_out)
                .item(&zoom_reset)
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
                id @ ("zoom_in" | "zoom_out" | "zoom_reset") => {
                    let state = app.state::<Zoom>();
                    let mut z = state.0.lock().unwrap();
                    *z = match id {
                        "zoom_in" => (*z + 0.1).min(3.0),
                        "zoom_out" => (*z - 0.1).max(0.5),
                        _ => 1.0,
                    };
                    let _ = win.set_zoom(*z);
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("TravelorAI CRM ishga tushmadi");
}
