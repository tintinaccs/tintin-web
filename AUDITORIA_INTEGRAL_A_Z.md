# AUDITORÍA INTEGRAL A–Z — Tintin Accesorios & Relojes

Estado: **PARCIAL — NO COMPLETAMENTE VALIDADA** (ver D e I).
Fecha de inicio: 2026-09-23. Entorno auditado: producción `https://tintinaccesorios.pages.dev` (dominio real del sitio según `_redirects`/`robots.txt`), sólo lectura. Repositorio local: `C:\Users\TI\Documents\tintin-web-main`.

## Notas de método
- El directorio **no era un repositorio git**. Se creó un git local con un commit base (`a58d852`) y la rama `audit/integral-a-z`; `audit/` y `.playwright-mcp/` están excluidos vía `.git/info/exclude`. Ningún cambio se despliega.
- Verificado que los archivos locales `styles.min.css`, `tienda.js`, `js/core/auth/diagnostico-sesion.js`, `firestore.rules`, `robots.txt`, `sitemap-pages.xml` son **idénticos (SHA-256)** a los servidos en producción → el repo corresponde al despliegue.
- No se cargó `tintin-codigo.md`. No se crearon pedidos, pagos ni correos; no se escribió en datos de producción.
- Evidencia: `audit/evidence/` (capturas por ruta × ancho en `shots/`).

## A. Resumen ejecutivo (parcial)
- Suites de pruebas Node existentes ejecutadas y en verde: checkout-contract (88), paypal (3), cart-persistence (4), accounts (18), architecture-gates (11), products-sync (42), engagement (44), web-push (29), site-activity (4), phase9-import (5), flow-connections (24).
- `firestore.rules`: default-deny (`/{document=**}` → false); pedidos sólo creados por el servidor; datos sensibles (`productInventory`, `reviewRecords`, `emailLogs`, tokens push) restringidos. **CORRECTO** en lo revisado.
- Endpoints sensibles revisados: webhook PayPal verifica firma vía `/v1/notifications/verify-webhook-signature`; proxies a Apps Script reenvían `idToken` para validación aguas abajo; límites de tasa en `functions/_middleware.js`.

## C. Hallazgos

### F-SEC-01 — MEDIUM — Archivos internos servidos públicamente en producción
- Evidencia (HTTP 200 en producción): `/firestore.rules`, `/package.json`, `/package-lock.json`, `/AGENTS.md`, `/README.md`, `/FULL_JOURNEY_CODE_AUDIT.md` y demás `*.md` de la raíz, `/docs/*.md`, `/diagnostic-manifest.json` (1.2 MB), `/.env.example`, `/.firebaserc`, `/firebase.json`, `/scripts/*.js`, `/cloudflare/*.js` (código de servidor, p. ej. `paypal-seguro.js`), `/apps-script/*.gs` (código de Apps Script), `/config/csp-runtime.js`.
- Ya bloqueados (404): `/functions/*`, `/tests/*`, `/maintenance/*`, `/tintin-codigo.md`, `/_headers`, `/_redirects`.
- Impacto: divulgación de arquitectura, reglas, nombres de secretos y lógica de servidor a terceros (facilita reconocimiento; no se encontraron secretos reales: `.env.example` tiene valores vacíos y en `.gs` no se detectaron credenciales literales). Un ID de hoja de cálculo aparece en `apps-script/ProductosUnificados.gs:5` (identificador, no credencial).
- Causa raíz: Cloudflare Pages sirve la raíz del repositorio como salida estática; `_routes.json` sólo enruta a Functions una lista explícita.
- Corrección propuesta (NO aplicada — afecta despliegue/enrutamiento de producción, requiere aprobación): publicar un directorio de salida (`dist/`) con sólo los recursos públicos (HTML, css, js, images, assets, manifiestos, robots/sitemaps) en `build:pages`, o bien añadir a `_routes.json` (límite 100 reglas) comodines `/scripts/*`, `/cloudflare/*`, `/apps-script/*`, `/docs/*`, `/config/*`, `/*.md` y un handler que responda 404. Estado: **PENDIENTE DE APROBACIÓN**.

### F-SEO-01 — MEDIUM — Soft-404 indexable en `/product`
- Pasos: `GET /product` y `GET /product?id=DOESNOTEXIST123`.
- Observado: HTTP 200, `<meta name="robots" content="index, follow, max-image-preview:large">`, canonical `/product`. Un producto inactivo (`active === false`) sufre lo mismo.
- Esperado: no indexable cuando el producto no existe/no está publicado.
- Causa raíz: `functions/product.js` (`onRequest`) devolvía el documento estático base sin más en esos tres casos.
- Corrección: `withNoindex()` añade `X-Robots-Tag: noindex, nofollow` y `Cache-Control: no-store` en sin-id/id inválido/no existe/inactivo (los timeouts y errores transitorios siguen igual). Archivos: `functions/product.js`, test nuevo `tests/seo/product-noindex.test.mjs`.
- Validación: test unitario 2/2 OK. **Sin verificar en navegador/producción** (requiere despliegue o `wrangler pages dev`). Estado: **CORREGIDO EN RAMA, VERIFICACIÓN PARCIAL**.

### F-SEO-02 — LOW — `/nosotros` con noindex pero bloqueado por robots.txt
- `/nosotros` sirve `meta refresh` a `/about`, `noindex, follow` y canonical `/about`, pero `robots.txt` hace `Disallow: /nosotros`, por lo que los buscadores no pueden leer el noindex/canonical. Efecto práctico bajo (la ruta no está en el sitemap). Remediación: quitar el Disallow durante la transición o redirigir 301 en `_redirects`.

### F-SEO-03 — LOW — `/404` responde 200
- `GET /404` → 200 (bloqueado por robots.txt). Las rutas inexistentes sí devuelven 404 real. Sin impacto de indexación por el Disallow.

### F-DATA-01 — MEDIUM — Productos con imagen apuntando a archivos inexistentes en Shopify CDN
- Repro: `/catalogo` (1440 px, contexto limpio, tras scroll): 90 <img>, 5 con carga fallida; `display:none` aplicado por el runtime → tarjetas sin foto: RELOJ ISADORA, RELOJ LUNARIA, COLLAR OJO TURCO, COLLAR ORLENA, COLLAR VAELIA.
- Evidencia: `curl` a esas URLs de `cdn.shopify.com/.../files/*` → HTTP 404 text/html (Chrome lo registra como `ERR_BLOCKED_BY_ORB`). Captura: `audit/evidence/catalogo_broken_imgs_1440.png`.
- Causa raíz: dato (`imageUrl` en Firestore) que referencia archivos borrados/renombrados en Shopify; no es un defecto de código (el front oculta la imagen rota sin romper el layout).
- Corrección: re-subir/actualizar las imágenes de esos productos (cambia datos de producción). Estado: **PENDIENTE DE APROBACIÓN**. Sólo se inspeccionó la primera página del catálogo (48 de 176 productos): puede haber más.

### F-UX-01 — LOW/MEDIUM — `/perfil` sin sesión muestra el shell del perfil sin redirección ni llamada a iniciar sesión
- Repro: contexto limpio, 390 px, `/perfil` → permanece en `/perfil` y muestra "Cuenta Tintin · Perfil privado", "Cambiar foto", Pedidos 0, sin CTA de login (`audit/evidence/perfil_guest_390.png`). No se expone información de usuario alguno.
- Impacto: confusión de un visitante no autenticado. Decisión de producto (redirigir a `/login` con retorno vs. mensaje) → **PENDIENTE**, no modificado.

### F-CSP-01 — LOW — Configuración CSP versionada desincronizada del generador
- `npm run verify:csp` fallaba en el repo: `config/csp-runtime.{js,json}` contenían 4 hashes de más por ruta (39 entradas) respecto a `scripts/generar-csp-cloudflare.js`. La producción actual sirve, para `/about`, una CSP que sí incluye los hashes de sus scripts inline (verificado con contexto limpio: 0 errores CSP).
- Corrección (en rama): `npm run build:csp` regenera ambos archivos; `verify:csp` → OK ("38 rutas HTML … 142 handler(s) fijados por hash"). Endurece la CSP (quita hashes obsoletos). **No desplegado.** Estado: **CORREGIDO EN RAMA; verificación en navegador NO PROBADA** (requiere despliegue).

### F-CHK-01 — HIGH — `/checkout` lee Firestore sin esperar App Check (permission-denied al llegar desde otra página)
- Repro (producción, contexto limpio, 3/3 y en otras variantes): visitar cualquier página (`/catalogo`, `/about`) y luego `/checkout` → consola: "No se pudo escuchar las tarifas de envío…" y "…la configuración de la tienda…: Missing or insufficient permissions" (`settings/shippingRates`, `settings/general`). Carga directa de `/checkout` como primera página: 0 errores (sin carrito y con carrito sembrado).
- Causa raíz: `checkout.html` (`subscribeStoreConfig`) inicia los `onSnapshot` sin esperar `appCheckReady` (exportado por `js/core/firebase/firebase.js`; otros 26 módulos sí hacen `await appCheckReady`). Con App Check exigido en Firestore, la lectura sale sin token.
- Impacto: medios de pago, cuentas bancarias, estado de apertura y ciudades/costos de envío no se cargan; el propio código deja las ciudades vacías ("nunca se inventan ciudades ni precios"). **Impacto confirmado**: con un artículo en el carrito, `#ck-departamento` tiene 1 opción (solo el placeholder) al llegar por "COMPRAR AHORA" desde la ficha y al abrir `/checkout` tras visitar la ficha; con carga directa tiene 19 (18 departamentos + placeholder) y 0 errores. Sin departamentos no se puede elegir ciudad ni calcular envío por delivery/encomienda (retiro en tienda: no probado). Es el camino normal de compra (ficha → checkout).
- Corrección (en rama): `checkout.html` importa `appCheckReady` y `subscribeStoreConfig` lo espera (`.catch` → continúa igual). CSP regenerada (`verify:csp` OK). **NO verificada**: App Check no funciona en localhost (reCAPTCHA) y no se despliega. Estado: **CORREGIDO EN RAMA, SIN VERIFICAR**.

### F-UX-02 — LOW — Filtro de precio invertido y aviso de stock
- `?min=100000&max=50000` (mín > máx) no filtra ni avisa: muestra los 224 productos con la URL conservando el rango. Al agregar un producto con stock 1 ya en el carrito, el toast dice "Producto actualizado" sin indicar que se alcanzó el tope de stock.
- Enter en el buscador del header (`#search-input`) abre sugerencias pero no filtra la grilla (el filtro real está en `#cat-search`).
- Corrección propuesta (no aplicada; es decisión de UX): normalizar/avisar rango inválido y mensaje de tope de stock.

### F-A11Y-01 — LOW/MEDIUM — Botón de favorito de las tarjetas del catálogo sin nombre accesible (invitado)
- Evidencia: en /catalogo (producción, invitado) los 48 `.tt-card-favorite` exponen solo `button` en el árbol de accesibilidad (sin aria-label). `sincronizacion-favoritos.js` `publish()` sí asigna "Guardar X en favoritos", pero no vuelve a ejecutarse tras renderizar la grilla: al llamar `TintinFavorites.refresh()` a mano el nombre aparece.
- Corrección (en rama): `catalogo.html` genera `aria-label` en la plantilla de la tarjeta; CSP regenerada (`verify:csp` OK). **No verificada de extremo a extremo**: en local las tarjetas no se renderizan (Firestore/App Check); solo comprobé que el HTML servido contiene el atributo y que la página no lanza errores de sintaxis. Estado: **CORREGIDO EN RAMA, SIN VERIFICAR**.
- Sin revisar/no corregido: plantillas equivalentes en `tienda.js` (líneas ~366, 410, 784) y `js/pages/product/seleccion-producto.js` (~101) tampoco fijan aria-label al renderizar; no comprobé si sufren el mismo desfase.

### F-A11Y-02 — LOW — Sin `<main>` ni enlace "saltar al contenido"
- /, /catalogo, /product, /checkout y /contact no tienen landmark `main`; solo /login lo tiene (con skip link). No se corrige: agregar landmarks toca el layout de cada página y requiere decisión/pruebas visuales.

### F-PERF-01 — LOW/MEDIUM — CLS variable en la ficha móvil
- 6 corridas en 390 px de `/product?id=iMhuRR4V9srzst736oKR`: CLS 0.04, 0.04, 0.08, 0.29 y 0.70 (umbral "malo" > 0.25). Fuente: `#product-grid` se desplaza 12 px (64→52) al terminar de hidratar la ficha; como el contenedor mide ~750 px el valor sube según lo que esté en pantalla. Causa raíz no aislada; sin corrección. Medición sin throttling y sin CrUX: indicativa, no de campo.
- LCP móvil: / 2.3 s, /catalogo 3.5 s (233 requests, 2.4 MB), ficha 1.9 s.

### F-TEST-01 — LOW — Test previo desactualizado
- `tests/performance/navegacion-inmediata.test.mjs:92` ("el adaptador y el preload comparten una sola identidad de navegación") falla también sin mis cambios (git stash): espera `ENTRY_VERSION = tintin-20260922-profile-timeout-fix-1` y el adaptador tiene `tintin-20260921-document-navigation-no-view-transition-css-1`. No lo toqué.

### F-SEO-04 — LOW — Canonical `.html` en páginas noindex
- `login.html`, `perfil.html`, `checkout.html` declaraban canonical `…/login.html` etc. (las URLs `.html` redirigen 308 a la limpia). Son `noindex, nofollow`, impacto mínimo. Corregido en rama a URL limpia; `verify:csp` OK. Estado: **CORREGIDO EN RAMA** (verificación por HTML fuente, no en producción).

### Observaciones descartadas / no concluyentes (no son hallazgos)
- **Violación CSP de script inline en 8 rutas (barrido inicial):** NO reproducible. Fue un artefacto del perfil persistente del navegador: se reutilizaba una respuesta cacheada previa con la CSP genérica (1490 car.). Con contextos limpios: 0 errores en `/about /contact /envios /collections /privacidad /preguntas-frecuentes /cambios-devoluciones`. Descartado.
- **Canonical `.html` en `/catalogo` y `/collections` (barrido inicial):** no reproducible por HTTP directo (canonical limpio). Descartado.
- **`/admin` sin sesión: "Missing or insufficient permissions" en `settings/general`/`storeGate`:** una lectura REST sin autenticar a `settings/appearance` (regla `allow read: if true`) también devuelve 403 ⇒ consistente con App Check aplicado en Firestore, no con un desvío de reglas. **No concluyente**: no se pudo confirmar sin credenciales/consola Firebase. Sin evidencia de defecto.
- `ERR_ABORTED` de Firestore Listen, logo y reCAPTCHA `clr`: cancelaciones por navegación, benignas.
- Fallo de `test:phase11-seo` contra producción: la especificación espera el fixture del servidor local (`x-tintin-product-meta: server-test`). Con `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4184` y `scripts/servidor-local-pruebas.mjs`: **5/5 OK**. `tests/performance/product.performance.spec.js` falla localmente por requerir datos reales (no evaluado).

## D. Matriz de cobertura
| Área | Estado |
|---|---|
| Reglas Firestore (lectura estática) | VERIFICADO (estático); emulador NO PROBADO (Java/Firebase emulator no comprobado) |
| Suites Node existentes (11) | VERIFICADO |
| Barrido Playwright 18 rutas × 6 anchos (320–1440): overflow horizontal, imágenes en DOM, consola, red | VERIFICADO (con salvedad: perfil persistente generó falsos positivos CSP; recontrastados en contexto limpio) |
| Revisión visual de capturas | PARCIAL: 6 de 108 capturas revisadas a ojo; banner de cookies tapa parte de la vista (sin consentimiento) |
| CSP en 7 rutas institucionales (contexto limpio) | VERIFICADO |
| Catálogo: render, 48 tarjetas, imágenes | ERROR CONFIRMADO (F-DATA-01) |
| Catálogo: paginación (48→96, "Mostrar más (128)") y panel de búsqueda (sugerencias; mensaje "No encontramos productos con esa búsqueda.") | VERIFICADO |
| Catálogo: filtros categoría (conteos = sidebar: Relojes 39, Bags 11, Tobilleras 4, Gafas 6, Anillos 0 → estado vacío; deep link `?cat=relojes`), precio (`?min&max`), "solo con stock", LIMPIAR, orden (precio asc/desc, nombre, stock), buscador `#cat-search` (`?q=`, sin resultados, HTML inyectado no se ejecuta), "Mostrar más" con filtro activo (Collares 48→59) | VERIFICADO |
| Catálogo: Enter en el buscador del header no filtra la grilla | ERROR CONFIRMADO (F-UX-02) |
| Carrito invitado: agregar, badge, persistencia tras recarga | VERIFICADO |
| Carrito en /checkout: +, −, quitar, estado vacío "Tu carrito está vacío" | VERIFICADO |
| Ficha `/product?id=` real (RELOJ ALLEGRA): título, canonical, JSON-LD server-side, precio, imágenes, variantes obligatorias con aviso "Por favor seleccioná una opción", agregar al carrito con variantes | VERIFICADO |
| Ficha sin variantes (RELOJ AMELIA, stock 1): sin selectores, agregar desde tarjeta y desde ficha, tope por stock (+/− deshabilitados, carrito queda en x1 aunque se repita), COMPRAR AHORA → /checkout con 1 ítem | VERIFICADO |
| Ficha agotada (RELOJ AMARA, 57 de 224 productos agotados): JSON-LD OutOfStock, "SIN STOCK", COMPRAR AHORA y +/− deshabilitados, sin botón de agregar, carrito intacto; tarjeta con botón deshabilitado | VERIFICADO |
| Responsive 320/375/390/768/1024/1440 × 7 rutas (/, /catalogo, /product, /checkout, /about, /contact, /login): sin overflow horizontal de página; tabs de categorías móviles con scroll interno intencional | VERIFICADO (medido; sin revisión visual de capturas) |
| Rendimiento (Playwright, sin throttling): LCP 1.6–3.5 s (peor: /catalogo móvil 3.5 s); CLS 0.002–0.084 salvo /product móvil variable 0.04–0.70 | ERROR CONFIRMADO (F-PERF-01) |
| Accesibilidad: lang, 1 h1, alt en imágenes, labels de inputs, foco visible en 12 tabulaciones × 6 rutas, zoom no bloqueado | VERIFICADO |
| Accesibilidad: botón favorito de tarjetas sin nombre accesible; sin <main> ni skip link (salvo /login) | ERROR CONFIRMADO (F-A11Y-01, F-A11Y-02) |
| Favoritos con sesión, reseñas | NO PROBADO (requiere cuenta) |
| /checkout tras navegar desde otra página | ERROR CONFIRMADO (F-CHK-01) |
| `/product` sin id/inválido/inactivo → noindex (F-SEO-01) | CORREGIDO EN RAMA; unit test OK; NO verificado en navegador/Pages |
| Login: UI y validación de envío vacío | VERIFICADO (sin cuentas reales) |
| Login real, registro, recuperación, Google | NO PROBADO (sin cuentas de prueba autorizadas) |
| `/perfil` invitado | ERROR CONFIRMADO (F-UX-01) |
| `/checkout` invitado con carrito vacío | VERIFICADO (carga, sin errores); flujo de pedido/pago NO PROBADO (prohibido crear pedidos/pagos) |
| Admin / roles (SuperAdmin y demás) | NO PROBADO (sin credenciales); acceso sin sesión: errores de permisos no concluyentes |
| Integraciones: PayPal, Resend, Apps Script, Shopify, Cloudflare (estado real) | NO PROBADO (sin llamadas a servicios externos; sólo revisión estática) |
| SEO: robots, sitemap, canonicals, noindex, JSON-LD de `/product` | PARCIAL (F-SEO-01..04) |
| Contraste WCAG AA (script en página, 6 rutas, 1280 px) | CORREGIDO EN RAMA Y VERIFICADO LOCAL (F-A11Y-03); verificación desplegada pendiente |
| Lector de pantalla real (NVDA/VoiceOver/TalkBack) | NO PROBADO: el entorno no tiene lector; sólo árbol de accesibilidad de Playwright como aproximación |
| Reglas Firestore con emulador (`test:rules-critical` 56 controles, `test:rules-phone` 12, `test:rules-username` 13; proyectos demo, sin datos reales) | VERIFICADO (exit 0) |
| Retiro en tienda / entrega en checkout | BLOQUEADO: sin sesión, "ELEGIR CÓMO LO RECIBO" abre el modal de login; el código OTP enviaría un correo y Google requiere cuenta real |
| Revisión visual de las 107 capturas (18 rutas × 6 anchos; hojas de contacto por ruta en `audit/evidence/sheets/`) | VERIFICADO con salvedad: sin roturas de layout ni solapamientos en ninguna ruta/ancho; el banner de cookies tapa parte de cada captura (sin consentimiento) y las páginas quedaron vistas sólo en el primer viewport. Hallazgos: F-A11Y-03 (ampliado) y F-UX-03 |
| Prueba E2E por rol (visitante/cliente/admin) | Visitante PARCIAL; cliente y admin NO PROBADO |

### F-A11Y-03 (LOW): contraste insuficiente en textos secundarios
Medido con script WCAG en `/`, `/catalogo`, `/product`, `/checkout`, `/contact`, `/login`. Confirmados:
- Botón "Escribirnos por WhatsApp" del footer: texto #2B2B2B sobre #0D8043 (~2.8:1; mínimo 4.5:1). Evidencia: `audit/evidence/footer_contact_1280.png`.
- Copyright del footer ~4.12:1; "Enviar código" en login ~3.90:1; descripción del carrusel ~3.28:1; "obligatoria" ~4.43:1.
- Descartados como falsos positivos: textos sobre imagen/gradiente (el script omite fondos con imagen) y botones deshabilitados (exentos).
- Mismo patrón (texto #2B2B2B sobre magenta #AD3F67, ~2,6:1) en `/admin-images` "Iniciar sesión" (visto en captura y confirmado por estilos computados en producción) y en los botones activos/secundarios del panel `/admin` ("Reintentar" #2B2B2B sobre #8B2642, pestañas activas "Usuarios", "Dashboard", "Problemas activos", etc.). Causa probable común: una regla global de color de texto que pisa el blanco de los botones; no diagnosticada en el CSS.
- Descartado tras verificar: "Ver catálogo" del carrito vacío se veía negro en la captura de 1024 px, pero en producción es blanco sobre #AD3F67 en 1024 y 1440 (artefacto de transición).
Remediación mínima: texto blanco en el botón verde y oscurecer los tonos rosados del texto secundario. No aplicada (cambia la paleta: decisión de diseño).


**Estado: CORREGIDO EN RAMA; verificación desplegada pendiente.** Tags de caché `?v=` renovados (`tintin-20260923-contrast-aa-4` para `contraste.css`; `contrast-aa-1` para los otros tres CSS), porque los assets se sirven `immutable`. Hero del inicio (texto sobre imagen rosa, 2.3–3.1:1 → #3d2530, ≥6:1; comprobado inyectando el CSS sobre producción) y CTA móvil incluidos. Cambios solo de color, sin tocar diseño: botón `#btn-send-otp` (`#d84f86`→`#b83a6e`, 3.90→5.43:1), copyright del footer y descripción del carrusel (→`#8a4a66`, 6.09/5.93:1), texto del botón WhatsApp del footer (blanco, 5.02:1) y pestañas activas del admin / reintento de conectividad (blanco sobre marca, antes 2.48:1 y 1.65:1). Archivos: `css/quality/contraste.css`, `css/core/tema-unificado-tintin.css`, `css/pages/login/login-onboarding-flow.css`, `css/pages/home/carrusel-colecciones.css`. Re-medido en servidor estático local con Playwright; las pestañas admin se midieron con DOM sintético (requieren sesión real). No desplegado.
### F-UX-03 (LOW): `/admin` sin sesión muestra "No pudimos restaurar tu sesión"
En contexto limpio (visitante sin cuenta) `/admin` muestra "La sesión de Firebase no se confirmó… No se cerró tu cuenta ni se borró ningún dato" con Reintentar/Ingresar nuevamente, mientras `/admin-images` muestra "Acceso denegado". Mensaje engañoso para quien nunca inició sesión. Causa no diagnosticada (posible dependencia de App Check/estado de sesión); se puede reproducir cargando `/admin` en un contexto nuevo. No corregido.

### F-CACHE-01 (MEDIUM): un mismo módulo cargado con URLs distintas (instancias duplicadas)

**Estado: CORREGIDO EN RAMA; verificación desplegada pendiente.** Evidencia: `tienda.js` importaba `sincronizacion-carrito.js` con un tag antiguo (x3) frente al tag vigente del resto (x8), lo que evalúa el módulo del carrito dos veces; `js/inicio-navegacion-publica.js` cargaba `entrada-navegacion-publica.js` con un tag distinto del `modulepreload` del HTML; `navegacion-autenticacion.js` y `notificaciones-push*.js` importaban `estado-canonico-perfil.mjs` / `origen-funciones.js` sin `?v=` frente a las demás importaciones versionadas. Todas las referencias del navegador quedan con una única URL por archivo (generador `sincronizar-inicio-navegacion-publica.js`, HTML y JS). CSP regenerado (`build:csp`) y baseline de versionado actualizado; `audit:cache-versioning`, `verify:csp`, `audit:public-shell` y 45 tests unitarios OK. Sin archivos huérfanos en `css/` ni `js/` (0 de 305). `auditar-sitio-confiabilidad.js` falla por una marca de autoría externa en `tintin-codigo.md` (preexistente, documento exportado; no se modificó). `audit:contraste` conserva `span.tt-loader-wordmark-i` (1.57:1, logotipo del loader) sin corregir. Referencias sin `?v=` restantes son de servidor (`functions/`, `cloudflare/`) o comentarios.

## F. Cambios en la rama `audit/integral-a-z` (sin commit posterior a a58d852 ni despliegue)
- `functions/product.js` + `tests/seo/product-noindex.test.mjs` (F-SEO-01).
- `config/csp-runtime.js`, `config/csp-runtime.json` regenerados (F-CSP-01).
- `catalogo.html` (aria-label del favorito, F-A11Y-01), `checkout.html` (canonical limpio F-SEO-04 + espera de App Check F-CHK-01), `login.html`, `perfil.html` (canonical limpio).
- Nada desplegado. Los `.md` de la raíz (incluido este informe) se sirven públicamente si se despliega la raíz (ver F-SEC-01): no publicar este archivo sin revisarlo.

## I. Pendientes y bloqueos
- Bloqueado: cuentas de prueba (cliente/SuperAdmin) → auth real, perfil, pedidos, admin y roles.
- Prohibido por instrucciones: crear pedidos/pagos, enviar correos, tocar datos → checkout completo y notificaciones sin probar.
- Aprobación requerida: F-SEC-01 (enrutamiento/despliegue), F-DATA-01 (datos), F-UX-01 (decisión de producto), despliegue de F-SEO-01/F-CSP-01/F-SEO-04.
- Actualización: contraste y emulador de reglas ya probados (ver matriz); retiro en tienda BLOQUEADO; lector real NO PROBADO; 98 capturas sin revisar. Lista original: retiro en tienda en checkout, contraste de color y lector de pantalla real, revisión visual de las 108 capturas, emulador de reglas, roles/admin (sin cuentas autorizadas), favoritos y reseñas con sesión, verificación de los fixes en navegador tras despliegue.
