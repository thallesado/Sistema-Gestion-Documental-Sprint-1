param([switch]$KeepDatabase,[switch]$Browser)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$container = 'nexodocs-operations-test-' + [guid]::NewGuid().ToString('N').Substring(0,10)
$oldUrl = $env:NEXODOCS_OPS_TEST_URL
$oldBrowser = $env:NEXODOCS_OPS_BROWSER
$env:NEXODOCS_OPS_BROWSER = $Browser.IsPresent.ToString().ToLowerInvariant()
$testConfig = Join-Path $env:TEMP ($container + '.yml')
$config = [IO.File]::ReadAllText((Join-Path $repo 'backend/bootstrap/src/main/resources/application.yml'))
$config = [regex]::Replace($config, '(?ms)^  config:\r?\n    import:.*?(?=^  jackson:)', '')
[IO.File]::WriteAllText($testConfig, $config)

function Docker-Checked([string[]]$Arguments) {
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { $output = & docker @Arguments 2>&1; $code = $LASTEXITCODE }
    finally { $ErrorActionPreference = $previousPreference }
    if ($code -ne 0) { throw ($output | Out-String) }
    return ($output | Out-String).Trim()
}
try {
    $null = Docker-Checked @('run','-d','--name',$container,'--label','nexodocs.purpose=document-operations-test',
      '--tmpfs','/var/lib/postgresql/data','--env','POSTGRES_HOST_AUTH_METHOD=trust','--env','POSTGRES_DB=operations_test',
      '-p','127.0.0.1::5432','--mount',"type=bind,source=$repo/database,target=/workspace/database,readonly",
      '--mount',"type=bind,source=$repo/infrastructure/docker/migrate.sh,target=/workspace/migrate.sh,readonly",
      '--mount',"type=bind,source=$repo/database/init/001_schema.sql,target=/docker-entrypoint-initdb.d/001.sql,readonly",
      '--mount',"type=bind,source=$repo/database/init/002_security.sql,target=/docker-entrypoint-initdb.d/002.sql,readonly",
      '--mount',"type=bind,source=$repo/database/init/003_seed.sql,target=/docker-entrypoint-initdb.d/003.sql,readonly",'postgres:17-alpine')
    $ready = $false
    for ($i=0;$i -lt 90;$i++) {
        $logs = Docker-Checked @('logs',$container)
        if ($logs.Contains('PostgreSQL init process complete')) {
            & docker exec $container pg_isready -U postgres -d operations_test *> $null
            if ($LASTEXITCODE -eq 0) { $ready=$true; break }
        }
        Start-Sleep -Milliseconds 500
    }
    if (!$ready) { throw 'La base aislada no terminó de inicializar.' }
    $result = Docker-Checked @('exec','--env','PGHOST=127.0.0.1','--env','PGDATABASE=operations_test','--env','PGUSER=postgres',
      '--env','MIGRATIONS_ROOT=/workspace/database',$container,'sh','-c',"tr -d '\r' </workspace/migrate.sh >/tmp/migrate.sh && sh /tmp/migrate.sh")
    $applied = Docker-Checked @('exec',$container,'psql','-X','-U','postgres','-d','operations_test','-At','-c',"SELECT count(*) FROM app.schema_migrations WHERE version='097_document_translations'")
    if ($applied -ne '1') { throw 'El migrador no registro el esquema esperado.' }
    $unsafe = Docker-Checked @('exec',$container,'psql','-X','-U','postgres','-d','operations_test','-At','-c',"SELECT count(*) FROM role_permissions x JOIN permissions p ON p.id=x.permission_id WHERE p.module='translation' AND NOT EXISTS (SELECT 1 FROM role_permissions a JOIN permissions q ON q.id=a.permission_id WHERE a.tenant_id=x.tenant_id AND a.role_id=x.role_id AND q.code='backup:configure')")
    if ($unsafe -ne '0') { throw 'Permisos de traduccion concedidos a roles no administradores.' }
    $null = Docker-Checked @('exec',$container,'psql','-X','-U','postgres','-d','operations_test','-v','ON_ERROR_STOP=1','-c',
      'CREATE ROLE ops_test_runtime LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS; GRANT nexodocs_app TO ops_test_runtime; GRANT CONNECT ON DATABASE operations_test TO ops_test_runtime;')
    $mapping = Docker-Checked @('port',$container,'5432/tcp')
    $testPort = ($mapping -split ':')[-1]
    $env:NEXODOCS_OPS_TEST_URL = "jdbc:postgresql://127.0.0.1:$testPort/operations_test"
    Write-Output 'Base efímera creada y migrada; pruebas con runtime sin privilegios administrativos.'
    Push-Location (Join-Path $repo 'backend')
    try {
      & mvn -q -pl bootstrap -am "-Dspring.config.location=file:$($testConfig.Replace('\','/'))" '-Dtest=DocumentOperationsIntegrationTest' '-Dsurefire.failIfNoSpecifiedTests=false' test
      if ($LASTEXITCODE -ne 0) { throw 'Falló la integración de operaciones documentales; consultar surefire-reports.' }
    } finally { Pop-Location }
    Write-Output 'DOCUMENT_OPERATIONS_INTEGRATION_OK'
} finally {
    $env:NEXODOCS_OPS_TEST_URL = $oldUrl
    $env:NEXODOCS_OPS_BROWSER = $oldBrowser
    Remove-Item -LiteralPath $testConfig -ErrorAction SilentlyContinue
    if (!$KeepDatabase) { & docker rm -f $container *> $null }
    else { Write-Output "Base de prueba preservada: $container" }
}
