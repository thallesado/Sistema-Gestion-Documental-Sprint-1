#!/bin/sh
set -eu

: "${PGHOST:?PGHOST es requerido}"
: "${PGDATABASE:?PGDATABASE es requerido}"
: "${PGUSER:?PGUSER es requerido}"

ROOT=${MIGRATIONS_ROOT:-/migrations}
INIT="$ROOT/init"
TENANT="$ROOT/tenant-bootstrap"

tenant_suffix=${PGDATABASE#nexodocs_t_}
if [ "$tenant_suffix" = "$PGDATABASE" ] || [ "${#tenant_suffix}" -ne 32 ]; then
  echo "PGDATABASE no parece una base aislada de tenant." >&2
  exit 2
fi
case "$tenant_suffix" in *[!0123456789abcdef]*)
  echo "PGDATABASE no parece una base aislada de tenant." >&2
  exit 2
esac

echo "Preparando esquema limpio para ${PGDATABASE}..."
until pg_isready --host="$PGHOST" --port="${PGPORT:-5432}" --username="$PGUSER" --dbname="$PGDATABASE" >/dev/null 2>&1; do
  sleep 2
done

existing_tables=$(psql -X -qAt -v ON_ERROR_STOP=1 \
  -c "SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')")
if [ "$existing_tables" = "0" ]; then
  # Solo se usa al crear una base nueva y vacia. No contiene seeds de organizaciones.
  psql -X -v ON_ERROR_STOP=1 --file="$INIT/001_schema.sql"
elif [ "$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT to_regclass('public.tenants') IS NOT NULL")" != "t" ]; then
  echo "La base destino tiene tablas pero no coincide con un bootstrap NexoDocs; no se modifica." >&2
  exit 3
fi

# Las fases iniciales son transaccionales; al reintentar solo se ejecutan las que
# no dejaron su marca en la base. Esto evita duplicar esquema o catalogos.
if [ "$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT to_regprocedure('app.current_tenant_id()') IS NOT NULL")" != "t" ]; then
  psql -X -v ON_ERROR_STOP=1 --file="$INIT/002_security.sql"
fi
if [ "$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT EXISTS (SELECT 1 FROM public.plans WHERE code='BASIC')")" != "t" ]; then
  psql -X -v ON_ERROR_STOP=1 --file="$TENANT/003_global_catalogs.sql"
fi

for migration in "$INIT"/[0-9][0-9][0-9]_*.sql; do
  filename=${migration##*/}
  number=${filename%%_*}
  version=${filename%.sql}

  # La base por tenant no recibe semillas demo ni el registro del plano central.
  case "$number" in
  # The tenant lifecycle registry and audit archive are control-plane only.
  # Stripe billing 059 is run from a tenant-safe variant without tenant_signups.
  # Migrations 060 and 061 contain tenant-local features and run in tenant DBs.
  001|002|003|005|015|016|066|069) continue ;;
  esac
  # 059 is shared with the Stripe billing schema by numeric prefix; only the
  # tenant-safe billing variant applies here. The lifecycle registry is control-plane data.
  if [ "$version" = "059_tenant_database_lifecycle" ]; then continue; fi

  has_history=$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT to_regclass('app.schema_migrations') IS NOT NULL")
  if [ "$has_history" = "t" ]; then
    applied=$(psql -X -qAt -v ON_ERROR_STOP=1 \
      -c "SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '${version}')")
  else
    applied=f
  fi
  if [ "$applied" = "t" ]; then continue; fi

  case "$version" in
    036_billing_engine) migration="$TENANT/036_billing_engine.sql" ;;
    059_stripe_subscription_billing) migration="$TENANT/059_stripe_subscription_billing.sql" ;;
  esac

  # Migration 070 transfers a SECURITY DEFINER function to the platform admin
  # role. PostgreSQL requires the new owner to have CREATE on its schema.
  # Keep this privilege scoped to isolated tenant databases.
  if [ "$version" = "070_secure_tenant_onboarding" ]; then
    psql -X -v ON_ERROR_STOP=1 -c \
      "GRANT CREATE ON SCHEMA app TO nexodocs_platform_admin"
  fi
  echo "Aplicando migración tenant ${filename}..."
  psql -X -v ON_ERROR_STOP=1 --file="$migration"
  # 048 is an idempotent legacy migration that predates schema_migrations.
  if [ "$version" = "048_enforce_plan_role_permissions" ]; then
    psql -X -q -v ON_ERROR_STOP=1 -c \
      "INSERT INTO app.schema_migrations(version) VALUES ('${version}') ON CONFLICT (version) DO NOTHING"
  fi
done

echo "Esquema de tenant preparado."
