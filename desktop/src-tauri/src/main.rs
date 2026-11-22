// TravelorAI CRM — desktop qobiq (yupqa klient).
// Hostlangan CRMni (travelorai.com) native oynada ochadi; login/kontent o'sha
// saytdan keladi — sayt yangilansa app ham yangilanadi.
//
// REMOTE SAHIFAGA OCHILGAN BUYRUQLAR (capabilities/default.json — faqat
// https://travelorai.com/agency... va /signin... sahifalari uchun):
//   check_update()   -> joriy/oxirgi versiya, yangilanish bormi
//   install_update() -> NATIVE "Ha/Yo'q" oynasida foydalanuvchi tasdiqlasa,
//                       yuklab o'rnatadi va ilovani qayta ishga tushiradi
//   open_external()  -> tashqi havolani TIZIM brauzeri/ilovasida ochadi
//                       (faqat https/http/tel/mailto)
//   save_download()  -> faylni «Yuklanmalar»ga saqlaydi; faylni OCHISH faqat
//                       native tasdiq oynasida «Ha» bosilsa
// Fayl tizimi, shell (buyruq bajarish), core:* (oyna/menyu/tray) va boshqa
// pluginlar remote sahifaga OCHILMAGAN.
//
// Nega native oyna: remote sahifada XSS bo'lsa ham, hujumchi foydalanuvchi
// bosmasdan yangilanishni o'rnatib/ilovani qayta ishga tushira olmaydi va
// yozilgan faylni avtomatik ocha olmaydi. Native MessageBox'ni webview
// ichidagi JS bosa olmaydi.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::atomic::{AtomicBool, Ordering};

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

// ---------------------------------------------------------------------------
// Native tasdiqlash oynasi (Windows MessageBox). Yangi dependency emas: `windows`
// crate'i tauri'ning o'zi ishlatadigan versiya va feature'lar bilan ulangan.
// ---------------------------------------------------------------------------

/// Bir vaqtda faqat bitta tasdiq oynasi. Sahifa buyruqni ketma-ket chaqirib
/// oynalarni "spam" qila olmasligi uchun — ikkinchi chaqiruv darhol rad etiladi.
static DIALOG_OPEN: AtomicBool = AtomicBool::new(false);

/// Foydalanuvchidan native "Ha/Yo'q" so'raydi. Faqat «Ha» bosilsa `true`.
/// Standart tugma — «Yo'q» (Enter tasodifan tasdiqlamaydi).
async fn confirm_native(app: &tauri::AppHandle, title: String, text: String) -> bool {
    if DIALOG_OPEN.swap(true, Ordering::SeqCst) {
        return false;
    }
    let owner = owner_hwnd(app);
    let answer = tauri::async_runtime::spawn_blocking(move || native_yes_no(owner, &title, &text))
        .await
        .unwrap_or(false);
    DIALOG_OPEN.store(false, Ordering::SeqCst);
    answer
}

#[cfg(windows)]
fn owner_hwnd(app: &tauri::AppHandle) -> isize {
    use tauri::Manager;
    app.get_webview_window("main")
        .and_then(|w| w.hwnd().ok())
        .map(|h| h.0 as isize)
        .unwrap_or(0)
}

#[cfg(not(windows))]
fn owner_hwnd(_app: &tauri::AppHandle) -> isize {
    0
}

#[cfg(windows)]
fn native_yes_no(owner: isize, title: &str, text: &str) -> bool {
    use windows::core::HSTRING;
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        MessageBoxW, IDYES, MB_DEFBUTTON2, MB_ICONQUESTION, MB_SETFOREGROUND, MB_YESNO,
    };

    let hwnd = if owner == 0 {
        None
    } else {
        Some(HWND(owner as *mut core::ffi::c_void))
    };
    let text = HSTRING::from(text);
    let title = HSTRING::from(title);
    let result = unsafe {
        MessageBoxW(
            hwnd,
            &text,
            &title,
            MB_YESNO | MB_ICONQUESTION | MB_DEFBUTTON2 | MB_SETFOREGROUND,
        )
    };
    result == IDYES
}

/// Windows'dan boshqa platformada native oyna yo'q — xavfsiz tomonga: rad.
#[cfg(not(windows))]
fn native_yes_no(_owner: isize, _title: &str, _text: &str) -> bool {
    false
}

// ---------------------------------------------------------------------------
// Buyruqlar
// ---------------------------------------------------------------------------

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

/// Yangilanishni o'rnatadi — FAQAT foydalanuvchi native oynada «Ha» bossa.
/// Paket imzosi updater pubkey bilan tekshiriladi (tauri.conf.json).
#[tauri::command]
async fn install_update(app: tauri::AppHandle) -> Result<bool, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    let found = updater.check().await.map_err(|e| e.to_string())?;

    match found {
        Some(update) => {
            let current = app.package_info().version.to_string();
            let confirmed = confirm_native(
                &app,
                "TravelorAI CRM — yangilanish".to_string(),
                format!(
                    "TravelorAI CRM {} versiyasini o'rnatishni tasdiqlaysizmi?\n\n\
                     Joriy versiya: {}\n\
                     O'rnatilgach ilova qayta ishga tushadi — saqlanmagan ma'lumotlarni avval saqlang.",
                    update.version, current
                ),
            )
            .await;
            if !confirmed {
                return Err("Yangilanish bekor qilindi".into());
            }
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

/// Tashqi havolani tizim brauzeri/ilovasida ochadi (WhatsApp, Telegram, tel:).
///
/// NEGA KERAK: Tauri webview'da `target="_blank"` havolalar ochilmaydi —
/// yangi oyna bloklangan. Shu sababli CRM'dagi WhatsApp/Telegram/qo'ng'iroq
/// tugmalari desktop ilovada hech narsa qilmasdi.
///
/// XAVFSIZLIK: bu "istalgan narsani ochish" emas. Faqat quyidagi sxemalar
/// ruxsat etiladi va boshqasi rad qilinadi — `file:`, `javascript:`, `data:`
/// va o'rnatilgan ilovalarni ishga tushiruvchi maxsus sxemalar o'tmaydi.
#[tauri::command]
async fn open_external(url: String) -> Result<(), String> {
    const ALLOWED: [&str; 4] = ["https://", "http://", "tel:", "mailto:"];
    let u = url.trim();
    let lower = u.to_ascii_lowercase();
    if u.len() > 2000 || !ALLOWED.iter().any(|p| lower.starts_with(p)) {
        return Err("Ruxsat etilmagan havola".into());
    }
    // Yangi qator/bo'sh joy orqali qo'shimcha argument uzatishga yo'l qo'ymaymiz.
    if u.chars().any(|c| c.is_control()) {
        return Err("Havolada ruxsat etilmagan belgi".into());
    }
    open::that_detached(u).map_err(|e| e.to_string())
}

/// Faylni foydalanuvchining «Yuklanmalar» papkasiga saqlaydi.
///
/// NEGA KERAK: Tauri webview'da `<a download>` orqali fayl yuklab olish
/// ishlamaydi — brauzerdagidek yuklanmalar paneli yo'q, fayl jimgina
/// yo'qoladi. Shu sababli CRM'dagi «Yuklab olish» va CSV eksport tugmalari
/// desktop ilovada hech narsa qilmasdi.
///
/// XAVFSIZLIK: ixtiyoriy joyga yozish EMAS —
///   * fayl faqat «Yuklanmalar» papkasiga tushadi,
///   * fayl nomidan papka belgilari (/ \ : .. va boshq.) tozalanadi,
///   * faqat .html va .csv kengaytmalariga ruxsat,
///   * hajm 8 MB bilan cheklangan,
///   * mavjud fayl ustiga yozmaydi — nomiga (2), (3) qo'shadi,
///   * fayl AVTOMATIK OCHILMAYDI: saqlangach native oynada «Ochilsinmi?»
///     so'raladi (standart javob — «Yo'q»). Remote sahifa buni bosa olmaydi.
///
/// Natija (o'zgarmagan kontrakt): saqlangan fayl yo'li.
#[tauri::command]
async fn save_download(
    app: tauri::AppHandle,
    filename: String,
    content: String,
) -> Result<String, String> {
    use std::path::PathBuf;

    if content.len() > 8 * 1024 * 1024 {
        return Err("Fayl juda katta".into());
    }
    // Nomni tozalaymiz: faqat oxirgi qismini olamiz va xavfli belgilarni olib tashlaymiz
    let raw = filename.rsplit(['/', '\\']).next().unwrap_or("").trim().to_string();
    let safe: String = raw
        .chars()
        .filter(|c| !matches!(c, '<' | '>' | ':' | '"' | '|' | '?' | '*') && !c.is_control())
        .collect();
    let safe = safe.trim_matches('.').to_string();
    let lower = safe.to_ascii_lowercase();
    if safe.is_empty() || safe.contains("..") || !(lower.ends_with(".html") || lower.ends_with(".csv")) {
        return Err("Fayl nomi ruxsat etilmagan".into());
    }

    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map_err(|_| "Uy papkasi topilmadi".to_string())?;
    let dir = PathBuf::from(home).join("Downloads");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    // Ustiga yozmaymiz — «Shartnoma (2).html» ko'rinishida yangi nom
    let (stem, ext) = match safe.rfind('.') {
        Some(i) => (safe[..i].to_string(), safe[i..].to_string()),
        None => (safe.clone(), String::new()),
    };
    let mut path = dir.join(&safe);
    let mut n = 2;
    while path.exists() && n < 100 {
        path = dir.join(format!("{stem} ({n}){ext}"));
        n += 1;
    }

    std::fs::write(&path, content).map_err(|e| e.to_string())?;
    let shown = path.to_string_lossy().to_string();

    // Ochish — faqat foydalanuvchi native oynada rozi bo'lsa (opt-in).
    let open_it = confirm_native(
        &app,
        "TravelorAI CRM — fayl saqlandi".to_string(),
        format!("Fayl «Yuklanmalar» papkasiga saqlandi:\n{shown}\n\nHozir ochilsinmi?"),
    )
    .await;
    if open_it {
        let _ = open::that_detached(&path);
    }
    Ok(shown)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            check_update,
            install_update,
            open_external,
            save_download
        ])
        .run(tauri::generate_context!())
        .expect("TravelorAI CRM ishga tushmadi");
}
