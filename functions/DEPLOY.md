# Tintin — Cloud Functions: Email Notification (requiere plan Blaze)

> ⚠️ **El sitio HOY NO usa este método** — requiere el plan Blaze de Firebase
> (pago por uso, con tarjeta cargada). Como se decidió no cargar tarjeta, el
> sitio usa en su lugar **Google Apps Script**, que es gratis y no la pide.
> Ver `EMAIL_SETUP.md` para el método que está activo actualmente.
>
> Este archivo (y `functions/index.js`) quedan listos por si en el futuro
> se prefiere pasar a Cloud Functions.

## Qué hace
- `notifyNewOrder`: cuando se crea un nuevo pedido en Firestore (`orders/{orderId}`),
  envía un email a `tintinaccs@gmail.com` con el resumen completo del pedido
  (cliente, WhatsApp, dirección, zona, productos, pago, envío, fecha/hora en horario de Paraguay).
- `resendOrderEmail`: función que Super Admin → Pedidos llama con el botón
  "✉️ Reenviar" para reenviar el correo de un pedido ya existente. Solo un
  usuario admin/superadmin puede llamarla. Cada reenvío suma 1 a `resendCount`,
  que se muestra en el panel como "Reenviado (N)".

## Requisitos
- Node.js 20+
- Firebase CLI: `npm install -g firebase-tools`
- Cuenta Firebase con Blaze plan (pay-as-you-go) activado
  - Las Cloud Functions requieren Blaze, pero el costo real para pocos pedidos es $0.

## Configuración de credenciales (una sola vez)

### 1. Crear contraseña de aplicación en Gmail
- Ir a: Google Account → Seguridad → Verificación en dos pasos → Contraseñas de aplicación
- Crear una contraseña para "Tintin Tienda"
- Copiar el código de 16 caracteres (ejemplo: `abcd efgh ijkl mnop`)

### 2. Guardar las credenciales como secretos de Firebase (SEGURO, no van al código)
```bash
firebase functions:secrets:set GMAIL_USER
# Ingresar: tintinaccs@gmail.com

firebase functions:secrets:set GMAIL_PASS
# Ingresar: la contraseña de aplicación (sin espacios)
```

### 3. Instalar dependencias y desplegar
```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

## Verificar que funciona
1. Crear un pedido de prueba desde checkout.html
2. Revisar en Firebase Console → Firestore → orders → el pedido nuevo
3. El campo `notificationStatus` debe cambiar de `"pending"` a `"sent"` en segundos
4. Revisar la bandeja de entrada de tintinaccs@gmail.com

## Si algo falla
- El campo `notificationStatus` quedará en `"error"`
- El campo `notificationError` mostrará el mensaje de error
- Ver logs: `firebase functions:log`

## Canales alternativos (futuro)
- **Telegram**: Reemplazar nodemailer por `node-telegram-bot-api`, usar Bot Token como secreto
- **WhatsApp Business API**: Usar Meta Cloud API o Twilio, credenciales como secretos
- **Zapier/Make**: En vez de Cloud Functions, conectar Firestore → Zapier → Gmail/WA/Slack
  sin necesidad de código backend
