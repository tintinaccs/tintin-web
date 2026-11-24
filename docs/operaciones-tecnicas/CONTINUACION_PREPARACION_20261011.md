# Preparación para importación y aceptación — 2026-10-11

Codex /root. Base vigente main 3488ebfd4315eceb58a3ca43ae5daefc30390775 (#1100 publicado). La nueva instrucción del propietario excluye migrar dominio, DNS y origen comercial, e integrar #929 o #1101. Shopify permanece disponible. No se permiten compras, pedidos, correos reales ni mutaciones de clientes como pruebas. La ubicación Windows del handoff no está montada en este entorno Linux.

## Evidencia actual y estado por requisito

| Requisito | Estado y evidencia observada | Dependencia pendiente |
| --- | --- | --- |
| A. Progreso de importación #1099 | PASS_LOCAL: reconciliado con main actual, conserva bienvenida/checkout; 58 Phase2, incluidas dos regresiones nuevas de actividad visible y liberación tras éxito/fallo. Build/caché reproducibles. | CI, revisión protegida del nuevo SHA, merge y cotejo publicado. |
| B. Monitor | FAIL reproducido en log 38143127671: aviso exacto Google frame-ancestors report-only. Salud actual 38152168143 SUCCESS sobre main3488; login/perfil tienen throttling reCAPTCHA, no equivale a App Check comprobado. | Commit af8e7f2 local Windows no está disponible en este checkout; recuperar o implementar la misma clasificación en PR separado, manteniendo errores reales bloqueantes. |
| C. Importación QA real segura | BLOCKED: no hay CSV QA ni sesión Super Admin/Chrome conectada en este entorno. No se elude la restricción Allow access to file URLs descrita en el handoff. | CSV ficticio autorizado, permiso de archivo confirmado por usuario y sesión autenticada; backup/alta/persistencia/reanudación/paridad por interfaz. |
| D. Medios Cloudinary | PASS_LOCAL contratos en suite Node; público actual 279 productos/12 colecciones sin referencias shopify.com. | Preflight autenticado y copia real de medios; no activar permanentemente SHOPIFY_PHASE2_MEDIA_WRITE. |
| E. Feedback CRUD | PASS_LOCAL contratos Node; edición/restauración del handoff es evidencia histórica, no repetida aquí. | Alta/borrado de colección ficticia autorizada y feedback central con sesión Admin. |
| F. Cliente | PASS_LOCAL Node de cuentas/auth/checkout; CI publicada actual observada. | Google/OTP real, favoritos/carrito/guardar para después/checkout con sesión real. No pedidos ni correos comerciales de prueba. |
| G. Bloqueada/eliminada | CORRECT: decisión canónica vigente en DECISIONES_CUESTIONARIO: eliminar cuenta DIFERIDO. Tests Node de cuentas pasan; no se cambia la decisión ni clientes reales. | Recorrido autenticado aislado y mensajes WhatsApp observables. |
| H. Correo/push/App Check | PASS_LOCAL tests de colas/push/checkout; salud observable. | Entorno aislado autenticado y entregas de prueba apropiadas. Throttling runner sigue NOT_VERIFIED para desafío real. |
| I. Sheets bidireccional | PASS_LOCAL pruebas de sync/Apps Script en suite Node. No se accede a Sheets privado ni Apps Script live en esta sesión. | Ciclos posteriores, paridad real tras alta y edición Sheets→Firestore; latencia intermitente no explicada. |
| J. PayPal/BCP | PASS_PRODUCTION lectura pública: sandbox, enabled=false únicamente feature_disabled; rateSource BCP, sourceDate 2026-10-09, updatedAt2026-10-09T21:28:18.991Z dentro de 7 días. Código consulta fuente oficial www.bcp.gov.py/webapps/web/cotizacion/monedas; tests pagos pasan. | Comparar cifra privada con BCP autenticado si se requiere. No habilitar Live; deshabilitado no es fallo comercial actual. |
| K. Backup/restore | Backup38135334540 SUCCESS comprobado hoy; tests restore guardan proyecto/base exactos. | Restauración remota nueva aislada requiere GCP autenticado y base de ensayo; nunca sobre producción. |
| L. MFA | BLOCKED activación: propuesta PROPUESTA_MFA_20261010 vigente; Identity Platform, Google primer factor, ensayo TOTP/recuperación/inscripción previos al enforcement. | Acceso administrativo y proyecto aislado; no bloquear al dueño ni afirmar MFA implementada. |
| M. Pantallas/SEO/entrega | Salud actual38152168143 SUCCESS: 17 rutas y APIs, catálogo, CSP/cache/headers. CI3488SUCCESS observada. | CI del candidato nuevo, dispositivos físicos y Search Console/OAuth/DNS futuros; sin cutover. |

Suite local actual: 609/609 Node de import/accounts/auth/sync/checkout/payments/push/operations, sin fallos ni skip. Incluye 58 Phase2; no sumar ambas cifras como casos distintos. No son pruebas reales de producción ni de dispositivos físicos. Evidencia pública read-only actual: health200, catálogo279 productos/12colecciones, PayPal deshabilitado sandbox BCP fresco. No se incluyen documentos privados ni credenciales.

## Hitos

No declarar aún «ya podés comenzar a importar catálogo y validar»: falta C/D/I reales. Tampoco «ya se puede cambiar el dominio»: faltan aceptación comercial, cuenta/checkout/email/App Check y preflight externo. Actualizar este estado con CI del SHA final y con integración/publicación reales; no heredar PASS de informes antiguos.
