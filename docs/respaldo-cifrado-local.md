# Copia cifrada en el disco de la titular

Se reutiliza Backup Firestore, su entorno `production-backup`, credenciales existentes y bucket canónico. El export diario sigue igual. El modo manual `encrypted_copy=true` sólo lee el último export que tenga su archivo `overall_export_metadata`; no inicia otro export ni importa, restaura o cambia producción. Requiere ejecución del titular desde `main`, comprobada antes de cargar las credenciales, y el certificado **público** PEM del destinatario en `recipient_pem`. No pasar claves privadas, cookies ni contraseñas a Actions o al chat.

El runner descarga el export a una carpeta temporal privada, lo empaqueta y cifra mediante CMS EnvelopedData/AES-256-CBC con OpenSSL de la plataforma. El resultado queda en `artifacts/encrypted-backup`, fuera de Git y del artefacto público del sitio. El artefacto contiene exclusivamente `firestore-backup.p7m` y un recibo con SHA-256, fecha e identificador del snapshot. No contiene el export en claro, certificado privado ni credenciales. La carpeta temporal se elimina incluso ante fallo y el artefacto cifrado caduca en un día. El recibo detecta corrupción; descargar siempre desde el workflow autorizado del repositorio.

## Preparar el destinatario Windows

```powershell
powershell -NoProfile -File scripts/respaldo-cifrado-windows.ps1 -Operation Prepare -OutputDirectory C:/Users/Windows/Documents/Respaldos-Tintin/destinatario
```

Esto crea un certificado de cifrado RSA3072 en `Cert:\CurrentUser\My` o reutiliza la identidad ya registrada en esa carpeta. Sólo salen su certificado público y un JSON con el thumbprint. La clave privada permanece en el almacén protegido de la cuenta Windows; el helper nunca la imprime ni exporta. `destinatario-publico.pem` es la entrada pública del workflow. La cuenta de Windows que generó el certificado es la que puede descifrar la copia.

Para recuperar también después de perder el perfil/equipo Windows hay que exportar ese certificado **con su clave privada**, protegido por una contraseña elegida por la titular, mediante `certmgr.msc` → Personal → Certificados → Tintin Respaldo Local → Todas las tareas → Exportar. Conservar el PFX en otro soporte seguro. Ese paso es personal: no almacenar el PFX/contraseña en Git, Actions ni el chat. Una copia en el mismo disco del sistema no protege ante pérdida física de ese disco.

## Copiar y recuperar

Ejecutar el workflow manual sobre `main` con `encrypted_copy=true` y el contenido de `destinatario-publico.pem`. Descargar su artefacto a la carpeta elegida y comprobar el SHA-256 del `.p7m` contra el recibo, antes de descifrar.

```powershell
$identity = Get-Content C:/Users/Windows/Documents/Respaldos-Tintin/destinatario/destinatario.json -Raw | ConvertFrom-Json
powershell -NoProfile -File scripts/respaldo-cifrado-windows.ps1 -Operation Decrypt -Source RUTA/firestore-backup.p7m -Destination RUTA/restauracion.tar.gz -CertificateThumbprint $identity.thumbprint
```

El destino debe ser nuevo. El TAR contiene la estructura nativa del export de Firestore y su metadata; no confundir descifrado con importación verificada. Comprobar una restauración sólo en emulador/base aislada elegida para el ensayo. El script existente `restore-firestore.mjs` mantiene su confirmación vinculada al proyecto y base; no usar `(default)` para una prueba.

El mismo helper cifra/restaura un bundle de código con `-Operation Encrypt`/`Decrypt`. La verificación final del código es `node scripts/verificar-respaldo-repositorio.mjs RUTA/restaurado.bundle`, que clona en una carpeta temporal y ejecuta `git fsck --full` sin tocar el checkout de trabajo.

Este mecanismo no exporta originales de Cloudinary ni configura Instagram/PayPal. Esas integraciones conservan sus propias autorizaciones. Las pruebas Node usan OpenSSL disponible en Ubuntu/Git para Windows; `OPENSSL_BIN` permite especificar otra instalación sin cambiar el helper de producción.
