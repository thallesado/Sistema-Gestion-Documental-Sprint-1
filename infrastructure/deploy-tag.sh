#!/usr/bin/env bash
# Execute on the authorized deployment host, after publishing the reviewed tag.
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
TAG=${1:?Usage: deploy-tag.sh reviewed-tag}
git -C "$ROOT" check-ref-format "refs/tags/$TAG"
[[ -z $(git -C "$ROOT" status --porcelain) ]] || { echo 'Deployment requires a clean checkout' >&2; exit 1; }
REVISION=$(git -C "$ROOT" rev-parse --verify "refs/tags/$TAG^{commit}")
# No automatic fetch, pull or deployment of untagged main.
git -C "$ROOT" switch --detach "$REVISION"
COMPOSE=(docker compose --project-directory "$ROOT/infrastructure" -f "$ROOT/infrastructure/docker-compose.yml")
if [[ -n ${COMPOSE_ENV_FILE:-} ]]; then COMPOSE+=(--env-file "$COMPOSE_ENV_FILE"); fi
if [[ ${ENABLE_BACKUP_OPERATOR:-false} == true ]]; then COMPOSE+=(-f "$ROOT/infrastructure/docker-compose.backup-operator.yml"); fi
"${COMPOSE[@]}" config --quiet
"${COMPOSE[@]}" up -d --build
MIGRATE=$("${COMPOSE[@]}" ps -aq migrate)
[[ -n "$MIGRATE" ]] || { echo 'Migration container missing' >&2; exit 1; }
[[ $(docker inspect --format '{{.State.ExitCode}}' "$MIGRATE") == 0 ]] || { echo 'Migration failed; inspect migration logs on the host' >&2; exit 1; }
[[ $(docker inspect --format '{{.State.Status}}' "$MIGRATE") == exited ]] || { echo 'Migrations have not finished' >&2; exit 1; }
"${COMPOSE[@]}" ps
echo "Deployed tag $TAG at $REVISION. Verify login, tenant isolation and migration logs before accepting the release."
