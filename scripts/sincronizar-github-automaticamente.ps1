param(
  [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
$RepositoryRoot = (Resolve-Path -LiteralPath $RepositoryRoot).Path
$gitDirectory = Join-Path $RepositoryRoot '.git'
$logPath = Join-Path $gitDirectory 'tintin-auto-sync.log'
$lockPath = Join-Path $gitDirectory 'tintin-auto-sync.lock'
$lockHandle = $null

function Write-SyncLog {
  param([string]$Message)

  $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  Add-Content -LiteralPath $logPath -Value "[$timestamp] $Message" -Encoding UTF8
}

function Invoke-Git {
  param([string[]]$GitArguments)

  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $output = & git -C $RepositoryRoot @GitArguments 2>&1
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  if ($exitCode -ne 0) {
    throw "git $($GitArguments -join ' ') fallo: $($output -join [Environment]::NewLine)"
  }

  return $output
}

try {
  if (-not (Test-Path -LiteralPath $gitDirectory -PathType Container)) {
    throw "No se encontro un repositorio Git en $RepositoryRoot."
  }

  try {
    $lockHandle = [System.IO.File]::Open(
      $lockPath,
      [System.IO.FileMode]::OpenOrCreate,
      [System.IO.FileAccess]::ReadWrite,
      [System.IO.FileShare]::None
    )
  } catch [System.IO.IOException] {
    exit 0
  }

  $branch = (Invoke-Git -GitArguments @('branch', '--show-current') | Select-Object -First 1).Trim()
  if ($branch -ne 'main') {
    Write-SyncLog "Omitido: la rama activa es '$branch', no 'main'."
    exit 0
  }

  $unmergedFiles = @(Invoke-Git -GitArguments @('ls-files', '--unmerged') | Where-Object {
    -not [string]::IsNullOrWhiteSpace([string]$_)
  })
  if ($unmergedFiles.Count -gt 0) {
    Write-SyncLog 'Omitido: existen conflictos Git sin resolver.'
    exit 0
  }

  Invoke-Git -GitArguments @('add', '-A', '--', '.') | Out-Null

  & git -C $RepositoryRoot diff --cached --quiet
  $stagedChanges = $LASTEXITCODE -eq 1
  if ($LASTEXITCODE -notin 0, 1) {
    throw 'No se pudo comprobar si existen cambios preparados.'
  }

  if ($stagedChanges) {
    $commitTimestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Invoke-Git -GitArguments @('commit', '-m', "chore: respaldo automatico $commitTimestamp") | Out-Null
    Write-SyncLog 'Commit automatico creado.'
  }

  Invoke-Git -GitArguments @('push', 'origin', 'HEAD:refs/heads/automatic-backup') | Out-Null
  Write-SyncLog "Sincronizacion completada en la rama 'automatic-backup'."
} catch {
  try {
    Write-SyncLog "ERROR: $($_.Exception.Message)"
  } catch {
    # La tarea no debe abrir ventanas ni bloquearse aunque el log no sea escribible.
  }
  exit 1
} finally {
  if ($null -ne $lockHandle) {
    $lockHandle.Dispose()
  }
}
