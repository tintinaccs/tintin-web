# diagnostics.ps1 - verificacion de solo lectura del entorno portable. No modifica nada.

param(
    [Parameter(Mandatory)][string]$Root
)

. (Join-Path $PSScriptRoot "common.ps1")
$Paths = Get-PortablePaths -Root $Root

Write-Section "Diagnostico"

Write-Host ""
Write-Host "-- Raiz detectada --"
Write-Info $Paths.Root

Write-Host ""
Write-Host "-- Claude Code --"
if (Test-Path $Paths.ClaudeExe) {
    Write-Ok "Binario: $($Paths.ClaudeExe)"
    try {
        $v = & $Paths.ClaudeExe --version 2>$null
        Write-Info "Version: $v"
    } catch { Write-WarnMsg "No se pudo ejecutar --version." }
} else {
    Write-WarnMsg "Binario no encontrado en $($Paths.ClaudeExe)."
}
if (Test-Path (Join-Path $Paths.ConfigClaude ".credentials.json")) {
    Write-Ok "Credenciales presentes en Config\Claude\.credentials.json (contenido no se muestra)."
} else {
    Write-WarnMsg "Sin credenciales en Config\Claude. Ejecute la configuracion inicial."
}

Write-Host ""
Write-Host "-- Codex CLI --"
if (Test-Path $Paths.CodexExe) {
    Write-Ok "Binario: $($Paths.CodexExe)"
    try {
        $v = & $Paths.CodexExe --version 2>$null
        Write-Info "Version: $v"
    } catch { Write-WarnMsg "No se pudo ejecutar --version." }
} else {
    Write-WarnMsg "Binario no encontrado en $($Paths.CodexExe)."
}
$codexConfig = Join-Path $Paths.ConfigCodex "config.toml"
if (Test-Path $codexConfig) {
    $storeMode = Select-String -Path $codexConfig -Pattern "cli_auth_credentials_store" -ErrorAction SilentlyContinue
    if ($storeMode) {
        Write-Ok "config.toml: $($storeMode.Line.Trim())"
    } else {
        Write-WarnMsg "config.toml existe pero no fija cli_auth_credentials_store (podria usar keyring de Windows, no portable)."
    }
} else {
    Write-WarnMsg "Sin Config\Codex\config.toml."
}
if (Test-Path (Join-Path $Paths.ConfigCodex "auth.json")) {
    Write-Ok "Credenciales presentes en Config\Codex\auth.json (contenido no se muestra)."
} else {
    Write-WarnMsg "Sin credenciales en Config\Codex. Ejecute la configuracion inicial."
}

Write-Host ""
Write-Host "-- Entorno host (solo lectura) --"
Write-Info "Node/npm en PATH del sistema: $(Test-CommandOnPath 'npm')"
Write-Info "Runtime\Node presente en el pendrive: $(Test-Path $Paths.RuntimeNode)"
$hostClaudeJson = Get-HostClaudeJsonPath
if (Test-Path $hostClaudeJson) {
    Write-Info "Existe $hostClaudeJson en este PC (metadata de Claude Code, no credenciales). No se toca salvo que este launcher lo haya creado hoy."
} else {
    Write-Info "No existe $hostClaudeJson en este PC."
}

Write-Host ""
Write-Host "-- Conectividad (solo prueba TCP 443, no se envian datos) --"
foreach ($h in @("claude.ai", "api.github.com", "registry.npmjs.org")) {
    $ok = Test-NetConnection -ComputerName $h -Port 443 -InformationLevel Quiet -WarningAction SilentlyContinue
    if ($ok) { Write-Ok "$h alcanzable" } else { Write-WarnMsg "$h NO alcanzable" }
}

Write-Host ""
Write-Host "-- Espacio libre en la unidad del pendrive --"
$drive = (Get-Item $Paths.Root).PSDrive
if ($drive) {
    $freeGB = [math]::Round($drive.Free / 1GB, 2)
    Write-Info "Unidad $($drive.Name): $freeGB GB libres"
}
