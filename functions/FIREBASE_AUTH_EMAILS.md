# Tintin — Personalizar los correos de Firebase Authentication

El sitio usa el sistema de correos **propio de Firebase Authentication** para
dos cosas:

- **Verificación de cuenta** (`sendEmailVerification`, disparado desde `login.html`
  cuando alguien se registra).
- **Recuperación de contraseña** (`sendPasswordResetEmail`, disparado desde la
  pestaña "Recuperar" de `login.html`).

Esto es 100% gratis (plan Spark de Firebase), no requiere activar Billing ni
tarjeta. El **idioma** del correo se fuerza desde el código (`js/firebase.js`,
`auth.languageCode = "es"` — ver más abajo), pero el asunto, el nombre del
remitente, el reply-to y el texto del correo se editan **a mano en la consola
de Firebase**, no hay forma de configurarlos desde el código.

## Dónde editarlo

1. Entrá a **https://console.firebase.google.com**, con la cuenta que administra
   el proyecto `tintin-accesorios`.
2. En el menú lateral: **Authentication → Templates** (Plantillas).
3. Vas a ver una lista con varios tipos de correo — a Tintin le interesan dos:
   - **Verificación de dirección de correo electrónico**
   - **Restablecimiento de contraseña**
4. Hacé clic en el ícono de lápiz ✏️ de cada uno para editarlo.

## Qué cambiar en cada uno

Para ambos templates podés editar:

- **Nombre del remitente**: poner `Tintin Accesorios` (por defecto dice
  "escrito por tu-proyecto.firebaseapp.com", que no se ve profesional).
- **Responder a**: opcional, podés dejarlo en blanco o poner `tintinaccs@gmail.com`.
- **Asunto**: reemplazar el texto en inglés por defecto ("Reset your password
  for...") por uno en español, por ejemplo:
  - Verificación → `Verificá tu cuenta de Tintin`
  - Restablecimiento → `Recuperá tu contraseña de Tintin` (o `Restablecé tu
    contraseña de Tintin`)
- **Mensaje**: Firebase te deja editar el cuerpo (con formato limitado). El
  placeholder `%LINK%` es obligatorio — es el botón/enlace que activa la
  verificación o el cambio de contraseña, no lo borres. Reemplazá TODO el
  texto en inglés ("Hello", "Follow this link", "Thanks") por algo así:

  **Restablecimiento de contraseña:**
  > Hola,
  > Recibimos una solicitud para restablecer la contraseña de tu cuenta Tintin.
  > Tocá el siguiente enlace para crear una nueva contraseña:
  > %LINK%
  > Si no solicitaste este cambio, podés ignorar este correo.
  > Gracias, Equipo Tintin

  **Verificación de correo:**
  > ¡Hola! 💗 Gracias por registrarte en Tintin Accesorios. Para activar tu
  > cuenta, confirmá tu correo con el siguiente enlace:
  > %LINK%
  > Si no creaste esta cuenta, podés ignorar este mensaje.
  > Gracias, Equipo Tintin

5. Click en **Guardar**. El cambio es inmediato, no hace falta ningún deploy
   ni tocar el código del sitio.

## Idioma de los correos

Antes, los correos llegaban en inglés ("Reset your password for...") porque
Firebase no sabía en qué idioma mandarlos. Esto se corrigió en dos frentes —
hacen falta los DOS, uno no reemplaza al otro:

1. **Código** (ya hecho, no requiere nada de tu parte): `js/firebase.js`
   tiene `auth.languageCode = "es";` justo después de inicializar `auth`. Con
   esto, cada vez que el sitio pide un correo (`sendPasswordResetEmail`,
   `sendEmailVerification`), le dice a Firebase "mandalo en español" — esto
   aplica automáticamente en todas las páginas (login, checkout, etc.)
   porque todas importan el mismo `auth` desde ese archivo.
2. **Consola** (esto sí lo tenés que hacer vos, una sola vez): el paso 1 le
   dice a Firebase QUÉ IDIOMA usar, pero el CONTENIDO en español de cada
   plantilla lo tenés que escribir vos —Firebase no traduce solo el texto
   que vos mismo escribiste. Dos lugares para revisar:
   - **Authentication → Templates**, arriba de la lista hay un selector
     **"Idioma de la plantilla"** — elegí **Español** antes de editar cada
     plantilla (si no, puede que edites la versión en inglés sin darte cuenta).
   - **Configuración del proyecto** (ícono de engranaje) → pestaña
     **General** → **Idioma predeterminado del proyecto** → **Español**.
     Esto es un respaldo por si algún correo cae al idioma por defecto del
     proyecto en vez del que pide el código.

## Por qué aparece "TINTIN-accesorios" y cómo cambiarlo

Ese nombre feo (todo en mayúsculas con guion) no sale del código — es el
**"Public-facing name"** (nombre público) del proyecto de Firebase, que por
defecto Firebase arma solo a partir del ID técnico del proyecto
(`tintin-accesorios`). Ese nombre se usa como reemplazo automático en los
asuntos/cuerpos que NO editaste a mano, y también aparece en la pantalla de
consentimiento de Google al iniciar sesión con Google. Para cambiarlo:

1. **Configuración del proyecto** (ícono de engranaje, arriba a la izquierda)
   → pestaña **General**.
2. Buscá el campo **"Nombre público del proyecto"** ("Public-facing name").
3. Cambialo a `Tintin Accesorios` (o simplemente `Tintin`).
4. Guardá.

Con este cambio más el asunto/cuerpo personalizado del paso anterior, en
ningún lado debería volver a aparecer "TINTIN-accesorios".

## El link de "Continuar" ya apunta al sitio — no toques eso

Firebase muestra una página propia (`tintin-accesorios.firebaseapp.com/...`)
cuando alguien hace clic en el link del correo, con un botón **"Continuar"**
que vuelve a `https://tintinaccs.github.io/tintin-web/login.html`. Esa
redirección ya está configurada en el código (`login.html`, variable
`actionCodeSettings`) — no hace falta configurar nada más en la consola para
que funcione.

## Cómo probarlo

1. Registrate con una cuenta de prueba desde `login.html`.
2. Revisá la bandeja de esa cuenta de prueba — debería llegar el correo de
   verificación con el asunto y el remitente que configuraste.
3. Para probar el de recuperación, andá a la pestaña "Recuperar" con ese
   mismo email.

## Por qué no un servicio de email externo (Resend, SendGrid, etc.)

Para verificación y recuperación de contraseña, el sistema propio de Firebase
Auth es la opción más segura y más simple: no requiere guardar ninguna clave
de API en el sitio, valida el link del lado del servidor de Google (no se
puede falsificar), y es gratis sin límite práctico para una tienda de este
tamaño. El correo de **reporte de pedidos** (a `tintinaccs@gmail.com` y al
cliente) usa un mecanismo distinto — un script propio en Google Apps Script,
ver `functions/EMAIL_SETUP.md` — porque ese correo necesita lógica
personalizada (dos destinatarios, HTML con productos e imágenes) que el
sistema de templates de Firebase Auth no permite.
