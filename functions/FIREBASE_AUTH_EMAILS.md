# Tintin — Personalizar los correos de Firebase Authentication

El sitio usa el sistema de correos **propio de Firebase Authentication** para
dos cosas:

- **Verificación de cuenta** (`sendEmailVerification`, disparado desde `login.html`
  cuando alguien se registra).
- **Recuperación de contraseña** (`sendPasswordResetEmail`, disparado desde la
  pestaña "Recuperar" de `login.html`).

Esto es 100% gratis (plan Spark de Firebase), no requiere activar Billing ni
tarjeta, y **no se configura desde el código** — el asunto, el nombre del
remitente y el texto del correo se editan desde la consola de Firebase.

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
- **Asunto**: reemplazar por:
  - Verificación → `Verificá tu cuenta de Tintin`
  - Restablecimiento → `Recuperá tu contraseña de Tintin`
- **Mensaje**: Firebase te deja editar el cuerpo (con formato limitado). El
  placeholder `%LINK%` es obligatorio — es el botón/enlace que activa la
  verificación o el cambio de contraseña, no lo borres. Podés agregar arriba
  o abajo un saludo con la voz de Tintin, por ejemplo:

  > ¡Hola! 💗 Gracias por registrarte en Tintin Accesorios. Para activar tu
  > cuenta, confirmá tu correo con el siguiente enlace:
  > %LINK%
  > Si no creaste esta cuenta, podés ignorar este mensaje.

5. Click en **Guardar**. El cambio es inmediato, no hace falta ningún deploy
   ni tocar el código del sitio.

## Idioma de los correos

Si los correos te llegan en inglés, es porque el proyecto no tiene definido
un idioma por defecto:

1. **Authentication → Templates**, arriba de la lista de templates hay un
   selector **"Idioma de la plantilla"** — elegí **Español**.
2. Si no aparece la opción ahí, andá a **Configuración del proyecto**
   (ícono de engranaje) → pestaña **General** → **Idioma predeterminado** →
   elegí **Español**.

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
