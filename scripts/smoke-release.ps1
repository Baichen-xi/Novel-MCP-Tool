param(
    [switch]$LaunchDesktop
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ReleaseDir = Join-Path $Root "frontend\src-tauri\target\release"
$BundleDir = Join-Path $ReleaseDir "_up_\_up_\backend\dist"
$TempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("novel-cockpit-release-smoke-" + [System.Guid]::NewGuid().ToString("N"))
$BackendLog = Join-Path $TempDir "backend.log"
$BackendErrorLog = Join-Path $TempDir "backend.err.log"
$DbPath = Join-Path $TempDir "smoke.db"
$McpDbPath = Join-Path $TempDir "mcp-smoke.db"
$BackendProcess = $null
$DesktopProcess = $null

function Assert-File {
    param(
        [string]$Path,
        [string]$Label
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "$Label not found: $Path"
    }

    Write-Host "[ok] $Label -> $Path"
}

function Stop-BackendProcesses {
    param([string]$BackendExePath)

    if ($BackendProcess -and -not $BackendProcess.HasExited) {
        Stop-Process -Id $BackendProcess.Id -Force -ErrorAction SilentlyContinue
        $BackendProcess.WaitForExit()
    }

    Get-Process -Name "novel-cockpit-backend" -ErrorAction SilentlyContinue |
        Where-Object { $_.Path -eq $BackendExePath } |
        Stop-Process -Force -ErrorAction SilentlyContinue
}

function Get-FreePort {
    $Listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
    $Listener.Start()
    try {
        return ([System.Net.IPEndPoint]$Listener.LocalEndpoint).Port
    }
    finally {
        $Listener.Stop()
    }
}

function Wait-Api {
    param(
        [int]$Port,
        [int]$TimeoutSeconds = 25
    )

    $Deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $LastError = $null
    while ((Get-Date) -lt $Deadline) {
        try {
            return Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/dashboard" -TimeoutSec 2
        }
        catch {
            $LastError = $_
            Start-Sleep -Milliseconds 500
        }
    }

    throw "Backend did not answer /api/dashboard on port $Port. Last error: $LastError"
}

function Test-DesktopLaunch {
    param([string]$DesktopExePath)

    if (Test-NetConnection -ComputerName 127.0.0.1 -Port 8765 -InformationLevel Quiet -WarningAction SilentlyContinue) {
        Write-Host "[skip] Desktop launch smoke skipped because 127.0.0.1:8765 is already in use"
        return
    }

    Write-Host "[run] Starting Tauri desktop exe for launch smoke"
    $script:DesktopProcess = Start-Process -FilePath $DesktopExePath -PassThru
    $Dashboard = Wait-Api -Port 8765 -TimeoutSeconds 30
    if (-not $Dashboard.project) {
        throw "Desktop-launched backend did not return project data"
    }
    Write-Host "[ok] Desktop exe auto-started backend on 127.0.0.1:8765"
}

function Invoke-McpHealthcheck {
    param(
        [string]$McpExe,
        [string]$DatabasePath
    )

    $McpScriptPath = Join-Path $TempDir "mcp-smoke.py"
    $McpOutPath = Join-Path $TempDir "mcp-smoke.out"
    $McpErrPath = Join-Path $TempDir "mcp-smoke.err"
    $Script = @"
import asyncio
import json
import os
from fastmcp import Client
from fastmcp.client.transports import StdioTransport

async def main():
    exe = os.environ["SMOKE_MCP_EXE"]
    db = os.environ["SMOKE_MCP_DB"]
    env = {
        **os.environ,
        "NOVEL_COCKPIT_DB": db,
        "PYTHONUTF8": "1",
        "FASTMCP_SHOW_SERVER_BANNER": "false",
        "FASTMCP_LOG_ENABLED": "false",
    }
    transport = StdioTransport(command=exe, args=[], env=env)
    async with Client(transport, init_timeout=30) as client:
        result = await client.call_tool("healthcheck", {})
        print(json.dumps(result.data, ensure_ascii=True))

asyncio.run(main())
"@

    Set-Content -LiteralPath $McpScriptPath -Value $Script -Encoding UTF8

    $OldSmokeMcpExe = $env:SMOKE_MCP_EXE
    $OldSmokeMcpDb = $env:SMOKE_MCP_DB
    $env:SMOKE_MCP_EXE = $McpExe
    $env:SMOKE_MCP_DB = $DatabasePath

    try {
        $Process = Start-Process -FilePath "python" -ArgumentList @($McpScriptPath) -NoNewWindow -PassThru -RedirectStandardOutput $McpOutPath -RedirectStandardError $McpErrPath
        if (-not $Process.WaitForExit(45000)) {
            Stop-Process -Id $Process.Id -Force
            throw "MCP healthcheck timed out after 45 seconds"
        }
        $Process.Refresh()
    }
    finally {
        $env:SMOKE_MCP_EXE = $OldSmokeMcpExe
        $env:SMOKE_MCP_DB = $OldSmokeMcpDb
    }

    $Output = if (Test-Path -LiteralPath $McpOutPath) { Get-Content -LiteralPath $McpOutPath -Raw } else { "" }
    $ErrorOutput = if (Test-Path -LiteralPath $McpErrPath) { Get-Content -LiteralPath $McpErrPath -Raw } else { "" }
    try {
        $Data = $Output | ConvertFrom-Json
    }
    catch {
        throw "MCP healthcheck returned invalid JSON. ExitCode=$($Process.ExitCode). Stdout=$Output Stderr=$ErrorOutput"
    }

    if (($null -ne $Process.ExitCode) -and $Process.ExitCode -ne 0) {
        throw "MCP healthcheck process failed with exit code $($Process.ExitCode): $ErrorOutput"
    }

    if ($Data.status -ne "ok") {
        throw "MCP healthcheck returned unexpected status: $Output"
    }

    Write-Host "[ok] MCP healthcheck -> $Output"
}

try {
    New-Item -ItemType Directory -Force -Path $TempDir | Out-Null

    $DesktopExe = Join-Path $ReleaseDir "novel-cockpit.exe"
    $Installer = Get-ChildItem -LiteralPath (Join-Path $ReleaseDir "bundle\nsis") -Filter "*_0.1.0_x64-setup.exe" |
        Select-Object -First 1 -ExpandProperty FullName
    $BundledBackendExe = Join-Path $BundleDir "novel-cockpit-backend.exe"
    $BundledMcpExe = Join-Path $BundleDir "novel-cockpit-mcp.exe"
    $RootBackendExe = Join-Path $Root "backend\dist\novel-cockpit-backend.exe"
    $RootMcpExe = Join-Path $Root "backend\dist\novel-cockpit-mcp.exe"

    Assert-File $DesktopExe "Tauri release exe"
    Assert-File $Installer "NSIS installer"
    Assert-File $BundledBackendExe "Bundled backend exe"
    Assert-File $BundledMcpExe "Bundled MCP exe"
    Assert-File $RootBackendExe "Root backend exe"
    Assert-File $RootMcpExe "Root MCP exe"

    $Port = Get-FreePort
    $OldDb = $env:NOVEL_COCKPIT_DB
    $OldPort = $env:NOVEL_COCKPIT_PORT
    $OldUtf8 = $env:PYTHONUTF8
    $env:NOVEL_COCKPIT_DB = $DbPath
    $env:NOVEL_COCKPIT_PORT = "$Port"
    $env:PYTHONUTF8 = "1"

    Write-Host "[run] Starting bundled backend on 127.0.0.1:$Port"
    $BackendProcess = Start-Process -FilePath $BundledBackendExe -NoNewWindow -PassThru -RedirectStandardOutput $BackendLog -RedirectStandardError $BackendErrorLog
    $Dashboard = Wait-Api -Port $Port
    if (-not $Dashboard.project) {
        throw "Dashboard response did not include project data"
    }
    Write-Host "[ok] Backend /api/dashboard -> project '$($Dashboard.project.title)'"

    Invoke-McpHealthcheck -McpExe $BundledMcpExe -DatabasePath $McpDbPath

    if ($LaunchDesktop) {
        Test-DesktopLaunch -DesktopExePath $DesktopExe
    }

    Write-Host "[done] Release smoke test passed"
}
finally {
    if ($DesktopProcess -and -not $DesktopProcess.HasExited) {
        Stop-Process -Id $DesktopProcess.Id -Force -ErrorAction SilentlyContinue
        $DesktopProcess.WaitForExit()
    }
    if (Get-Variable -Name BundledBackendExe -Scope Local -ErrorAction SilentlyContinue) {
        Stop-BackendProcesses -BackendExePath $BundledBackendExe
    }
    if (Get-Variable -Name RootBackendExe -Scope Local -ErrorAction SilentlyContinue) {
        Stop-BackendProcesses -BackendExePath $RootBackendExe
    }
    Start-Sleep -Milliseconds 800

    if (Get-Variable -Name OldDb -Scope Local -ErrorAction SilentlyContinue) {
        $env:NOVEL_COCKPIT_DB = $OldDb
        $env:NOVEL_COCKPIT_PORT = $OldPort
        $env:PYTHONUTF8 = $OldUtf8
    }

    if (Test-Path -LiteralPath $TempDir) {
        try {
            Remove-Item -LiteralPath $TempDir -Recurse -Force
        }
        catch {
            Write-Warning "Failed to clean smoke temp directory: $TempDir"
        }
    }
}
