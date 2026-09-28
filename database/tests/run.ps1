param([string]$Image = 'postgres:17-alpine')

$ErrorActionPreference = 'Stop'
$databaseDirectory = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$containerName = 'nexodocs-test-' + [guid]::NewGuid().ToString('N').Substring(0, 12)
$testJobs = @()

function Invoke-Docker {
    param([string[]]$DockerArguments, [switch]$AllowFailure)
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $commandOutput = & docker @DockerArguments 2>&1
        $commandExit = $LASTEXITCODE
    } finally { $ErrorActionPreference = $previousPreference }
    $result = [pscustomobject]@{ ExitCode = $commandExit; Output = ($commandOutput | Out-String).Trim() }
    if (!$AllowFailure -and $commandExit -ne 0) { throw $result.Output }
    return $result
}
function Invoke-Sql {
    param([string]$Database, [string]$Sql, [string]$User = 'postgres')
    $result = Invoke-Docker -DockerArguments @('exec', $containerName, 'psql', '-X', '-U', $User, '-d', $Database, '-v', 'ON_ERROR_STOP=1', '-At', '-c', $Sql)
    return $result.Output
}
function Invoke-SqlFile {
    param([string]$Database, [string]$File)
    return Invoke-Docker -DockerArguments @('exec', $containerName, 'psql', '-X', '-U', 'postgres', '-d', $Database, '-v', 'ON_ERROR_STOP=1', '-f', $File)
}
function Assert-Equal {
    param($Actual, $Expected, [string]$Message)
    if ($Actual -cne $Expected) { throw "$Message. Esperado: $Expected. Recibido: $Actual" }
}
function Initialize-LegacyDatabase {
    param([string]$Database)
    $null = Invoke-Docker -DockerArguments @('exec', $containerName, 'createdb', '-U', 'postgres', $Database)
    foreach ($file in @('001_schema.sql', '002_security.sql', '003_seed.sql')) {
        $null = Invoke-SqlFile -Database $Database -File "/workspace/init/$file"
    }
}

try {
    $startedContainer = Invoke-Docker -DockerArguments @('run', '--detach', '--name', $containerName,
        '--label', 'nexodocs.purpose=database-test', '--network', 'none',
        '--env', 'POSTGRES_HOST_AUTH_METHOD=trust', '--env', 'POSTGRES_DB=fresh',
        '--tmpfs', '/var/lib/postgresql/data',
        '--mount', "type=bind,source=$databaseDirectory,target=/workspace,readonly",
        '--mount', "type=bind,source=$databaseDirectory/init,target=/docker-entrypoint-initdb.d,readonly", $Image)

    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        $probe = Invoke-Docker -AllowFailure -DockerArguments @('exec', $containerName, 'psql', '-U', 'postgres', '-d', 'fresh', '-At', '-c', "SELECT count(*) FROM app.schema_migrations WHERE version = '017_revoked_access_tokens'")
        if ($probe.ExitCode -eq 0 -and $probe.Output -eq '1') { $ready = $true; break }
        Start-Sleep -Milliseconds 500
    }
    if (!$ready) { throw 'La inicialización Docker no terminó correctamente.' }
    $fresh = Invoke-SqlFile -Database 'fresh' -File '/workspace/tests/validate.sql'
    if (!$fresh.Output.Contains('VALIDATION_OK')) { throw $fresh.Output }
    Write-Output 'Inicialización Docker desde cero + VALIDATION_OK'

    Initialize-LegacyDatabase -Database 'upgrade'
    $fingerprintSql = @'
SELECT md5(string_agg(row_data, '' ORDER BY row_data)) FROM (
 SELECT 'documents:' || to_jsonb(d)::text AS row_data FROM documents d
 UNION ALL SELECT 'versions:' || to_jsonb(v)::text FROM document_versions v
 UNION ALL SELECT 'users:' || to_jsonb(u)::text FROM users u
 UNION ALL SELECT 'tenants:' || to_jsonb(t)::text FROM tenants t
) records;
'@
    $before = Invoke-Sql -Database 'upgrade' -Sql $fingerprintSql
    $null = Invoke-SqlFile -Database 'upgrade' -File '/workspace/init/004_saas_hardening.sql'
    Assert-Equal (Invoke-Sql -Database 'upgrade' -Sql $fingerprintSql) $before 'La migración alteró datos de negocio ya coherentes'
    foreach ($file in @('005_demo_users.sql', '006_password_recovery.sql', '007_tenant_user_management.sql', '008_tenant_status_compatibility.sql', '009_clinical_domain_extensions.sql', '010_medical_notes.sql', '011_persistent_auth_sessions.sql', '012_http_access_audit.sql', '013_document_checksum_compatibility.sql', '014_auth_user_password_hash_privilege.sql', '015_acme_superadmin_demo_users.sql', '016_finocode_tenant_name.sql', '017_revoked_access_tokens.sql')) {
        $null = Invoke-SqlFile -Database 'upgrade' -File "/workspace/init/$file"
    }
    $afterMigrations = Invoke-Sql -Database 'upgrade' -Sql $fingerprintSql
    foreach ($file in @('004_saas_hardening.sql', '005_demo_users.sql', '006_password_recovery.sql', '007_tenant_user_management.sql', '008_tenant_status_compatibility.sql', '009_clinical_domain_extensions.sql', '010_medical_notes.sql', '011_persistent_auth_sessions.sql', '012_http_access_audit.sql', '013_document_checksum_compatibility.sql', '014_auth_user_password_hash_privilege.sql', '015_acme_superadmin_demo_users.sql', '016_finocode_tenant_name.sql', '017_revoked_access_tokens.sql')) {
        $null = Invoke-SqlFile -Database 'upgrade' -File "/workspace/init/$file"
    }
    Assert-Equal (Invoke-Sql -Database 'upgrade' -Sql 'SELECT count(*) FROM app.schema_migrations') '14' 'Repetición de migraciones'
    Assert-Equal (Invoke-Sql -Database 'upgrade' -Sql $fingerprintSql) $afterMigrations 'Repetición alteró datos'
    $upgrade = Invoke-SqlFile -Database 'upgrade' -File '/workspace/tests/validate.sql'
    if (!$upgrade.Output.Contains('VALIDATION_OK')) { throw $upgrade.Output }
    Write-Output 'Actualización incremental, conservación de datos e idempotencia + VALIDATION_OK'

    Initialize-LegacyDatabase -Database 'invalid_data'
    $null = Invoke-Sql -Database 'invalid_data' -Sql "INSERT INTO users(tenant_id,username,email,password_hash,first_name,last_name) SELECT tenant_id,'duplicate.case',upper(email),password_hash,first_name,last_name FROM users WHERE username='laura.martinez'"
    $invalid = Invoke-Docker -AllowFailure -DockerArguments @('exec', $containerName, 'psql', '-X', '-U', 'postgres', '-d', 'invalid_data', '-v', 'ON_ERROR_STOP=1', '-f', '/workspace/init/004_saas_hardening.sql')
    if ($invalid.ExitCode -eq 0 -or !$invalid.Output.Contains('uq_users_tenant_email_normalized')) { throw 'La migración no rechazó el correo ambiguo como se esperaba.' }
    Assert-Equal (Invoke-Sql -Database 'invalid_data' -Sql "SELECT to_regclass('app.schema_migrations') IS NULL AND (SELECT count(*)=5 FROM users)") 't' 'Rollback de migración fallida'
    Write-Output 'Datos incompatibles: rechazo y rollback completo OK'

    # Conexión real sin superusuario: SET ROLE desde una sesión postgres no basta
    # para demostrar que el login de aplicación no puede asumir roles privilegiados.
    $null = Invoke-Sql -Database 'fresh' -Sql 'CREATE ROLE nexodocs_test_login LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS; GRANT nexodocs_app TO nexodocs_test_login;'
    $loginSql = @'
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-0000-0000-000000000001',true);
SELECT set_config('app.user_id','40000000-0000-0000-0000-000000000001',true);
DO $$ BEGIN IF (SELECT count(*) FROM documents) <> 1 THEN RAISE EXCEPTION 'Login sin aislamiento'; END IF; END $$;
COMMIT;
DO $$ BEGIN
 IF app.current_tenant_id() IS NOT NULL OR app.current_user_id() IS NOT NULL OR (SELECT count(*) FROM documents) <> 0 THEN
   RAISE EXCEPTION 'Contexto filtrado a la siguiente transacción';
 END IF;
END $$;
'@
    $null = Invoke-Sql -Database 'fresh' -User 'nexodocs_test_login' -Sql $loginSql
    foreach ($privilegedRole in @('nexodocs_platform_admin', 'nexodocs_security')) {
        $denied = Invoke-Docker -AllowFailure -DockerArguments @('exec', $containerName, 'psql', '-X', '-U', 'nexodocs_test_login', '-d', 'fresh', '-v', 'ON_ERROR_STOP=1', '-c', "SET ROLE $privilegedRole")
        if ($denied.ExitCode -eq 0 -or !$denied.Output.Contains('permission denied')) { throw "Escalada a $privilegedRole" }
    }
    Write-Output 'Login no privilegiado, separación de roles y limpieza transaccional OK'

    $writerSql = @'
BEGIN;
SELECT set_config('app.tenant_id','20000000-0000-0000-0000-000000000001',true);
SELECT set_config('app.user_id','40000000-0000-0000-0000-000000000001',true);
INSERT INTO document_versions(tenant_id,document_id,author_id,change_reason,content) VALUES
('20000000-0000-0000-0000-000000000001','55000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','Concurrencia','{}');
'@
    $jobScript = {
        param($TestContainer, $Statement)
        $outputText = & docker exec $TestContainer psql -X -U nexodocs_test_login -d fresh -v ON_ERROR_STOP=1 -c $Statement 2>&1
        [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = ($outputText | Out-String) }
    }
    $firstJob = Start-Job -ScriptBlock $jobScript -ArgumentList $containerName, ("SET application_name='nexodocs_writer_a';" + $writerSql + 'SELECT pg_sleep(8); COMMIT;')
    $testJobs += $firstJob
    $locked = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        if ((Invoke-Sql -Database 'fresh' -Sql "SELECT count(*) FROM pg_stat_activity WHERE application_name='nexodocs_writer_a' AND wait_event='PgSleep'") -eq '1') { $locked = $true; break }
        Start-Sleep -Milliseconds 200
    }
    if (!$locked) { throw 'El primer escritor no alcanzó la barrera de concurrencia.' }
    $secondJob = Start-Job -ScriptBlock $jobScript -ArgumentList $containerName, ("SET application_name='nexodocs_writer_b';" + $writerSql + 'COMMIT;')
    $testJobs += $secondJob
    $secondWaiting = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if ((Invoke-Sql -Database 'fresh' -Sql "SELECT count(*) FROM pg_stat_activity WHERE application_name='nexodocs_writer_b' AND wait_event_type='Lock'") -eq '1') { $secondWaiting = $true; break }
        Start-Sleep -Milliseconds 200
    }
    if (!$secondWaiting) { throw 'No se observó contención real entre los dos escritores.' }
    foreach ($job in $testJobs) {
        $finished = Wait-Job -Job $job -Timeout 20
        if (!$finished) { throw 'Timeout de la prueba concurrente.' }
        $jobResult = Receive-Job -Job $job
        if ($jobResult.ExitCode -ne 0) { throw $jobResult.Output }
    }
    Assert-Equal (Invoke-Sql -Database 'fresh' -Sql "SELECT current_version=3 AND (SELECT count(*)=3 AND max(version_number)=3 FROM document_versions WHERE document_id=d.id) FROM documents d WHERE id='55000000-0000-0000-0000-000000000001'") 't' 'Dos escritores deben producir versiones 2 y 3'
    Write-Output 'Dos conexiones concurrentes: versiones consecutivas sin pérdida OK'
    Write-Output 'DATABASE_TESTS_OK'
} catch {
    $logs = Invoke-Docker -AllowFailure -DockerArguments @('logs', '--tail', '30', $containerName)
    Write-Output $logs.Output
    throw
} finally {
    foreach ($job in $testJobs) { Stop-Job -Job $job -ErrorAction SilentlyContinue; Remove-Job -Job $job -Force -ErrorAction SilentlyContinue }
    # Solo se elimina el contenedor creado por esta ejecución, validando su etiqueta.
    $inspection = Invoke-Docker -AllowFailure -DockerArguments @('inspect', $containerName)
    if ($inspection.ExitCode -eq 0) {
        $containerInfo = ($inspection.Output | ConvertFrom-Json)[0]
        if ($containerInfo.Id -eq $startedContainer.Output -and $containerInfo.Config.Labels.'nexodocs.purpose' -eq 'database-test') {
            $null = Invoke-Docker -DockerArguments @('rm', '--force', $containerName)
        } else { Write-Warning 'No se eliminó el contenedor: su identidad o etiqueta no coincide.' }
    }
}
