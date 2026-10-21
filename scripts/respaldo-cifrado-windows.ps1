param(
  [Parameter(Mandatory=$true)][ValidateSet('Prepare','Encrypt','Decrypt')][string]$Operation,
  [string]$OutputDirectory,
  [string]$Source,
  [string]$Destination,
  [string]$CertificateThumbprint
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security

if ($Operation -eq 'Prepare') {
  if (-not $OutputDirectory) { throw 'Falta OutputDirectory.' }
  $folder = [IO.Path]::GetFullPath($OutputDirectory)
  New-Item -ItemType Directory -Path $folder -Force | Out-Null
  $identityPath = Join-Path $folder 'destinatario.json'
  if (Test-Path -LiteralPath $identityPath) {
    $identity = Get-Content -LiteralPath $identityPath -Raw | ConvertFrom-Json
    $cert = Get-Item -LiteralPath ('Cert:\CurrentUser\My\' + $identity.thumbprint)
    if (-not $cert.HasPrivateKey) { throw 'El certificado no tiene clave privada en esta cuenta Windows.' }
  } else {
    $cert = New-SelfSignedCertificate -Type DocumentEncryptionCert -Subject 'CN=Tintin Respaldo Local' -FriendlyName 'Tintin respaldo local cifrado' -KeyLength 3072 -HashAlgorithm SHA256 -KeyExportPolicy Exportable -CertStoreLocation 'Cert:\CurrentUser\My' -NotAfter (Get-Date).AddYears(5)
  }
  $pem = "-----BEGIN CERTIFICATE-----`n" + [Convert]::ToBase64String($cert.RawData, [Base64FormattingOptions]::InsertLineBreaks) + "`n-----END CERTIFICATE-----`n"
  [IO.File]::WriteAllText((Join-Path $folder 'destinatario-publico.pem'), $pem, [Text.Encoding]::ASCII)
  @{thumbprint=$cert.Thumbprint; expires=$cert.NotAfter.ToUniversalTime().ToString('o'); store='Cert:\CurrentUser\My'; format='CMS EnvelopedData AES-256-CBC'; privateKeyExported=$false} | ConvertTo-Json | Set-Content -LiteralPath $identityPath -Encoding UTF8
  Write-Output 'Destinatario preparado. La clave privada permanece en el almacén de esta cuenta Windows.'
  exit 0
}

if (-not $Source -or -not $Destination -or -not $CertificateThumbprint) { throw 'Faltan Source, Destination o CertificateThumbprint.' }
if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) { throw 'No existe el archivo de origen.' }
if (Test-Path -LiteralPath $Destination) { throw 'El destino ya existe; no se sobrescribe.' }
$cert = Get-Item -LiteralPath ('Cert:\CurrentUser\My\' + $CertificateThumbprint)
$bytes = [IO.File]::ReadAllBytes([IO.Path]::GetFullPath($Source))
if ($Operation -eq 'Encrypt') {
  $content = New-Object System.Security.Cryptography.Pkcs.ContentInfo -ArgumentList (,$bytes)
  $oid = New-Object System.Security.Cryptography.Oid '2.16.840.1.101.3.4.1.42'
  $algorithm = New-Object System.Security.Cryptography.Pkcs.AlgorithmIdentifier $oid
  $message = New-Object System.Security.Cryptography.Pkcs.EnvelopedCms $content,$algorithm
  $recipient = New-Object System.Security.Cryptography.Pkcs.CmsRecipient $cert
  $message.Encrypt($recipient)
  [IO.File]::WriteAllBytes([IO.Path]::GetFullPath($Destination), $message.Encode())
} else {
  if (-not $cert.HasPrivateKey) { throw 'Esta cuenta no tiene la clave privada de restauración.' }
  $message = New-Object System.Security.Cryptography.Pkcs.EnvelopedCms
  $message.Decode($bytes)
  $certificates = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2Collection
  [void]$certificates.Add($cert)
  $message.Decrypt($certificates)
  [IO.File]::WriteAllBytes([IO.Path]::GetFullPath($Destination), $message.ContentInfo.Content)
}
Write-Output ('Operación ' + $Operation + ' completada.')
