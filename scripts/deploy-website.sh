#!/usr/bin/env bash
# Deploy the TravelorAI website (podman container travelorai_website, 127.0.0.1:3100).
#
#   scripts/deploy-website.sh --dry-run origin/main   # read-only preflight + plan
#   scripts/deploy-website.sh origin/main
#
# Steps on the server (scripts/lib/remote.sh):
#   1. podman commit travelorai_website -> localhost/voyageai_website:pre-deploy-<ts>
#   2. build localhost/voyageai_website:deploy-<ts>-<sha> FROM that snapshot:
#      old /app source wiped (keeps .env*, public/desktop/*.exe), new source
#      copied, npm ci, next build with the production NEXT_PUBLIC_* values
#   3. podman rm -f + podman run with the identical flags
#      (--network host --restart unless-stopped --env-file /root/travelorai-admin.env)
#   4. curl 127.0.0.1:3100/ == 200 within 90 s, else automatic rollback
#   5. keep the last 5 pre-deploy-* / deploy-* images
set -euo pipefail
COMPONENT=website
DEFAULT_HOST="${TRAVELORAI_SSH_HOST:-rux-backend}"
# shellcheck source=lib/local.sh
. "$(dirname "$0")/lib/local.sh"
deploy_main "$@"
