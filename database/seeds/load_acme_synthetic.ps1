param(
    [string]$PostgresService = 'postgres',
    [string]$BackendService = 'backend',
    [string]$PostgresUser = $(if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { 'nexodocs' }),
    [string]$PostgresDatabase = $(if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { 'nexodocs' }),
    [switch]$CopyToDockerStorage
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$sql = Join-Path $PSScriptRoot 'acme_synthetic_300.sql'
$staging = Join-Path $env:TEMP 'nexodocs-acme-synthetic-300'

Write-Host 'Ejecutando carga SQL explícita (sin borrar datos)...'
docker compose cp $sql "${PostgresService}:/tmp/acme_synthetic_300.sql"
if ($LASTEXITCODE -ne 0) { throw 'No se pudo copiar el SQL al contenedor PostgreSQL.' }
docker compose exec -T $PostgresService psql -X -U $PostgresUser -d $PostgresDatabase -v ON_ERROR_STOP=1 -f /tmp/acme_synthetic_300.sql
if ($LASTEXITCODE -ne 0) { throw 'La carga SQL falló; la transacción fue revertida.' }

New-Item -ItemType Directory -Force -Path $staging | Out-Null
for ($n = 1; $n -le 300; $n++) {
    $name = ('patient-{0:D4}.txt' -f $n)
    @(
        'NexoDocs SYNTHETIC FIXTURE',
        ('FinoCode / patient-{0:D4}' -f $n),
        'No contiene datos personales reales. Uso exclusivo para pruebas.',
        ('Deterministic fixture sequence: {0}' -f $n)
    ) | Set-Content -Encoding utf8 -NoNewline (Join-Path $staging $name)
}
Write-Host "Archivos físicos creados en $staging"

if ($CopyToDockerStorage) {
    docker compose exec -T $BackendService sh -c 'mkdir -p /data/storage/synthetic/acme-patients'
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar el volumen documental.' }
    docker compose cp "$staging\." "${BackendService}:/data/storage/synthetic/acme-patients"
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron copiar los fixtures al volumen documental.' }
    Write-Host 'Fixtures copiados al volumen persistente del servicio backend.'
} else {
    Write-Host 'No se copiaron al volumen Docker. Use -CopyToDockerStorage con backend activo.'
}

docker compose exec -T $PostgresService psql -X -U $PostgresUser -d $PostgresDatabase -v ON_ERROR_STOP=1 -c @'
SELECT 'patients' AS relation, count(*) FROM patients
 WHERE tenant_id = '20000000-0000-0000-0000-000000000001'
   AND id BETWEEN '60000000-0000-0000-0000-000000000001'::uuid AND '60000000-0000-0000-0000-000000000300'::uuid
UNION ALL SELECT 'clinical_histories', count(*) FROM clinical_histories
 WHERE tenant_id = '20000000-0000-0000-0000-000000000001'
   AND id BETWEEN '61000000-0000-0000-0000-000000000001'::uuid AND '61000000-0000-0000-0000-000000000300'::uuid
UNION ALL SELECT 'documents', count(*) FROM documents
 WHERE tenant_id = '20000000-0000-0000-0000-000000000001'
   AND id BETWEEN '62000000-0000-0000-0000-000000000001'::uuid AND '62000000-0000-0000-0000-000000000300'::uuid
UNION ALL SELECT 'document_versions', count(*) FROM document_versions
 WHERE tenant_id = '20000000-0000-0000-0000-000000000001'
   AND id BETWEEN '63000000-0000-0000-0000-000000000001'::uuid AND '63000000-0000-0000-0000-000000000300'::uuid
UNION ALL SELECT 'clinical_document_links', count(*) FROM clinical_document_links
 WHERE tenant_id = '20000000-0000-0000-0000-000000000001'
   AND document_id BETWEEN '62000000-0000-0000-0000-000000000001'::uuid AND '62000000-0000-0000-0000-000000000300'::uuid;
'@
