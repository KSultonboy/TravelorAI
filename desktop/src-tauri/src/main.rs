// TravelorAI CRM — desktop qobiq (yupqa klient).
// Bu app hostlangan CRMni (travelorai.com) native oynada ochadi; login/yangilanish
// o'sha saytdan ishlaydi. Remote sahifaga Tauri API'lari BERILMAYDI (xavfsiz).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("TravelorAI CRM ishga tushmadi");
}
