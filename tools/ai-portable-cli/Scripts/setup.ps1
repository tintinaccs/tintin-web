# setup.ps1 - configuracion inicial de Claude Code y/o Codex CLI en el pendrive.
#
# Requisito de red: la ADQUISICION del binario (una sola vez) necesita internet.
# Claude Code: se instala via `npm --prefix` (no requiere Node en tiempo de ejecucion,
#   solo para descargarlo la primera vez), o copiando el binario nativo ya instalado
#   en el host (ver README, seccion "Instalacion manual").
# Codex CLI: se descarga el binario nativo directamente desde GitHub Releases
#   (openai/codex), sin necesidad de Node en absoluto.
#
# Ninguna de las dos rutas modifica PATH/registro del sistema: todo lo instalado
# queda dentro de $Root\Claude o $Root\Codex, en el propio pendrive.
#
# Este archivo SOLO define funciones (Setup-Claude, Setup-Codex). No ejecuta nada
# por si mismo: launcher.ps1 lo dot-sourcea y llama a las funciones cuando el
# usuario elige configurar cada herramienta.

function Get-NpmCommand {
    param($Paths)
    $portableNode = Join-Path $Paths.RuntimeNode "npm.cmd"
    if (Test-Path $portableNode) { return $portableNode }
    if (Test-CommandOnPath "npm") { return "npm" }
    return $null
}

function Setup-Claude {
    param($Paths)

    Write-Section "Configurar Claude Code"

    if (Test-Path $Paths.ClaudeExe) {
        Write-Ok "Ya existe un binario en $($Paths.ClaudeExe)."
        $reinstall = Read-Host "Reinstalar de todas formas? (s/N)"
        if ($reinstall -notin @("s", "S")) {
            Write-Info "Se mantiene el binario existente."
        } else {
            Remove-Item $Paths.ClaudeBin -Recurse -Force -ErrorAction SilentlyContinue
            New-Item -ItemType Directory -Path $Paths.ClaudeBin -Force | Out-Null
        }
    }

    if (-not (Test-Path $Paths.ClaudeExe)) {
        $npm = Get-NpmCommand $Paths
        if (-not $npm) {
            Write-ErrMsg "No se encontro npm (ni en Runtime\Node ni en el PATH del sistema)."
            Write-Info  "Claude Code no requiere Node para EJECUTARSE, pero la descarga inicial"
            Write-Info  "del binario nativo se hace hoy mediante 'npm install --prefix'."
            Write-Info  "Alternativa manual: instala Claude Code normalmente en cualquier PC"
            Write-Info  "(irm https://claude.ai/install.ps1 | iex), y copia el .exe resultante"
            Write-Info  "desde %USERPROFILE%\.local\share\claude\versions\<version>\ hacia:"
            Write-Info  "  $($Paths.ClaudeBin)\claude.exe"
            Write-Info  "Ver README.md, seccion 'Instalacion manual de Claude Code'."
            return $false
        }

        Write-Info "Descargando Claude Code CLI (npm --prefix $($Paths.ClaudeBin)) ..."
        & $npm install "@anthropic-ai/claude-code" --prefix "$($Paths.ClaudeBin)" --no-fund --no-audit
        if ($LASTEXITCODE -ne 0) {
            Write-ErrMsg "Fallo la instalacion via npm."
            return $false
        }

        # npm coloca el binario nativo bajo node_modules\@anthropic-ai\claude-code-win32-*\
        # y un shim (claude.cmd / claude.ps1) en la raiz del prefix. Igualamos todo bajo
        # ClaudeBin\claude.exe para que el resto de scripts tengan una ruta fija.
        $shim = Get-ChildItem -Path $Paths.ClaudeBin -Filter "claude.exe" -Recurse -ErrorAction SilentlyContinue |
                Select-Object -First 1
        if (-not $shim) {
            Write-ErrMsg "npm instalo paquetes pero no se encontro claude.exe resultante. Revisa $($Paths.ClaudeBin)."
            return $false
        }
        Copy-Item $shim.FullName $Paths.ClaudeExe -Force
    }

    Write-Ok "Binario de Claude Code listo: $($Paths.ClaudeExe)"

    # Config portable: todo (settings, credenciales OAuth) vive en Config\Claude.
    Set-SessionEnvironment -Paths $Paths -IncludeClaude

    Write-Section "Login de Claude Code"
    Write-Info "Se abrira el flujo oficial de autenticacion (navegador). Complete el login."
    & $Paths.ClaudeExe "/login" 2>$null
    if ($LASTEXITCODE -ne 0) {
        # /login como subcomando puede no existir en todas las versiones; fallback interactivo.
        Write-Info "Iniciando sesion interactiva de 'claude' para autenticar..."
        & $Paths.ClaudeExe
    }

    if (Test-Path (Join-Path $Paths.ConfigClaude ".credentials.json")) {
        Write-Ok "Credenciales guardadas en $($Paths.ConfigClaude)\.credentials.json"
        return $true
    } else {
        Write-WarnMsg "No se detecto .credentials.json. Verifique manualmente con 'claude doctor'."
        return $false
    }
}

function Get-LatestCodexWindowsAsset {
    Write-Info "Consultando ultima release de openai/codex en GitHub..."
    try {
        $release = Invoke-RestMethod -Uri "https://api.github.com/repos/openai/codex/releases/latest" `
                                      -Headers @{ "User-Agent" = "AI-Portable-Setup" }
    } catch {
        Write-ErrMsg "No se pudo consultar GitHub Releases: $_"
        return $null
    }

    $asset = $release.assets | Where-Object {
        $_.name -match "win" -and $_.name -match "\.exe(\.zip)?$" -or ($_.name -match "pc-windows-msvc" )
    } | Select-Object -First 1

    if (-not $asset) {
        Write-ErrMsg "No se encontro un asset de Windows en la ultima release ($($release.tag_name))."
        return $null
    }
    return $asset
}

function Setup-Codex {
    param($Paths)

    Write-Section "Configurar Codex CLI"

    if (Test-Path $Paths.CodexExe) {
        Write-Ok "Ya existe un binario en $($Paths.CodexExe)."
        $reinstall = Read-Host "Reinstalar de todas formas? (s/N)"
        if ($reinstall -notin @("s", "S")) {
            Write-Info "Se mantiene el binario existente."
        } else {
            Remove-Item $Paths.CodexExe -Force -ErrorAction SilentlyContinue
        }
    }

    if (-not (Test-Path $Paths.CodexExe)) {
        $asset = Get-LatestCodexWindowsAsset
        if ($asset) {
            $dest = Join-Path $Paths.CodexBin $asset.name
            Write-Info "Descargando $($asset.name) ..."
            Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $dest -UseBasicParsing

            if ($dest -like "*.zip") {
                Expand-Archive -Path $dest -DestinationPath $Paths.CodexBin -Force
                Remove-Item $dest -Force
                $found = Get-ChildItem -Path $Paths.CodexBin -Filter "codex*.exe" -Recurse | Select-Object -First 1
                if ($found) { Copy-Item $found.FullName $Paths.CodexExe -Force }
            } else {
                Rename-Item -Path $dest -NewName "codex.exe" -Force
            }
        }

        if (-not (Test-Path $Paths.CodexExe)) {
            Write-WarnMsg "Descarga directa no disponible. Intentando via npm --prefix (requiere Node)..."
            $npm = Get-NpmCommand $Paths
            if (-not $npm) {
                Write-ErrMsg "No se encontro npm. No fue posible instalar Codex CLI automaticamente."
                Write-Info  "Alternativa manual: descargue el binario Windows desde"
                Write-Info  "https://github.com/openai/codex/releases y colóquelo en:"
                Write-Info  "  $($Paths.CodexExe)"
                return $false
            }
            & $npm install "@openai/codex" --prefix "$($Paths.CodexBin)" --no-fund --no-audit
            $found = Get-ChildItem -Path $Paths.CodexBin -Filter "codex.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($found) { Copy-Item $found.FullName $Paths.CodexExe -Force }
        }
    }

    if (-not (Test-Path $Paths.CodexExe)) {
        Write-ErrMsg "No se pudo obtener el binario de Codex CLI."
        return $false
    }
    Write-Ok "Binario de Codex CLI listo: $($Paths.CodexExe)"

    Set-SessionEnvironment -Paths $Paths -IncludeCodex

    # cli_auth_credentials_store = "file" es una opcion OFICIAL de config.toml.
    # La fijamos explicitamente para evitar que Codex intente usar el almacen de
    # credenciales de Windows (keyring/DPAPI), que NO es portable entre PCs.
    #
    # sandbox_mode = "workspace-write" se fija explicitamente para evitar el modo
    # "danger-full-access"/elevado, que en Windows puede requerir permisos de
    # administrador o cambios de politica local (no compatible con "sin cambios
    # permanentes en el host"). "workspace-write" es el modo estandar no elevado.
    $configTomlPath = Join-Path $Paths.ConfigCodex "config.toml"
    if (-not (Test-Path $configTomlPath)) {
        @"
# Generado por AI-Portable setup.ps1
# 'file' fuerza almacenamiento de credenciales como archivo plano dentro de
# CODEX_HOME (portable), en vez de 'keyring' (Windows Credential Manager,
# NO portable) o 'auto' (que podria elegir keyring segun el sistema).
cli_auth_credentials_store = "file"

# Modo de sandbox no elevado explicito. Evita que Codex requiera permisos de
# administrador o modifique politicas locales de Windows (firewall, etc.),
# lo cual violaria el requisito de "sin cambios permanentes en el host".
sandbox_mode = "workspace-write"
"@ | Set-Content -Path $configTomlPath -Encoding UTF8
        Write-Info "Config creada: $configTomlPath (cli_auth_credentials_store = file, sandbox_mode = workspace-write)"
    }

    Write-Section "Login de Codex CLI"
    Write-Info "Se abrira el flujo oficial de autenticacion (navegador). Complete el login."
    & $Paths.CodexExe login

    if (Test-Path (Join-Path $Paths.ConfigCodex "auth.json")) {
        Write-Ok "Credenciales guardadas en $($Paths.ConfigCodex)\auth.json"
        return $true
    } else {
        Write-WarnMsg "No se detecto auth.json. Verifique manualmente con 'codex login status' o similar."
        return $false
    }
}

