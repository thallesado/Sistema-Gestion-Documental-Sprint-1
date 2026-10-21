$ErrorActionPreference = 'Stop'
$neonUrl = 'postgresql://neondb_owner:npg_k2zSxB3MPLEq@ep-lucky-dream-b436bm6l-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require'
$psql = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'

$files = Get-ChildItem 'database/init/*.sql' | Where-Object {
    $_.Name -match '^\d{3}_' -and [int]($_.Name.Substring(0,3)) -ge 42
} | Sort-Object Name

foreach ($file in $files) {
    Write-Host ">>> Aplicando $($file.Name)..."
    & $psql $neonUrl -v ON_ERROR_STOP=1 -f $file.FullName
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Fallo en $($file.Name)"
        exit 1
    }
}

Write-Host ">>> TODAS LAS MIGRACIONES 042-047 APLICADAS CORRECTAMENTE EN NEON."
