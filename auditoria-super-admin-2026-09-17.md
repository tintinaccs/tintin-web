# Super Admin — auditoría A→Z (2026-09-17)

## Alcance y base

Esta auditoría está limitada a `admin.html`, `admin-images.html` y las dependencias directas o indirectas que gobiernan el panel Super Admin. No audita ni modifica la experiencia pública salvo contratos compartidos estrictamente necesarios para preservar el catálogo.

- Base de trabajo: `main` en `c5d69381dd963e5799b17e4332f0fc6374ea6e97`.
- Rama: rama de trabajo solicitada para esta entrega.
- Identidad elevada: únicamente `tintinaccs@gmail.com`, validada en Auth, cliente, Pages Functions y Firestore Rules.
- Reglas Firebase, Auth, App Check, checkout, stock, precio, seguridad e idempotencia de pedidos: no se modifican en esta fase.
- Migración real de catálogo: no ejecutada; el nuevo flujo termina en `PREVIEW`/`READY`.

## Método y evidencia inicial

Antes de cambiar código se revisaron el HTML, los módulos montados, el registro Maestro, reglas, Functions, proveedores de media, contratos de productos y pruebas. Se ejecutaron los siguientes gates estáticos sobre la base:

| Gate | Resultado inicial |
| --- | --- |
| `audit:admin-foundation` | PASS |
| `audit:products-media` | PASS |
| `audit:admin-orders` | PASS |
| `audit:users-roles` | PASS |
| `audit:content-appearance` | PASS |
| `audit:appearance-unified` | PASS |
| `audit:analytics-audit` | PASS |
| `audit:final-integration` | PASS |
| `test:architecture-gates` | PASS |
| `test:phase9-import` | PASS |
| Maestro completo/conexiones/cierre | PASS |
| Responsive Maestro real | PASS con Chromium instalado en 1440×900, 1366×768, 768×1024 y 390×844 |
| Admin commerce fixture | PASS, 6/6 flujos de productos, colecciones, pedidos y móvil |
| UI/UX global | PASS, 2/2 |
| Accesibilidad browser | PASS, 5/5 |

La discrepancia del navegador es un problema del harness local. No se transformó en un falso PASS ni se alteró producción para ocultarla.

## Mapa de dependencia real

```text
admin.html
├─ cargador-pagina.js + protección de cambios pendientes
├─ Firebase/Auth/App Check
├─ js/admin/admin-app.js
│  ├─ productos, colecciones, pedidos, usuarios, auditoría, configuración
│  ├─ exportaciones y acciones masivas
│  ├─ carga de imagen y biblioteca multimedia
│  └─ permisos y trazabilidad
├─ js/admin/importacion-admin.js  ← autoridad única de preview Shopify
│  ├─ normalizacion-importacion.mjs
│  ├─ shopify-import-core.mjs
│  ├─ IndexedDB local para reanudar preview
│  └─ /api/admin-import-job (job server-side, Super Admin)
├─ js/admin/shopify-commerce-admin.js (lectura/operación de comercio)
├─ js/admin/maestro/{registro-maestro,panel-maestro}.js
├─ js/admin/appearance, notifications, diagnostics, pages, participation
├─ /admin-images
│  └─ biblioteca-multimedia.js → Cloudinary firmado → media
└─ firestore.rules / Cloudflare Pages Functions
```

### Autoridades consolidadas

- Identidad: `js/core/auth/identidad-super-admin.js` y `SUPER_ADMIN`.
- Rol/permisos: `js/core/auth/roles.js` + matriz dinámica; Super Admin no depende de una fila editable.
- Productos: `js/admin/admin-app.js` para CRUD manual; el importador solo prepara jobs y no crea una segunda escritura.
- Importación Shopify: `js/admin/importacion-admin.js` + `shopify-import-core.mjs`; los cards legacy quedan ocultos y marcados.
- Media: biblioteca Cloudinary existente; no se crea Firebase Storage/ImgBB adicional.
- Auditoría: `auditLog`, append-only según Rules.
- Borrado global: `/api/admin-catalog-delete`, con dry-run/preflight/confirmación; fuera de la migración.

## Matriz de funciones

Estados usados: `VERIFIED`, `BROKEN`, `PARTIAL`, `DUPLICATED`, `LEGACY_REQUIRED`, `LEGACY_DEAD`, `UNREACHABLE`, `MISSING`, `NOT_APPLICABLE`. `VERIFIED` solo significa que existe evidencia en código/gate; no equivale a una prueba de producción.

| MÓDULO | FUNCIÓN | UI | EVENTO/HANDLER | DATA SOURCE | WRITE TARGET | AUTORIDAD | ROL | TEST | ESTADO | DUPLICADO | LEGACY | ACCIÓN |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Auth | Entrar al panel | guard HTML | coordinador de sesión | Firebase Auth | DOM | identidad Super Admin | Super Admin | admin-foundation | VERIFIED | no | no | conservar |
| Auth | Denegar cuenta normal | guard | `getUserRole`/email | Auth + users | redirect/DOM | Rules + Functions | no client | users-roles | VERIFIED | no | no | conservar |
| Dashboard | Resumen | `section-dashboard` | listeners admin | Firestore | ninguno | admin-app | staff según permiso | admin-foundation | PARTIAL | no | no | verificar navegador |
| Usuarios | listar/bloquear/restaurar | tabla | handlers admin-app | users | users | Rules + API lifecycle | Super Admin | users-roles | VERIFIED | no | no | conservar |
| Pedidos | editar estado/pago | tabla/modal | order admin | orders | orders/orderTrash | Functions/Rules | staff/Super Admin | admin-orders | VERIFIED | no | no | conservar |
| Productos | crear/editar | formulario | `prodGuardar` | products/collections | products | Rules + permiso | admin/Super Admin | products-media | VERIFIED | no | no | conservar |
| Productos | listar grande | tabla | `onSnapshot` limitado | products | ninguno | admin-app | staff/Super Admin | admin-products | PARTIAL | no | no | paginación futura |
| Productos | activar/desactivar | fila/masivo | product handlers | products | products | Rules + audit | admin/Super Admin | products-media | VERIFIED | no | no | conservar |
| Productos | eliminar | confirmación | delete/API global | products | products/trash/sheets | API Super Admin | Super Admin | admin-orders/products | VERIFIED | no | no | no usar en import |
| Colecciones | CRUD | tabla/form | collection handlers | collections | collections/products | Rules + audit | admin/Super Admin | products-media | VERIFIED | no | no | conservar |
| Media | subir/editar/borrar | `/admin-images` | widget/biblioteca | Cloudinary + media | media | signed Function + Rules | Super Admin | images | VERIFIED | no | no | conservar |
| Import | export operativo | card | `exportOperationalBackup` | products/etc. | descarga | Super Admin | Super Admin | phase9 | VERIFIED | no | no | conservar |
| Import | seleccionar archivo | dropzone | `processFile` | File/stream | ninguno | import core | Super Admin | import core | VERIFIED | no | legacy visible | usar único card |
| Import | parsear CSV Shopify | preview | `parseDelimitedRowsStream` | File.stream | ninguno | import core | Super Admin | Shopify core | VERIFIED | no | parser legacy oculto | conservar |
| Import | agrupar por Handle | preview | `groupShopifyRows` | filas CSV | memoria preview | import core | Super Admin | Shopify core | VERIFIED | no | parser legacy oculto | conservar |
| Import | Body HTML | preview | `sanitizeShopifyBodyHtml` | Body (HTML) | preview | import core | Super Admin | XSS test | VERIFIED | no | strip legacy | conservar |
| Import | colección ambigua | preview | resolver mapping | collections | ninguno | Super Admin confirma | Super Admin | Shopify core | VERIFIED | no | heurística legacy | bloquear hasta confirmar |
| Import | job persistente | status card | `/api/admin-import-job` | Auth + Firestore | importJobs/auditLog | Pages Function | Super Admin | endpoint tests | VERIFIED | no | no | conservar |
| Import | resume tras cierre | botón restore | IndexedDB + status | local job + API | local job | job server | Super Admin | browser job test | PARTIAL | no | no | probar navegador |
| Import | escritura de productos | no expuesta | no handler product write | n/a | n/a | no se ejecuta | n/a | dry-run contract | NOT_APPLICABLE | no | direct writer legacy | retirar en fase autorizada |
| Import | media migration | no expuesta | no handler | Shopify CDN | n/a | media job futuro | Super Admin | architecture doc | MISSING | no | no | fase posterior |
| Auditoría | leer/exportar | tabla | audit handlers | auditLog | descarga | Rules append-only | Super Admin | admin-foundation | VERIFIED | no | no | conservar |
| Diagnóstico | ejecutar | botón | diagnostics | APIs/read-only | artifact | diagnostic core | Super Admin | final-integration | VERIFIED | no | no | conservar |
| Maestro | matriz/health | sección dinámica | panel Maestro | registry + DOM | ninguno | registro Maestro | Super Admin | maestro gates | VERIFIED | no | no | conservar |
| Configuración | tienda/envío/apariencia | formularios | admin-app/modules | settings/site_content | Firestore | Rules + audit | Super Admin/admin según módulo | content/appearance | VERIFIED | no | no | conservar |

## Hallazgos de consolidación

1. **Corregido:** el módulo canónico de importación ahora se monta explícitamente en `admin.html` y oculta los dos importadores legacy del HTML.
2. **Corregido:** se eliminó el recorte de 5 MB/1.000 filas. El CSV se procesa por stream y el preview se limita solo visualmente a 250 filas; no descarta datos.
3. **Corregido:** la importación ya no escribe directamente productos desde el navegador. El único efecto de esta fase es un `importJobs/{jobId}` de preview y su auditoría.
4. **Corregido:** agrupación por `Handle`, stock una vez por variante y media separada de identidad de variante.
5. **Corregido:** Body HTML restringido a `p`, `br`, `strong`, `em`, `ul`, `ol`, `li`, sin atributos.
6. **Pendiente intencional:** descarga/migración server-side de media Shopify, reemplazo/cutover, backup externo y escritura real de productos.
7. **Límite de evidencia:** la matriz real autenticada contra producción requiere credenciales y no se ejecutó; la matriz fixture segura y el Maestro responsive sí pasaron en los cuatro viewports.

## Seguridad e invariantes

- No hay secretos de Cloudinary en el cliente.
- `/api/admin-import-job` valida origen, Firebase ID token y email exacto de Super Admin.
- El endpoint no acepta records ni muta `products`; el dry-run es server-side y queda auditado.
- No se cambian Rules, App Check ni el contrato de pedidos/stock/precio/idempotencia.
- Las operaciones destructivas de catálogo siguen fuera del importer y requieren su endpoint/confirmación propia.

## Estado de secciones

La evidencia estática de las 19 secciones base, el registro Maestro, el fixture de comercio y la matriz responsive está en verde. La certificación funcional contra una sesión real permanece `PARTIAL` porque no se usaron credenciales de producción; no se marca `VERIFIED` solo por existir el DOM.

## Decisión de cierre de esta fase

`admin.html` queda `PARTIAL`: la superficie base, seguridad estática, contratos, responsive fixture y accesibilidad están verificadas, pero faltan la matriz autenticada contra producción, la recuperación visual end-to-end de un job y la implementación autorizada de media migration. La migración real del catálogo no se ejecuta en esta fase.
