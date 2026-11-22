#!/usr/bin/env bash
# Shared developer-machine logic for scripts/deploy-backend.sh and
# scripts/deploy-website.sh. Sourced, not executed.
#
# Flow: git archive <ref>:<component> -> scp to server -> stream
# scripts/lib/remote.sh over ssh (snapshot, build, [migrate], swap,
# health check, automatic rollback, prune).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REMOTE_LIB="$SCRIPT_DIR/remote.sh"

die() { echo "ERROR: $*" >&2; exit 1; }

deploy_usage() {
  cat <<EOF
Usage: $(basename "$0") [options] [<git-ref>]

Deploys the git-tracked files of '$COMPONENT/' at <git-ref> (default: HEAD)
to production ($DEFAULT_HOST). Uncommitted changes are NEVER deployed.

Options:
  --dry-run       Read-only: build the tarball locally, run server preflight
                  checks and print every mutating step without executing it.
  --host HOST     ssh host alias (default: $DEFAULT_HOST)
  --yes           do not ask for confirmation
EOF
  if [ "$COMPONENT" = backend ]; then
    cat <<EOF
  --skip-backup   do not take a pg_dump before 'prisma migrate deploy'
                  (default: required; needs ops/backup installed on the server)
EOF
  fi
  cat <<EOF
  -h, --help      this help

Rollback: scripts/rollback.sh $COMPONENT [image-tag]
EOF
}

deploy_main() {
  local ref="HEAD" host="$DEFAULT_HOST" dry_run=0 yes=0 skip_backup=0
  while [ $# -gt 0 ]; do
    case "$1" in
      --dry-run) dry_run=1; shift ;;
      --host) host="${2:?--host needs a value}"; shift 2 ;;
      --yes|-y) yes=1; shift ;;
      --skip-backup)
        [ "$COMPONENT" = backend ] || die "--skip-backup is backend-only"
        skip_backup=1; shift ;;
      -h|--help) deploy_usage; exit 0 ;;
      -*) die "unknown option: $1 (see --help)" ;;
      *) ref="$1"; shift ;;
    esac
  done

  command -v git >/dev/null || die "git not found"
  command -v ssh >/dev/null || die "ssh not found"
  command -v scp >/dev/null || die "scp not found"
  [ -f "$REMOTE_LIB" ] || die "missing $REMOTE_LIB"

  cd "$REPO_ROOT"
  local sha short
  sha="$(git rev-parse --verify --quiet "${ref}^{commit}")" || die "unknown git ref: $ref"
  short="${sha:0:12}"
  git cat-file -e "${sha}:${COMPONENT}/package.json" 2>/dev/null \
    || die "$COMPONENT/package.json does not exist at $short"

  if [ -n "$(git status --porcelain -- "$COMPONENT")" ]; then
    echo "NOTE: $COMPONENT/ has uncommitted changes — they will NOT be deployed (deploying $short)."
  fi
  if ! git branch -r --contains "$sha" 2>/dev/null | grep -q .; then
    echo "WARNING: $short is not on any remote branch — push it first so the deployed code is recoverable."
  fi

  local tmpdir tarball remote_tar
  tmpdir="$(mktemp -d)"
  # shellcheck disable=SC2064
  trap "rm -rf '$tmpdir'" EXIT
  tarball="$tmpdir/travelorai-$COMPONENT-$short.tar.gz"
  git archive --format=tar.gz -o "$tarball" "${sha}:${COMPONENT}" \
    || die "git archive failed"
  remote_tar="/tmp/travelorai-$COMPONENT-$short-$(date -u +%Y%m%d%H%M%S).tar.gz"

  echo "Component : $COMPONENT"
  echo "Git ref   : $ref -> $sha"
  echo "            $(git log -1 --format='%s (%an, %cr)' "$sha")"
  echo "Tarball   : $(du -h "$tarball" | cut -f1) ($(tar -tzf "$tarball" | wc -l | tr -d ' ') entries)"
  echo "Server    : $host"
  [ "$dry_run" = 1 ] && echo "Mode      : DRY RUN (read-only)"

  local remote_args=(deploy "$COMPONENT" --sha "$sha" --tarball "$remote_tar")
  [ "$skip_backup" = 1 ] && remote_args+=(--skip-backup)

  if [ "$dry_run" = 1 ]; then
    remote_args+=(--dry-run)
    echo "[dry-run] scp $tarball $host:$remote_tar   (skipped)"
    ssh "$host" "bash -s -- $(printf '%q ' "${remote_args[@]}")" < "$REMOTE_LIB"
    return
  fi

  if [ "$yes" != 1 ]; then
    printf 'Deploy %s %s to %s? [y/N] ' "$COMPONENT" "$short" "$host"
    local answer
    read -r answer
    case "$answer" in y|Y|yes|YES) ;; *) die "aborted" ;; esac
  fi

  scp -q "$tarball" "$host:$remote_tar" || die "upload failed"
  ssh "$host" "bash -s -- $(printf '%q ' "${remote_args[@]}")" < "$REMOTE_LIB"
}
