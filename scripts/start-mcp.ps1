$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Root "backend"
$McpExe = Join-Path $Backend "dist\novel-cockpit-mcp.exe"
$AppDataRoot = if ($env:APPDATA) { $env:APPDATA } else { Join-Path $env:USERPROFILE "AppData\Roaming" }
$DataDir = Join-Path $AppDataRoot "local.novel.cockpit"

New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
$env:NOVEL_COCKPIT_DB = Join-Path $DataDir "novel.db"
$env:PYTHONUTF8 = "1"
$env:FASTMCP_SHOW_SERVER_BANNER = "false"
$env:FASTMCP_LOG_ENABLED = "false"

if (Test-Path $McpExe) {
    & $McpExe 2>$null
} else {
    Set-Location $Backend
    python -m app.mcp_server 2>$null
}
