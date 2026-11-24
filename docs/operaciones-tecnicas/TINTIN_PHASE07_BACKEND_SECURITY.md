# Fase07 — Backend, datos y servicios conectados

2026-11-02, Codex /root. Base1159edeb (#1314), rama codex/phase07-backend-security. Revisión de fuentes y pruebas aisladas; no consultas ni mutaciones manuales de datos productivos. Las Rules corregidas son un candidato sujeto a validación; no se presentan como desplegadas ni como garantía de seguridad exhaustiva.

## Hallazgo reparado en fuente

**F01-RULES — HIGH.** `staffOrderInventoryTransitionValid` devolvía true cuando status no cambiaba. El allow update de orders admitía inventoryState, inventoryRevision, inventoryUpdatedAt e inventoryUpdatedBy sin exigir permiso de módulo para esos campos. La reproducción histórica de01 demostró escritura de agente sin lectura autorizada; el código vigente conservaba exactamente ese camino. El cambio mínimo rechaza metadata aislada y exige permiso cambiarEstado para la rama de transición, además de la coherencia de estado, revisión consecutiva, identidad, fecha y productos del commit ya exigidas.

También se bloquea la transición SDK para pedidos con más de4líneas o reservas por variante: el helper legado sólo verifica4productos agregados y no valida matrices. Esos pedidos deben pasar por el dominio canónico. Se añade reproducción con primeras4líneas sin control de stock y quinta controlada, más reserva por variante; no se deben liberar sólo cambiando metadata.

No cambia la excepción explícita Super Admin del contrato ni se añaden permisos. Los cambios de pago sin metadata de inventario conservan su camino autorizado. El escritor server-side de pedidos conserva CAS, idempotencia, reservas por variante, auditoría y efectos posteriores; las Rules del SDK no son sustituto de sus controles. La eliminación definitiva SDK es exclusiva del Super Admin; su transacción existente se conserva. No se migran pedidos ni stock.

Regresión reproducible: `scripts/probar-firestore-critico.mjs`, ejecutada por test:rules-critical. Cada inventory* aislado, combinado y revisión999 se rechaza para Admin/Agente/Viewer/Cliente; se comprueba agente con todos los permisos de pedidos deshabilitados, lectura denegada y escritura denegada. Se conserva caso positivo de pago autorizado sin alterar inventario. La suite existente comprueba dueño/ajeno, correo sin verificar, creación directa, precios/stock, roles y secretos. La integración Firestore real prueba simultaneidad, reservas, cancelaciones y proveedor simulado.

## Mapa de confianza y cobertura

| Área solicitada | Autoridad y controles examinados | Evidencia y límites |
| --- | --- | --- |
| Auth y sesiones | Firebase token verificado, coordinador de sesión, OTP server-side y perfil/bloqueo | Suites auth/accounts; no login productivo ni creación real de cuentas. |
| Modelos y Rules | products/orders/users, subcolecciones privadas, permiso por rol, identidades inmutables | Parche F01 y regresiones SDK. Rules desplegadas NOT_VERIFIED. |
| Aislamiento | orders por UID/correo verificado; perfil/cart/notifications privados, administración por permisos | Rules críticas y pruebas endpoints; no consulta de datos ajenos reales. |
| Operaciones comerciales | product-editor-domain y order-admin-domain; entrada no confiable normalizada, precios server-side | Suites pedidos/sync y CAS. No compras, cobros ni stock real. |
| Atomización/reintentos | commit con precondiciones, changeId/requestId, secuencia/pedido/reserva, devolución idempotente | Suites de dominio y commerce-firestore en CI; no atribuir atomicidad a efectos externos. |
| APIs Cloudflare | requireFirebaseUser/requireSuperAdmin/requireOrderStaff; permisos guardados, límites y statusFromError | security/operations:401/403/404/409/429/5xx según contrato; no se afirma cubrir toda combinación de endpoint/estado. |
| Despliegue/CSP/rutas | Generadores canónicos y preflight, cabeceras, middleware y mantenimiento protegido | build:pages y CI; no edición manual de derivados ni apertura de CSP. |
| Correo y colas | Colas existentes de pedidos/catálogo/engagement; confirmación del dominio y reintentos diferidos | sync/operations con IO simulado. Entrega real NOT_VERIFIED, sin envíos. |
| Webhooks | Verificación PayPal y secretos distintos Sheets entrante/saliente; router de integración | payments/security/operations; proveedor, secreto remoto y versión de Apps Script NOT_VERIFIED. |
| Secretos/PII | Credenciales sólo servidor, payloads públicos acotados, mensajes sanitizados | Tests secretos-sheets y límites/estatus; no se leen ni imprimen valores del entorno. No se infiere correcta configuración remota. |
| Logs/abuso | Límites compartidos, deadlines, status de error y diagnóstico sin elevar permisos | security, architecture y operations. Retención/observabilidad del proveedor NOT_VERIFIED. |
| Backups/recuperación | Scripts inspeccionados, dry-run sale antes de spawn; confirmación restore incluye proyecto/base, snapshot completo sobrescribe IDs | Pruebas de backup cifrado y dry-run con demo-tintin-phase07/bucket ficticio. Nunca export/import real. Recuperabilidad real requiere ensayo autorizado en otra base. |

## Consultas e índices

Se contrastan consultas paginadas de perfil/admin, home-index y transporte REST con las suites correspondientes. `firebase.json` sólo declara firestore.rules; no hay manifiesto de índices versionado. Esto **no demuestra índices ausentes**: el emulador tampoco valida los índices compuestos de producción. No inventar un manifiesto a partir de supuestos ni declarar compatibilidad desplegada. El cierre requiere inventario/export de índices autorizado por el propietario y contraste con consultas reales. La prueba del índice de pedidos está en test:rules-critical.

## Sincronización y errores parciales

Firestore/dominios son autoridad; Sheets es espejo con cola/acuse y conflictos409. Correo, push, proveedor y Sheets no participan del commit comercial; sus fallos no deben deshacer un pedido confirmado ni generar otro. Las suites existentes cubren reintento, duplicado, conflictos, cuotas, errores externos y stock. La ruta pública Apps Script fue retirada en05 en fuente; verificar su deployment sigue pendiente. No se supone que sistemas externos estén sincronizados por aprobar una simulación.

## Evidencia y operaciones pendientes

- 729 pruebas Node de seguridad/auth/cuentas/pedidos/pagos/sync/operaciones/arquitectura PASS,0SKIP. Queries/CI/preflight y build se acreditan en los logs y recibos de esta rama.
- Auditoría security PASS. Backup/restore sin variables se detuvieron con código2, como corresponde; repetición con proyecto/bucket/base ficticios y --dry-run no ejecuta gcloud y pasa. No prueba existencia de copias ni su restauración real.
- Rules local BLOCKED: descarga del JAR oficial desde storage.googleapis.com no permitida en este entorno. No se presenta como RED/GREEN ejecutado; la regresión se añade al gate aislado de CI y requiere resultado terminal. El razonamiento sobre el bypass se apoya en código vigente y reproducción histórica, distinguiéndolos.
- Publicar Rules: operación separada, **requiere autorización explícita**. Workflow existente `Publicar reglas Firestore`, main + input PUBLICAR_REGLAS + environment production-rules, valida emulador antes del deploy. No se dispara como parte de este trabajo. F01 sólo puede cerrarse en producción después de publicar y verificar ese SHA con autorización.
- También requieren autorización separada: leer/exportar configuración/datos productivos para revisar índices, cualquier backup/restauración real, migración, actualización de WebApp, envío de correo/push/webhook real, lectura de logs con PII o rotación de secretos. No se ejecutan.
- F02-STATS y otros pendientes globales no se cierran por esta fase. No se declara auditoría exhaustiva de todos los servicios desplegados.

Evaluación del hallazgo de Rules (formato del Skill, antes de validar despliegue):
```json
{"score":2,"summary":"Bypass HIGH confirmado en fuente y reparado en candidato; despliegue y validación externa pendientes, sin puntuación global de producción","findings":[{"check":"Update bypass/field authority","severity":"major","issue":"Staff podía editar metadata inventory* sin transición ni permiso","recommendation":"Validar candidato con emulador, publicar Rules sólo con autorización y verificar el SHA desplegado"}]}
```
