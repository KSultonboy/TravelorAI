#!/usr/bin/env bash
# Deploy the TravelorAI backend (podman container voyageai_backend, 127.0.0.1:4000).
#
#   scripts/deploy-backend.sh --dry-run origin/main   # read-only preflight + plan
#   scripts/deploy-backend.sh origin/main
#
# Steps on the server (scripts/lib/remote.sh):
#   1. podman commit voyageai_backend -> localhost/voyageai_backend:pre-deploy-<ts>
#   2. build localhost/voyageai_backend:deploy-<ts>-<sha> FROM that snapshot:
#      old /app source wiped (keeps /app/.env + uploads), new source copied,
#      npm ci --omit=dev, prisma generate
#   3. pg_dump backup, then `prisma migrate deploy` in a one-off container
#      (host network) — abort before touching prod if it fails
#   4. podman rm -f + podman run with the identical flags
#      (--network host --restart unless-stopped -v /root/travelorai-uploads:/app/uploads)
#   5. curl 127.0.0.1:4000/api/v1/health == 200 within 90 s, else automatic
#      rollback to the pre-deploy snapshot
#   6. keep the last 5 pre-deploy-* / deploy-* images
set -euo pipefail
COMPONENT=backend
DEFAULT_HOST="${TRAVELORAI_SSH_HOST:-rux-backend}"
# shellcheck source=lib/local.sh
. "$(dirname "$0")/lib/local.sh"
deploy_main "$@"
