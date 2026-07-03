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

## Página propia para "restablecer contraseña" y "verificar correo" — REQUIERE UN PASO MANUAL

Antes, al hacer clic en el link del correo, Firebase mostraba su propia
página genérica (`tintin-accesorios.firebaseapp.com/__/auth/action`, a veces
en inglés) y solo al final un botón "Continuar" que volvía a `login.html`.

Ahora `login.html` sabe manejar esos links directamente (mismo diseño de
Tintin, en español, con mensaje claro si el link ya se usó o caducó) — pero
para que el link del correo venga DIRECTO a `login.html` en vez de pasar por
la pantalla de Firebase, hay que activarlo a mano, una sola vez, por cada
plantilla:

1. **Authentication → Templates**.
2. Abrí (ícono de lápiz ✏️) la plantilla **Restablecimiento de contraseña**.
3. Buscá el enlace **"Personalizar URL de acción"** ("Customize action URL"),
   generalmente abajo del todo del editor.
4. Poné: `https://tintinaccs.github.io/tintin-web/login.html`
5. Guardá.
6. Repetí los pasos 2 a 5 para la plantilla **Verificación de dirección de
   correo electrónico**.

**Si no hacés este paso**, no pasa nada malo — el link del correo simplemente
sigue yendo a la pantalla de Firebase como antes (el código de `login.html`
detecta `?mode=…&oobCode=…` en la URL; si esos parámetros no están, ni se
entera de que existe esta función nueva).

Una vez activado, así se comporta cada caso:

- **Restablecer contraseña** → `login.html` valida el enlace
  (`verifyPasswordResetCode`) y muestra el formulario de nueva contraseña con
  el diseño de Tintin. Si el enlace ya se usó o caducó, muestra "Este enlace
  ya fue usado o caducó" con un botón **Solicitar nuevo enlace** que la lleva
  directo a la pestaña Recuperar.
- **Verificar correo** → `login.html` confirma el correo (`applyActionCode`)
  y muestra "¡Correo verificado!" con un botón para ir a iniciar sesión. Si
  el enlace ya se usó o caducó, se le indica que inicie sesión (ahí el
  sistema ya le ofrece reenviar la verificación si todavía hace falta).

Todo esto es 100% client-side con el SDK de Firebase Auth — el código nunca
ve ni maneja la contraseña de nadie más que la de la propia clienta en su
propio navegador, y el enlace (`oobCode`) se valida del lado del servidor de
Google, igual que con la pantalla genérica de antes. No se agregó ningún
backend ni Cloud Function.

## Cómo probarlo

1. Registrate con una cuenta de prueba desde `login.html`.
2. Revisá la bandeja de esa cuenta de prueba — debería llegar el correo de
   verificación con el asunto y el remitente que configuraste, en español.
3. Hacé clic en el enlace del correo — si configuraste la URL de acción
   personalizada (arriba), deberías ver la pantalla de Tintin, no la de
   Firebase.
4. Para probar el de recuperación, andá a la pestaña "Recuperar" con ese
   mismo email, y hacé clic en el enlace que te llega.
5. Probá también un enlace viejo/ya usado — debería mostrar el mensaje de
   "caducó" con el botón para pedir uno nuevo, no un error críptico.

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

## Cuentas de Google vs. cuentas con contraseña — bloqueo real del reenvío

Una cuenta creada con el botón de Google no tiene contraseña de Tintin, así
que "Recuperar contraseña" no le sirve — y antes, aunque se le mostrara un
aviso genérico al lado, el botón "Enviar enlace de recuperación" igual le
mandaba el correo (Firebase no lo bloqueaba). Tintin pidió explícitamente
que ESO no pase: si el email es de una cuenta de Google, no se debe reenviar
nada, solo mostrarle el aviso de usar "Continuar con Google".

Para lograrlo hace falta poder consultar, a partir de un email suelto y SIN
estar logueada, qué proveedor usa esa cuenta puntual. Firebase tenía una
función para eso (`fetchSignInMethodsForEmail`) y la discontinuó a propósito
por permitir "email enumeration" (probar emails al voleo y aprender cuáles
tienen cuenta). La solución acá reconstruye ese lookup pero acotado al
mínimo posible, para no reabrir ese riesgo más de lo estrictamente necesario:

- Colección aparte `emailProviders/{email}`, con un ÚNICO campo:
  `{ provider: 'password' | 'google.com' }`. Nunca nombre, teléfono, rol,
  ni ningún otro dato — si alguien la consulta, lo único que puede llegar a
  saber es "esta cuenta puntual, si existe, es de Google o no", nada más.
- Se puede leer un email puntual (`allow get: if true`) pero la colección
  **nunca se puede listar/recorrer** (`allow list: if false`) — no hay forma
  de "iterar" para descubrir qué emails tienen cuenta, solo confirmar uno
  que ya se escribió a mano en el formulario.
- Solo el dueño de una cuenta (con su propio token ya autenticado) puede
  escribir su propio documento, y solo con el proveedor real que Firebase
  le asignó — nadie puede escribir el proveedor de otra persona ni inventar
  un valor.

`login.html` guarda este dato en cada login/registro (junto con
`authProvider` en `users/{uid}`, que sigue existiendo igual que antes). En
"Recuperar contraseña", antes de llamar a `sendPasswordResetEmail`, se
consulta `emailProviders/{email}`: si el proveedor es `google.com`, se
corta ahí con el mensaje de Google y **no se envía ningún correo**; en
cualquier otro caso (proveedor `password`, o el email no está en la
colección — es decir, probablemente no tiene cuenta) sigue el flujo de
siempre, con el mismo mensaje genérico de éxito. La pregunta "¿existe una
cuenta con este email?" sigue protegida igual que antes — lo único que deja
de estar protegido es, específicamente, "si existe, ¿es de Google?", que es
justo el dato que hacía falta para cumplir el pedido.
