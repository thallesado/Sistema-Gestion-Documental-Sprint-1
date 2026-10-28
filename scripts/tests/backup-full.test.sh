#!/usr/bin/env bash
# Exercise the operator failure path without stopping any real container.
set -euo pipefail
command -v flock >/dev/null || { echo 'Run this test on Linux with flock installed' >&2; exit 1; }
TEST_ROOT=$(mktemp -d)
trap 'rm -rf -- "$TEST_ROOT"' EXIT
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
mkdir -p "$TEST_ROOT/repo/infrastructure" "$TEST_ROOT/bin" "$TEST_ROOT/external"
cp -- "$ROOT/infrastructure/backup-full.sh" "$TEST_ROOT/repo/infrastructure/backup-full.sh"
export BACKUP_DESTINATION="$TEST_ROOT/external" TEST_EVENTS="$TEST_ROOT/events"
cat > "$TEST_ROOT/bin/findmnt" <<'MOCK'
#!/usr/bin/env bash
case "$*" in *external*) echo external;; *) echo primary;; esac
MOCK
cat > "$TEST_ROOT/bin/docker" <<'MOCK'
#!/usr/bin/env bash
echo "$*" >> "$TEST_EVENTS"
case "$*" in
  *'ps -q postgres') echo fixture-db;;
  *'ps -q backend') echo fixture-backend;;
  'inspect '*) :;;
  'exec fixture-db '*) exit 42;;
esac
MOCK
chmod +x "$TEST_ROOT/bin/"*
export PATH="$TEST_ROOT/bin:$PATH"
if bash "$TEST_ROOT/repo/infrastructure/backup-full.sh" > "$TEST_ROOT/output" 2>&1; then
  echo 'Expected failed dump to fail backup' >&2; exit 1
fi
grep -q 'stop backend' "$TEST_EVENTS"
grep -q 'start backend' "$TEST_EVENTS"
if compgen -G "$BACKUP_DESTINATION/nexodocs-full-*" >/dev/null; then
  echo 'Failure published a completed package' >&2; exit 1
fi
echo 'PASS: failed dump restarts backend and does not publish a completed backup'

cp -- "$ROOT/infrastructure/backup-worker.sh" "$TEST_ROOT/repo/infrastructure/backup-worker.sh"
export BACKUP_QUEUE="$TEST_ROOT/queue" BACKUP_DESTINATION="$TEST_ROOT/external-worker"
PENDING=11111111-1111-1111-1111-111111111111
ORPHAN=22222222-2222-2222-2222-222222222222
mkdir -p "$BACKUP_QUEUE/$PENDING" "$BACKUP_QUEUE/$ORPHAN" "$BACKUP_DESTINATION"
touch "$BACKUP_QUEUE/$PENDING/requested" "$BACKUP_QUEUE/$ORPHAN/running"
if ! bash "$TEST_ROOT/repo/infrastructure/backup-worker.sh" > "$TEST_ROOT/worker-output" 2>&1; then
  cat "$TEST_ROOT/worker-output"; exit 1
fi
[[ -f "$BACKUP_QUEUE/$PENDING/failed" && ! -e "$BACKUP_QUEUE/$PENDING/requested" ]]
[[ -f "$BACKUP_QUEUE/$ORPHAN/failed" && ! -e "$BACKUP_QUEUE/$ORPHAN/running" ]]
[[ -f "$BACKUP_QUEUE/worker-ready" ]]
echo 'PASS: worker persists failures, marks interrupted operations and publishes heartbeat'
