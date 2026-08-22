#!/usr/bin/env bash
# TravelorAI CRM desktop — yangilanishni "chiqarish" (publish).
#
# Nima qiladi:
#   1) tauri.conf.json'dan versiyani oladi
#   2) NSIS installer + .sig faylini topadi (build qilingan bo'lishi kerak)
#   3) installerni website/public/desktop/ ga ko'chiradi (probelsiz nom bilan)
#   4) latest.json manifestini yozadi (imzo + yuklab olish havolasi bilan)
#
# Keyin websiteni deploy qilsangiz — barcha desktop foydalanuvchilar
# "Dastur yangilanishi" tugmasida yangi versiyani ko'radi.
#
# Ishlatish:
#   cd desktop
#   export TAURI_SIGNING_PRIVATE_KEY_PATH="$HOME/.tauri/travelorai.updater.key"
#   export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
#   tauri build            # avval build
#   ./publish-update.sh "Nima yangilandi (ixtiyoriy izoh)"
set -euo pipefail

cd "$(dirname "$0")"
NOTES="${1:-Yaxshilanishlar va tuzatishlar.}"

VERSION=$(python -c "import json;print(json.load(open('src-tauri/tauri.conf.json'))['version'])")
SRC_DIR="src-tauri/target/release/bundle/nsis"
EXE="$SRC_DIR/TravelorAI CRM_${VERSION}_x64-setup.exe"
SIG="$EXE.sig"

[ -f "$EXE" ] || { echo "XATO: installer topilmadi: $EXE"; echo "Avval 'tauri build' qiling."; exit 1; }
[ -f "$SIG" ] || { echo "XATO: imzo fayli topilmadi: $SIG"; echo "TAURI_SIGNING_PRIVATE_KEY_PATH berilganini tekshiring."; exit 1; }

OUT_DIR="../website/public/desktop"
OUT_NAME="TravelorAI-CRM_${VERSION}_x64-setup.exe"
mkdir -p "$OUT_DIR"
cp -f "$EXE" "$OUT_DIR/$OUT_NAME"

SIGNATURE=$(cat "$SIG")
PUB_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)

python - "$OUT_DIR" "$VERSION" "$OUT_NAME" "$SIGNATURE" "$PUB_DATE" "$NOTES" <<'PY'
import io, json, sys
out_dir, version, name, signature, pub_date, notes = sys.argv[1:7]
manifest = {
    "version": version,
    "notes": notes,
    "pub_date": pub_date,
    "platforms": {
        "windows-x86_64": {
            "signature": signature,
            "url": f"https://travelorai.com/desktop/{name}",
        }
    },
}
io.open(f"{out_dir}/latest.json", "w", encoding="utf-8", newline="\n").write(
    json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"
)
PY

echo "✅ Chiqarildi: versiya $VERSION"
echo "   installer : $OUT_DIR/$OUT_NAME"
echo "   manifest  : $OUT_DIR/latest.json"
echo ""
echo "Endi websiteni deploy qiling — foydalanuvchilar yangilanishni ko'radi:"
echo "  tar czf - --exclude=node_modules --exclude=.next --exclude=.git -C website . | ssh rux-backend \"/opt/voyageai/deploy-travelorai.sh\""
