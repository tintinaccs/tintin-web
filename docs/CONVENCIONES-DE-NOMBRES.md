# Convenciones de nombres

## Objetivo

Mantener el código de Tintin legible, predecible y seguro sin traducir contratos externos ni convenciones técnicas por obligación.

## Regla general

- Los archivos funcionales propios de Tintin usan nombres claros en español y kebab-case.
- Las carpetas técnicas estables como `js`, `css`, `pages`, `components`, `core` y `admin` se conservan.
- Las rutas públicas HTML, endpoints, eventos, claves persistidas, IDs y clases no se renombran dentro de una reorganización de archivos.
- Los nombres de proveedores y estándares se conservan: Firebase, Firestore, Cloudinary, WhatsApp, SEO, API, OTP, JSON y similares.
- `checkout` se conserva como término técnico del flujo de comercio electrónico; el resto del nombre describe la responsabilidad en español.
- No se usan nombres temporales como `phase4`, `phase5` o `phase7` para código permanente.

## Alcance de esta migración

Se normalizan los nombres funcionales de `js/pages/**` y de los componentes públicos de carrito, color, formularios, imágenes, ubicación, modales y bienvenida. Navegación ya cuenta con una convención propia en español.

## Validación obligatoria

Todo renombre debe actualizar referencias en código, HTML, estilos, pruebas, auditorías, workflows y documentación. Antes de fusionar se ejecuta `npm run audit:final`.

## Panel administrativo

- Los módulos funcionales de `js/admin/**` usan nombres claros en español y `kebab-case`.
- `js/admin/admin-app.js` se conserva como entrada canónica del panel.
- `css/admin/admin.css` se conserva como hoja de estilos principal del panel.
- Los nombres de proveedores, APIs, contratos persistidos, rutas públicas, IDs, clases y eventos se mantienen estables.
- Los identificadores temporales como `phase4`, `phase5`, `phase8` o `phase9` no se usan para módulos permanentes.

## Núcleo de autenticación

- Los módulos funcionales de `js/core/auth/**` usan nombres claros en español y `kebab-case`.
- `roles.js` se conserva porque el término ya es claro y válido en español.
- No se modifican nombres de roles persistidos, permisos, eventos, claves de sesión, rutas ni contratos de autenticación.

## Núcleo Firebase y Firestore

- Los auxiliares internos de `js/core/firebase/**` usan nombres claros en español y `kebab-case`.
- `firebase.js` se conserva como entrada técnica canónica.
- Se mantienen los nombres de Firebase, Firestore y REST por corresponder a tecnologías y protocolos.
- No se modifican colecciones, campos, endpoints, orígenes configurados ni contratos persistidos.

## Control de acceso a la tienda

- Los módulos internos de `js/core/store-gate/**` usan nombres claros en español y `kebab-case`.
- Se conserva la carpeta `store-gate` para mantener estable la agrupación histórica y reducir el alcance del cambio.
- No se modifican `settings/storeGate`, `window.TintinStoreGate`, el evento `tintin:store-gate-state`, clases CSS ni estados persistidos.

## Estado, contenido e inventario

- Los módulos funcionales de contenido, importación, inventario y configuración pública de `js/core/store/**` usan nombres claros en español y `kebab-case`.
- Se conserva la carpeta técnica `store` para mantener la arquitectura y las importaciones agrupadas.
- No se modifican colecciones, campos, esquemas persistidos, claves de configuración, exports ni APIs globales.

## Productos, pedidos y perfiles

- Los módulos funcionales de productos, estadísticas de pedidos y perfil de usuario de `js/core/store/**` usan nombres claros en español y `kebab-case`.
- Se conserva la carpeta técnica `store` para mantener la arquitectura y las importaciones agrupadas.
- No se modifican exports, eventos, colecciones, campos persistidos, claves de almacenamiento ni APIs globales.

## Runtime transversal: bloques 8 a 12

- Analítica, diagnóstico, correo, pedidos y calidad usan nombres funcionales claros en español y `kebab-case`.
- Se preservan nombres de proveedores y contratos técnicos como Firebase, Firestore, Resend y checkout.
- Las carpetas arquitectónicas `analytics`, `diagnostic-shims`, `diagnostics`, `email`, `orders` y `quality` permanecen estables.
- No se modifican eventos, claves persistidas, exports, APIs globales ni comportamiento de negocio.

## Backend y contratos públicos

- Los módulos internos de Cloudflare, Apps Script y funciones auxiliares usan nombres funcionales en español.
- Los archivos dentro de `functions/api/**` conservan sus nombres cuando definen endpoints públicos; son excepciones contractuales documentadas.
- Se preservan nombres de proveedores y protocolos como Firebase, Cloudinary, API, OTP y checkout.
- Los renombres no modifican rutas públicas, parámetros, variables de entorno ni contratos persistidos.

## Automatización, auditorías y comandos

- Los archivos físicos de scripts y workflows usan nombres funcionales en español y `kebab-case`.
- Los comandos npm existentes se conservan como aliases estables para no romper CI ni documentación externa.
- Se preservan siglas y nombres técnicos como CI, SEO, PWA, API, Firebase, Firestore, Cloudinary, Playwright, UI, UX y checkout.
- Las referencias, filtros de paths, expresiones regulares y manifiestos se actualizan junto con cada renombre.
- Renombres de scripts aplicados automáticamente en este bloque: 109.
