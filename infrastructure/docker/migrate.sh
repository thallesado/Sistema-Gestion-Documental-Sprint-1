#!/bin/sh
set -eu

: "${PGHOST:?PGHOST es requerido}"
: "${PGDATABASE:?PGDATABASE es requerido}"
: "${PGUSER:?PGUSER es requerido}"

echo "Esperando PostgreSQL en ${PGHOST}:${PGPORT:-5432}/${PGDATABASE}..."
until pg_isready --host="$PGHOST" --port="${PGPORT:-5432}" --username="$PGUSER" --dbname="$PGDATABASE" >/dev/null 2>&1; do
  sleep 2
done

for migration in /migrations/init/[0-9][0-9][0-9]_*.sql; do
  filename=${migration##*/}
  version=${filename%.sql}
  number=${filename%%_*}

  # 001-003 son la instalación inicial y los datos demo. Nunca se vuelven a
  # ejecutar sobre un volumen existente.
  if [ "$number" -lt 4 ]; then
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
  psql -X -v ON_ERROR_STOP=1 --file="$migration"

  applied=$(psql -X -qAt -v ON_ERROR_STOP=1 \
    -c "SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '${version}')")
  if [ "$applied" != "t" ]; then
    echo "ERROR: ${filename} terminó sin registrar su versión en app.schema_migrations." >&2
    exit 1
  fi
done

echo "Migraciones al día."
