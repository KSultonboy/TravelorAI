#!/usr/bin/env bash
# TravelorAI — server-side deploy/rollback logic.
#
# This file is NOT run on the developer machine. scripts/deploy-*.sh and
# scripts/rollback.sh stream it to the server:
#     ssh rux-backend 'bash -s -- <action> <component> [options]' < scripts/lib/remote.sh
#
# It touches ONLY the two TravelorAI podman containers and their images:
#     voyageai_backend   (localhost/voyageai_backend:*)  127.0.0.1:4000
#     travelorai_website (localhost/voyageai_website:*)  127.0.0.1:3100
# The server is shared with other projects — never add anything here that
# lists/prunes/restarts containers or images by a broad filter.
#
# Actions:
#   deploy   <backend|website> --tarball PATH --sha SHA [--skip-backup] [--dry-run]
#   rollback <backend|website> [--tag TAG] [--dry-run]
#   list     <backend|website>
set -Eeuo pipefail

ACTION="${1:-}"
COMPONENT="${2:-}"
shift 2 || true

TARBALL=""
SHA=""
TAG=""
SKIP_BACKUP=0
DRY_RUN=0
while [ $# -gt 0 ]; do
  case "$1" in
    --tarball) TARBALL="$2"; shift 2 ;;
    --sha) SHA="$2"; shift 2 ;;
    --tag) TAG="$2"; shift 2 ;;
    --skip-backup) SKIP_BACKUP=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    *) echo "remote: unknown option: $1" >&2; exit 2 ;;
  esac
done

TS="$(date -u +%Y%m%d-%H%M%S)"
HEALTH_TIMEOUT=90
KEEP_IMAGES=5
BACKUP_SCRIPT=/usr/local/sbin/travelorai-pg-backup.sh
HISTORY_DIR=/root/travelorai-deploy
HISTORY_LOG="$HISTORY_DIR/history.log"

case "$COMPONENT" in
  backend)
    CONTAINER=voyageai_backend
    REPO=localhost/voyageai_backend
    PORT=4000
    HEALTH_URL=http://127.0.0.1:4000/api/v1/health
    RUN_FLAGS=(--network host --restart unless-stopped -v /root/travelorai-uploads:/app/uploads)
    EXPECT_MOUNT="/root/travelorai-uploads:/app/uploads"
    EXPECT_ENV_FILE=""
    ;;
  website)
    CONTAINER=travelorai_website
    REPO=localhost/voyageai_website
    PORT=3100
    HEALTH_URL=http://127.0.0.1:3100/
    RUN_FLAGS=(--network host --restart unless-stopped --env-file /root/travelorai-admin.env)
    EXPECT_MOUNT=""
    EXPECT_ENV_FILE=/root/travelorai-admin.env
    ;;
  *)
    echo "remote: component must be backend or website (got '$COMPONENT')" >&2
    exit 2
    ;;
esac

# Public build-time values for the website (not secrets). Must match AGENTS.md.
NEXT_PUBLIC_SITE_URL=https://travelorai.com
NEXT_PUBLIC_API_URL=https://travelorai.com/api/v1
NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID=401741517790-11c61fghvchvld521kdi0fu4ee1mo2af.apps.googleusercontent.com

# --------------------------------------------------------------------------- helpers
log()  { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
warn() { printf '[%s] WARN: %s\n' "$(date -u +%H:%M:%S)" "$*" >&2; }
die()  { printf '[%s] ERROR: %s\n' "$(date -u +%H:%M:%S)" "$*" >&2; exit 1; }

# Mutating commands go through run(): printed instead of executed in dry-run.
run() {
  if [ "$DRY_RUN" = 1 ]; then
    # stderr: callers often redirect stdout of the real command to /dev/null.
    { printf '[dry-run]'; printf ' %q' "$@"; printf '\n'; } >&2
  else
    "$@"
  fi
}

record_history() {
  [ "$DRY_RUN" = 1 ] && return 0
  mkdir -p "$HISTORY_DIR"
  printf '%s\t%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$COMPONENT" "$ACTION" "$*" >> "$HISTORY_LOG"
}

container_state() {
  podman inspect -f '{{.State.Status}}' "$CONTAINER" 2>/dev/null || echo missing
}

container_id() {
  podman inspect -f '{{.Id}}' "$CONTAINER" 2>/dev/null || true
}

# PIDs listening on $PORT.
port_pids() {
  ss -ltnpH "sport = :$PORT" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u || true
}

# PIDs listening on $PORT that do NOT belong to our container (by cgroup).
# Non-empty = a duplicate/foreign holder (the 2026-06-12 "port war").
foreign_port_pids() {
  local cid pid
  cid="$(container_id)"
  for pid in $(port_pids); do
    if [ -n "$cid" ] && grep -q "$cid" "/proc/$pid/cgroup" 2>/dev/null; then
      continue
    fi
    echo "$pid"
  done
}

http_code() {
  curl -s -o /dev/null -m 5 -w '%{http_code}' "$HEALTH_URL" 2>/dev/null || echo 000
}

wait_healthy() {
  local deadline code state
  deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    code="$(http_code)"
    if [ "$code" = 200 ]; then
      log "health OK ($HEALTH_URL -> 200)"
      return 0
    fi
    state="$(container_state)"
    case "$state" in
      exited|stopped|dead|missing)
        warn "container state is '$state' while waiting for health"
        return 1
        ;;
    esac
    sleep 3
  done
  warn "health check failed for ${HEALTH_TIMEOUT}s (last HTTP code: $(http_code))"
  return 1
}

wait_port_free() {
  local i
  for i in $(seq 1 30); do
    [ -z "$(port_pids)" ] && return 0
    sleep 1
  done
  return 1
}

# Remove our container and start a new one from $1 with the canonical flags.
# Dies (no automatic action possible) if the old container cannot be removed or
# the port stays busy; returns 1 if `podman run` fails so callers can roll back.
swap_to() {
  local image="$1"
  log "swap: podman rm -f $CONTAINER"
  run timeout 90 podman rm -f -t 15 "$CONTAINER" >/dev/null || warn "podman rm -f returned non-zero or timed out"
  if [ "$DRY_RUN" = 0 ] && podman container exists "$CONTAINER"; then
    die "container $CONTAINER still exists after rm -f (podman 'stopping' bug?) — see AGENTS.md recovery"
  fi
  if [ "$DRY_RUN" = 0 ] && ! wait_port_free; then
    die "port $PORT still in use after removing $CONTAINER (pids: $(port_pids | tr '\n' ' ')) — NOT starting a second holder"
  fi
  log "swap: podman run $CONTAINER from $image"
  if ! run podman run -d --name "$CONTAINER" "${RUN_FLAGS[@]}" "$image" >/dev/null; then
    warn "podman run from $image failed"
    podman rm -f "$CONTAINER" >/dev/null 2>&1 || true
    return 1
  fi
}

snapshot() {
  local tag="$1"
  log "snapshot: podman commit $CONTAINER -> $REPO:$tag"
  run timeout 600 podman commit --pause=false "$CONTAINER" "$REPO:$tag" >/dev/null
}

prune_tags() {
  local prefix="$1" ref in_use
  in_use="$(podman inspect -f '{{.ImageName}}' "$CONTAINER" 2>/dev/null || true)"
  podman images --format '{{.Repository}}:{{.Tag}}' \
    | { grep -E "^${REPO}:${prefix}[0-9]{8}-[0-9]{6}" || true; } \
    | sort -r \
    | tail -n +$((KEEP_IMAGES + 1)) \
    | while read -r ref; do
        [ "$ref" = "$in_use" ] && continue
        log "prune: $ref"
        run podman rmi "$ref" >/dev/null || warn "could not remove $ref (in use?)"
      done
}

preflight() {
  local allow_down="${1:-0}"
  command -v podman >/dev/null || die "podman not found"
  command -v curl >/dev/null || die "curl not found"
  command -v ss >/dev/null || die "ss not found"

  local state net restart mounts foreign
  state="$(container_state)"
  if [ "$allow_down" = 1 ] && [ "$state" != running ]; then
    # Rollback of a dead service: there is no live container to compare flags with.
    [ "$state" = stopping ] && die "container $CONTAINER is stuck in 'stopping' — do the AGENTS.md recovery (commit snapshot, rm -f, run) first"
    foreign="$(foreign_port_pids | tr '\n' ' ')"
    [ -z "${foreign// /}" ] || die "port $PORT is held by pid(s): $foreign — refusing to start a second holder"
    warn "$CONTAINER is '$state' — rollback will (re)create it with the canonical flags"
    return 0
  fi
  [ "$state" = missing ] && die "container $CONTAINER does not exist — refusing to create one blindly (see AGENTS.md)"
  [ "$state" = running ] || die "container $CONTAINER is '$state', not running — recover first (AGENTS.md: podman 'stopping' recovery)"

  # The swap re-creates the container with hard-coded flags; make sure the
  # live container really uses them, otherwise we would silently change prod.
  net="$(podman inspect -f '{{.HostConfig.NetworkMode}}' "$CONTAINER")"
  restart="$(podman inspect -f '{{.HostConfig.RestartPolicy.Name}}' "$CONTAINER")"
  mounts="$(podman inspect -f '{{range .Mounts}}{{.Source}}:{{.Destination}} {{end}}' "$CONTAINER")"
  [ "$net" = host ] || die "$CONTAINER network mode is '$net', expected 'host' — update scripts/lib/remote.sh first"
  [ "$restart" = unless-stopped ] || die "$CONTAINER restart policy is '$restart', expected 'unless-stopped'"
  mounts="${mounts% }"
  [ "$mounts" = "$EXPECT_MOUNT" ] \
    || die "$CONTAINER mounts are '$mounts', expected '$EXPECT_MOUNT' — the swap would drop/alter them; update scripts/lib/remote.sh first"
  if [ -n "$EXPECT_ENV_FILE" ]; then
    [ -r "$EXPECT_ENV_FILE" ] || die "$EXPECT_ENV_FILE missing — the new container would start without admin credentials"
  fi

  foreign="$(foreign_port_pids | tr '\n' ' ')"
  [ -z "${foreign// /}" ] || die "port $PORT is also held by non-$CONTAINER pid(s): $foreign — duplicate container? Fix that first (AGENTS.md §3)"

  local avail_kb
  avail_kb="$(df -Pk /var/lib/containers 2>/dev/null | awk 'NR==2 {print $4}')"
  if [ -n "$avail_kb" ] && [ "$avail_kb" -lt $((3 * 1024 * 1024)) ]; then
    die "less than 3 GB free under /var/lib/containers — prune old TravelorAI images first"
  fi

  log "preflight OK: $CONTAINER running on :$PORT, image $(podman inspect -f '{{.ImageName}}' "$CONTAINER")"
}

acquire_lock() {
  [ "$DRY_RUN" = 1 ] && return 0
  exec 9>/run/lock/travelorai-deploy.lock
  flock -n 9 || die "another TravelorAI deploy/rollback is running"
}

# --------------------------------------------------------------------------- build
# Returns non-zero on failure (callers must check; errexit is not relied on).
build_image() {
  local base="$1" new="$2" ctx user rc
  ctx="$(mktemp -d /tmp/travelorai-build-XXXXXX)" || return 1
  mkdir -p "$ctx/src" || return 1
  if ! tar -xzf "$TARBALL" -C "$ctx/src"; then
    rm -rf "$ctx"; warn "could not extract $TARBALL"; return 1
  fi
  if [ ! -f "$ctx/src/package.json" ]; then
    rm -rf "$ctx"; warn "tarball has no package.json at its root — wrong archive?"; return 1
  fi

  user="$(podman image inspect -f '{{.Config.User}}' "$base" 2>/dev/null || true)"

  cat > "$ctx/apply.sh" <<'APPLY'
#!/bin/sh
# Runs INSIDE the image build: replace /app source, keep runtime-only files.
set -eu
COMPONENT="$1"
RUN_USER="${2:-}"
KEEP=/tmp/travelorai-keep
rm -rf "$KEEP"
mkdir -p "$KEEP"
cd /app
case "$COMPONENT" in
  backend) keep_list=".env uploads" ;;
  website) keep_list=".env .env.local .env.production public/desktop/*.exe" ;;
  *) echo "bad component" >&2; exit 1 ;;
esac
for p in $keep_list; do
  [ -e "$p" ] || continue
  mkdir -p "$KEEP/$(dirname "$p")"
  cp -a "$p" "$KEEP/$p"
done
[ "$COMPONENT" != backend ] || [ -f "$KEEP/.env" ] || { echo "ERROR: /app/.env missing in base image" >&2; exit 1; }
# Wipe old source completely so deleted files/routes do not survive.
find /app -mindepth 1 -maxdepth 1 -exec rm -rf {} +
cp -a /tmp/newsrc/. /app/
cp -a "$KEEP/." /app/
rm -rf "$KEEP" /tmp/newsrc
if [ "$COMPONENT" = backend ]; then
  npm ci --omit=dev --no-audit --no-fund
  npx prisma generate
else
  npm ci --include=dev --no-audit --no-fund
  NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  NEXT_PUBLIC_SITE_URL="$NEXT_PUBLIC_SITE_URL" \
  NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" \
  NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID="$NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID" \
    node node_modules/next/dist/bin/next build
fi
npm cache clean --force >/dev/null 2>&1 || true
case "$RUN_USER" in
  ""|root|0|0:0) ;;
  *) chown -R "$RUN_USER" /app ;;
esac
APPLY

  {
    echo "FROM $base"
    echo "USER root"
    echo "COPY src/ /tmp/newsrc/"
    echo "COPY apply.sh /tmp/travelorai-apply.sh"
    echo "RUN NEXT_PUBLIC_SITE_URL='$NEXT_PUBLIC_SITE_URL' NEXT_PUBLIC_API_URL='$NEXT_PUBLIC_API_URL' NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID='$NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID' sh /tmp/travelorai-apply.sh '$COMPONENT' '$user' && rm -f /tmp/travelorai-apply.sh"
    if [ -n "$user" ]; then echo "USER $user"; fi
    echo "LABEL org.opencontainers.image.revision='$SHA' travelorai.component='$COMPONENT' travelorai.deployed-at='$TS'"
  } > "$ctx/Containerfile"

  log "build: $new (base $base)"
  rc=0
  # --squash-all: every deploy builds FROM the previous snapshot; without squashing,
  # the layer count grows with each deploy until overlayfs refuses (~128 layers).
  timeout 1800 podman build --squash-all --network host --pull=never -t "$new" -f "$ctx/Containerfile" "$ctx" || rc=$?
  rm -rf "$ctx"
  return "$rc"
}

# Run `prisma migrate deploy` in a one-off container of image $1, with the same
# env resolution as server.js (dotenv override:true over /app/.env), so the
# migration hits exactly the database the app will use.
run_migrations() {
  local image="$1"
  # Production's _prisma_migrations was empty until it was baselined on 2026-11-22
  # (AGENTS.md). On an un-baselined database `migrate deploy` would start from
  # 'init' and fail half-way, leaving a failed row behind — refuse instead.
  timeout 900 podman run --rm --log-driver=none --network host --name "voyageai_backend_migrate_$TS" "$image" \
    node -e "
      require('dotenv').config({ override: true });
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      prisma.\$queryRawUnsafe('SELECT count(*)::int AS n FROM _prisma_migrations WHERE finished_at IS NOT NULL')
        .then(async (rows) => {
          await prisma.\$disconnect();
          if (!rows[0] || rows[0].n === 0) {
            console.error('_prisma_migrations is empty: baseline the database first (AGENTS.md); refusing to run migrate deploy');
            process.exit(3);
          }
          require('child_process').execFileSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit' });
        })
        .catch((e) => { console.error(e.message); process.exit(1); });
    "
}

# --------------------------------------------------------------------------- actions
do_deploy() {
  [ -n "$SHA" ] || die "--sha is required"
  local snap_tag="pre-deploy-$TS"
  local snap="$REPO:$snap_tag"
  local new="$REPO:deploy-$TS-${SHA:0:12}"

  acquire_lock
  preflight

  if [ "$DRY_RUN" = 1 ]; then
    log "DRY RUN — nothing below is executed"
    snapshot "$snap_tag"
    echo "[dry-run] build $new FROM $snap with new $COMPONENT source (git $SHA)"
    if [ "$COMPONENT" = backend ]; then
      echo "[dry-run] backup via $BACKUP_SCRIPT (exists: $([ -x "$BACKUP_SCRIPT" ] && echo yes || echo no))"
      echo "[dry-run] podman run --rm --network host $new node -e '<dotenv override; npx prisma migrate deploy>'"
    fi
    swap_to "$new"
    echo "[dry-run] wait for $HEALTH_URL = 200 (${HEALTH_TIMEOUT}s), else roll back to $snap"
    prune_tags pre-deploy-
    prune_tags deploy-
    return 0
  fi

  [ -f "$TARBALL" ] || die "tarball $TARBALL not found"

  # 1. Snapshot the live container (includes /app/.env and any in-place edits).
  snapshot "$snap_tag"
  record_history "snapshot $snap sha=$SHA"

  # 2. Build the new image on top of the snapshot.
  if ! build_image "$snap" "$new"; then
    record_history "FAILED build $new"
    die "image build failed — production untouched (snapshot $snap kept)"
  fi
  rm -f "$TARBALL"

  # 3. Backend: DB backup + migrations BEFORE the swap.
  if [ "$COMPONENT" = backend ]; then
    if [ "$SKIP_BACKUP" = 1 ]; then
      warn "skipping pre-migration DB backup (--skip-backup)"
    elif [ -x "$BACKUP_SCRIPT" ]; then
      log "backup: $BACKUP_SCRIPT --kind manual"
      "$BACKUP_SCRIPT" --kind manual || die "pre-migration backup failed — aborting (use --skip-backup to override)"
    else
      die "$BACKUP_SCRIPT not installed (ops/backup/README.md) — install it or pass --skip-backup"
    fi
    log "migrate: prisma migrate deploy (one-off container, host network)"
    if ! run_migrations "$new"; then
      record_history "FAILED migrate $new"
      die "prisma migrate deploy failed — production untouched (new image $new kept for debugging)"
    fi
  fi

  # 4. Swap + 5. health check, automatic rollback.
  if swap_to "$new" && wait_healthy; then
    record_history "OK $new (rollback: $snap)"
    log "deployed $new"
  else
    mkdir -p "$HISTORY_DIR"
    podman logs --tail 120 "$CONTAINER" > "$HISTORY_DIR/failed-$COMPONENT-$TS.log" 2>&1 || true
    warn "new container unhealthy — logs saved to $HISTORY_DIR/failed-$COMPONENT-$TS.log"
    warn "ROLLING BACK to $snap"
    if swap_to "$snap" && wait_healthy; then
      record_history "ROLLED BACK to $snap after failed $new"
      if [ "$COMPONENT" = backend ]; then
        warn "migrations from $new (if any) are still applied — old code must tolerate them"
      fi
      die "deploy failed, rolled back to $snap"
    fi
    record_history "ROLLBACK UNHEALTHY $snap after failed $new"
    die "deploy failed AND rollback to $snap is unhealthy — manual action needed NOW"
  fi

  # 6. Keep the last $KEEP_IMAGES of each kind.
  prune_tags pre-deploy-
  prune_tags deploy-
  prune_tags pre-rollback-
}

do_rollback() {
  local target
  if [ -n "$TAG" ]; then
    target="$REPO:$TAG"
  else
    target="$(podman images --format '{{.Repository}}:{{.Tag}}' \
      | grep -E "^${REPO}:pre-deploy-[0-9]{8}-[0-9]{6}$" | sort -r | head -n1 || true)"
    [ -n "$target" ] || die "no pre-deploy-* images found for $REPO"
  fi
  podman image exists "$target" || die "image $target not found (see: rollback.sh $COMPONENT --list)"

  acquire_lock
  preflight 1

  local current state snap_tag=""
  state="$(container_state)"
  current="$(podman inspect -f '{{.ImageName}}' "$CONTAINER" 2>/dev/null || echo none)"
  if [ "$state" = running ]; then
    [ "$current" != "$target" ] || die "$CONTAINER already runs $target"
    snap_tag="pre-rollback-$TS"
    snapshot "$snap_tag"
  fi
  log "rollback: $current -> $target"
  if [ "$DRY_RUN" = 1 ]; then
    swap_to "$target"
    echo "[dry-run] wait for $HEALTH_URL = 200"
    return 0
  fi

  if swap_to "$target" && wait_healthy; then
    record_history "OK rollback to $target (was $current, state $state; snapshot ${snap_tag:-none})"
    log "rolled back to $target"
    prune_tags pre-rollback-
  else
    [ -n "$snap_tag" ] || die "rollback target $target is unhealthy and there was no running container to restore — manual action needed NOW"
    warn "rollback target unhealthy — restoring $REPO:$snap_tag"
    if ! { swap_to "$REPO:$snap_tag" && wait_healthy; }; then
      record_history "FAILED rollback; restore unhealthy"
      die "restore of $REPO:$snap_tag is unhealthy — manual action needed NOW"
    fi
    record_history "FAILED rollback to $target; restored $REPO:$snap_tag"
    die "rollback to $target failed health check; restored previous state"
  fi
}

do_list() {
  log "$CONTAINER: state=$(container_state) image=$(podman inspect -f '{{.ImageName}}' "$CONTAINER" 2>/dev/null || echo -)"
  podman images --format '{{.Repository}}:{{.Tag}}\t{{.Created}}\t{{.Size}}' \
    | grep -E "^${REPO}:" | sort -r || true
  if [ -f "$HISTORY_LOG" ]; then
    echo "--- last deploy history ($HISTORY_LOG)"
    awk -F '\t' -v c="$COMPONENT" '$2 == c' "$HISTORY_LOG" | tail -n 10 || true
  fi
}

case "$ACTION" in
  deploy) do_deploy ;;
  rollback) do_rollback ;;
  list) do_list ;;
  *) die "action must be deploy|rollback|list (got '$ACTION')" ;;
esac
