# launcher.ps1 - punto de entrada real del entorno portable (invocado por AI-Portable.exe).
#
# Menu unico que cubre tanto "primera ejecucion" (configurar/loguear Claude y/o Codex)
# como "uso normal" (abrir una terminal ya lista con `claude` o `codex` disponibles).

param(
    [Parameter(Mandatory)][string]$Root
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")
. (Join-Path $PSScriptRoot "setup.ps1")

$Paths = Get-PortablePaths -Root $Root
Ensure-PortableFolders -Paths $Paths

# Registrar si ~/.claude.json ya existia ANTES de que este launcher tocara nada.
# cleanup.ps1 usa esto para decidir si es seguro borrarlo al terminar (regla:
# nunca borrar algo que no creamos nosotros).
$state = Get-RuntimeState -Paths $Paths
if ($null -eq $state.ClaudeJsonPreexisted) {
    $state.ClaudeJsonPreexisted = Test-Path (Get-HostClaudeJsonPath)
    Save-RuntimeState -Paths $Paths -State $state
}

function Test-ClaudeReady { param($Paths) Test-Path $Paths.ClaudeExe }
function Test-CodexReady  { param($Paths) Test-Path $Paths.CodexExe }

function Open-Terminal {
    param(
        [Parameter(Mandatory)]$Paths,
        [switch]$WithClaude,
        [switch]$WithCodex
    )

    Set-SessionEnvironment -Paths $Paths -IncludeClaude:$WithClaude -IncludeCodex:$WithCodex

    $tools = @()
    if ($WithClaude) { $tools += "claude" }
    if ($WithCodex)  { $tools += "codex" }
    Write-Ok "Entorno preparado para: $($tools -join ', ')"
    Write-Info "PATH y variables de entorno aplicados SOLO a esta terminal (proceso hijo)."
    Write-Info "Escriba $($tools -join ' o ') para empezar. Cierre la ventana para salir."

    # Se lanza una terminal HIJA con el entorno ya inyectado (heredado por el
    # proceso hijo). No se usa setx ni se escribe en el registro: al cerrar esta
    # ventana, el PATH/variables desaparecen con ella.
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "powershell.exe"
    $psi.Arguments = "-NoExit -NoLogo -Command `"cd '$($Paths.Root)'`""
    $psi.UseShellExecute = $false
    $proc = [System.Diagnostics.Process]::Start($psi)

    $state = Get-RuntimeState -Paths $Paths
    $state.SpawnedProcessIds = @($state.SpawnedProcessIds) + $proc.Id
    Save-RuntimeState -Paths $Paths -State $state

    Write-Info "Terminal abierta (PID $($proc.Id)). Esperando a que la cierre..."
    $proc.WaitForExit()
    Write-Info "Terminal cerrada."
}

function Show-SetupMenu {
    param($Paths)
    while ($true) {
        Write-Section "AI PORTABLE SETUP"
        Write-Host "[1] Configurar Claude Code"
        Write-Host "[2] Configurar Codex"
        Write-Host "[3] Configurar ambos"
        Write-Host "[4] Diagnostico"
        Write-Host "[5] Volver"
        $choice = Read-Host "Seleccione una opcion"
        switch ($choice) {
            "1" { Setup-Claude -Paths $Paths | Out-Null }
            "2" { Setup-Codex  -Paths $Paths | Out-Null }
            "3" { Setup-Claude -Paths $Paths | Out-Null; Setup-Codex -Paths $Paths | Out-Null }
            "4" { & (Join-Path $PSScriptRoot "diagnostics.ps1") -Root $Root }
            "5" { return }
            default { Write-WarnMsg "Opcion invalida." }
        }
    }
}

while ($true) {
    Write-Section "AI PORTABLE - LAUNCHER"
    $claudeStatus = if (Test-ClaudeReady $Paths) { "listo" } else { "no configurado" }
    $codexStatus  = if (Test-CodexReady  $Paths) { "listo" } else { "no configurado" }
    Write-Host "Claude Code: $claudeStatus   |   Codex: $codexStatus"
    Write-Host ""
    Write-Host "[1] Usar Claude Code"
    Write-Host "[2] Usar Codex"
    Write-Host "[3] Usar Claude + Codex"
    Write-Host "[4] Configuracion inicial / Reconfigurar"
    Write-Host "[5] Diagnostico"
    Write-Host "[6] Salir"
    $choice = Read-Host "Seleccione una opcion"

    switch ($choice) {
        "1" {
            if (-not (Test-ClaudeReady $Paths)) {
                Write-WarnMsg "Claude Code no esta configurado todavia."
                Setup-Claude -Paths $Paths | Out-Null
            }
            if (Test-ClaudeReady $Paths) { Open-Terminal -Paths $Paths -WithClaude }
        }
        "2" {
            if (-not (Test-CodexReady $Paths)) {
                Write-WarnMsg "Codex no esta configurado todavia."
                Setup-Codex -Paths $Paths | Out-Null
            }
            if (Test-CodexReady $Paths) { Open-Terminal -Paths $Paths -WithCodex }
        }
        "3" {
            if (-not (Test-ClaudeReady $Paths)) { Setup-Claude -Paths $Paths | Out-Null }
            if (-not (Test-CodexReady  $Paths)) { Setup-Codex  -Paths $Paths | Out-Null }
            if ((Test-ClaudeReady $Paths) -or (Test-CodexReady $Paths)) {
                Open-Terminal -Paths $Paths -WithClaude:(Test-ClaudeReady $Paths) -WithCodex:(Test-CodexReady $Paths)
            }
        }
        "4" { Show-SetupMenu -Paths $Paths }
        "5" { & (Join-Path $PSScriptRoot "diagnostics.ps1") -Root $Root }
        "6" {
            & (Join-Path $PSScriptRoot "cleanup.ps1") -Root $Root
            exit 0
        }
        default { Write-WarnMsg "Opcion invalida." }
    }
}
