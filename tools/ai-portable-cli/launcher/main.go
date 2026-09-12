// AI-Portable.exe: minimal bootstrapper for the portable Claude Code / Codex CLI environment.
//
// It does exactly one thing: find its own location on disk (whatever drive
// letter the USB stick got assigned) and hand off to Scripts\launcher.ps1,
// which contains all the real logic in plain, auditable PowerShell. Nothing
// here touches the registry, PATH, or credentials — that is intentional, so
// anyone can read the .ps1 files and see precisely what happens to their
// Claude/Codex login.
package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

func main() {
	exePath, err := os.Executable()
	if err != nil {
		fatal("no se pudo determinar la ruta del ejecutable: %v", err)
	}
	exePath, err = filepath.EvalSymlinks(exePath)
	if err != nil {
		fatal("no se pudo resolver la ruta real del ejecutable: %v", err)
	}

	root := filepath.Dir(exePath)
	launcherScript := filepath.Join(root, "Scripts", "launcher.ps1")

	if _, err := os.Stat(launcherScript); err != nil {
		fatal("no se encontro Scripts\\launcher.ps1 junto a AI-Portable.exe (raiz detectada: %s)", root)
	}

	powershell, err := exec.LookPath("powershell.exe")
	if err != nil {
		// pwsh (PowerShell 7+) as fallback if Windows PowerShell isn't on PATH.
		powershell, err = exec.LookPath("pwsh.exe")
		if err != nil {
			fatal("no se encontro powershell.exe ni pwsh.exe en el PATH del sistema")
		}
	}

	args := append([]string{
		"-NoLogo",
		"-NoProfile",
		"-ExecutionPolicy", "Bypass",
		"-File", launcherScript,
		"-Root", root,
	}, os.Args[1:]...)

	cmd := exec.Command(powershell, args...)
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Dir = root

	if err := cmd.Run(); err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			os.Exit(exitErr.ExitCode())
		}
		fatal("fallo al ejecutar launcher.ps1: %v", err)
	}
}

func fatal(format string, args ...interface{}) {
	fmt.Fprintf(os.Stderr, "[AI-Portable] "+format+"\n", args...)
	os.Exit(1)
}
