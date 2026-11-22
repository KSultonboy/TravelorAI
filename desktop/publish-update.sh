#!/usr/bin/env bash
# TravelorAI CRM desktop — yangilanishni "chiqarish" (publish).
#
# Nima qiladi:
#   1) tauri.conf.json'dan versiyani oladi
#   2) NSIS installer + .sig faylini topadi (imzo bilan build qilingan bo'lishi kerak)
#   3) installerni GitHub Releases'ga yuklaydi (tag: desktop-v<versiya>)
#      — .exe fayllar ENDI website/public/desktop'ga (va git'ga) qo'yilmaydi
#   4) website/public/desktop/latest.json manifestini yozadi: imzo + GitHub
#      Releases'dagi yuklab olish havolasi. Updater endpoint O'ZGARMAYDI:
#      https://travelorai.com/desktop/latest.json (tauri.conf.json'da "pishirilgan").
#
# Keyin latest.json'ni commit qilib websiteni deploy qilsangiz
# (scripts/deploy-website.sh) — barcha desktop foydalanuvchilar
# "Dastur yangilanishi" tugmasida yangi versiyani ko'radi.
#
# Talablar:
#   - gh CLI (`gh auth login`), releases repo'ga yozish huquqi
#   - TRAVELORAI_RELEASES_REPO — installerlar turadigan OMMAVIY (public) GitHub
#     repo, masalan "KSultonboy/travelorai-desktop-releases". Asosiy kod repo
#     private bo'lsa, undagi release asset'larni updater yuklab ola olmaydi.
#
# Ishlatish:
#   cd desktop
#   export TAURI_SIGNING_PRIVATE_KEY_PATH="$HOME/.tauri/travelorai.updater.key"
#   export TAURI_SIGNING_PRIVATE_KEY_PASSWORD='...'   # kalit PAROLLI bo'lishi shart
#   npx @tauri-apps/cli build
#   export TRAVELORAI_RELEASES_REPO="KSultonboy/travelorai-desktop-releases"
#   ./publish-update.sh [--dry-run] "Nima yangilandi (ixtiyoriy izoh)"
set -euo pipefail

cd "$(dirname "$0")"

DRY_RUN=0
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=1
  shift
fi
NOTES="${1:-Yaxshilanishlar va tuzatishlar.}"
REPO="${TRAVELORAI_RELEASES_REPO:-}"

die() { echo "XATO: $*" >&2; exit 1; }
run() {
  if [ "$DRY_RUN" = 1 ]; then
    printf '[dry-run]'; printf ' %q' "$@"; printf '\n'
  else
    "$@"
  fi
}

[ -n "$REPO" ] || die "TRAVELORAI_RELEASES_REPO berilmagan (masalan: KSultonboy/travelorai-desktop-releases)."
command -v node >/dev/null || die "node topilmadi."
command -v gh >/dev/null || die "gh CLI topilmadi (https://cli.github.com)."

VERSION=$(node -p "require('./src-tauri/tauri.conf.json').version")
CARGO_VERSION=$(sed -n 's/^version = "\(.*\)"/\1/p' src-tauri/Cargo.toml | head -n1)
[ "$VERSION" = "$CARGO_VERSION" ] || die "versiya mos emas: tauri.conf.json=$VERSION, Cargo.toml=$CARGO_VERSION"

SRC_DIR="src-tauri/target/release/bundle/nsis"
EXE="$SRC_DIR/TravelorAI CRM_${VERSION}_x64-setup.exe"
SIG="$EXE.sig"
[ -f "$EXE" ] || die "installer topilmadi: $EXE — avval 'npx @tauri-apps/cli build' qiling."
[ -f "$SIG" ] || die "imzo fayli topilmadi: $SIG — TAURI_SIGNING_PRIVATE_KEY_PATH berilganini tekshiring."

if [ "$DRY_RUN" = 0 ]; then
  VISIBILITY=$(gh repo view "$REPO" --json visibility -q .visibility 2>/dev/null || true)
  [ "$VISIBILITY" = "PUBLIC" ] || die "$REPO topilmadi yoki public emas (visibility='$VISIBILITY'). Updater private repo asset'larini yuklay olmaydi."
fi

TAG="desktop-v${VERSION}"
ASSET_NAME="TravelorAI-CRM_${VERSION}_x64-setup.exe"
URL="https://github.com/${REPO}/releases/download/${TAG}/${ASSET_NAME}"

# gh asset nomini fayl nomidan oladi — probelsiz nusxa tayyorlaymiz.
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
cp -f "$EXE" "$STAGE/$ASSET_NAME"
cp -f "$SIG" "$STAGE/$ASSET_NAME.sig"

if [ "$DRY_RUN" = 0 ] && gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  die "release $TAG allaqachon bor. Versiyani oshiring (tauri.conf.json + Cargo.toml)."
fi
run gh release create "$TAG" "$STAGE/$ASSET_NAME" "$STAGE/$ASSET_NAME.sig" \
  --repo "$REPO" --title "TravelorAI CRM $VERSION" --notes "$NOTES"

OUT_DIR="../website/public/desktop"
SIGNATURE=$(cat "$SIG")
PUB_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)

if [ "$DRY_RUN" = 1 ]; then
  echo "[dry-run] $OUT_DIR/latest.json -> version=$VERSION url=$URL"
else
  mkdir -p "$OUT_DIR"
  node - "$OUT_DIR/latest.json" "$VERSION" "$URL" "$SIGNATURE" "$PUB_DATE" "$NOTES" <<'JS'
const fs = require('fs');
const [out, version, url, signature, pubDate, notes] = process.argv.slice(2);
const manifest = {
  version,
  notes,
  pub_date: pubDate,
  platforms: { 'windows-x86_64': { signature, url } },
};
fs.writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
JS
fi

echo "Chiqarildi: versiya $VERSION"
echo "   installer : $URL"
echo "   manifest  : $OUT_DIR/latest.json"
echo ""
echo "Endi latest.json'ni commit qiling va websiteni deploy qiling:"
echo "  scripts/deploy-website.sh <git-ref>"
