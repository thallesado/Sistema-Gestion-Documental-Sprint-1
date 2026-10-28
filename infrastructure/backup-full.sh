#!/usr/bin/env bash
# Run on the Linux Docker host. Never source or print the deployment .env.
set -euo pipefail
umask 077
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
: "${BACKUP_DESTINATION:?Set BACKUP_DESTINATION to an existing independent mounted disk}"
[[ "$BACKUP_DESTINATION" = /* && -d "$BACKUP_DESTINATION" ]] || { echo 'Destination must be an existing absolute directory' >&2; exit 1; }
DEST=$(realpath -- "$BACKUP_DESTINATION")
[[ $(findmnt -n -o SOURCE -T "$DEST") != $(findmnt -n -o SOURCE -T "$ROOT") ]] || { echo 'Destination must be on a different filesystem from the checkout' >&2; exit 1; }
exec 9>"$DEST/.nexodocs-full.lock"
flock -n 9 || { echo 'A full backup is already running' >&2; exit 1; }
COMPOSE=(docker compose --project-directory "$ROOT/infrastructure" -f "$ROOT/infrastructure/docker-compose.yml")
DB=$("${COMPOSE[@]}" ps -q postgres)
BACKEND=$("${COMPOSE[@]}" ps -q backend)
[[ -n "$DB" && -n "$BACKEND" ]] || { echo 'Postgres and backend must be running' >&2; exit 1; }
# Also reject a destination on the filesystem backing either persistent volume.
for container in "$DB" "$BACKEND"; do
  while IFS= read -r source; do
    [[ -d "$source" ]] || continue
    [[ $(findmnt -n -o SOURCE -T "$DEST") != $(findmnt -n -o SOURCE -T "$source") ]] || { echo 'Destination shares a source volume filesystem' >&2; exit 1; }
  done < <(docker inspect --format '{{range .Mounts}}{{println .Source}}{{end}}' "$container")
done
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
STAGE="$DEST/.nexodocs-full-$STAMP.partial"
mkdir -- "$STAGE"
RESUME=0
cleanup() {
  status=$?
  if (( RESUME )); then "${COMPOSE[@]}" start backend >/dev/null || status=1; fi
  exit "$status"
}
trap cleanup EXIT
RESUME=1
"${COMPOSE[@]}" stop backend >/dev/null
# pg_dump uses the container's local connection and runtime configuration.
docker exec "$DB" sh -eu -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$STAGE/database.dump"
docker exec -i "$DB" pg_restore --list < "$STAGE/database.dump" >/dev/null
docker run --rm --network none --volumes-from "$BACKEND:ro" \
  --mount "type=bind,src=$STAGE,dst=/backup" postgres:17-alpine \
  tar -cf /backup/storage.tar -C /data/storage .
tar -tf "$STAGE/storage.tar" >/dev/null
git -C "$ROOT" rev-parse HEAD > "$STAGE/revision.txt"
if [[ -n $(git -C "$ROOT" status --porcelain) ]]; then
  echo 'WARNING: checkout contains local changes' > "$STAGE/checkout-warning.txt"
fi
(cd -- "$STAGE" && sha256sum database.dump storage.tar revision.txt > SHA256SUMS && sha256sum -c SHA256SUMS)
mv -- "$STAGE" "$DEST/nexodocs-full-$STAMP"
echo "Full backup verified: $DEST/nexodocs-full-$STAMP"
