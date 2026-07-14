#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# TravelorAI — BACKEND deploy skripti (forced-command nishoni).
# "sherik-backend-deploy" kaliti bilan SSH qilinganda AVTOMATIK ishga tushadi.
# Bajaradi: git pull (integration/full-merge) -> backend image build -> prisma
# migrate deploy -> health tekshiruvi. Build/migrate xato bo'lsa — eski
# konteyner ishlab turaveradi (xavfsiz). .env faylga TEGMAYDI (git'da yo'q).
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

REPO_DIR="${TRAVELORAI_REPO:-/opt/voyageai}"          # backend manba papkasi (kerak bo'lsa o'zgartiring)
COMPOSE="ops/vps/docker-compose.backend.yml"
BRANCH="integration/full-merge"
P="[backend-deploy]"

echo "$P Boshlandi ($(date '+%Y-%m-%d %H:%M:%S'))"

cd "$REPO_DIR" 2>/dev/null || { echo "$P XATO: manba papkasi topilmadi: $REPO_DIR"; exit 1; }

echo "$P Manba yangilanmoqda ($BRANCH)..."
git fetch origin --quiet            || { echo "$P XATO: git fetch"; exit 1; }
git checkout "$BRANCH" --quiet 2>/dev/null || git checkout -b "$BRANCH" "origin/$BRANCH" --quiet
git reset --hard "origin/$BRANCH" --quiet || { echo "$P XATO: git reset"; exit 1; }
echo "$P Commit: $(git rev-parse --short HEAD)"

echo "$P Backend image build + qayta ishga tushirish..."
if ! podman compose -f "$COMPOSE" up -d --build backend; then
  echo "$P XATO: build/up muvaffaqiyatsiz. Eski konteyner ishlab turibdi."
  exit 1
fi

echo "$P Migratsiya (prisma migrate deploy)..."
if ! podman compose -f "$COMPOSE" exec -T backend npx prisma migrate deploy; then
  echo "$P OGOHLANTIRISH: migratsiya muvaffaqiyatsiz — loglarni tekshiring!"
  exit 1
fi

echo "$P Health tekshiruvi..."
sleep 4
code="$(curl -s -o /dev/null -w '%{http_code}' http://localhost:4000/api/v1/health 2>/dev/null || echo 000)"
if [ "$code" = "200" ]; then
  echo "$P DEPLOY OK - health: 200. Yakunlandi."
  exit 0
else
  echo "$P OGOHLANTIRISH: health=$code. Log: podman logs travelorai_backend"
  exit 1
fi
