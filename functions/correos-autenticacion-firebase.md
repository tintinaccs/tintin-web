# Tintin — Autenticación: Google + código de acceso por correo

`login.html` ofrece dos formas de entrar (y de crear cuenta), ambas sin
contraseña:

1. **"Continuar con Google"** — `signInWithPopup` + `GoogleAuthProvider`
   (con `signInWithRedirect` como respaldo si el navegador bloquea el
   popup). Google entrega el correo ya verificado.
2. **Código de 6 dígitos por correo** — la clienta escribe su correo,
   recibe un código de un solo uso que vence en 5 minutos, y lo escribe en
   el sitio para entrar. Backend propio en Cloudflare Pages Functions
   (`functions/api/email-otp-send.js` / `email-otp-verify.js`) — **no** usa
   el proveedor "Email link (passwordless sign-in)" de Firebase Auth (ese
   solo manda enlaces, no códigos; quedó habilitado en el proyecto pero sin
   uso real, no hace falta deshabilitarlo).

Ambos caminos son métodos de acceso a una sola identidad y terminan en el mismo lugar: `guardarUsuario()` /
`ensureUserDocForEmailLogin()` crean o actualizan `users/{uid}` con el mismo
criterio (primera vez arma el perfil, las siguientes solo tocan
`lastLogin` y `authMethods`), y `redirectByRole()` decide el destino según el rol. Una
cuenta creada con Google también puede pedir PIN: el backend busca primero el
email verificado en Firebase Auth y reutiliza el mismo UID, sin crear otro
`customerId`. Antes de
redirigir, `ensureProfileComplete()` pide **solamente los campos ausentes**:
una cuenta completa entra directo, el nombre provisto por Google se confirma
y puede corregirse, y cada escritura se vuelve a validar en una transacción
para no pisar datos existentes. El superadmin está excluido del onboarding.
Los perfiles quedan en `users/{uid}`. La publicación del contrato actualizado
en la pestaña de clientas de Google Sheets se trata como una operación externa
separada: el repositorio no presume que el Apps Script desplegado ya coincida.

## Cómo funciona el código de 6 dígitos

- **Envío** (`functions/api/email-otp-send.js`): genera el código al azar,
  lo guarda **hasheado** (nunca en texto plano) en Firestore
  (`emailOtpCodes/{correo}`) con vencimiento real de 5 minutos, cooldown de
  reenvío de 45s y tope de 8 códigos por correo por día. Lo manda por
  **Resend** desde `noreply@tintinaccs.com` (mismo dominio ya verificado
  que usa `pedidos@tintinaccs.com` para los correos de pedidos — no
  requirió ningún paso nuevo de DNS).
- **Verificación** (`functions/api/email-otp-verify.js`): compara el código
  (hasheado también del lado del pedido), con tope de 5 intentos antes de
  invalidarlo. Si es correcto, busca o crea la cuenta de Firebase Auth con
  ese correo (ya verificado) y firma un **Custom Token** que el navegador
  usa con `signInWithCustomToken` — recién ahí existe una sesión real.
- **Nunca requirió el plan Blaze de Firebase**: todo corre en Cloudflare
  Pages Functions (gratis, mismo lugar que ya usa `order-email.js`) usando
  Web Crypto para firmar JWTs — ver `cloudflare/firebase-admin-ligero.js`.
  La única pieza nueva de configuración fue la variable secreta
  `FIREBASE_SERVICE_ACCOUNT_KEY` en Cloudflare Pages (Settings →
  Environment variables), con el `.json` completo de una cuenta de
  servicio generada en Firebase Console → Configuración del proyecto →
  Cuentas de servicio → Generar nueva clave privada.
- La colección `emailOtpCodes` no tiene ninguna regla de cliente que la
  permita en `firestore.rules` (cae en el "deny all" del final) — el único
  camino que la toca es la credencial de servicio del lado del servidor.

## Qué NO hace falta tocar

- **Authentication → Templates** de Firebase: no se usa para esto, el
  correo del código lo arma y manda Resend directamente.
- **Dominios autorizados** de Firebase Auth: `tintinaccesorios.pages.dev`
  ya es el `authDomain` configurado en `js/core/firebase/firebase.js`.
- El correo de **reporte de pedidos** (a `tintinaccs@gmail.com` y al
  cliente) es un mecanismo aparte (`functions/api/order-email.js`, también
  Resend) sin relación con esto.

## Cuentas viejas con contraseña

Si existía alguna cuenta creada antes con email/contraseña (flujo viejo, ya
eliminado), esa cuenta no puede entrar con contraseña — no hay pantalla de
"olvidé mi contraseña". Para volver a entrar, esa clienta usa Google o el
código por correo con el mismo email; Firebase asocia el inicio de sesión a
la cuenta existente por dirección de correo.

## Cómo probarlo

1. Entrá a `login.html` sin sesión iniciada — se ve "Continuar con Google" y
   más abajo el bloque de correo ("Correo electrónico" + "Enviar código").
2. **Google**: clic, elegí una cuenta — debería mostrar la pantalla de
   carga de marca durante todo el proceso (nunca vuelve a mostrarse el
   formulario). Si Google ya entrega el nombre, se confirma y solo se pide
   teléfono; si el perfil ya está completo, no aparece ningún paso adicional.
3. **Correo**: escribí un correo válido, "Enviar código" — llega un correo
   con 6 dígitos en segundos. Escribilo en el sitio y "Confirmar código" —
   debería completar el ingreso (pidiendo solo cada dato faltante) sin
   volver a mostrar el formulario de login.
4. Probá "Reenviar código" (cooldown de 45s) y un código vencido/incorrecto
   (mensaje claro, sin trabarse).
5. Cerrá la ventana emergente de Google antes de elegir cuenta — el loader
   rosa debería desaparecer rápido con un mensaje de error, sin quedar
   colgado.
6. Con una cuenta marcada como bloqueada (Fase E), debería cerrar sesión
   sola y mostrar el mensaje de cuenta bloqueada, sin dejar entrar — para
   los dos métodos.
7. Desde `checkout.html`, sin sesión, avanzar de Carrito a Envío debería
   abrir el modal "Necesitás una cuenta para continuar" con un botón
   "Iniciar sesión" que lleva a `login.html?from=checkout.html` (ahí elige
   Google o código), y volver directo al paso de Envío después de loguearse.
