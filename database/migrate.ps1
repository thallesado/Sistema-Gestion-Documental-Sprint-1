param(
    [string]$ProjectName = 'nexodocs',
    [string]$Service = 'postgres'
)

$ErrorActionPreference = 'Stop'
$repositoryDirectory = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$composeFile = Join-Path $repositoryDirectory 'infrastructure/docker-compose.yml'
$composeArguments = @('--project-name', $ProjectName, '--project-directory', $repositoryDirectory, '--file', $composeFile)

function Invoke-Compose {
    param([string[]]$CommandArguments)
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & docker compose @composeArguments @CommandArguments
        $commandExit = $LASTEXITCODE
    } finally { $ErrorActionPreference = $previousPreference }
    if ($commandExit -ne 0) { throw "Falló docker compose $($CommandArguments -join ' ') (código $commandExit)." }
}

# Garantiza la disponibilidad de la base sin reinicializar ni eliminar su volumen.
Invoke-Compose -CommandArguments @('up', '-d', '--wait', $Service)

# Respaldo recuperable antes de cambiar el esquema.
$databaseUser = (& docker compose @composeArguments exec -T $Service printenv POSTGRES_USER).Trim()
$databaseName = (& docker compose @composeArguments exec -T $Service printenv POSTGRES_DB).Trim()
if ($LASTEXITCODE -ne 0 -or !$databaseUser -or !$databaseName) {
    throw 'No se pudieron resolver las credenciales internas de PostgreSQL.'
}
$backupDirectory = Join-Path $PSScriptRoot 'backups'
$null = New-Item -ItemType Directory -Path $backupDirectory -Force
$backupName = 'before-migrations-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8) + '.dump'
$remoteBackup = '/tmp/' + $backupName
$localBackup = Join-Path $backupDirectory $backupName
Invoke-Compose -CommandArguments @('exec', '-T', $Service, 'pg_dump', '-U', $databaseUser, '-d', $databaseName, '--format=custom', '--file', $remoteBackup)
Invoke-Compose -CommandArguments @('exec', '-T', $Service, 'pg_restore', '--list', $remoteBackup)
Invoke-Compose -CommandArguments @('cp', ($Service + ':' + $remoteBackup), $localBackup)
if (!(Test-Path -LiteralPath $localBackup) -or (Get-Item -LiteralPath $localBackup).Length -eq 0) {
    throw 'No se creó un respaldo local válido; no se aplicaron migraciones.'
}
Invoke-Compose -CommandArguments @('exec', '-T', $Service, 'rm', '--', $remoteBackup)
Write-Output "Respaldo previo: $localBackup"

# El runner ejecuta exclusivamente migraciones no registradas y nunca 001-003.
Invoke-Compose -CommandArguments @('up', '--build', '--force-recreate', '--no-deps', 'migrate')
Write-Output 'MIGRATIONS_OK'
