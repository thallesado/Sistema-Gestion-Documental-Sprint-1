#!/bin/sh
set -eu

ROOT=${MIGRATIONS_ROOT:-/migrations}
INIT="$ROOT/init"

if [ "${TENANT_DATABASE_BOOTSTRAP:-false}" = "true" ]; then
  exec "$ROOT/tenant-bootstrap/migrate-tenant.sh"
fi

: "${PGHOST:?PGHOST es requerido}"
: "${PGDATABASE:?PGDATABASE es requerido}"
: "${PGUSER:?PGUSER es requerido}"

echo "Esperando PostgreSQL en ${PGHOST}:${PGPORT:-5432}/${PGDATABASE}..."
until pg_isready --host="$PGHOST" --port="${PGPORT:-5432}" --username="$PGUSER" --dbname="$PGDATABASE" >/dev/null 2>&1; do
  sleep 2
done

apply_deferred_demo_seed() {
  local version has_history applied
  for version in 005_demo_users 015_acme_superadmin_demo_users; do
    has_history=$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT to_regclass('app.schema_migrations') IS NOT NULL")
    if [ "$has_history" = "t" ]; then
      applied=$(psql -X -qAt -v ON_ERROR_STOP=1 \
        -c "SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '${version}')")
    else
      applied=f
    fi
    if [ "$applied" != "t" ]; then
      echo "Aplicando migración diferida ${version}.sql..."
      psql -X -v ON_ERROR_STOP=1 --file="$INIT/${version}.sql"
      applied=$(psql -X -qAt -v ON_ERROR_STOP=1 \
        -c "SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '${version}')")
      if [ "$applied" != "t" ]; then
        echo "ERROR: ${version}.sql terminó sin registrar su versión." >&2
        exit 1
      fi
    fi
  done
}

apply_initial_audit_policy() {
  local applied
  applied=$(psql -X -qAt -v ON_ERROR_STOP=1 \
    -c "SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '067_audit_security_system_events')")
  if [ "$applied" != "t" ]; then
    # Several early post-hardening migrations create demo roles/users. Their
    # audit triggers run as nexodocs_security and need this narrowly scoped
    # system-event policy before those data migrations execute.
    echo "Aplicando política de auditoría 067 antes de migraciones de datos..."
    psql -X -v ON_ERROR_STOP=1 --file="$INIT/067_audit_security_system_events.sql"
  fi
}

apply_fresh_install_demo_migrations() {
  local version has_history has_hardening applied
  has_history=$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT to_regclass('app.schema_migrations') IS NOT NULL")
  if [ "$has_history" = "t" ]; then
    has_hardening=$(psql -X -qAt -v ON_ERROR_STOP=1 \
      -c "SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '004_saas_hardening')")
  else
    has_hardening=f
  fi
  if [ "$has_hardening" = "f" ]; then
    # Fresh demo rows are installed before 004 adds immutable audit triggers.
    # 016 copies demo administrators into the global account table, outside
    # tenant audit.
    for version in 005_demo_users 015_acme_superadmin_demo_users 016_finocode_tenant_name; do
      has_history=$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT to_regclass('app.schema_migrations') IS NOT NULL")
      if [ "$has_history" = "t" ]; then
        applied=$(psql -X -qAt -v ON_ERROR_STOP=1 \
          -c "SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '${version}')")
      else
        applied=f
      fi
      if [ "$applied" != "t" ]; then
        echo "Aplicando migración inicial ${version}.sql antes del endurecimiento..."
        psql -X -v ON_ERROR_STOP=1 --file="$INIT/${version}.sql"
      fi
    done
  fi
}

apply_migration() {
  local migration version result
  migration=$1
  version=${migration##*/}
  if [ "$version" = "029_workflow_step_instances.sql" ]; then
    # 029 only backfills workflow_step_id, but its UPDATE also fires 004's
    # legacy template trigger, which cannot resolve tenant context in a schema
    # migration. Disable that one trigger only for this migration and always
    # restore it before returning or failing.
    psql -X -v ON_ERROR_STOP=1 -c 'ALTER TABLE public.workflow_tasks DISABLE TRIGGER trg_task_template'
    if psql -X -v ON_ERROR_STOP=1 --file="$migration"; then
      psql -X -v ON_ERROR_STOP=1 -c 'ALTER TABLE public.workflow_tasks ENABLE TRIGGER trg_task_template'
    else
      result=$?
      psql -X -v ON_ERROR_STOP=1 -c 'ALTER TABLE public.workflow_tasks ENABLE TRIGGER trg_task_template' || true
      return "$result"
    fi
  else
    psql -X -v ON_ERROR_STOP=1 --file="$migration"
  fi
}

apply_fresh_install_demo_migrations

for migration in "$INIT"/[0-9][0-9][0-9]_*.sql; do
  filename=${migration##*/}
  version=${filename%.sql}
  number=${filename%%_*}

  # 001-003 son la instalación inicial y los datos demo. Nunca se vuelven a
  # ejecutar sobre un volumen existente.
  if [ "$number" -lt 4 ]; then
    continue
  fi

  # Demo-only data triggers the immutable audit trigger from 004. Its
  # SECURITY DEFINER insert policy is introduced by 067, so it must run after.
  if [ "$version" = "005_demo_users" ] || [ "$version" = "015_acme_superadmin_demo_users" ]; then
    continue
  fi

  has_history=$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT to_regclass('app.schema_migrations') IS NOT NULL")
  if [ "$has_history" = "t" ]; then
    applied=$(psql -X -qAt -v ON_ERROR_STOP=1 \
      -c "SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '${version}')")
  else
    applied=f
  fi

  if [ "$applied" = "t" ]; then
    continue
  fi

  echo "Aplicando migración ${filename}..."
  apply_migration "$migration"

  # 048 predates the migration-history contract and does not register itself.
  # Record the exact filename after its idempotent SQL has committed.
  if [ "$version" = "048_enforce_plan_role_permissions" ]; then
    psql -X -q -v ON_ERROR_STOP=1 -c \
      "INSERT INTO app.schema_migrations(version) VALUES ('${version}') ON CONFLICT (version) DO NOTHING"
  fi

  if [ "$version" = "004_saas_hardening" ]; then
    apply_initial_audit_policy
    apply_deferred_demo_seed
  fi

  applied=$(psql -X -qAt -v ON_ERROR_STOP=1 \
    -c "SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '${version}')")
  if [ "$applied" != "t" ]; then
    echo "ERROR: ${filename} terminó sin registrar su versión en app.schema_migrations." >&2
    exit 1
  fi

done
apply_deferred_demo_seed

echo "Migraciones al día."
