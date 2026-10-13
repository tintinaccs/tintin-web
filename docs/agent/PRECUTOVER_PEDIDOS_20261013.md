# Preparación final antes de migrar — 13 octubre 2026

Solicitud del titular: dejar la web preparada para que la migración de URL sea el último paso. No ejecutar migración, DNS, cambios productivos ni operaciones comerciales reales. Codex /root.

## Candidato y origen

PR1115 se reconcilia mediante merge normal con main f5ffc5a (PR1101). Se conservan las mejoras ajenas y Pedidos; no se reescribe historial. Los conflictos de fuentes, imports y HTML quedan resueltos; metadata/caché/plan se regeneran sobre main actual.

config/public-site.json mantiene origin y firebaseAuthDomain en tintinaccesorios.pages.dev. cutover conserva tintinaccs.com, su redirect exacto y dominios de destino. El origen activo sólo cambia durante el corte autorizado. Los generadores sincronizan runtime, SEO, correo y monitor desde esa única configuración. Esto exige actualizar URLs inmutables transitivas; no es un rediseño de otros módulos.

## Evidencia actual

| Comprobación | Evidencia | Estado |
|---|---|---|
| Lógica, checkout, inventario, estados y seguimiento | node --test tests/orders/*.test.mjs tests/profile/order-history-display.test.mjs tests/payments/*.test.mjs tests/operations/order-staff-permission.test.mjs tests/sync/*.test.mjs tests/checkout/*.test.mjs: 436/436, backend simulado | PASS_LOCAL |
| Cutover y rollback de enlaces del pedido | Generador original ejecutado en copia aislada: WhatsApp pasa de pages.dev a tintinaccs.com y vuelve. Ahora incluye consumidores cloudflare .mjs | PASS_LOCAL |
| Pedidos y editor, CSS y contenedor reales | 48/48 Chromium, 24 dimensiones 320–2880px, dos sesiones, offline, clics repetidos, teclado y errores; red externa bloqueada | PASS_LOCAL |
| Preparación del dominio en código | auditar-preparacion-dominio.mjs: 17 controles, proxy Auth, ruta, configuración activa/futura, Enterprise, CSP, SEO y monitor | PASS_LOCAL |
| Recursos críticos / confiabilidad / comercio / Pedidos | Scripts y tests originales ejecutados sin falla | PASS_LOCAL |
| Versionado de caché | 322 recursos, 66 cargas dinámicas, sin dos URLs para un módulo ni reutilización con bytes distintos | PASS_LOCAL |
| Build Pages completo | npm run build:pages, incluida sincronización Monaco/shell, rutas, flujos, CSP, manifiesto y verificadores, dependencias oficiales locales | PASS_LOCAL |
| Google Sign-In y dominios Firebase | TinyFish run 46ba7bbb-8d40-460c-aeee-82b62e43ddcb: Google habilitado; apex/www/pages.dev autorizados | Verificado en lectura |
| App Check enforcement | Mismo run: Firestore aplicado, Authentication supervisión. No implica desafío satisfactorio por host | Verificado en lectura |
| DNS actual | Resolve-DnsName: apex A 23.227.38.65; www CNAME. No se cambió DNS | Verificado en lectura |

Logs locales en C:/Users/USER/AppData/Local/Temp: tintin-precutover-node.log, tintin-precutover-browser.log, tintin-precutover-domain.log, tintin-precutover-resources.log, tintin-precutover-reliability.log y tintin-precutover-cache.log. Google Cloud c1d95a67-9f12-49e6-84d9-246a374fca14 encontró el cliente web, pero devolvió valores example.com que pueden ser placeholders: redirect exacto NOT_VERIFIED. La API Browser Key no acredita reCAPTCHA. Lectura focalizada ceab1026-837b-49d4-adb4-ec49a12b699c encontró la clave Tintin App Chec en reCAPTCHA Enterprise, pero no obtuvo dominios permitidos por un modal: dominios NOT_VERIFIED. No convertir estos resultados en PASS ni confundir identificación de proveedor con autorización de dominio.

Acceso Cloudflare: el titular autorizó abrir setup TinyFish. La captura quedó en Verify with a security key y no respondió al scroll; reabrir desde el control superior Open devolvió Sign in to Cloudflare. Sesión aún no guardada/acreditada. No se canceló el perfil ni se guardó como autenticado. Captura local tinyfish-cloudflare-login-recuperado.png.

## Gates antes de declarar sólo falta migrar

- CI completo del SHA reconciliado; no heredar CI 2aca7cb ni la del main anterior.
- Mantenimiento protegido desde main con PR y SHA exactos; aprobación humana protected-flow-maintenance. El agente no aprueba en nombre del titular.
- Cloudflare autenticado: zona y Pages misma cuenta, configuración/custom domains actual, export DNS íntegro y SSL. La lectura pública no acredita la cuenta ni el certificado futuro de Pages.
- OAuth web: redirects exactos autorizados; los dominios de Firebase no sustituyen esa comprobación.
- reCAPTCHA Enterprise: dominios de la clave de la app; enforcement/métricas globales no sustituyen el permiso de dominio.
- Sesión GitHub para preparar workflow_dispatch y revisión, si no disponible por conector.
- Autorización concreta de integración/publicación técnica previa y autorización final del cambio de tráfico.

No está autorizado cambiar DNS, añadir el custom domain de Pages (puede modificar tráfico), activar redirecciones globales ni cancelar Shopify. Conservar los registros de correo y verificaciones. No enviar pedidos/pagos/correos/mensajes de prueba sobre producción.

## Último paso autorizado en el futuro

Usar docs/cutover-tintinaccs-com.md: export DNS completo, cambiar fuente canónica al destino, regenerar y validar artefactos, aprobar/desplegar SHA, activar custom domain/registro web y redirect www conservando path/query. Después comprobar HTTPS, canonical/sitemaps/redirects, proxy Auth, login y desafío App Check en el dominio definitivo. No anunciar éxito sólo porque DNS cambió.

Rollback: mantener disponible pages.dev y Shopify; restaurar sólo origen/código web y registros web desde el export verificado. No borrar pedidos, stock, Firestore ni registros de correo. El certificado y el login reales del dominio nuevo deben verificarse tras el corte; no pueden certificarse desde fixtures locales.

Limitaciones: hardware físico/Safari/Firefox e inbox real no probados. Crear una venta real no está autorizado. Si faltan accesos, el estado sigue pendiente y no se afirma «sólo falta migrar».
