# Auditoría multidispositivo — 2026-10-10

Responsable: Codex /root. Zona de fecha: America/Buenos_Aires. Base publicada: `34aa0f3b6812bc98aba6ad91075335c81ec7e378` (#1082). Este informe diferencia evidencia local, CI y producción; los resultados históricos no certifican cambios posteriores.

## A. Errores encontrados

| Gravedad | Problema y causa comprobada | Evidencia |
| --- | --- | --- |
| MEDIUM | Enter en Últimos datos no ejecutaba Continuar: los inputs carecían de manejador de avance. | Reproducción anterior fallida a 1280×720; `login.html`, `ensureProfileComplete`. |
| HIGH | El límite por IP leía y sobrescribía el contador sin precondición: 200 solicitudes simultáneas recibían permiso. | Regresión previa 200≠1; `functions/api/email-otp-send.js`. |
| HIGH | La cuota por correo estaba en el documento del OTP, eliminado al consumirlo; además admitía envíos concurrentes desde distintas IPs. | Regresiones de concurrencia y nueve envíos después de consumir los códigos. |
| LOW | La fixture de registro breve omitía importar `isNationalMobileInput`, utilizado por el código real. | Se corrige la importación y se ejecutan sus siete casos. |
| MEDIUM | Envíos superó el presupuesto de 120 solicitudes: 121/125 en CI y 122 en reproducción local. Abría listeners antes de App Check, repetía la configuración y los paneles descargaban varias versiones del mismo logo. | CI de main `38079284389` FAIL; tres mediciones posteriores al arreglo: 118/118/116. No se aumenta el límite. |
| HIGH | La función de normalización de tarifas se importaba en un módulo de Envíos diferente del que la ejecutaba. Los módulos no comparten esas variables. | Se mueve el import al módulo de tarifas y se ensaya el callback real en navegador, con configuración aislada. |
| MEDIUM | El panel de conexiones instalaba un listener directo de Auth, incumpliendo el coordinador único de sesión. | La suite completa detectó el consumidor; después de usar `subscribeAuthState`, 1273/1273 PASS. |
| HIGH / BLOCKED | La administración actual no exige una segunda autenticación de Firebase. La configuración remota de Identity Platform no está verificada. | No hay inscripción/resolución MFA ni comprobación de segundo factor en cliente, API o Rules. Propuesta concreta en `PROPUESTA_MFA_20261010.md`. |

La última fila identifica un requisito de seguridad pendiente; no constituye evidencia de un acceso indebido ocurrido.

## B. Correcciones implementadas

`login.html`: Enter reutiliza la validación y guardado del botón. Desde el nombre válido enfoca WhatsApp; desde WhatsApp continúa. Ignora repetición e IME y evita solicitudes duplicadas durante el guardado. El teclado indica Siguiente/Listo según los campos pendientes; el teléfono queda asociado a su mensaje accesible.

`functions/api/email-otp-send.js`: reserva la cuota mediante commit de Firestore con `updateTime`/`exists:false`, con reintentos acotados. El contador privado por correo vive separado del código, conserva la cuota/cooldown anterior y no desaparece al consumirlo. La reserva ocurre antes de contactar al proveedor. Un fallo conserva el código anterior y contabiliza el intento para impedir abuso. No cambia el TTL, formato de seis dígitos, autenticación, origen permitido ni credenciales.

Regresiones persistidas en `tests/accounts/email-otp-send-limits.test.mjs`, `scripts/probar-otp-limites-emulador.mjs` y suites de registro/Rules. No cambian Rules, roles, workflows, protección de ramas, datos comerciales ni el dominio.

`envios.html`: espera App Check, reutiliza `onPublicSettings`, importa las tarifas dentro del módulo que las ejecuta; conserva todas las precargas y la tipografía exigidas. Los paneles de carrito, cuenta y catálogo reutilizan `logoUrl()`, sin modificar la imagen. Se renuevan las versiones de caché transitivas del JavaScript cambiado. El nuevo test de Envíos conserva los imports reales y comprueba espera, tarifas, respaldo, error y escape de HTML con servicios aislados.

## C. Login

Google y correo usan el mismo perfil mínimo: nombre y apellido, al menos dos palabras de tres letras cada una, y WhatsApp paraguayo de nueve dígitos o diez con cero inicial. Los errores enfocan y muestran el campo; el nombre/teléfono se conservan al reintentar. No se exige fecha de nacimiento, dirección ni usuario. Las suites cubren sesión existente, recuperación de red, popup bloqueado/cancelado, retorno y perfil incompleto.

Los contratos del correo comprueban OTP de seis dígitos, expiración, intentos, consumo, cuenta existente y sesión verificada. Las pruebas usan proveedores y usuarios aislados: no se hizo un envío ni OAuth real a una cuenta productiva. Eso permanece NOT TESTED.

## D. Checkout

Se conservan identidad guardada, ocultación de los datos ya completos, datos restantes de entrega/factura, validación nacional, totales calculados por servidor e idempotencia de pedido/pago/inventario. Los contratos de checkout, pedidos y pagos se ejecutan contra el código actual. No hubo pedidos, pagos ni cambios de stock reales. PayPal remoto habilitado/sandbox/credenciales no se deduce de estas pruebas; el panel debe conservar su estado parcial si falta esa evidencia.

## E. Seguridad

Las reservas fallan cerradas ante ausencia de versión o error de Firestore. El emulador comprueba las precondiciones reales. Las Rules existentes niegan lectura, consulta, creación/edición y borrado de códigos y contadores tanto a anónimos como a clientes, administradores y Super Admin. Las APIs conservan verificación criptográfica de token, origen y autorización según la operación.

`npm audit` y `npm audit --omit=dev`: cero vulnerabilidades reportadas; no se hicieron actualizaciones mayores. No se extrajeron ni publicaron secretos. La configuración pública de Firebase no es una credencial administrativa. MFA obligatorio permanece BLOCKED hasta configurar y ensayar la migración oficial sin bloquear a la propietaria; no se sustituye por el 2FA externo de Google.

## F. Sincronización

Los contratos actuales cubren autoridad Firestore/Sheets, webhooks autenticados, rechazo de datos inválidos, control de versiones, commits, reintentos, reconciliación y ausencia de duplicación. Se conservan las lecturas automáticas del panel sin botones, caducidad de evidencia, cancelación al cambiar cuenta y estados honestos. No se dispararon escrituras de prueba sobre Sheets ni producción; el último ciclo productivo y sus datos requieren evidencia operativa remota reciente.

## G. Compatibilidad

| Motor | Registro / recuperación / teclado | Alcance |
| --- | --- | --- |
| Chromium | 64 PASS únicos | 57 de registro/Google y siete de registro breve; la repetición de 28 casos táctiles no se suma otra vez. |
| Firefox | 57 PASS | Registro, Google y teclado. |
| WebKit | 57 PASS | 46 de registro/teclado y 11 de recuperación Google. |

Matriz táctil de ambos métodos: 320×568, 360×640, 375×812, 390×844, 414×896, 430×932, 844×390, 768×1024, 1024×768, 820×1180, 1180×820, 1280×720, 1440×900 y 1920×1080. Enter se ensaya con Google/correo a 390×844, 1024×768 y 1280×720. Son motores reales de Linux con resolución/toque emulados; no certifican hardware físico, Safari iOS ni teclados virtuales de todos los fabricantes.

## H. Pruebas y evidencia

| Corrida actual | Resultado | Evidencia local |
| --- | --- | --- |
| Cuentas, checkout, seguridad, sincronización y pedidos | 412 PASS, 0 FAIL/skip | `/tmp/tintin-integral-contracts-final.log` |
| Pagos y CLI de restauración | 24 PASS, 0 FAIL/skip | `/tmp/tintin-payments-restore-current.log` |
| Autenticación/login/perfil/catálogo inicial/navegación | 225 PASS | `/tmp/tintin-login-node-current.log` |
| Firestore real del emulador: concurrencia y cuota | 2 PASS | `/tmp/tintin-otp-rate-emulator-final.log` |
| Rules críticas | 159 controles PASS | `/tmp/tintin-critical-rules-final.log` |
| Smoke de páginas | 18 rutas PASS; incluye loaders, recursos y navegación móvil/tablet/desktop | `/tmp/tintin-pages-current.log` |
| Auditoría global previa al ajuste de Envíos | PASS | `/tmp/tintin-followup-audit-final.log`; se repiten los controles afectados después del ajuste. |
| Registro Chromium | 64 PASS únicos | `/tmp/tintin-login-matrix-after.log`, `/tmp/tintin-login-touch-final.log` |
| Registro Firefox | 57 PASS | `/tmp/tintin-login-firefox-current.log` |
| Registro WebKit | 57 PASS | `/tmp/tintin-login-webkit-current.log`, `/tmp/tintin-google-webkit-final.log` |

Las suites Node pueden solaparse: no se presenta su suma como casos únicos. La suite completa Node del código actual terminó con **1273 PASS, 0 FAIL, 0 skip** (`/tmp/tintin-all-node-after-session.log`). Encontró inicialmente una suscripción directa del panel de conexiones a Firebase Auth; el panel ahora usa `subscribeAuthState` del coordinador único, preserva cancelación/reinicio al cambiar UID y no interpreta RESTORING/UNKNOWN como cierre de sesión. La fixture se adapta a esa misma interfaz sin relajar estados ni restricciones de escritura.

La comprobación posterior de navegación, primer render, tarifas y rendimiento terminó con 37 PASS y el nuevo caso de logo canónico con 1 PASS; las tres mediciones actuales de Envíos pasaron con 118/118/116 solicitudes, conservando presupuesto 120 y precargas originales.

Los FAIL de reproducción anteriores al arreglo se conservan como evidencia causal, no como PASS ni como fallos actuales. `audit:final` completo terminó en PASS después de corregir las validaciones intermedias de tipografía/fixture y regenerar el manifiesto (`/tmp/tintin-followup-audit-verified.log`). Se conservan los límites, precargas y todos los auditores. El plan oficial renueva sólo 31 archivos/53 registros contra main, con metadatos/alcances/sellos intactos. El build final y CI se registran en CURRENT_STATE antes de publicar. La restauración CLI usa un ejecutable de prueba y no acredita una restauración remota real.

## I. Git

#1088, #1089, #1062 y #1082 ya integrados. #1082 pasó CI `38077553526` y mantenimiento protegido `38078736757`, con aprobación de la propietaria; merge `34aa0f3b6812bc98aba6ad91075335c81ec7e378`. Su árbol coincide con el candidato aprobado. Esta corrección nueva vive en `codex/auditoria-login-multidispositivo-20261010`; su integración exige CI y revisión propios. #929 cambia dominio y conserva su instrucción expresa de no integrar hasta el corte de catálogo.

## J. Pendientes y recuperación

MFA: faltan acceso administrativo válido para comprobar/configurar Identity Platform, inscripción segura de administradores, recuperación y ensayo de enforcement. No hay credencial administrativa Firebase utilizable en este entorno. Ver propuesta revisable.

Respaldos: los documentos registran PITR/retención y restauración aislada de 960 documentos del 2026-08-08; no son prueba actual. Se verifican los guardas de la CLI. Sin acceso Google Cloud al snapshot, bucket/IAM y base aislada no puede comprobarse una nueva restauración, retención, copia independiente, RPO ni RTO actuales. No se toca producción para ensayar. Revalidar esos recursos con acceso de lectura y un destino aislado aprobado.

OAuth/correo/pagos reales, hardware físico y ciclos Sheets actuales permanecen NOT TESTED cuando dependen de cuentas o escrituras reales. No se sustituye esta evidencia por simulaciones ni sellos verdes.

## K. Producción

#1082 fue publicado: el fingerprint de origen y producción coincide, `f6a6ace672b5df465bcca8c00d0f86cc3122ff3c5b5368fa6e7a04d83be367ba`; salud de producción `38079284371` SUCCESS. Esto acredita ese árbol y las comprobaciones de salud, no las correcciones posteriores de este PR ni todos los servicios remotos.

El CI posterior de main `38079284389` falló en el presupuesto de Envíos. Se conserva ese FAIL y se corrige su causa en el candidato nuevo; la salud publicada exitosa no lo reemplaza.

Las correcciones nuevas son candidatas verificadas localmente, pendientes de CI/revisión/publicación propios. La preparación reutilizable de Firefox/WebKit y arranque se guardó en install_script/start_skill del borrador del entorno; su publicación se realiza desde configuración del entorno y no equivale a desplegar la aplicación. Frente al requisito de MFA obligatorio y recuperación actual verificada, el sistema completo está **NO LISTO para certificar todos los requisitos de producción**. Las mejoras de pantallas publicadas y los PASS concretos anteriores conservan su alcance indicado.
