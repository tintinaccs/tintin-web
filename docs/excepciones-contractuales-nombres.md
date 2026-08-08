# Excepciones contractuales de nombres

La organización global se aplica a todos los nombres internos elegibles. Se conservan los siguientes nombres cuando cambiarlos rompería una URL, una integración, un estándar o una herramienta externa.

## Rutas y contratos públicos

- Páginas HTML públicas y sus URLs existentes.
- `checkout` cuando forma parte de rutas, eventos o contratos técnicos.
- `js/create-order-client.js`, requerido por auditorías y compatibilidad histórica.
- Campos, colecciones, eventos, IDs, clases CSS y claves persistidas.

## Endpoints de Pages Functions

Los nombres de estos archivos definen endpoints públicos y permanecen estables:

- `functions/api/cloudinary-delete.js`
- `functions/api/cloudinary-sign-upload.js`
- `functions/api/email-otp-send.js`
- `functions/api/email-otp-verify.js`
- `functions/api/geo-search.js`
- `functions/api/location-search.js`
- `functions/api/order-email.js`
- `functions/api/sheets-product-sync.js`
- `functions/api/test-email.js`
- `functions/api/visitor-geo.js`

## Archivos estándar y arquitectura

- `README.md`, `AGENTS.md`, `LICENSE`, `package.json`, `firebase.json`, `manifest.webmanifest`, `sw.js`, `_headers` y `_redirects`.
- `AGENTS.md` conserva exactamente ese nombre porque Codex lo descubre como archivo contractual de instrucciones del repositorio.
- Carpetas arquitectónicas convencionales como `js`, `css`, `pages`, `components`, `core`, `admin`, `scripts`, `functions` y `.github/workflows`.
- Nombres de proveedores, protocolos y siglas: Firebase, Firestore, Cloudinary, Resend, WhatsApp, API, OTP, PWA, SEO, UI, UX, CI, SDK y Playwright.

Estas excepciones no representan trabajo pendiente: son contratos deliberadamente preservados.
