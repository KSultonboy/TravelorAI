// TravelorAI CRM — desktop qobiq (yupqa klient).
// Hostlangan CRMni (travelorai.com) native oynada ochadi; login/kontent o'sha
// saytdan keladi — sayt yangilansa app ham yangilanadi.
//
// YANGILANISH (updater): native qobiqni yangilash uchun ikkita buyruq ochilgan.
// Remote sahifaga BUTUN Tauri API berilmaydi — faqat shu ikkitasi:
//   check_update()   -> joriy/oxirgi versiya, yangilanish bormi
//   install_update() -> yuklab o'rnatadi va ilovani qayta ishga tushiradi
// Fayl tizimi, shell va boshqa pluginlar OCHILMAGAN (xavfsizlik).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri_plugin_updater::UpdaterExt;

#[derive(serde::Serialize)]
struct UpdateInfo {
    /// Hozir o'rnatilgan versiya
    current: String,
    /// Serverdagi oxirgi versiya (yangilanish bo'lmasa — null)
    latest: Option<String>,
    /// Yangilanish mavjudmi
    available: bool,
    /// Yangilanish izohi (release notes)
    notes: Option<String>,
}

#[tauri::command]
async fn check_update(app: tauri::AppHandle) -> Result<UpdateInfo, String> {
    let current = app.package_info().version.to_string();
    let updater = app.updater().map_err(|e| e.to_string())?;

    match updater.check().await {
        Ok(Some(update)) => Ok(UpdateInfo {
            current,
            latest: Some(update.version.clone()),
            available: true,
            notes: update.body.clone(),
        }),
        Ok(None) => Ok(UpdateInfo {
            current,
            latest: None,
            available: false,
            notes: None,
        }),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
async fn install_update(app: tauri::AppHandle) -> Result<bool, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    let found = updater.check().await.map_err(|e| e.to_string())?;

    match found {
        Some(update) => {
            update
                .download_and_install(|_chunk, _total| {}, || {})
                .await
                .map_err(|e| e.to_string())?;
            // O'rnatildi — ilovani qayta ishga tushiramiz (bu chaqiruv qaytmaydi).
            app.restart();
        }
        None => Ok(false),
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![check_update, install_update])
        .run(tauri::generate_context!())
        .expect("TravelorAI CRM ishga tushmadi");
}
