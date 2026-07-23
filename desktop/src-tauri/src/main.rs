// TravelorAI CRM — desktop qobiq (yupqa klient).
// Hostlangan CRMni (travelorai.com) native oynada ochadi; login/yangilanish
// o'sha saytdan. Remote sahifaga Tauri API BERILMAYDI (xavfsiz).
// Menyu YO'Q — to'liq ekran va boshqa amallar CRM headeridan boshqariladi.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("TravelorAI CRM ishga tushmadi");
}
