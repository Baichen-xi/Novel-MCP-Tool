$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot

& (Join-Path $PSScriptRoot "build-backend-exe.ps1")

$Frontend = Join-Path $Root "frontend"
Set-Location $Frontend
npm run build
