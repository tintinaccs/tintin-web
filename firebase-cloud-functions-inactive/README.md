# Firebase Cloud Functions — inactivas (plan Spark)

El código de esta carpeta **no se despliega hoy**. `firebase.json` no
declara ningún bloque `"functions"`, y el proyecto corre en el plan Spark
de Firebase (sin tarjeta), que no permite desplegar Cloud Functions v2 —
`create-order.js` e `index.js` requieren `firebase-admin`/`firebase-functions`,
disponibles solo bajo el plan Blaze (pago por uso).

El sitio usa en su lugar:
- **Pedidos y stock:** una transacción de Firestore iniciada desde el
  navegador y validada por `firestore.rules` (ver `SECURE_ORDER_DEPLOY.md`
  en `functions/`, un nivel arriba).
- **Correos:** Google Apps Script + Gmail, gratis (ver
  `functions/EMAIL_SETUP.md`).

Este código se separó del directorio `functions/` porque Cloudflare Pages
usa ese mismo nombre de carpeta por convención para sus propias Pages
Functions activas (`functions/api/*.js` — Cloudinary, geocoding, email,
geo). Tenerlos mezclados hacía parecer que este código corría en
producción cuando en realidad depende de una plataforma distinta
(Firebase Cloud Functions) que hoy no está activa.

## Si en el futuro se activa el plan Blaze

1. Mover (o copiar) esta carpeta de vuelta a un directorio propio fuera de
   `functions/` de Cloudflare (por ejemplo, mantenerla acá mismo) y agregar
   un bloque `"functions"` en `firebase.json` apuntando a esta carpeta.
2. `npm install` dentro de esta carpeta (tiene su propio `package.json`).
3. Ver `DEPLOY.md` para el detalle de qué hace cada función.
4. Migrar la lógica de envío de correo desde Apps Script si se decide
   reemplazarlo (no es obligatorio: ambos caminos pueden convivir).
