# cleanup.ps1 - limpieza al cerrar el launcher.
#
# Reglas duras (no negociables):
#   - Nunca se toco PATH/registro del sistema (solo variables de proceso), asi que
#     no hay nada que "restaurar" a nivel de sistema operativo.
#   - Solo se eliminan archivos que ESTE launcher creo en esta sesion. Nunca se
#     borra algo que ya existia antes de que el pendrive se conectara.
#   - No se tocan Claude\, Codex\ ni Config\ en el pendrive: esa es la instalacion
#     portable, y debe permanecer intacta para la proxima vez.

param(
    [Parameter(Mandatory)][string]$Root
)

. (Join-Path $PSScriptRoot "common.ps1")
$Paths = Get-PortablePaths -Root $Root

Write-Section "Limpieza"

$state = Get-RuntimeState -Paths $Paths

# 1) Cerrar procesos de terminal que este launcher abrio y que sigan vivos.
foreach ($procId in @($state.SpawnedProcessIds)) {
    $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Info "Cerrando terminal residual (PID $procId)..."
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
}
$state.SpawnedProcessIds = @()

# 2) ~/.claude.json: solo se borra si NO existia antes de esta sesion (es decir,
#    si lo creamos nosotros al ejecutar el binario portable de Claude Code).
$hostClaudeJson = Get-HostClaudeJsonPath
if ($state.ClaudeJsonPreexisted -eq $false -and (Test-Path $hostClaudeJson)) {
    Remove-Item $hostClaudeJson -Force -ErrorAction SilentlyContinue
    Write-Ok "Eliminado $hostClaudeJson (creado por esta sesion; no existia antes)."
} elseif (Test-Path $hostClaudeJson) {
    Write-Info "$hostClaudeJson ya existia antes de esta sesion: no se toca."
}

Save-RuntimeState -Paths $Paths -State $state

Write-Ok "Limpieza completa. La configuracion y credenciales permanecen en el pendrive (Config\)."
Write-Info "Al retirar el pendrive, 'claude' y 'codex' dejan de existir como comandos en este PC."
