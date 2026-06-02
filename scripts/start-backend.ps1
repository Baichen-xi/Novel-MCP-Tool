$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Root "backend"
$AppDataRoot = if ($env:APPDATA) { $env:APPDATA } else { Join-Path $env:USERPROFILE "AppData\Roaming" }
$DataDir = Join-Path $AppDataRoot "local.novel.cockpit"

New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
$env:NOVEL_COCKPIT_DB = Join-Path $DataDir "novel.db"

Set-Location $Backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8765
