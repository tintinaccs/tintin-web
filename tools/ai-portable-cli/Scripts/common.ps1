# common.ps1 - funciones compartidas por setup.ps1, launcher.ps1, diagnostics.ps1 y cleanup.ps1
#
# Todo lo que toca el sistema host (env vars, procesos, archivos fuera del pendrive)
# pasa por las funciones de este archivo, para que quede en un solo lugar auditable.

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor Cyan
}

function Write-Info    { param([string]$Message) Write-Host "[i] $Message" -ForegroundColor Gray }
function Write-Ok      { param([string]$Message) Write-Host "[OK] $Message" -ForegroundColor Green }
function Write-WarnMsg { param([string]$Message) Write-Host "[!] $Message" -ForegroundColor Yellow }
function Write-ErrMsg  { param([string]$Message) Write-Host "[X] $Message" -ForegroundColor Red }

# Estructura de carpetas portable. $Root es la raiz detectada dinamicamente
# (la carpeta donde vive AI-Portable.exe), nunca una letra de unidad fija.
function Get-PortablePaths {
    param([Parameter(Mandatory)][string]$Root)

    [PSCustomObject]@{
        Root            = $Root
        ClaudeBin       = Join-Path $Root "Claude\bin"
        ClaudeExe       = Join-Path $Root "Claude\bin\claude.exe"
        CodexBin        = Join-Path $Root "Codex\bin"
        CodexExe        = Join-Path $Root "Codex\bin\codex.exe"
        ConfigClaude    = Join-Path $Root "Config\Claude"
        ConfigCodex     = Join-Path $Root "Config\Codex"
        RuntimeNode     = Join-Path $Root "Runtime\Node"
        RuntimeState    = Join-Path $Root "Config\.runtime-state.json"
        Scripts         = Join-Path $Root "Scripts"
    }
}

function Ensure-PortableFolders {
    param([Parameter(Mandatory)]$Paths)
    $dirs = @(
        $Paths.ClaudeBin, $Paths.CodexBin,
        $Paths.ConfigClaude, $Paths.ConfigCodex,
        (Join-Path $Paths.Root "Runtime")
    )
    foreach ($d in $dirs) {
        if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
    }
}

function Test-CommandOnPath {
    param([Parameter(Mandatory)][string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

# Aplica PATH y variables de entorno SOLO al proceso PowerShell actual.
# Nunca usa setx, nunca escribe en el registro, nunca toca el PATH de usuario/sistema.
# Los hijos que lancemos (cmd.exe, powershell.exe, claude.exe, codex.exe) heredan
# este entorno de proceso; al cerrar esa terminal, el entorno desaparece con ella.
function Set-SessionEnvironment {
    param(
        [Parameter(Mandatory)]$Paths,
        [switch]$IncludeClaude,
        [switch]$IncludeCodex
    )

    $prependPaths = @()

    if ($IncludeClaude) {
        $env:CLAUDE_CONFIG_DIR = $Paths.ConfigClaude
        $prependPaths += $Paths.ClaudeBin
    }
    if ($IncludeCodex) {
        $env:CODEX_HOME = $Paths.ConfigCodex
        $prependPaths += $Paths.CodexBin
    }
    if (Test-Path $Paths.RuntimeNode) {
        $prependPaths += $Paths.RuntimeNode
    }

    foreach ($p in $prependPaths) {
        if ($env:Path -notlike "*$p*") {
            $env:Path = "$p;$env:Path"
        }
    }
}

# --- Estado de runtime (para que cleanup.ps1 sepa que fue creado por nosotros) ---

function Get-RuntimeState {
    param([Parameter(Mandatory)]$Paths)
    if (Test-Path $Paths.RuntimeState) {
        try { return Get-Content $Paths.RuntimeState -Raw | ConvertFrom-Json } catch { }
    }
    return [PSCustomObject]@{
        ClaudeJsonPreexisted = $null
        SpawnedProcessIds    = @()
    }
}

function Save-RuntimeState {
    param([Parameter(Mandatory)]$Paths, [Parameter(Mandatory)]$State)
    $State | ConvertTo-Json -Depth 5 | Set-Content -Path $Paths.RuntimeState -Encoding UTF8
}

# ~/.claude.json vive FUERA de CLAUDE_CONFIG_DIR (es un archivo de estado en la
# raiz del perfil de Windows, no dentro de la carpeta de config). Registramos si
# ya existia ANTES de que nuestro launcher tocara nada, para poder decidir en el
# cleanup si es seguro borrarlo (solo si lo creamos nosotros en esta sesion).
function Get-HostClaudeJsonPath {
    return (Join-Path $env:USERPROFILE ".claude.json")
}
