# SOLO para el Compose local de desarrollo; no ejecutar en producción.
# El rol aprovisionador puede crear bases y leer/mover datos de tenants para completar una migración.
$ErrorActionPreference = 'Stop'

$root = (git rev-parse --show-toplevel).Trim()
$envPath = Join-Path $root '.env'
$sqlPath = Join-Path $env:TEMP 'nexodocs-local-tenant-roles.sql'
$containerSql = '/tmp/nexodocs-local-tenant-roles.sql'
$container = 'nexodocs-postgres-1'

if (-not (Test-Path -LiteralPath $envPath)) {
    throw 'No existe el .env local del proyecto.'
}

$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$runtimeBytes = New-Object byte[] 32
$adminBytes = New-Object byte[] 32
$rng.GetBytes($runtimeBytes)
$rng.GetBytes($adminBytes)
$rng.Dispose()
$runtimePassword = [BitConverter]::ToString($runtimeBytes).Replace('-', '').ToLowerInvariant()
$adminPassword = [BitConverter]::ToString($adminBytes).Replace('-', '').ToLowerInvariant()

$sql = @'
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='nexodocs_runtime') THEN
    CREATE ROLE nexodocs_runtime;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='nexodocs_tenant_provisioner') THEN
    CREATE ROLE nexodocs_tenant_provisioner;
  END IF;
END $$;
ALTER ROLE nexodocs_runtime WITH LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD '__RUNTIME_PASSWORD__';
GRANT nexodocs_app TO nexodocs_runtime;
GRANT CONNECT ON DATABASE nexodocs TO nexodocs_runtime;
ALTER ROLE nexodocs_tenant_provisioner WITH LOGIN INHERIT NOSUPERUSER CREATEDB NOCREATEROLE BYPASSRLS PASSWORD '__ADMIN_PASSWORD__';
GRANT nexodocs_app, nexodocs_security, nexodocs_platform_admin TO nexodocs_tenant_provisioner;
GRANT SET ON PARAMETER session_replication_role TO nexodocs_tenant_provisioner;
GRANT CONNECT, TEMPORARY ON DATABASE nexodocs TO nexodocs_tenant_provisioner;
GRANT USAGE, CREATE ON SCHEMA public, app TO nexodocs_tenant_provisioner;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public, app TO nexodocs_tenant_provisioner;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public, app TO nexodocs_tenant_provisioner;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public, app TO nexodocs_tenant_provisioner;
'@
$sql = $sql.Replace('__RUNTIME_PASSWORD__', $runtimePassword).Replace('__ADMIN_PASSWORD__', $adminPassword)
Set-Content -LiteralPath $sqlPath -Value $sql -Encoding Ascii

try {
    docker cp $sqlPath "${container}:${containerSql}" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo pasar la configuración SQL al contenedor.' }
    docker exec $container psql -X -v ON_ERROR_STOP=1 -U nexodocs -d nexodocs -f $containerSql
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL rechazó la creación de los roles locales.' }

    $settings = [ordered]@{
        DB_RUNTIME_USER = 'nexodocs_runtime'
        DB_RUNTIME_PASSWORD = $runtimePassword
        TENANT_DATABASE_ADMIN_USERNAME = 'nexodocs_tenant_provisioner'
        TENANT_DATABASE_ADMIN_PASSWORD = $adminPassword
        TENANT_DATABASE_ROUTING_ENABLED = 'true'
        TENANT_DATABASE_ISOLATION_ENABLED = 'true'
        TENANT_DATABASE_PROVISIONING_ENABLED = 'true'
        COMPOSE_PROFILES = 'tenant-isolation'
    }
    $lines = [System.Collections.Generic.List[string]]::new()
    foreach ($line in (Get-Content -LiteralPath $envPath)) {
        if ($line -notmatch '^([^#=]+)=') { $lines.Add($line); continue }
        if (-not $settings.Contains($matches[1])) { $lines.Add($line) }
    }
    foreach ($key in $settings.Keys) { $lines.Add("$key=$($settings[$key])") }
    Set-Content -LiteralPath $envPath -Value $lines -Encoding Ascii
    Write-Output 'Roles restringidos creados y configuración local activada; no se imprimieron credenciales.'
}
finally {
    docker exec $container rm -f $containerSql 2>$null | Out-Null
    Remove-Item -LiteralPath $sqlPath -Force -ErrorAction SilentlyContinue
}
