# Índice de arquitectura para esta auditoría

La arquitectura equivalente ya existe. Este archivo es un índice, no otra
definición de roles, rutas, datos o despliegue.

- `arquitectura-tecnica.md`:presentación HTML/CSS, aplicación JS modular,
  Firestore, identidad y límites del servidor.
- `arquitectura-operativa-canonica.md` y `autoridades-sincronizacion.md`:datos
  comerciales e integraciones; Firestore es autoridad y Sheets un espejo.
- `arquitectura-versiones-canonicas.md`:generadores de rutas/CSP/caché/shell,
  manifiesto y avisos semánticos de actualización.
- `contratos-calidad.md`:responsive, accesibilidad, estados y presupuestos.
- `../DESIGN.md`:documentación del sistema visual actual.
- `AUDITORIA_PROFESIONAL.md` y `QA_REPORT.md`:inventario, riesgos, evidencia y
  continuidad de la revisión local de `5a2ea0f63`.

Frontend:HTML/CSS/JS nativos; backend:Cloudflare Pages Functions y módulos
`cloudflare/`; identidad:Firebase Auth Google/OTP; datos:Firestore/Rules.
No cambiar stack ni duplicar contratos para completar esta auditoría.

## Límites que futuros agentes deben conservar

Las páginas se sirven como documentos; las Functions de producto añaden SEO
servidor y las rutas limpias se generan. No convertir actualizaciones de campos
en navegación/remontajes. Header, footer, carrito y loaders tienen autoridades
compartidas, no una implementación nueva por página.

Los endpoints privados reciben Firebase ID tokens Bearer, verificados en
servidor con claves públicas y correo verificado; el perfil/Rules gobierna
bloqueo y rol, no un role enviado por cliente. Super Admin es una excepción
explícita del contrato de cuentas. El control CSRF no es un formulario de
contraseña basado en cookie:revisar Origin y autenticación por operación.
No inferir que CORS por sí solo autentica solicitudes.

Frontend no fija precios, pertenencia, estado de pago, stock ni cuotas.
`cloudflare/` contiene dominios, transacciones/idempotencia, permisos y
adaptadores externos. Sheets es espejo; no invertir autoridad con Firestore.
Los webhooks tienen autenticación propia (secreto/firma/OIDC); no trasladarles
indiscriminadamente un guard de sesión del navegador.

La tienda no implementa organizaciones multiempresa. La separación relevante
es usuario/UID, rol y borrador privado. Los datos públicos del catálogo usan
campos explícitos/caché pública; respuestas privadas usan no-store.
El inventario de58 adaptadores y límites está en AUDITORIA_PROFESIONAL.

## Repetición local segura

`scripts/servidor-local-pruebas.mjs` sirve rutas limpias y fixtures sin escribir
en producción. `test:critical-runtime` inicia Auth/Firestore demo, carga Rules
reales y ejecuta Chromium desktop/móvil y WebKit. No interpretar fixtures como
aceptación del proveedor. `ci:rules` requiere puertos de emulador disponibles;
no solaparlo con runtime. Los tests de navegador que comparten test-results
pueden reemplazar capturas anteriores:conservar evidencia relevante aparte.

Build y auditorías canónicas regeneran rutas/CSP/shell/manifiestos; el plan de
mantenimiento protegido se calcula desde hashes reales contra la base. No
editar sellos manuales, relajar aserciones ni publicar para cerrar esta tarea.
