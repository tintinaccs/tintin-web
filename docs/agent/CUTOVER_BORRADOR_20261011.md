# Cutover preparado: NO INTEGRAR NI ACTIVAR

Este candidato separado se prepara por solicitud del propietario, quien excluye migrar todavía. No autoriza cambiar DNS, añadir Custom Domain, redireccionar pages.dev ni integrar este PR. Base de preparación 3488ebfd4315eceb58a3ca43ae5daefc30390775 (main, #1100 integrado); actualizar contra main y regenerar plan antes de una futura activación.

## Cambios preparados

- Origen y Firebase authDomain candidatos: https://tintinaccs.com / tintinaccs.com. Se conservan hosts pages.dev/locales junto al apex/www en App Check para transición y rollback.
- Consumidores públicos, canonical/SEO/sitemaps/robots y URLs del servidor sincronizados con la autoridad config/public-site.json; imports con versiones nuevas, sin reutilizar URLs inmutables.
- Shell público, CSP runtime y diagnóstico generados mediante scripts canónicos. Se conservan Rules, roles y controles de mantenimiento.
- Plan separado: 155 archivos protegidos / 62 registros afectados. Es una propuesta calculada, sin aprobación ni autorización para activación.

## Evidencia local de este candidato

- Build completo PASS: origen, rutas, CSP reproducible, 19 páginas del diagnóstico y caché (317 assets / 64 cargas dinámicas; seis entradas históricas conservadas).
- Preparación estática de dominio: 17 controles PASS; consumidores de dominio alineados.
- 23 pruebas de arquitectura y redirecciones Shopify PASS, sin fallos, skip ni cambios a mecanismos de auditoría.
- No equivale a login/App Check real en el nuevo dominio. CI del SHA del borrador queda pendiente de observar.

## Pendientes externos y activación futura

Seguir docs/cutover-tintinaccs-com.md y docs/agent/PREPARACION_DOMINIO_Y_BIENVENIDA_20261011.md. La consulta pública de Firebase ya incluye apex/www entre dominios autorizados; aún deben verificarse OAuth exacto, reCAPTCHA Enterprise/App Check, zona/Pages en la misma cuenta y paridad privada de Sheets. No se accedió a esas consolas con autenticación.

Antes de cutover: exportar zona completa, preservar registros no web/correo y nameservers, actualizar candidato sobre main, cerrar aceptación comercial, obtener nueva autorización y revisión protegida del SHA. Sólo entonces ejecutar activación y pruebas reales controladas. El dominio sigue en Shopify y la web vigente sigue en pages.dev.

Rollback: restaurar únicamente DNS web según exportación y origen del código; conservar perfiles, pedidos y correo. No activar redirección global de pages.dev antes de aceptación real.

La primera auditoría completa del borrador detectó la versión interna de Maestro desalineada tras el bump de sus imports. Se alinea con un tag nuevo master-align-20261011-1 (no se reutiliza URL publicada). Auditorías locales Maestro 27/27, conexiones 25/25, cierre 83/83 y módulos 140/140 PASS; responsive 5 viewports PASS. CI del nuevo SHA se verifica por separado; no cambia el main publicado.
