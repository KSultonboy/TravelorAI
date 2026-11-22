#!/usr/bin/env bash
# Roll a TravelorAI container back to an earlier image.
#
#   scripts/rollback.sh backend --list           # images + deploy history
#   scripts/rollback.sh backend                  # newest pre-deploy-* snapshot
#   scripts/rollback.sh website pre-deploy-20261122-101500
#   scripts/rollback.sh backend hotfix-20261122 --dry-run
#
# The current container is snapshotted first (pre-rollback-<ts>), then
# re-created with the identical podman flags from the chosen image; if the
# health check fails within 90 s the snapshot is restored.
# NOTE: database migrations are NOT reverted — old code must tolerate them.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REMOTE_LIB="$SCRIPT_DIR/lib/remote.sh"
HOST="${TRAVELORAI_SSH_HOST:-rux-backend}"

usage() {
  sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'
  echo "Options: --list  --dry-run  --host HOST  --yes"
}

COMPONENT=""
TAG=""
LIST=0
DRY_RUN=0
YES=0
while [ $# -gt 0 ]; do
  case "$1" in
    --list) LIST=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --host) HOST="${2:?--host needs a value}"; shift 2 ;;
    --yes|-y) YES=1; shift ;;
    -h|--help) usage; exit 0 ;;
    -*) echo "unknown option: $1" >&2; exit 2 ;;
    *)
      if [ -z "$COMPONENT" ]; then COMPONENT="$1"
      elif [ -z "$TAG" ]; then TAG="$1"
      else echo "too many arguments" >&2; exit 2
      fi
      shift ;;
  esac
done

case "$COMPONENT" in
  backend|website) ;;
  *) usage; exit 2 ;;
esac
[ -f "$REMOTE_LIB" ] || { echo "missing $REMOTE_LIB" >&2; exit 1; }

# Accept "localhost/voyageai_backend:tag" or just "tag".
TAG="${TAG##*:}"
if [ -n "$TAG" ] && ! printf '%s' "$TAG" | grep -Eq '^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$'; then
  echo "invalid image tag: $TAG" >&2; exit 2
fi

if [ "$LIST" = 1 ]; then
  ssh "$HOST" "bash -s -- list $COMPONENT" < "$REMOTE_LIB"
  exit 0
fi

args=(rollback "$COMPONENT")
[ -n "$TAG" ] && args+=(--tag "$TAG")
[ "$DRY_RUN" = 1 ] && args+=(--dry-run)

if [ "$DRY_RUN" = 0 ] && [ "$YES" = 0 ]; then
  printf 'Roll back %s on %s to %s? [y/N] ' "$COMPONENT" "$HOST" "${TAG:-newest pre-deploy snapshot}"
  read -r answer
  case "$answer" in y|Y|yes|YES) ;; *) echo "aborted"; exit 1 ;; esac
fi

ssh "$HOST" "bash -s -- $(printf '%q ' "${args[@]}")" < "$REMOTE_LIB"
