# AI Portable CLI (Claude Code + Codex en pendrive)

Entorno portable para Windows que permite usar `claude` (Claude Code CLI) y
`codex` (Codex CLI de OpenAI) desde un pendrive, sin instalacion permanente en
el PC host, arrancando desde un unico `AI-Portable.exe`.

> Este directorio es una herramienta independiente, sin relacion con el sitio
> e-commerce de `tintin-web`. Vive aqui porque el flujo de trabajo de esta
> sesion enruta el codigo entregado a este repositorio.

## Indice
- [Que es y que no es](#que-es-y-que-no-es)
- [Analisis tecnico: Claude Code CLI](#analisis-tecnico-claude-code-cli)
- [Analisis tecnico: Codex CLI](#analisis-tecnico-codex-cli)
- [Que es portable y que no](#que-es-portable-y-que-no)
- [Arquitectura](#arquitectura)
- [Estructura de carpetas](#estructura-de-carpetas)
- [Compilar AI-Portable.exe](#compilar-ai-portableexe)
- [Preparar el pendrive](#preparar-el-pendrive)
- [Primer uso (setup)](#primer-uso-setup)
- [Uso normal](#uso-normal)
- [Diagnostico](#diagnostico)
- [Limpieza al cerrar](#limpieza-al-cerrar)
- [Seguridad y limites explicitos](#seguridad-y-limites-explicitos)
- [Elementos no verificados](#elementos-no-verificados)

## Que es y que no es

Es un lanzador que, en un PC Windows con el pendrive conectado:
1. Detecta su propia ubicacion (letra de unidad dinamica, nunca fija).
2. Prepara variables de entorno **solo para el proceso de esa terminal**
   (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `PATH` con los binarios del pendrive).
3. Abre una terminal (CMD/PowerShell) donde `claude` y `codex` funcionan como
   si estuvieran instalados nativamente.
4. Al cerrar esa terminal y retirar el pendrive, no queda ningun rastro
   persistente en PATH/registro del sistema.

No es: un mecanismo para extraer o robar credenciales, evadir el
almacenamiento seguro de Windows, ocultar procesos, o evadir politicas
corporativas/antivirus. El login en ambas herramientas es siempre el flujo
oficial del propio fabricante; no se hardcodea ningun secreto en el `.exe`
ni en los scripts.

## Analisis tecnico: Claude Code CLI

- **Instalacion**: binario nativo autocontenido. La via oficial recomendada
  es `irm https://claude.ai/install.ps1 | iex` (o el paquete npm
  `@anthropic-ai/claude-code`, que resuelve a un paquete opcional nativo por
  plataforma, p.ej. `claude-code-win32-x64`). No requiere Node.js en tiempo
  de ejecucion; npm solo se usa como mecanismo de descarga/actualizacion.
- **Layout de instalacion nativa**: `~/.local/bin/claude` +
  `~/.local/share/claude/versions/<version>/`. En este proyecto se usa la via
  npm `--prefix` para obtener el binario, que luego se copia a una ruta fija
  `Claude\bin\claude.exe` dentro del pendrive.
- **Configuracion**: `CLAUDE_CONFIG_DIR` (variable de entorno oficial)
  reubica toda la carpeta `~/.claude` (settings + `.credentials.json`, este
  ultimo es el archivo de credenciales OAuth). En Windows, ese archivo de
  credenciales **siempre es JSON plano** (no hay integracion con Windows
  Credential Manager; el uso de Keychain es exclusivo de macOS), por lo que
  reubicarlo con `CLAUDE_CONFIG_DIR` es 100% oficial y no implica ningun
  bypass de seguridad del SO.
- **Caveat conocido**: existe un segundo archivo, `~/.claude.json`, que es
  estado de nivel superior (no credenciales) y que **no** se reubica con
  `CLAUDE_CONFIG_DIR` — siempre se crea en `%USERPROFILE%` del host. Este
  proyecto registra si ese archivo ya existia antes de la sesion
  (`Config\.runtime-state.json`) y solo lo borra en la limpieza si lo creo
  el propio launcher; si ya existia, nunca se toca.
- **Login**: `claude /login` (o el flujo interactivo de `claude` si el
  subcomando no existe en la version instalada) abre el flujo OAuth oficial
  en el navegador del usuario.

## Analisis tecnico: Codex CLI

- **Instalacion**: binario nativo (Rust) publicado en GitHub Releases
  (`openai/codex`) — no requiere Node.js. Alternativa: paquete npm
  `@openai/codex` como wrapper de descarga.
- **Configuracion**: `CODEX_HOME` (variable de entorno oficial, por defecto
  `~/.codex`) reubica `config.toml` y el archivo de credenciales
  `auth.json`.
- **Almacenamiento de credenciales**: la clave oficial de `config.toml`
  `cli_auth_credentials_store` acepta `file | keyring | auto | ephemeral`.
  Por defecto puede usar el almacen de credenciales de Windows (no portable
  entre PCs). Este proyecto fija explicitamente `cli_auth_credentials_store
  = "file"` en el `config.toml` generado, forzando almacenamiento como
  archivo plano dentro de `CODEX_HOME` — esta es la alternativa
  **oficial y documentada** para lograr portabilidad sin intentar sortear
  el almacen seguro de Windows.
- **Sandbox en Windows**: Codex soporta varios `sandbox_mode`. El modo mas
  restrictivo/elevado puede requerir permisos de administrador o cambios de
  politica local. Para evitar esto, `config.toml` fija explicitamente
  `sandbox_mode = "workspace-write"` (modo estandar, no elevado).
- **Login**: `codex login` abre el flujo OAuth oficial en el navegador.

## Que es portable y que no

| Elemento | Portable | Notas |
|---|---|---|
| Binario `claude.exe` | Si | Copiado a `Claude\bin\` en el pendrive |
| Binario `codex.exe` | Si | Copiado a `Codex\bin\` en el pendrive |
| Credenciales Claude (`.credentials.json`) | Si | Via `CLAUDE_CONFIG_DIR` |
| Settings Claude | Si | Via `CLAUDE_CONFIG_DIR` |
| Credenciales Codex (`auth.json`) | Si | Via `CODEX_HOME` + `cli_auth_credentials_store = file` |
| `config.toml` de Codex | Si | Via `CODEX_HOME` |
| `~/.claude.json` (estado, no credenciales) | No | Ligado a `%USERPROFILE%` del host; se recrea en cada PC. Rastreado y limpiado solo si lo creamos nosotros |
| PATH/registro del sistema | No aplica | Nunca se modifica; solo variables de entorno del proceso de la terminal abierta |
| Node.js/npm | Opcional | Solo se usa, si esta disponible en el host o en `Runtime\Node` (no incluido), para la adquisicion inicial de binarios |

## Arquitectura

- **`launcher/main.go`** — bootstrapper compilado a `AI-Portable.exe`.
  Deliberadamente minimo: resuelve su propia ruta real (`os.Executable()` +
  `EvalSymlinks`), calcula la raiz del pendrive como su carpeta padre, y
  ejecuta `Scripts\launcher.ps1` con `-Root <esa carpeta>`, heredando
  stdio/exit code. Toda la logica real (incluida cualquier logica cercana a
  credenciales) esta en PowerShell, legible y auditable — nada sensible
  vive oculto dentro del binario compilado.
- **`Scripts/common.ps1`** — helpers compartidos: construccion de rutas,
  aplicacion de entorno de proceso (`Set-SessionEnvironment`), lectura y
  escritura de estado de runtime.
- **`Scripts/setup.ps1`** — funciones `Setup-Claude` / `Setup-Codex`:
  adquisicion del binario, configuracion portable, login oficial.
- **`Scripts/launcher.ps1`** — punto de entrada real. Menu unificado
  (usar herramientas / configurar / diagnostico / salir) y el submenu de
  configuracion inicial solicitado.
- **`Scripts/diagnostics.ps1`** — solo lectura: verifica binarios, version,
  presencia (no contenido) de credenciales, config de Codex, conectividad,
  espacio libre.
- **`Scripts/cleanup.ps1`** — cierra procesos hijos abiertos por el
  launcher y borra `~/.claude.json` del host **solo** si lo creo esta
  sesion.

## Estructura de carpetas

```
PENDRIVE\
  AI-Portable.exe
  Claude\bin\claude.exe
  Codex\bin\codex.exe
  Config\Claude\            (CLAUDE_CONFIG_DIR: settings + .credentials.json)
  Config\Codex\             (CODEX_HOME: config.toml + auth.json)
  Config\.runtime-state.json
  Runtime\Node\             (opcional, no incluido — ver mas abajo)
  Scripts\common.ps1
  Scripts\setup.ps1
  Scripts\launcher.ps1
  Scripts\diagnostics.ps1
  Scripts\cleanup.ps1
```

`Runtime\Node` es opcional: solo se usa si el usuario coloca alli una copia
portable de Node.js. No se incluye en el pendrive por defecto porque ninguna
de las dos CLIs lo requiere para ejecutarse (solo, opcionalmente, para la
adquisicion inicial via npm si falla la descarga directa de binarios).

## Compilar AI-Portable.exe

Requiere Go instalado en la maquina de build (no en el pendrive).

```bash
cd tools/ai-portable-cli/launcher
GOOS=windows GOARCH=amd64 go build -o AI-Portable.exe .
```

Copiar el `AI-Portable.exe` resultante a la raiz del pendrive.

## Preparar el pendrive

1. Copiar `AI-Portable.exe` a la raiz del pendrive.
2. Copiar la carpeta `Scripts\` completa (los 4 `.ps1`) junto al `.exe`.
3. Las carpetas `Claude\`, `Codex\`, `Config\`, `Runtime\` se crean solas en
   el primer arranque (`Ensure-PortableFolders`); no es necesario crearlas
   a mano.

## Primer uso (setup)

Ejecutar `AI-Portable.exe` → opcion `[4] Configuracion inicial / Reconfigurar`
del menu principal, que abre:

```
========================================
          AI PORTABLE SETUP
========================================
[1] Configurar Claude Code
[2] Configurar Codex
[3] Configurar ambos
[4] Diagnostico
[5] Volver
```

Cada opcion de configuracion: descarga el binario (si falta), aplica el
entorno portable, lanza el login oficial en el navegador, y verifica que se
haya creado el archivo de credenciales correspondiente.

### Instalacion manual de Claude Code (si no hay npm disponible)

Si el pendrive no tiene acceso a npm ni `Runtime\Node`, se puede instalar
Claude Code normalmente en cualquier PC (`irm https://claude.ai/install.ps1
| iex`) y copiar el ejecutable resultante desde
`%USERPROFILE%\.local\share\claude\versions\<version>\` hacia
`Claude\bin\claude.exe` en el pendrive.

### Instalacion manual de Codex CLI

Descargar el binario Windows desde
`https://github.com/openai/codex/releases` y colocarlo en
`Codex\bin\codex.exe`.

## Uso normal

Ejecutar `AI-Portable.exe`:

```
========================================
       AI PORTABLE - LAUNCHER
========================================
Claude Code: listo   |   Codex: listo

[1] Usar Claude Code
[2] Usar Codex
[3] Usar Claude + Codex
[4] Configuracion inicial / Reconfigurar
[5] Diagnostico
[6] Salir
```

Las opciones `[1]-[3]` abren una terminal PowerShell hija con el entorno ya
inyectado (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `PATH`), donde `claude`/`codex`
funcionan directamente. Si la herramienta elegida no esta configurada
todavia, se dispara automaticamente su setup antes de abrir la terminal.

## Diagnostico

`Scripts\diagnostics.ps1` (opcion `[5]` del menu, o `[4]` del submenu de
setup) es estrictamente de solo lectura: verifica presencia y version de
cada binario, presencia (sin mostrar contenido) de archivos de credenciales,
si `config.toml` de Codex fija `cli_auth_credentials_store`, disponibilidad
de `npm` en el host, presencia de `Runtime\Node`, existencia de
`~/.claude.json` en el host, conectividad TCP 443 a `claude.ai`,
`api.github.com` y `registry.npmjs.org`, y espacio libre en la unidad del
pendrive.

## Limpieza al cerrar

Al elegir `[6] Salir`, `Scripts\cleanup.ps1`:
- Cierra unicamente los procesos de terminal que el propio launcher abrio
  en esa sesion (por PID registrado).
- Borra `~/.claude.json` del host **solo si** no existia antes de esta
  sesion (registrado en `Config\.runtime-state.json`).
- Nunca toca `Claude\`, `Codex\` ni `Config\` en el pendrive: esa es la
  instalacion portable y debe permanecer intacta.
- No restaura PATH/registro del sistema porque nunca se modificaron: solo
  se usaron variables de entorno del proceso de la terminal abierta, que
  desaparecen al cerrarla.

## Seguridad y limites explicitos

- Ningun password/token/credencial esta hardcodeado en ningun script ni en
  el `.exe`. Todo login pasa por el flujo oficial de cada herramienta.
- No se intenta leer, copiar ni exportar nada de Windows Credential
  Manager, DPAPI, TPM ni Keychain. Donde una herramienta puede usar esos
  mecanismos por defecto (Codex + keyring), se usa la alternativa oficial
  de configuracion (`cli_auth_credentials_store = "file"`) en vez de
  intentar sortear la proteccion del SO.
- Nunca se usa `setx`, ni se escribe en el registro de Windows, ni se
  modifica el PATH de usuario/sistema: todo cambio de entorno es
  process-scoped (heredado solo por los procesos hijos que abre el
  launcher).
- La limpieza solo borra lo que el propio launcher creo en esa sesion.

## Elementos no verificados

Este desarrollo se realizo en un entorno Linux sin PowerShell (`pwsh`)
disponible, por lo que:
- Los 4 scripts `.ps1` fueron revisados manualmente linea por linea (llaves
  balanceadas, sintaxis de funciones/here-strings, uso de cmdlets), pero
  **no se ejecutaron ni se validaron con un interprete de PowerShell real**.
- No fue posible probar el flujo completo (setup, login real de Claude
  Code y Codex, apertura/cierre de terminal, limpieza) en una maquina
  Windows real.
- No fue posible verificar en la practica que `sandbox_mode =
  "workspace-write"` evite toda elevacion en Windows para la version
  actual de Codex CLI, ni el nombre exacto del asset de Windows en la
  ultima release de GitHub (la deteccion en `Get-LatestCodexWindowsAsset`
  usa un patron de nombre razonable pero debe confirmarse contra la
  release real).

**Paso manual pendiente para el usuario**: ejecutar el flujo completo en un
PC Windows real (segunda PC, pendrive conectado) — preparar pendrive, correr
`AI-Portable.exe`, completar setup con login real de ambas herramientas,
verificar `claude`/`codex` funcionando, cerrar y confirmar que no queda
rastro en PATH/registro, y validar diagnostico y limpieza.
