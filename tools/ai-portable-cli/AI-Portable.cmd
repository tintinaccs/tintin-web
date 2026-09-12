@echo off
REM AI-Portable.cmd - punto de entrada del entorno portable.
REM
REM Se autolocaliza dinamicamente via %~dp0 (nunca una letra de unidad fija),
REM y delega toda la logica real a Scripts\launcher.ps1. No instala ni
REM modifica nada del sistema por si mismo.

setlocal
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

set "LAUNCHER=%ROOT%\Scripts\launcher.ps1"
if not exist "%LAUNCHER%" (
    echo [X] No se encontro %LAUNCHER%
    echo     Verifique que la carpeta Scripts esta junto a este archivo.
    pause
    exit /b 1
)

where powershell.exe >nul 2>nul
if %errorlevel%==0 (
    powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%LAUNCHER%" -Root "%ROOT%" %*
    exit /b %errorlevel%
)

where pwsh.exe >nul 2>nul
if %errorlevel%==0 (
    pwsh.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%LAUNCHER%" -Root "%ROOT%" %*
    exit /b %errorlevel%
)

echo [X] No se encontro powershell.exe ni pwsh.exe en el PATH del sistema.
pause
exit /b 1
