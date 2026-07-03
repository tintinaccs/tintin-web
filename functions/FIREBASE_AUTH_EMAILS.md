# Tintin — Autenticación: solo Google

Desde este cambio, el sitio **ya no tiene login/registro con email y
contraseña**. La única forma de entrar (y de crear una cuenta) es el botón
**"Continuar con Google"** en `login.html`, usando `signInWithPopup` +
`GoogleAuthProvider` de Firebase Authentication.

## Qué se eliminó

- Las pestañas "Ingresar" / "Registrarse" / "Recuperar" de `login.html` (y
  todo el código de `sendPasswordResetEmail`, `sendEmailVerification`,
  `verifyPasswordResetCode`, `confirmPasswordReset`, `applyActionCode`).
- La colección `emailProviders/{email}` en `firestore.rules` (existía solo
  para diferenciar cuentas de Google vs. cuentas con contraseña al recuperar
  contraseña — ya no hace falta).
- Toda lógica de "correo verificado / correo sin verificar": Google entrega
  el email ya verificado, así que ese estado intermedio no existe más.

**Esto significa que Firebase Authentication ya NO envía ningún correo**
(ni de verificación ni de restablecimiento de contraseña). Por lo tanto:

- La sección **Authentication → Templates** de la consola de Firebase ya no
  necesita ninguna configuración para este sitio — podés ignorarla.
- El paso de **"Personalizar URL de acción"** (Customize action URL) ya no
  aplica.

## Qué sigue vivo

- `js/firebase.js` sigue teniendo `auth.languageCode = "es";` — no hace
  daño dejarlo (afecta, por ejemplo, textos que Google pueda mostrar), pero
  no es indispensable para el flujo de Google.
- El **nombre público del proyecto** en Firebase (Configuración del
  proyecto → General → "Nombre público del proyecto") sigue siendo lo que
  ve la clienta en la pantalla de consentimiento de Google al iniciar
  sesión — conviene que diga `Tintin Accesorios` y no el ID técnico del
  proyecto.
- El correo de **reporte de pedidos** (a `tintinaccs@gmail.com` y al
  cliente) sigue funcionando igual que siempre, sin relación con esto — es
  un mecanismo aparte (Google Apps Script), ver `functions/EMAIL_SETUP.md`.

## Cuentas viejas con contraseña

Si existía alguna cuenta creada antes con email/contraseña (no con Google),
esa cuenta deja de poder ingresar: no hay ningún flujo de "recuperar
contraseña" ni de login con contraseña. Para volver a comprar/ver su
perfil, esa clienta tiene que entrar con el botón de Google usando el mismo
correo — Firebase crea una cuenta de Google nueva con ese email si no
existía una, y el sitio arma su perfil (`users/{uid}`) igual que a
cualquier clienta nueva.

## Cómo probarlo

1. Entrá a `login.html` sin sesión iniciada — debería verse un único botón
   "Continuar con Google", sin pestañas ni formularios.
2. Hacé clic, elegí una cuenta de Google — debería crear el perfil (primera
   vez) o solo actualizar `lastLogin` (siguientes veces) y redirigir según
   el rol (cliente → `perfil.html` o `from`, staff → `admin.html`).
3. Cerrá la ventana emergente de Google antes de elegir cuenta — el loader
   rosa debería desaparecer rápido con un mensaje de error, sin quedar
   colgado.
4. Con una cuenta marcada como bloqueada (Fase E), debería cerrar sesión
   sola y mostrar el mensaje de cuenta bloqueada, sin dejar entrar.
5. Desde `checkout.html`, sin sesión, avanzar de Carrito a Envío debería
   abrir el modal "Necesitás una cuenta para continuar" con un solo botón
   "Continuar con Google" que lleva a `login.html?from=checkout.html`, y
   volver directo al paso de Envío después de loguearse.
