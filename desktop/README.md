# TravelorAI CRM — Desktop app (Tauri)

Agentlik CRM'ini alohida Windows dasturi (`.exe`) sifatida ochadi. Bu **yupqa
klient**: hostlangan CRMni (`https://travelorai.com/signin`) native oynada
yuklaydi — login, ma'lumot va yangilanishlar o'sha saytdan ishlaydi. Alohida
server yoki qayta build shart emas; sayt yangilansa, app ham yangilanadi.

- **Xavfsizlik:** remote sahifaga Tauri/OS API berilmaydi — bu shunchaki
  brend'langan, chekланган brauzer oynasi.
- **Hajmi:** ~7 MB (Electron ~150 MB o'rniga). WebView2 (Windows'da o'rnatilgan)
  ishlatiladi.

## Talablar (build uchun)

- Rust (`cargo`) + `x86_64-pc-windows-msvc` target
- Visual Studio C++ Build Tools (linker)
- WebView2 Runtime (Windows 11'da o'rnatilgan)
- Node/npm (Tauri CLI'ni `npx` orqali chaqirish uchun)

## Ishga tushirish (dev)

```bash
cd desktop
npx @tauri-apps/cli dev
```

## Build (.exe / installer)

```bash
cd desktop
npx @tauri-apps/cli build
```

Natija:

- Portativ exe: `src-tauri/target/release/travelorai-crm.exe`
- Installer (NSIS): `src-tauri/target/release/bundle/nsis/TravelorAI CRM_<versiya>_x64-setup.exe`

## Ikonkani yangilash

`icon-source.png` (1024×1024) ni almashtiring, so'ng:

```bash
cd desktop
npx @tauri-apps/cli icon icon-source.png
```

## Sozlash

- **Qaysi manzilга ochilishi**, oyna o'lchami, nomi — `src-tauri/tauri.conf.json`
  (`app.windows[0].url`, `width/height`, `title`, `productName`).
- **Versiya** — `tauri.conf.json` (`version`) va `src-tauri/Cargo.toml`.

## Eslatmalar (tarqatish)

- **Imzo (code signing):** installer imzolanmagan bo'lsa, Windows SmartScreen
  birinchi ishga tushishда ogohlantiradi («More info → Run anyway»). Professional
  tarqatish uchun code-signing sertifikati (EV/OV) tavsiya etiladi — ogohlantirish
  yo'qoladi.
- **Auto-update:** Tauri updater (`plugin-updater`) qo'shib, yangi versiyalarni
  avtomatik tarqatish mumkin (keyingi bosqich).
- **macOS/Linux:** shu loyihадан `.dmg` / `.AppImage` ham chiqarish mumkin
  (mos platformada build qilinsa).
