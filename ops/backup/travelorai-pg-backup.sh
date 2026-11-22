#!/usr/bin/env bash
# TravelorAI — PostgreSQL backup (runs ON the production server as root).
#
# Install: see ops/backup/README.md  (target path /usr/local/sbin/travelorai-pg-backup.sh)
#
# - DATABASE_URL is read from inside the voyageai_backend container, resolved
#   exactly like server.js does (dotenv override:true over /app/.env). It is
#   never printed or written to disk.
# - pg_dump runs in a throw-away `postgres:16-alpine` podman container with
#   --network host (Postgres listens on 127.0.0.1:5433 under snap-docker).
# - Output: /root/backups/travelorai/{daily,weekly,manual}/travelorai-<kind>-<UTC>.sql.gz, chmod 600
# - Retention: 14 daily, 8 weekly (Sunday's daily is also copied to weekly), 10 manual.
#
# Usage:
#   travelorai-pg-backup.sh                 # daily (+ weekly on Sundays)
#   travelorai-pg-backup.sh --kind manual   # e.g. before migrations (scripts/deploy-backend.sh)
#
# Touches nothing but TravelorAI: reads one env var from voyageai_backend and
# writes under /root/backups/travelorai.
set -Eeuo pipefail
umask 077

BACKUP_ROOT="${TRAVELORAI_BACKUP_ROOT:-/root/backups/travelorai}"
CONTAINER=voyageai_backend
PG_IMAGE=docker.io/library/postgres:16-alpine
KEEP_DAILY=14
KEEP_WEEKLY=8
KEEP_MANUAL=10

KIND=auto
while [ $# -gt 0 ]; do
  case "$1" in
    --kind) KIND="${2:?--kind needs daily|weekly|manual}"; shift 2 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done
case "$KIND" in auto|daily|weekly|manual) ;; *) echo "bad --kind: $KIND" >&2; exit 2 ;; esac

log() { printf '%s travelorai-pg-backup: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }

command -v podman >/dev/null || die "podman not found"
exec 9>/run/lock/travelorai-pg-backup.lock
flock -n 9 || die "another backup is running"

DATABASE_URL="$(podman exec "$CONTAINER" node -e \
  "require('dotenv').config({ override: true }); process.stdout.write(process.env.DATABASE_URL || '')" 2>/dev/null)" \
  || die "could not read DATABASE_URL from $CONTAINER (is it running?)"
[ -n "$DATABASE_URL" ] || die "DATABASE_URL is empty in $CONTAINER"
# Prisma-only query params (e.g. ?schema=public&connection_limit=) are not libpq options.
PG_URL="${DATABASE_URL%%\?*}"

STAMP="$(date -u +%Y%m%d-%H%M%S)"
if [ "$KIND" = auto ]; then
  PRIMARY=daily
else
  PRIMARY="$KIND"
fi
mkdir -p "$BACKUP_ROOT/daily" "$BACKUP_ROOT/weekly" "$BACKUP_ROOT/manual"
chmod 700 "$BACKUP_ROOT" "$BACKUP_ROOT"/daily "$BACKUP_ROOT"/weekly "$BACKUP_ROOT"/manual

OUT="$BACKUP_ROOT/$PRIMARY/travelorai-$PRIMARY-$STAMP.sql.gz"
TMP="$OUT.partial"
trap 'rm -f "$TMP"' EXIT

log "dumping to $OUT"
# The URL is passed through the environment (not argv) so it does not show up in `ps`.
# --log-driver=none: otherwise podman also copies the dump (with PII and password
# hashes) from the container's stdout into the system journal.
if ! podman run --rm --network host --pull=missing --log-driver=none \
      -e PGURL="$PG_URL" \
      "$PG_IMAGE" \
      sh -c 'exec pg_dump --dbname="$PGURL" --no-owner --no-privileges --format=plain' \
    | gzip -9 > "$TMP"; then
  die "pg_dump failed"
fi
# Sanity check: non-trivial, valid gzip, looks like a pg_dump.
gzip -t "$TMP" || die "gzip integrity check failed"
SIZE=$(stat -c %s "$TMP")
[ "$SIZE" -gt 1024 ] || die "dump suspiciously small ($SIZE bytes)"
( set +o pipefail; gzip -dc "$TMP" 2>/dev/null | head -n 20 | grep -q 'PostgreSQL database dump' ) \
  || die "output does not look like a pg_dump"
chmod 600 "$TMP"
mv -f "$TMP" "$OUT"
log "ok: $OUT ($SIZE bytes)"

if [ "$KIND" = auto ] && [ "$(date -u +%u)" = 7 ]; then
  WEEKLY="$BACKUP_ROOT/weekly/travelorai-weekly-$STAMP.sql.gz"
  cp -p "$OUT" "$WEEKLY"
  chmod 600 "$WEEKLY"
  log "weekly copy: $WEEKLY"
fi

prune() {
  local dir="$1" keep="$2"
  # Names sort chronologically (UTC stamp). Only our own files are matched.
  find "$dir" -maxdepth 1 -type f -name 'travelorai-*.sql.gz' -printf '%f\n' \
    | sort -r | tail -n +$((keep + 1)) \
    | while read -r f; do
        rm -f -- "$dir/$f"
        log "pruned $dir/$f"
      done
}
prune "$BACKUP_ROOT/daily" "$KEEP_DAILY"
prune "$BACKUP_ROOT/weekly" "$KEEP_WEEKLY"
prune "$BACKUP_ROOT/manual" "$KEEP_MANUAL"
