$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Root "backend"
$Dist = Join-Path $Backend "dist"

Set-Location $Backend

python -m pip show pyinstaller *> $null
if ($LASTEXITCODE -ne 0) {
    python -m pip install pyinstaller
}

New-Item -ItemType Directory -Force -Path $Dist | Out-Null
$BackendExe = Join-Path $Dist "novel-cockpit-backend.exe"
$McpExe = Join-Path $Dist "novel-cockpit-mcp.exe"
foreach ($Exe in @($BackendExe, $McpExe)) {
    if (Test-Path $Exe) {
        Remove-Item -LiteralPath $Exe -Force
    }
}

python -m PyInstaller `
    --clean `
    --noconfirm `
    --onefile `
    --name novel-cockpit-backend `
    --paths $Backend `
    --copy-metadata fastmcp `
    --copy-metadata fastmcp-slim `
    --hidden-import app.main `
    --hidden-import app.mcp_server `
    --hidden-import fastmcp `
    app\standalone.py

python -m PyInstaller `
    --clean `
    --noconfirm `
    --onefile `
    --name novel-cockpit-mcp `
    --paths $Backend `
    --copy-metadata fastmcp `
    --copy-metadata fastmcp-slim `
    --hidden-import app.mcp_server `
    --hidden-import fastmcp `
    app\mcp_standalone.py

if (!(Test-Path $BackendExe)) {
    throw "Backend executable was not created: $BackendExe"
}
if (!(Test-Path $McpExe)) {
    throw "MCP executable was not created: $McpExe"
}

Write-Host "Backend executable created: $BackendExe"
Write-Host "MCP executable created: $McpExe"
