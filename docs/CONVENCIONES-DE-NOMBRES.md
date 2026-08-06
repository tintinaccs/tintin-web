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
