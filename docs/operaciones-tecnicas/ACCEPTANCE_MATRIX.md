# Matriz de aceptación integral

Esta matriz define qué significa "revisar/reparar todo" en Tintin Web. Cada fila debe evaluarse contra el commit actual. Los comandos son puntos de entrada; el agente debe ampliar la verificación según `docs/lista-impacto-cambios.md` cuando un cambio cruce dominios.

| Dominio | Criterio mínimo de aceptación | Evidencia principal |
| --- | --- | --- |
| Build y estructura | Build reproducible; estructura y contratos arquitectónicos sin divergencias | `build:pages`, `audit:site-structure`, `audit:architecture-contracts`, `test:architecture-gates` |
| Home y shell público | Carga correcta, navegación compartida, loader y estados base sin regresión | `audit:public-shell`, navegación/browser |
| Catálogo y colecciones | Productos/colecciones visibles, rutas y estados vacío/error coherentes | auditorías de catálogo/colecciones + browser |
| Producto | Precio, stock, multimedia, SEO y producto inválido coherentes | auditorías producto/media/SEO + browser |
| Carrito | Persistencia, cantidades, reintentos y regreso de navegación sin corrupción | `audit:cart`, `test:cart-persistence`, browser aplicable |
| Checkout | No vacía prematuramente; entrega, totales, idempotencia y errores coherentes | `audit:secure-orders`, `audit:checkout-delivery`, tests checkout |
| Pedidos/stock/pagos | Autoridad server-side, concurrencia, histórico, permisos y PayPal coherentes | tests comercio/pagos/reglas + auditorías Admin |
| Login y sesión | Email/Google, restauración, logout, cuenta bloqueada y aislamiento correctos | `audit:login-isolation`, browser auth |
| Perfil | Perfil completo, onboarding, avatar y regreso desde login coherentes | `audit:login-profile` + browser |
| Roles y Super Admin | Permisos efectivos, SuperAdmin protegido y acciones administrativas autorizadas | `audit:users-roles`, Admin audits, rules |
| Firestore | Rules permiten/deniegan correctamente; una autoridad por dato | emulator tests + contratos arquitectura |
| App Check | Bootstrap y fallos no bloquean indebidamente ni se desactivan para pasar tests | `audit:app-check-bootstrap` |
| Integraciones | Sheets/Apps Script, Resend, Cloudinary y colas usan backend canónico e idempotencia | contratos integración/system health |
| CSP y headers | CSP generado vigente, hashes sincronizados y headers correctos | `verify:csp`, `audit:headers`, producción cuando aplique |
| Rutas y redirects | Rutas canónicas, aliases y redirects sin divergencias | `verify:routes`, smoke |
| Caché/versionado | Cambio de bytes implica versión coherente; no quedan referencias obsoletas | `audit:cache-versioning` |
| Diagnóstico | Manifiesto y endpoints diagnósticos coherentes con el commit | `verify:diagnostics`, diagnostic audits |
| Responsive | Desktop/tablet/mobile sin overflow, solapamientos ni controles inaccesibles | viewports canónicos + Playwright |
| Accesibilidad | Teclado, foco, labels, contraste y estados de error aceptables | auditorías a11y + browser |
| Performance | Sin regresiones conocidas de carga, listeners, LCP/CLS y presupuesto | performance audits/tests |
| SEO | Canonical, robots, sitemap, metadata y estados noindex correctos | SEO audits + producción |
| Correos/notificaciones | Envío/cola/reintento idempotente sin secretos ni duplicados | email/push audits/tests |
| Producción | Origen público, Pages Functions, catálogo, auth observable, CSP/headers y smoke sanos | `monitor:production`, checks no destructivos |
| Recuperación | Backups/rollback documentados y cambios masivos con vía de recuperación | contratos y workflows de backup |

## Regla de estado

El detalle del estado actual vive en `CURRENT_STATE.md`, no en esta matriz. Esta matriz cambia solo cuando cambia el contrato de aceptación del producto.

## Cierre global

Antes de declarar baseline estable:

1. cerrar las verificaciones específicas afectadas;
2. ejecutar `npm run audit:final`;
3. ejecutar reglas/emuladores relevantes;
4. ejecutar pruebas de navegador relevantes;
5. usar Diagnóstico Maestro para el cierre global cuando el entorno/flujo lo permita;
6. separar explícitamente lo verificado localmente, en CI y en producción.

Una compra monetaria real y cualquier escritura destructiva en producción quedan fuera de la automatización.
