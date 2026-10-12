# Seguridad: lista del propietario — 2026-10-12

Codex /root. Base integrada `20cd150f5180344930d5c5062f8450b60b3c27f1` (#1106). La lista se aplica al stack real: Pages/Functions, Firebase Auth/Firestore, Apps Script y Cloudinary. No autoriza adelantar el cambio de dominio. Los resultados locales del candidato no sustituyen CI ni configuración remota.

## Verificación y acciones

| # | Control | Evidencia / estado actual |
| --- | --- | --- |
| 1 | Cloudflare delante | PASS_PRODUCTION en pages.dev: servidor Cloudflare. Dominio comercial sigue reservado al cutover final. |
| 2 | HTTPS | PASS_PRODUCTION: HTTP301 hacia HTTPS, HTTPS200 y HSTS `max-age=31536000; includeSubDomains; preload`. |
| 3 | No subir .env | .gitignore excluye .env/.dev.vars/credenciales. Inventario actual y nombres del historial de refs disponibles sólo encontraron `.env.example`. No equivale a escanear cada secreto de todo el historial. |
| 4 | Claves fuera del código | Auditoría Fase6 aprobó ausencia de claves privadas/service accounts en fuentes. Credenciales servidor se obtienen de env/Script Properties. Configuración pública de Firebase/reCAPTCHA no es una credencial administrativa. |
| 5 | Rotar filtraciones | No se identificó una credencial privada filtrada en esta revisión. No se rota una clave pública de Firebase por confundirla con secreto. Escaneo exhaustivo histórico y revocación de posibles credenciales antiguas: NOT_VERIFIED. |
| 6 | Logs sin secretos | Falla reproducida: diagnóstico Auth guardaba query y aceptaba datos anidados. Candidato elimina query, objetos, campos sensibles y sobrescritura de metadatos; conserva códigos técnicos. Prueba VM usa el módulo original con query/token ficticios. |
| 7 | Frontend sin secretos | Fase6 aprobada; claves privilegiadas son servidor. No imprimir env, propiedades privadas ni tokens durante verificaciones. |
| 8 | Debug en producción | Se elimina `console.info` de cada diagnóstico Auth; buffer acotado de eventos seguros continúa disponible para el panel. No se encontró AppCheck debug token habilitado en js/config/functions. No se desactivan errores operativos reales. |
| 9 | Rutas de prueba | `test-email` y `push-test` son herramientas del diagnóstico del Super Admin, autenticadas, no backdoors públicas. Se conserva su función operativa. `test-email` devolvía400 por ausencia de sesión y consultaba configuración antes de autenticar; candidato exige Auth primero y conserva401/403. POST sin token a importador, borrado y Sheets devolvió401 sin escrituras. |
| 10 | Cabeceras y CSP | PASS_PRODUCTION del auditor de cabeceras; Fase6 y tests CSP verifican hashes de scripts, uploads sólo en Admin/Perfil y límite de línea de Pages. Regenerar canónicamente tras cambiar referencias. |
| 11 | CORS | Helper compartido permite mismo origen y la excepción localhost del contrato de desarrollo; no hay wildcard ni dominios terceros en TRUSTED_CROSS_ORIGINS. CORS no sustituye ID token. No retirar localhost rompiendo login local sin cambiar ese contrato. |
| 12 | Login seguro | Tokens Firebase verificados criptográficamente en servidor; Google y OTP convergen por UID. Tests Auth/cuentas/login ejecutados. Validación final real de cliente y recuperación: pendiente. |
| 13 | Limitar intentos | Middleware limita Auth; OTP guarda cuotas/intentos con control de concurrencia en Firestore, no sólo Map de worker. Tests existentes incluidos en suites Auth/cuentas. |
| 14 | Permisos servidor | APIs administrativas usan requireSuperAdmin/requireOrderStaff y permisos de rol cuando aplica; no basta ocultar botones. Tres endpoints privados rechazaron solicitudes reales sin token con401. |
| 15 | Protección por defecto | Firestore termina con `match /{document=**}: allow read, write: if false`. APIs privadas validan Auth; lecturas públicas del catálogo son intencionales. |
| 16 | Aislar usuarios | Rules restringen usuario/carrito/pedidos por UID, roles y bloqueo. Auditoría Fase8 aprobada; no modificar cuentas reales para probar. |
| 17 | RLS/buckets | SQL RLS: NOT APPLICABLE. Equivalente: Rules Firestore y colecciones servidor privadas. AppCheck Firestore figura Aplicada en consola. Catálogo/avatares públicos de Cloudinary son imágenes de presentación; no hacer privado el catálogo. Bucket backups automáticos ya tenía PAP y acceso uniforme. En bucket históricorespaldos se aplicó PAP; UI confirmó No público y ambas APIs de listado sin sesión devolvieron401. Permisos individuales, objetos y retención conservados. |
| 18 | Datos y archivos | Backend valida cuerpo/tamaño, tipo de imagen, firma, URL permitida y descarga acotada. Admin-import-media limita bytes y lote; avatar limita formato y5MB. Validación del navegador no es autoridad. |
| 19 | Inyección | No hay SQL. Firestore usa datos estructurados/validación y IDs codificados, no consultas concatenadas desde entradas. Fase6 valida checkout y formatos. No afirmar un pentest exhaustivo. |
| 20 | Actualizar, backups,2FA | npm audit:0 vulnerabilidades. Backups Firestore38135334540/38047393587/37926397603SUCCESS; copias operativas previas a importación descargadas. Restauración aislada e IAM pendientes. Firebase aún no actualizado a IdentityPlatform/MFA; 2FA Google y GitHub confirmado activo en sus ajustes; Cloudflare pendiente de acceso. GitHub devolvió campo2FA null, que significa sin evidencia, no deshabilitado. Inscripción y recuperación requieren al titular; no activar enforcement y bloquearlo antes. Plan: PROPUESTA_MFA_20261010.md. |

## Sincronización y operación verificadas ahora

- #1106 integrado en SHA20cd150f; candidato CI38199225090SUCCESS, CodeQLSUCCESS, revisión nativa38200912170SUCCESS. Árbol integrado idéntico al candidato.
- Apps Script: código guardado, recargado y comparado exactamente; publicación confirmó versión24 del mismo deployment canónico, sin cambiar URL ni permisos.
- Producto ficticio `imp_4535e071a4ff206f`, fila1048 de Productos: edición web temporal de descripción → Sheets confirmó texto y fórmulas G/H/K/M relativas correctas; K1048=0, M1048=Reponer. Ventana central OP-20261012-000001: Correcto,1/1,15.2s.
- Restauración de U1048 mediante interfaz Sheets (dispara onEdit, no API de celdas) → ficha administrativa en tiempo real mostró descripción original, mismoID, Inactivo, stock0 y precio1000. Sin otro producto ni pedido. Catálogo415 conservado.
- Libro verificado: https://docs.google.com/spreadsheets/d/106Z1A8veL9fGMc4U7R10NVNMsJiEYt9wiGr4YFAav1U/edit . Evidencia visual local en artifacts/qa-sheets-roundtrip-20261012.jpg y apps-script-v24-20261012.jpg.

## Cierre pendiente

Actualización de evidencia remota: GitHub settings/security mostró Two-factor authentication Enabled y Authenticator app Configured. Google myaccount/security mostró Verificación en2pasos activada y Autenticador agregado. Se confirma2FA de ambas cuentas propietarias; no se leen códigos de recuperación ni se modifican credenciales. Resend confirmó SPF/DKIMverified y el último correo transaccionaldelivered sin nuevo envío. Cloudflare muestra login con aceptación de términos: se solicitó al titular completar ese paso. Cloudflare y MFA propio de Firebase siguen pendientes. Pruebas Auth/cuentas/login/security finales277/277PASS_LOCAL; npm audit0.

PAP evita publicaciones accidentales mediante allUsers/allAuthenticatedUsers, conservando permisos individuales y URLs firmadas. Fuente técnica: https://docs.cloud.google.com/storage/docs/public-access-prevention . Evidencia visual local: artifacts/backup-private-20261012.jpg. La privacidad no sustituye una restauración aislada actual.

Integrar/publicar candidato de privacidad Auth y contrato HTTP del diagnóstico; confirmar gates del SHA final. Luego completar aceptación real de cliente/checkout/email/AppCheck, imagen independiente y restore aislado. El enrolamiento MFA, configuración remota de cuentas y permisos no se declara hecho por tener pruebas de código. No es todavía un100% global ni autorización para cambiar DNS. #929/#1101 siguen excluidos.
