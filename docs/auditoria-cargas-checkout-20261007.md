# Auditoría de cargas y checkout — 2026-10-07

## 1. Resumen ejecutivo

Auditoría independiente de los informes históricos. Base local/remota/producción comprobada antes de editar: `2c3c07fe1efa0387f45823994d1ed66b68bffc06`, fingerprint publicado `7ebe0f6f334d6ef8d5583a1e454435d5f85349feaecb8102b363f0f8fb15ecac`. Rama `codex/auditoria-checkout-20261006`.

Se corrigieron el bloqueo del primer clic durante restauración de sesión, la hidratación duplicada del perfil, dos renderizadores competidores del carrito, la respuesta atrasada de recomendaciones y URLs inconsistentes del logo y de dos dependencias del admin. El primer intento de «Elegir cómo lo recibo» solicita acceso si la identidad resuelta es invitada; conserva el carrito y el paso pendiente.

Actualización tras recuperar el entorno: push inicial y PR #1054 realizados. CI inicial detectó un marcador estático obsoleto de notificaciones Admin; corregido, cierre Admin 77/77 PASS. El clic real encontró un bucle entre la guardia cart de window y la guardia profile de document: cada una reenviaba un evento que la otra volvía a cancelar. La corrección conserva etapas validadas sólo para ese avance y cada clic nuevo empieza vacío. La ejecución antes del arreglo produjo 111.006 clics sintéticos sin modal; después, 11/11 anchos con SDK real y transporte TLS verificado abren un único modal al primer clic. Browser conjunto 17/17 (incluye cuenta bloqueada/carrito vacío); Node 1104/1104, cache 308 archivos y 73 cargas dinámicas. Merge y deploy quedan pendientes de CI del nuevo commit; no se declara compra/admin autenticado real.

## 2. Mapa por página

Inventario estático de los 19 HTML de raíz y sus consumidores. Primer barrido comparativo: 38 navegaciones, 390/1440 px, con medios accesibles. Barrido intermedio: 209 navegaciones, 320/360/375/390/414/430/768/820/1024/1366/1440 px. Transporte mediante bridge temporal con TLS verificado y sólo lectura. Los conteos siguientes pertenecen a esos barridos, antes de los últimos ajustes de CSS y renderer; no representan una medición final.

| Documento | Requests antes → intermedio (390 / 1440 px) | Conflictos antes → intermedio (390 / 1440 px) | Último ajuste |
|---|---|---|---|
| `404.html` | 170 → 173 / 172 → 165 | 1 → 0 / 1 → 0 | Sin nuevo conflicto identificado; red final pendiente |
| `about.html` | 160 → 158 / 158 → 162 | 1 → 0 / 1 → 0 | Sin nuevo conflicto identificado; red final pendiente |
| `admin-images.html` | 122 → 122 / 122 → 116 | 0 → 0 / 0 → 0 | Sin nuevo conflicto identificado; red final pendiente |
| `admin.html` | 190 → 194 / 190 → 188 | 2 → 0 / 2 → 0 | Sin nuevo conflicto identificado; red final pendiente |
| `cambios-devoluciones.html` | 153 → 152 / 157 → 155 | 1 → 0 / 1 → 0 | Sin nuevo conflicto identificado; red final pendiente |
| `catalogo.html` | 181 → 147 / 187 → 140 | 1 → 0 / 1 → 0 | Sin nuevo conflicto identificado; red final pendiente |
| `checkout.html` | 213 → 206 / 217 → 217 | 1 → 0 / 1 → 0 | Renderer único validado en fixtures; red final pendiente |
| `collections.html` | 199 → 199 / 192 → 213 | 1 → 0 / 1 → 0 | Sin nuevo conflicto identificado; red final pendiente |
| `contact.html` | 154 → 152 / 156 → 150 | 1 → 0 / 1 → 0 | Sin nuevo conflicto identificado; red final pendiente |
| `envios.html` | 152 → 144 / 150 → 142 | 1 → 0 / 1 → 0 | Sin nuevo conflicto identificado; red final pendiente |
| `googlef396be0b943aa3d1.html` | 1 → 1 / 1 → 1 | 0 → 0 / 0 → 0 | Sin nuevo conflicto identificado; red final pendiente |
| `index.html` | 213 → 213 / 211 → 168 | 1 → 0 / 1 → 0 | Sin nuevo conflicto identificado; red final pendiente |
| `login.html` | 212 → 152 / 205 → 150 | 1 → 1 / 1 → 1 | CSS del logo pendiente de reverificación en red |
| `nosotros.html` | 180 → 148 / 180 → 131 | 1 → 1 / 1 → 0 | Sin nuevo conflicto identificado; red final pendiente |
| `perfil.html` | 197 → 151 / 218 → 144 | 1 → 1 / 1 → 1 | Sin nuevo conflicto identificado; red final pendiente |
| `preguntas-frecuentes.html` | 154 → 117 / 153 → 118 | 1 → 0 / 1 → 0 | Sin nuevo conflicto identificado; red final pendiente |
| `privacidad.html` | 150 → 117 / 156 → 110 | 0 → 0 / 1 → 1 | Sin nuevo conflicto identificado; red final pendiente |
| `product.html` | 211 → 153 / 224 → 150 | 1 → 1 / 1 → 1 | CSS del logo pendiente de reverificación en red |
| `terminos.html` | 150 → 118 / 155 → 116 | 0 → 0 / 1 → 0 | Sin nuevo conflicto identificado; red final pendiente |

Barrido final con la red recuperada: 209/209 navegaciones ready y **cero conflictos de versiones**. Hubo 197 repeticiones en marcos aislados de seguridad y 34 candidatos repetidos: 32 durante redirect nosotros→about (ambos documentos comparten recursos), y 2 refrescos de reviewStats tras error del listener Firestore (fallback real). Los 165 errores de Listen corresponden al buffering/timeout del bridge; no se presentan como errores de negocio ni como ejecución sin errores. El barrido fue previo al ajuste de coordinación de guardias, que tiene verificación real 11/11 y gates de URL coherentes.

## 3. Doble render

`checkout-confiabilidad.js` reconstruía `#ck-items` leyendo `tt_cart` mientras `checkout.html` usaba el carrito de la identidad activa y otra estructura de filas. Los timers y eventos forzaban repintados. Ahora la recuperación delega a `TintinCheckoutCartRenderer`; el renderer canónico espera identidad, compara datos y descarta recomendaciones obsoletas. Las pruebas ejecutan la función real extraída de HTML: eventos idénticos producen una escritura, cambiar cantidad actualiza filas/subtotal y resolver una recomendación vieja no sustituye el carrito lleno.

Las 29 transiciones observadas de `#ck-items` en el barrido intermedio no equivalen por sí solas a 29 defectos: incluyen loading, datos y cambios de formato. La causa de dos autoridades sí está demostrada por el código y eliminada. Hero/producto/header se observaron con MutationObserver; skeleton → dato real y actualización de catálogo no se eliminan.

## 4. Red y requests duplicadas

El clasificador agrupa método y URL lógica, elimina sólo `v` y distingue error/reintento, redirect, dos versiones, marcos aislados y repetición candidata. Conserva parámetros de negocio y separa documentos sucesivos; OPTIONS no es una segunda lectura. `nosotros` redirige a `about`: descargar recursos en ambos documentos es una navegación legítima. Los scripts de reCAPTCHA en iframes separados siguen clasificados como aislamiento necesario. No se desactivaron App Check ni SDK de seguridad.

En el barrido intermedio hubo 33 candidatos de versiones distintas: todos eran el logo; los fondos CSS restantes de login/producto se corrigieron después y tienen gate estático. Los conteos de recursos repetidos son candidatos que incluyen diferentes marcos y navigaciones, no una declaración de defectos. Los diez candidatos con errores y las 19 entradas de error correspondieron a timeout de Firestore Listen en el bridge y a espera de readiness; la verificación de Google no tiene runtime y ahora se trata como documento estático. La falta de una nueva captura no permite certificar ausencia universal de repeticiones.

## 5. Firestore y Firebase

Native checkout y hardening hacían `getDoc(users/uid)` independientemente. `perfil-checkout.js` comparte una promesa durante la sesión, invalida en salida/cambio de UID, no consulta para invitadas, libera el timeout y permite reintento tras error sin borrar una solicitud nueva. Cada consumidor conserva su guardia de generación para no aplicar datos de otra sesión. Esto no sustituye autorización/validación del servidor. Guardar dirección tras decisión explícita sigue siendo una lectura/escritura funcional distinta.

Reglas en emulador: 121 escenarios críticos, 12 de teléfono y 13 de username pasaron. No se modificaron reglas ni se consultaron datos privados de cuentas reales. Listeners de reseñas, likes y catálogo siguen siendo necesarios; los gates del repositorio comprueban sus límites y cleanup.

## 6. Imágenes

Footer generado, logo de login, banner de privacidad, avatares de fallback, gestor de imágenes y fondos CSS ahora reutilizan la URL del logo del shell. No se alteraron archivos PNG/WebP, tamaños ni selección responsive del hero. Los medios de Cloudinary se habilitaron en el borrador de red y estuvieron accesibles en el barrido anterior. Un 403 por dominio bloqueado no se trató como defecto de imágenes. El último ajuste CSS tiene prueba negativa/contrato y requiere nueva captura real de red.

## 7. JavaScript

Los imports compartidos de `shopify-import-core.mjs` y `origen-funciones.js` del admin usan el mismo `?v=` que sus consumidores canónicos. Se evitan instancias ES distintas para los mismos bytes. Se mantienen guardias de arranque, coordinador de sesión y bootstrap Firebase existentes. No se agregó SDK o framework. Admin autenticado no se ejercitó con una cuenta real.

## 8. CSS

Se alinearon sólo las URLs de background del logo en `login-maintenance.css` y `superficies-marca-responsive-tintin.css`; reglas visuales conservadas. Sus consumidores y transitivos recibieron nueva versión. CSP e integridad de estilos se verifican mediante los scripts del repositorio.

## 9. Caché y `?v=`

Se propagaron versiones nuevas sólo donde cambiaron bytes o dependencias, usando el gate canónico y su baseline. Recursos immutable mantienen URLs estables por contenido. El generador de shell conserva footer/preloads/entry coherentes; 404 fue alineado como consumidor adicional. `audit:cache-versioning` verifica referencias literales y dinámicas. No se borró almacenamiento ni se añadió cache busting por timestamp.

## 10. Hashes

El manifiesto diagnóstico debe regenerarse después de la última edición y compararse de manera reproducible. La huella base publicada fue verificada; la huella final local no demuestra publicación. No se cambiaron los bytes de imágenes para evitar caché.

## 11. CSP

`build:csp` y `verify:csp` generan/verifican hashes de inline handlers y scripts para Cloudflare. No se redujeron restricciones CSP ni se deshabilitó TLS. El bridge permite inspección sin ampliar permanentemente la confianza del navegador; no es una optimización del producto.

## 12. Cloudflare

El repositorio tiene integración automática de Cloudflare Pages. Tras push/CI/merge se debe comprobar el check de Pages y el fingerprint de producción. El workflow manual de GitHub Pages es un fallback diferente y no se invoca para este despliegue. No se tocaron DNS ni configuración comercial.

## 13. Storage y auth

`validacion-avance.js` usa WeakMap por evento y una marca síncrona temporal del control durante replay. La guardia del carrito sólo omite su etapa ya verificada; la de perfil sigue validando su etapa. Un evento nuevo no hereda validaciones previas. Se conserva `.click()` y su comportamiento para controles deshabilitados. Esto evita el ping-pong sin deshabilitar guards ni la validación comercial del servidor.

El estado desconocido/restaurando conserva loading y no inventa identidad invitada. Hardening espera `waitForSession`, evita intentos simultáneos y reproduce el handler native una vez. Una invitada recibe el modal directamente sin depender de cart sync remoto. La reanudación conserva el paso y no borra el carrito. Se mantienen email verificado, bloqueo de cuenta y validación del pedido en servidor. Pruebas con identidad simulada cubren restauración, salida/reentrada, carrera de perfil, acceso y cierre/reapertura del modal; no acreditan login real con Google en producción.

## 14. Matriz de hallazgos y cambios

| ID / gravedad | Ubicación / causa / clase | Antes → después | Evidencia y regresión | Estado |
|---|---|---|---|---|
| CK-01 alta | hardening: captura decide durante RESTORING; carrera | clic cancelado → espera sesión y pide acceso | session-profile-race + 11 widths invitados + restauración autenticada | PASS local |
| CK-02 media | HTML y hardening: dos lecturas del perfil; consulta duplicada | 2 promesas → 1 por sesión | shared-profile-read, timeout y cambio de identidad; control negativo rompe dedup | PASS local |
| CK-03 alta | reliability y HTML: dos autoridades de render; doble render/dato provisional | markup/cart distintos → renderer canónico idempotente | canonical-cart-render; control negativo sin memoización falla | PASS local; red final pendiente |
| CK-04 media | HTML: recomendaciones async antiguas; carrera | vacío tardío sustituye filas → generación descarta resultado | resolución tardía tras carrito lleno; control negativo sin generación falla | PASS local |
| LOAD-01 media | footer/login/privacy/fallbacks/CSS: varias URLs del logo; descarga duplicada | tags antiguos/sin tag → URL del shell | 34 conflictos base, 8 intermedios en 38 navegaciones; gate URLs incluyendo CSS | PASS estático; último CSS pendiente de red |
| LOAD-02 media | imports del admin: módulo con/sin versión; inicialización duplicada | URLs ES distintas → URL única canónica | captura admin base + gate imports; auditoría cache transitiva | PASS estático; admin real no verificado |
| CK-05 alta | guardias cart/profile independientes; replay recursivo | 111.006 eventos sin modal → único avance con etapas por evento | 17/17 browser conjunto; cuenta bloqueada y carrito vacío siguen bloqueados; SDK real 11/11 anchos | PASS local |
| ENV-01 bloqueo histórico | túnel de salida del entorno | acceso previo correcto → 503 a GitHub/producción/gstatic | curl, gh y git ls-remote, también fuera de sandbox; DNS directo no disponible | BLOCKED externo |

## 15. Pruebas

Última suite completa Node, incluyendo el escenario de recomendación obsoleta: **1104/1104**, cero omitidas. Gates específicos de renderer, recursos y clasificador: **13/13**. Browser checkout: **15/15**, incluyendo once anchos y sesión restaurada. Emuladores: **146/146**. Los controles negativos se ejecutaron en archivos temporariamente modificados y restaurados: espera de auth, promesa compartida, clasificación de versiones, URL del logo, memoización y generación del renderer; todos fallan cuando se elimina la protección correspondiente.

Un `audit:final` anterior pasó con los cambios iniciales. En el cierre, el primer intento detectó JSON de capturas ignoradas dentro de `artifacts` como texto de fuente; se trasladaron fuera del checkout, sin debilitar el auditor. El siguiente detectó manifiesto desactualizado por las últimas ediciones. Después de corregir esos prerrequisitos, **build:pages, build y audit:final completos terminaron con código 0**. El diagnóstico comprobó reproducibilidad del manifiesto, y el gate final verificó 307 archivos versionados y 73 cargas dinámicas. Se agregó la regresión browser de login requerido al workflow CI. Tras el cierre de audit:final sólo se ajustó la política del instrumento de auditoría: 20/20 gates de arquitectura y la suite Node 1104/1104 pasaron de nuevo. El manifiesto se regeneró tras actualizar este informe. El intento ampliado de Playwright para colecciones no alcanzó ready en el entorno con acceso HTTPS del navegador bloqueado; no se declara PASS ni se alteran sus assertions. Smoke de 18 rutas + header pasó en la fase anterior; nuevas llamadas externas fallan por el túnel.

## 16. Métricas antes/después

Capturas comparables a 390/1440 px: **34 → 8** conflictos de versión (antes → intermedio), faltaban dos fondos CSS corregidos después. 209 navegaciones intermedias documentan cobertura, no perfección. Las pruebas de renderer muestran **2 llamadas iguales → 1 escritura**, y al cambiar cantidad se produce una nueva escritura y subtotal correcto. Hidratación del perfil: **2 consumidores → 1 lectura por sesión** en fixtures.

LCP/CLS se recolectaron como observaciones de render bajo bridge. Transferencia real, caché fría/caliente y red lenta real: **NO VERIFICADAS**. El routing de la guardia de sólo lectura desactiva caché del navegador; esos bytes/tiempos no se presentan como ganancias de rendimiento ni se atribuyen al sitio. El script marca transferencia `null`. El bridge intermedio bloqueó 1.988 POST de telemetría reCAPTCHA (`/recaptcha/enterprise/clr`); no son duplicados comerciales ni se cuentan como ahorro. La política final permite endpoints específicos de reCAPTCHA/App Check/refresh necesarios para la seguridad de las lecturas y sigue bloqueando pedidos, pagos, escrituras Firestore, altas de cuenta y correos. Sus dos pruebas de fronteras pasaron; el barrido con esa política final requiere red disponible. Las capturas crudas permanecen fuera del repositorio para no publicar URLs de datos ni contaminar gates.

## 17. Producción

La base coincidía con main antes de editar. No hubo órdenes, pagos, correos, creación de cuentas ni escrituras Firestore/Sheets reales. El usuario autorizó posteriormente push, merge y deploy; no falta aprobación. El acceso se recuperó y la PR #1054 está abierta; la nueva publicación queda pendiente de CI/check Cloudflare y artefacto publicado. El error actual contiene `remote address:envoy://cloudflare_https_tunnel/`, HTTP 503 en todos los hosts probados; no es otro dominio faltante en la allowlist.

## 18. Pendientes reales

La consulta inicial de npm audit reportó cero vulnerabilidades con este lockfile; repetirla al cierre devolvió 503 del registro y no acredita un resultado actualizado. Los intentos finales de monitor de producción y headers fallaron con 503; la espera del artefacto fue interrumpida al confirmar el mismo fallo de transporte.

Transporte recuperado, npm audit actualizado: cero vulnerabilidades, barrido final 209/209 y checkout guest real 11/11. Ejecutar CI oficial del commit de coordinación de guardias, push/merge y verificar despliegue automático/fingerprint/health/headers. Verificar caché real fría/caliente y red lenta, y flujos autenticados de cliente/admin bajo condiciones autorizadas sin transacciones reales. Safari/iOS no probado.

## 19. Riesgos

Los resultados de fixtures no prueban todos los estados de infraestructura, sesión o contenido remoto. Las métricas intermedias no son el estado final. La memoización sólo omite render de datos idénticos; contenido/cantidad/catalogo distintos regeneran. La promesa de perfil vive por página/sesión, no como caché persistente ni control de autorización. No se certifica ausencia universal de duplicados a partir de una captura invitada.

## 20. Conclusión

¿Sigue existiendo alguna doble carga innecesaria conocida? **NO VERIFICADO globalmente**: las causas identificadas fueron corregidas, pero falta la captura final con red disponible y los estados autenticados reales.

¿Sigue existiendo algún doble render innecesario conocido? **NO VERIFICADO globalmente**: el renderer duplicado identificado fue eliminado y sus regresiones pasan.

¿Existen dos versiones del mismo recurso en una misma navegación? **NO VERIFICADO en ejecución final**: gate estático canónico y casos del logo pasan; último barrido fue intermedio.

¿Fuente de verdad clara para los datos principales? **PARCIAL**: checkout usa coordinador de sesión, cart store y lector compartido de perfil; el servidor sigue siendo autoridad comercial. El resto del sitio no se certifica con cuentas reales en esta auditoría.
