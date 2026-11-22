# TravelorAI CRM — Desktop app (Tauri v2)

Agentlik CRM'ini alohida Windows dasturi (`.exe`) sifatida ochadi. Bu **yupqa
klient**: hostlangan CRMni (`https://travelorai.com/signin?as=agency` →
`/agency`) native oynada yuklaydi — login, ma'lumot va UI o'sha saytdan keladi.
Sayt yangilansa, CRM ham yangilanadi; native qobiqni yangilash uchun updater bor.

- **Hajmi:** ~7 MB (WebView2 ishlatiladi, Windows 10/11'da o'rnatilgan).
- **Platforma:** faqat Windows (NSIS installer). Native tasdiq oynalari
  (`MessageBoxW`) Windows'ga xos; boshqa platformada ular "Yo'q" deb hisoblanadi.

## Remote sahifaga nima ochiq (xavfsizlik modeli)

Remote sahifa Tauri API'siz emas — `withGlobalTauri: true` va quyidagi
**4 ta o'z buyrug'imiz** ochiq. Boshqa hech narsa (core:* oyna/menyu/tray/event,
fayl tizimi, shell, boshqa pluginlar) berilmagan.

| Buyruq | Nima qiladi | Himoya |
|---|---|---|
| `check_update` | joriy/oxirgi versiya | faqat o'qish |
| `install_update` | yangilanishni yuklab o'rnatadi, ilovani qayta ishga tushiradi | **native "Ha/Yo'q" oynasi** (standart — Yo'q); paket imzosi updater pubkey bilan tekshiriladi |
| `open_external` | havolani tizim brauzeri/ilovasida ochadi | faqat `https`, `http`, `tel`, `mailto`; boshqaruv belgilari rad |
| `save_download` | `.html`/`.csv` faylni `Downloads`ga yozadi | nom tozalanadi, 8 MB, ustiga yozmaydi; **avtomatik ochilmaydi** — "Ochilsinmi?" native oynasida «Ha» bosilsa ochiladi |

- IPC faqat shu URL'larda ishlaydi (`src-tauri/capabilities/default.json`):
  `https://travelorai.com/agency`, `/agency/*`, `/signin`, `/signin/*`
  (query string farq qilmaydi). Saytning boshqa sahifalari (`/`, `/tours`, `/admin`...)
  desktop oynada ochilsa ham buyruqlarni chaqira olmaydi.
- Bir vaqtda faqat bitta native tasdiq oynasi — sahifa ularni "spam" qila olmaydi.
- `app.security.csp` faqat ilova ichidagi lokal sahifaga (`frontend/index.html`,
  zaxira "yuklanmadi" sahifasi) taalluqli. Remote CRM sahifasining CSP'si
  **website/nginx sarlavhalari** bilan boshqariladi — XSS himoyasi o'sha yerda.
- Buyruqlar ro'yxati: `src-tauri/permissions/updater-commands.toml`; kodi:
  `src-tauri/src/main.rs`.

## Talablar (build uchun)

- Rust (`cargo`, stable `x86_64-pc-windows-msvc`) — `rustup default stable`
- Visual Studio C++ Build Tools (linker)
- WebView2 Runtime
- Node/npm (Tauri CLI'ni `npx` orqali chaqirish uchun)

## Ishga tushirish (dev)

```bash
cd desktop
npx @tauri-apps/cli dev
```

## Build (installer)

```bash
cd desktop
export TAURI_SIGNING_PRIVATE_KEY_PATH="$HOME/.tauri/travelorai.updater.key"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD='<kalit paroli>'
npx @tauri-apps/cli build
```

Natija: `src-tauri/target/release/bundle/nsis/TravelorAI CRM_<versiya>_x64-setup.exe`
va `.sig` (updater imzosi).

## Yangi versiya chiqarish

1. Versiyani **ikkala** joyda bir xil oshiring: `src-tauri/tauri.conf.json` →
   `version` va `src-tauri/Cargo.toml` → `version`.
2. Yuqoridagidek imzo bilan build qiling (imzo bo'lmasa updater ishlamaydi).
3. Chiqarish — installer GitHub Releases'ga, manifest website'ga:
   ```bash
   export TRAVELORAI_RELEASES_REPO="KSultonboy/travelorai-desktop-releases"  # PUBLIC repo
   ./publish-update.sh --dry-run "Nima yangilandi"   # avval tekshiring
   ./publish-update.sh "Nima yangilandi"
   ```
   Skript `desktop-v<versiya>` release yaratadi va
   `website/public/desktop/latest.json`ni yangi havola + imzo bilan yozadi.
4. `latest.json`ni commit qiling va websiteni deploy qiling
   (`scripts/deploy-website.sh <ref>`).

- **Installerlar git'ga va `website/public/desktop/`ga QO'YILMAYDI**
  (`.gitignore`da `website/public/desktop/*.exe`). Faqat `latest.json` website'da
  qoladi — updater endpoint o'zgarmaydi: `https://travelorai.com/desktop/latest.json`.
- Releases repo **public** bo'lishi shart: updater va foydalanuvchilar asset'ni
  autentifikatsiyasiz yuklaydi.

## Updater kaliti — MUHIM

- Maxfiy kalit (`~/.tauri/travelorai.updater.key`) **repoda YO'Q va bo'lmasin**,
  CI secret'iga ham faqat parol bilan qo'yiladi.
- Kalit **parol bilan himoyalangan bo'lishi shart.** Hozirgi kalit parolsiz
  yaratilgan (audit 2026-11-22). Tuzatish: yangi parolli kalit
  (`npx @tauri-apps/cli signer generate -w ~/.tauri/travelorai.updater.key`) —
  lekin pubkey ilovaga "pishirilgan", shuning uchun o'tish tartibi:
  1) yangi pubkey'ni `tauri.conf.json`ga qo'yib, yangi versiyani **eski kalit**
  bilan imzolab chiqaring; 2) keyingi versiyalardan boshlab yangi kalit bilan
  imzolang. Eski kalitni shundan keyin yo'q qiling.
- Kalit va parolning zaxira nusxasini parol menejerida saqlang: kalit yo'qolsa,
  o'rnatilgan ilovalarga boshqa yangilanish yubora olmaysiz.
- Installer Authenticode bilan imzolanmagan — SmartScreen ogohlantiradi
  («More info → Run anyway»). OV/EV code-signing sertifikati tavsiya etiladi.

## Ikonkani yangilash

`icon-source.png` (1024×1024) ni almashtiring, so'ng:

```bash
cd desktop
npx @tauri-apps/cli icon icon-source.png
```

## Sozlash

- Ochiladigan manzil, oyna o'lchami, nomi — `src-tauri/tauri.conf.json`
  (`app.windows[0].url`, `width/height`, `title`, `productName`). Manzil
  o'zgarsa, `capabilities/default.json` → `remote.urls`ni ham moslang.
