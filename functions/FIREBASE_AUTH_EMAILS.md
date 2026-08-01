# Tintin — Autenticación: Google + enlace por correo

`login.html` ofrece dos formas de entrar (y de crear cuenta), ambas sin
contraseña:

1. **"Continuar con Google"** — `signInWithPopup` + `GoogleAuthProvider`
   (con `signInWithRedirect` como respaldo si el navegador bloquea el
   popup). Google entrega el correo ya verificado.
2. **"Recibir enlace de acceso"** — enlace mágico de un solo uso mandado al
   correo escrito (`js/email-auth.js`, `sendSignInLinkToEmail` /
   `signInWithEmailLink` de Firebase Auth). Pensado para quien no tiene o no
   quiere usar una cuenta de Google.

Ambos caminos terminan en el mismo lugar: `guardarUsuario()` /
`ensureUserDocForEmailLogin()` crean o actualizan `users/{uid}` con el mismo
criterio (primera vez arma el perfil, las siguientes solo tocan
`lastLogin`), y `redirectByRole()` decide el destino según el rol.

## ⚠️ Paso pendiente en la consola de Firebase (bloquea el enlace por correo)

El código del enlace por correo está completo, pero **el proveedor "Email
link (passwordless sign-in)" está deshabilitado en el proyecto**. Confirmado
en vivo el 2026-08-01: `sendSignInLinkToEmail` contra producción devuelve
`auth/operation-not-allowed` (HTTP 400, `OPERATION_NOT_ALLOWED`). Hasta que
se habilite, cualquier clienta que use "Recibir enlace de acceso" ve el
mensaje "El ingreso por correo no está disponible en este momento" y no
puede completar el ingreso por esa vía — Google sigue funcionando sin
problema mientras tanto.

**Para habilitarlo** (requiere acceso a la consola de Firebase del
proyecto, no se puede hacer desde el código/repo):

1. [Firebase Console](https://console.firebase.google.com) → proyecto
   `tintin-accesorios` → **Authentication → Sign-in method**.
2. Abrir el proveedor **Email/Password**.
3. Activar el toggle **"Email link (passwordless sign-in)"** (dejar
   "Email/Password" en sí apagado si no se quiere permitir contraseñas —
   solo hace falta el enlace).
4. Guardar. No requiere redeploy del sitio; el cambio aplica al toque.

Después de activarlo, probar con un correo real: pedir el enlace, abrirlo
desde el mismo navegador y confirmar que entra sin volver a mostrar el
formulario.

## Qué NO hace falta tocar

- **Authentication → Templates**: Firebase manda el enlace con su plantilla
  y remitente por defecto; no depende de ningún backend propio de Tintin.
  Se puede personalizar remitente/idioma ahí más adelante si se quiere,
  pero no es necesario para que funcione.
- **Dominios autorizados**: `tintinaccesorios.pages.dev` ya es el
  `authDomain` configurado en `js/firebase.js`, así que ya está autorizado
  para ambos métodos.
- El correo de **reporte de pedidos** (a `tintinaccs@gmail.com` y al
  cliente) es un mecanismo aparte (Google Apps Script) sin relación con
  esto — ver `functions/EMAIL_SETUP.md`.

## Cuentas viejas con contraseña

Si existía alguna cuenta creada antes con email/contraseña (flujo viejo, ya
eliminado), esa cuenta no puede entrar con contraseña — no hay pantalla de
"olvidé mi contraseña". Para volver a entrar, esa clienta usa Google o el
enlace por correo con el mismo email; Firebase asocia el inicio de sesión a
la cuenta existente por dirección de correo.

## Cómo probarlo

1. Entrá a `login.html` sin sesión iniciada — se ve "Continuar con Google" y
   más abajo el bloque de correo ("Correo electrónico" + "Recibir enlace de
   acceso").
2. **Google**: clic, elegí una cuenta — debería crear el perfil (primera
   vez) o solo actualizar `lastLogin` (siguientes veces), mostrar la
   pantalla de carga de marca durante todo el proceso (nunca vuelve a
   mostrarse el formulario) y redirigir según el rol.
3. **Correo** (una vez habilitado el proveedor, ver arriba): escribí un
   correo válido, "Recibir enlace de acceso" — debería mostrar el aviso de
   éxito y arrancar el cooldown de reenvío de 60s. Abrí el enlace recibido
   desde el mismo navegador — debería completar el ingreso solo, sin pedir
   nada más.
4. Cerrá la ventana emergente de Google antes de elegir cuenta — el loader
   rosa debería desaparecer rápido con un mensaje de error, sin quedar
   colgado.
5. Con una cuenta marcada como bloqueada (Fase E), debería cerrar sesión
   sola y mostrar el mensaje de cuenta bloqueada, sin dejar entrar — para
   los dos métodos.
6. Desde `checkout.html`, sin sesión, avanzar de Carrito a Envío debería
   abrir el modal "Necesitás una cuenta para continuar" con acceso a ambos
   métodos, y volver directo al paso de Envío después de loguearse.
