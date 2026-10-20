# Mapa global — fase 1

Inventario reconstruido el 2026-10-20 contra main c99289a9. Es un mapa del código actual, no una certificación de funcionamiento. Los resultados del ciclo actual se registran en revision-global-2026-10-20.md.

## Tamaño y alcance

| Superficie | Cantidad verificada |
| --- | ---: |
| HTML raíz, incluidos técnicos y redirecciones | 19 |
| Páginas públicas/cliente principales | 14 |
| Recuperación404 | 1 |
| Entradas administrativas | 2 |
| Redirección Nosotros y verificación Google | 2 |
| Secciones declaradas en admin.html | 23 |
| Archivos JS en functions/api | 57 |
| Archivos de pruebas y soporte | 358 |
| Archivos de pruebas Node | 256 |
| Specs de navegador | 95 |

Los archivos API no equivalen a funciones comerciales independientes. Los módulos dinámicos del Maestro y los diálogos del panel no se cuentan como páginas HTML adicionales.

## Páginas y rutas

- `404.html`
- `about.html`
- `admin-images.html`
- `admin.html`
- `cambios-devoluciones.html`
- `catalogo.html`
- `checkout.html`
- `collections.html`
- `contact.html`
- `envios.html`
- `googlef396be0b943aa3d1.html`
- `index.html`
- `login.html`
- `nosotros.html`
- `perfil.html`
- `preguntas-frecuentes.html`
- `privacidad.html`
- `product.html`
- `terminos.html`

Consulta pública no destructiva del catálogo (2026-10-20): 215 productos y 11 colecciones devueltos por la API, cifras que pueden variar y que no incluyen borradores privados ni acreditan stock por sí solas. La cantidad de páginas personalizadas publicadas queda NOT_VERIFIED sin lectura administrativa autenticada.

Las rutas limpias y sus derivados se validan con build:routes/verify:routes. Producto y colección agregan identidad mediante parámetros y datos del catálogo. `/pages/[slug]` y `/policies/[slug]` son rutas dinámicas: el número de páginas publicadas no se infiere del número de archivos.

## Administración

`dashboard`, `estadisticas`, `usuarios`, `ventas-locales`, `clientes-compraron`, `espejos-sheets`, `pedidos`, `mayoristas`, `productos`, `colecciones`, `mensajes`, `auditoria`, `flujo-conexiones`, `diagnostico`, `correos`, `notificaciones-push`, `paginas`, `configuracion`, `permisos`, `apariencia`, `importar`, `resenas`, `me-gusta`.

## Roles, datos e integraciones

Visitante, client, viewer, agent, admin y superadmin. `roles.js` fija el techo; `permisos-roles.js` aplica permisos granulares sin elevarlo; Firestore/Pages Functions validan el acceso de servidor. La presencia de una opción en la interfaz no acredita permiso.

Autoridades: Firestore para catálogo, inventario privado, pedidos, cuentas, contenido y auditoría; dominio transaccional para stock/pedidos; GitHub para código/CI; Cloudflare Pages/Functions para entrega/API; Firebase Auth/App Check/FCM para identidad/verificación/push. Apps Script/Sheets conserva su rol de espejo. Cloudinary gestiona medios; los servicios de correo y PayPal conservan sus controles/flags. El feed Meta y la edición rápida de tarjetas del PR1182 no forman parte de main: PR abierto con conflictos y CI fallida a la fecha de consulta. El retorno exacto de push 1179 y el editor 1175 sí están integrados.

## Recorridos y estados que deben revisarse

| Recorrido | Estados relevantes y fuentes de prueba |
| --- | --- |
| Navegar, buscar, filtrar | Inicio/catálogo/colecciones, carga/vacío/error; tests/navigation y catalog |
| Elegir producto/variante | disponible/agotado/oculto, foto por opción, cantidad; tests/catalog y ui-ux |
| Carrito | vacío, persistido, cambio remoto, stock insuficiente; tests/cart y checkout |
| Compra | sesión restaurando/visitante/cuenta, entrega, totales, cupón, pedido; tests/checkout y payments |
| Cuenta | ingreso, correo, Google, logout, perfil/direcciones; tests/accounts, auth, login y profile |
| Seguimiento | pedido enlazado, hidratación tardía, permisos/errores; tests/orders y profile |
| Productos admin | crear/editar/variantes, inventario privado, fotos, concurrencia; tests/admin y ui-ux |
| Pedidos admin | estados, pagos, devoluciones, selección, papelera; tests/orders y operations |
| Contenido/medios | página, colección, biblioteca, permisos/publicación; tests/visual-builder y admin |
| Sincronización | revisión pública, espejo, reconexión, idempotencia; tests/sync y system-health |
| Participación/push | Me gusta, reseña, destino tras login, carga tardía; tests/engagement y push |
| Recuperación/calidad | offline, proveedor lento, reintento, caché, foco, responsive; tests/security, performance, cache y ui-ux |

No se considera probado un proveedor real por usar un fixture o emulador. Las limitaciones de OAuth/correo/push físico, pagos y sincronización autenticada deben quedar explícitas al cierre. No se hacen pedidos, pagos ni escrituras comerciales reales para completar esta revisión.
