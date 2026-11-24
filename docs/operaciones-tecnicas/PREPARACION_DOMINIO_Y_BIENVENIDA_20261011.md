# Preparación sin activar dominio y corrección de primer ingreso

Agente: Codex /root. Base: f67f2c23a550308487d12b26093658a2ef9dcdbe (incluye #1094, #1095 y #1096). Reconciliación posterior: b6e5a56278bee67af5040c74112cc370272d89e9 (#1097); se conservan recuperación Sheets, runner y calibración de Auth/WebKit. Autorización: preparar la migración sin ejecutarla; corregir arranque, bienvenida y reutilización de datos. La preparación histórica de #929 no se considera evidencia actual ni se integra sobre main vigente.

## Causas y comportamiento

- `index.html` ocultaba header, main, footer y navegación móvil mientras existía `welcome=1`. Se elimina ese bloqueo del documento; una importación o respuesta tardía ya no deja una pantalla vacía.
- Bienvenida: requiere perfil real de cliente activo, no bloqueado, y `welcomeTutorialPending=true`, sin marcas de vista/completado. Ni la URL ni una cuenta creada dentro de 72 horas habilitan la guía. Admin queda excluido salvo preview explícito autorizado por la configuración.
- La primera aparición se registra con una transacción Firestore antes de mostrar; otra pestaña/dispositivo que lee el mismo perfil no vuelve a mostrarla. `welcomeTutorialFirstShownAt` conserva la primera aparición incluso si se restablecen las banderas de onboarding. Cerrar libera scroll y pantalla sin esperar red. App Check y lecturas/escritura tienen plazo limitado; si falta confirmación, se conserva pendiente y el inicio permanece accesible.
- Tarjeta centrada con altura dinámica, límite de viewport y safe area; enfoque sin desplazar Safari. Una actualización de identidad cierra el overlay anterior.
- El guardado de CI, razón social y RUC ya existía. Se conservan validaciones y requisitos condicionales. Se completa tipo de contribuyente y preferencias de departamento/ciudad/modalidad/dirección/referencia; recuperación sólo de opciones aún disponibles, sin pisar una elección actual. La factura se pide voluntariamente en cada compra; sus datos se recuperan sin volver a escribirlos.
- Comprar sin factura conserva RUC/razón social/tipo anterior. Un error de lectura no habilita escritura con valores vacíos. Guardado opcional tiene plazo limitado y error visible; no convierte una compra válida en duplicada.
- Ubicación ya se guardaba en libreta del perfil para delivery; ahora también en encomienda a puerta. La ubicación guardada sigue pidiendo confirmación de un toque. La agencia no pide dirección/mapa; CI sólo encomienda, datos tributarios sólo factura.
- El snapshot canónico de Usuarios para Sheets omitía `checkoutDefaults.invoice`. Se corrige su proyección, conservando compatibilidad de perfiles históricos. Firestore sigue siendo la fuente de verdad; Sheets es un espejo administrativo, no otra base cliente independiente.

## Preparación externa de sólo lectura — 11 octubre

Observaciones actuales guardadas en `artifacts/domain-preparation/` (no se versionan datos de navegador ni credenciales):

- 13:10 UTC: HTTPS `tintinaccs.com` responde 200 y `powered-by: Shopify`. No hay cutover.
- 13:16 UTC, DNS público: NS gemma/leo Cloudflare; A 23.227.38.65; AAAA 2620:127:f00f:5::; www CNAME shops.myshopify.com. MX sin respuestas en la consulta pública; TXT de verificación Google y DMARC `p=none`. Esto no equivale a exportar toda la zona ni a verificar todos los selectores DKIM. No se crean ni borran registros.
- Lectura pública oficial de Firebase Identity Toolkit: dominios autorizados incluyen tanto pages.dev/locales como tintinaccs.com y www.tintinaccs.com. No se cambió configuración ni se inició OAuth.
- Backup de hoy: workflow 38135334540, `completed/success`, comprobado mediante GitHub. No se ejecutó restore ni se modificó la base real.
- `scripts/auditar-preparacion-dominio.mjs`: 17 controles de código PASS_LOCAL. No acredita el SSL/Custom Domain todavía no activado.

## Antes de autorizar la activación futura

1. Revisar el candidato nuevo de cutover sobre el main que esté vigente entonces y revalidar su cache/CSP/build. No integrar #929 antiguo ni el borrador de dominio automáticamente.
2. Exportar zona desde Cloudflare y confirmar zona/Pages en la misma cuenta. Conservar exactamente registros no web, incluidos correo y account; no cambiar nameservers.
3. Revisar en consolas el redirect OAuth exacto `https://tintinaccs.com/__/auth/handler`, los hosts Enterprise/App Check y propiedad Search Console. Authentication autorizado ya fue comprobado, pero no prueba Google completo ni App Check real.
4. Cerrar aceptación real de catálogo/medios/importación y paridad Sheets descrita en PREPARACION_ACTUAL_20261011.md. No se hereda PASS de 27 septiembre ni se cargan filas ficticias como datos comerciales.
5. Sólo tras nueva autorización de cutover: revisión protegida del SHA, despliegue del candidato, Custom Domain/SSL y cambios exclusivamente DNS web. Ejecutar sección E de docs/cutover-tintinaccs-com.md, incluyendo login y checkout controlado reales, antes de anunciar.
6. Rollback preparado: restaurar sólo A/AAAA/CNAME web de la captura/export y origen del código; preservar pedidos, perfiles y correo. No hay redirección global de pages.dev mientras esta preparación siga sin activar.

## Validación local observada

- 320 controles Node iniciales; tras reconciliar #1097, 329/329 checkout/sync/login/perfil, sin fallos/skip.
- 45/45 navegador con cero retries: 27 casos con SDK/servicios aislados reales; 15 componente UI con dependencias controladas; tres calibraciones del monitor. Tras los últimos cambios: 18/18 focalizados en bienvenida/recuperación Firestore, sin reintentos automáticos.
- 126/126 combinaciones de páginas y geometría estática en siete viewports; la guía dinámica se prueba separadamente en cuatro tamaños sobre cada motor/proyecto.
- Build y cache/CSP/diagnóstico correctos; 317 assets y 64 mecanismos dinámicos; auditores focalizados de incorporación, entrega, confiabilidad, imágenes y Tintin correctos; 48 contratos de mantenimiento/blobs PASS.
- Primeros intentos detectaron expectativas antiguas de tienda oculta y selector desktop aplicado a móvil. Se actualizan al comportamiento solicitado, con pruebas de interacción. Hubo un clic de producto WebKit perdido en una ejecución completa; la causa no se acredita. La repetición focalizada y la completa posterior pasan; no se añade tolerancia al caso.
- CI/revisión protegida/publicación del SHA final requieren verificación posterior; esta evidencia local no sustituye aprobación humana ni aceptación comercial.

## Límites

Las pruebas con SDK/Rules y emuladores acreditan persistencia aislada. Las pruebas del componente usan dependencias controladas para errores/timeout y no simulan aprobación real de App Check. No hay acceso autenticado a Sheets/Cloudflare/reCAPTCHA en esta sesión; paridad de datos privados y configuración externa faltante quedan NOT_VERIFIED. No se envían correos reales, pedidos, cobros, importaciones comerciales ni cambios DNS. Las resoluciones/toques de motores de navegador no acreditan hardware físico.

Revisión final de proyección: checkoutDefaults actual tiene prioridad sobre invoice/dirección/departamento históricos; un wanted=false explícito no revive la factura por un wantsInvoice legacy. Compatibilidad de perfiles sin defaults conservada. Suite sync final: 165/165 PASS.
