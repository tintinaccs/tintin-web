# Notificaciones de pedidos en el celular (Tintin Pedidos)

Esta guía explica, paso a paso, cómo dejar funcionando el aviso que llega al
celular cada vez que una clienta completa un pedido. No hace falta saber
programar: son datos que se copian y se pegan en tres lugares (Firebase,
Cloudflare y Google Apps Script) y después una instalación en el celular.

**Cómo funciona, en una frase:** cuando el pedido queda realmente guardado,
el servidor de Tintin avisa a Firebase, y Firebase le manda la notificación a
cada celular que la administradora haya activado.

**Qué se ve en la pantalla bloqueada:** solamente el número de pedido, el
total y el tipo de entrega. Por ejemplo:

> **Nuevo pedido en Tintin**
> Pedido #A1B2C3D4 · Gs. 180.000 · Delivery

El nombre, el teléfono, el correo, la dirección, la referencia, la ubicación
y las notas de la clienta **nunca** salen en la notificación: se ven solo
después de abrir el panel con la sesión iniciada.

---

## 1. Firebase

1. Entrá a <https://console.firebase.google.com> y abrí el proyecto
   **tintin-accesorios**.
2. Tocá el engranaje ⚙️ arriba a la izquierda y entrá en
   **Configuración del proyecto**.
3. Abrí la pestaña **Cloud Messaging**.
4. Buscá la sección **Certificados push web** (Web Push certificates). Si no
   hay ninguno, tocá **Generar par de claves**. Si ya hay uno, usá ese.
   Copiá el texto largo de la columna **Clave** — esa es la **clave VAPID**.
   - Esta clave es **pública**: el navegador la recibe igual cuando activa
     las notificaciones. Igual la guardamos en Cloudflare para poder
     cambiarla sin tocar el código.
5. En la misma pantalla, confirmá que **Firebase Cloud Messaging API (V1)**
   figure como **Habilitada**. Si dice deshabilitada, tocá el enlace y
   habilitala en Google Cloud.
6. Volvé a **Configuración del proyecto** y abrí la pestaña
   **Cuentas de servicio**.
7. Tocá **Generar nueva clave privada** y confirmá. Se descarga un archivo
   `.json`.
8. ⚠️ **Ese archivo es la llave maestra del proyecto.** No lo subas a GitHub,
   no lo mandes por WhatsApp, no lo pegues en un chat y no lo dejes en la
   carpeta del sitio. Se usa una sola vez, en el paso siguiente, y después
   conviene borrarlo de Descargas.

---

## 2. Cloudflare Pages

1. Entrá a <https://dash.cloudflare.com> → **Workers & Pages** → el proyecto
   de Tintin (el que publica el sitio).
2. Abrí **Settings**.
3. Entrá en **Variables and Secrets**.
4. Agregá estas cuatro:

   | Nombre | Valor | Tipo |
   |---|---|---|
   | `FIREBASE_WEB_PUSH_VAPID_KEY` | La clave VAPID del paso 1.4 | Texto (es pública) |
   | `FIREBASE_SERVICE_ACCOUNT_JSON` | **Todo** el contenido del archivo `.json` del paso 1.7, de la primera llave `{` a la última `}` | **Secreto / cifrado** |
   | `TINTIN_PUSH_WEBHOOK_SECRET` | Una contraseña larga inventada por vos (mínimo 32 caracteres, letras y números) | **Secreto / cifrado** |
   | `TINTIN_PUSH_ENABLED` | `true` | Texto |

   > Si el proyecto ya tenía `FIREBASE_SERVICE_ACCOUNT_KEY` configurada (la
   > usa el ingreso con código por correo), sirve la misma cuenta de
   > servicio y no hace falta cargarla dos veces.

5. Marcá como **cifradas / encrypted** las dos que dicen "Secreto".
6. Configuralas para **Production**. Si usás vistas previas (*Preview*),
   cargalas también ahí.
7. Guardá y volvé a **desplegar** (Deployments → Retry deployment o un push
   nuevo). Las variables recién existen después de un despliegue.

Anotá la dirección del webhook, que es el dominio del sitio más
`/api/push-order-event`. Por ejemplo:

```
https://tintinaccesorios.pages.dev/api/push-order-event
```

---

## 3. Google Apps Script

1. Abrí el mismo proyecto de Apps Script donde ya están `Código.gs`,
   `Phase3Security.gs` y `Phase4CreateOrder.gs`.
2. Reemplazá el contenido de `Phase4CreateOrder.gs` por el de este
   repositorio (`apps-script/Phase4CreateOrder.gs`), que ya trae el aviso.
3. Andá a **Configuración del proyecto** (⚙️) →
   **Propiedades de la secuencia de comandos** (*Script Properties*).
4. Agregá dos propiedades:

   | Propiedad | Valor |
   |---|---|
   | `TINTIN_PUSH_WEBHOOK_URL` | La dirección anotada al final del paso 2 |
   | `TINTIN_PUSH_WEBHOOK_SECRET` | **Exactamente** la misma contraseña que cargaste en Cloudflare |

   Si las dos contraseñas no son idénticas (una letra de más, un espacio al
   final), Cloudflare rechaza el aviso y no llega ninguna notificación.
5. Guardá.
6. Tocá **Implementar** → **Administrar implementaciones** → editar (✏️) →
   **Versión: Nueva versión** → **Implementar**.
7. Confirmá que la implementación conserve los mismos permisos que tenía
   (si Google los vuelve a pedir, aceptalos con la cuenta dueña del script).

---

## 4. En el celular

### Android (Chrome)

1. Abrí el panel: `https://tintinaccesorios.pages.dev/admin.html`.
2. Menú ⋮ → **Instalar aplicación** / **Agregar a pantalla principal**.
3. Abrí **Tintin Pedidos** desde el ícono nuevo.
4. Iniciá sesión con `tintinaccs@gmail.com`.
5. Entrá en **Configuración** y buscá la tarjeta **Notificaciones de pedidos**.
6. Tocá **Activar notificaciones** y aceptá el permiso que pide el navegador.
7. Tocá **Enviar notificación de prueba**. Tiene que llegar el aviso
   "Tintin Pedidos — Las notificaciones están funcionando correctamente."

### iPhone / iPad (Safari, iOS 16.4 o posterior)

En iPhone las notificaciones web **solo funcionan con la aplicación
instalada**. Si abrís el panel en Safari sin instalar, la tarjeta te lo va a
avisar y el botón no va a pedir permiso.

1. Abrí el panel con **Safari** (no con Chrome ni desde Instagram).
2. Tocá el botón **Compartir** (el cuadrito con la flecha hacia arriba).
3. Elegí **Agregar a inicio**.
4. Abrí **Tintin Pedidos** desde el ícono nuevo de la pantalla de inicio.
5. Iniciá sesión con `tintinaccs@gmail.com`.
6. Entrá en **Configuración** → tarjeta **Notificaciones de pedidos**.
7. Tocá **Activar notificaciones** y aceptá el permiso.
8. Tocá **Enviar notificación de prueba**.

> Se puede activar en varios celulares: cada uno se registra por separado y
> todos reciben el aviso. Podés ponerle un nombre a cada uno
> (por ejemplo "iPhone de Barbi") en el campo de la tarjeta.

---

## 5. Solución de problemas

| Qué pasa | Por qué | Qué hacer |
|---|---|---|
| **No aparece la tarjeta ni el botón** | La tarjeta es exclusiva de `tintinaccs@gmail.com`. | Verificá con qué cuenta iniciaste sesión. |
| **Dice "Navegador no compatible"** | El navegador no admite Web Push (Safari viejo, navegador dentro de Instagram/Facebook). | Abrí el panel en Chrome (Android) o Safari (iPhone con iOS 16.4+). |
| **Dice "Instalación requerida en iPhone"** | Estás en Safari sin instalar la app. | Compartir → Agregar a inicio, y abrir desde el ícono. |
| **Dice "Permiso bloqueado"** | Se rechazó el permiso alguna vez. | Android: Ajustes del sitio → Notificaciones → Permitir. iPhone: Ajustes → Tintin Pedidos → Notificaciones. Después volvé a tocar Activar. |
| **Dice "Error de configuración"** | Falta la clave VAPID o la cuenta de servicio en Cloudflare. | Revisá el paso 2 y volvé a desplegar. |
| **Llega el correo pero no la notificación** | Falta alguna variable en Cloudflare, o ningún dispositivo está activo. | Revisá el paso 2 y activá al menos un dispositivo. |
| **El pedido se crea pero no llega nada** | Apps Script no tiene las propiedades, o la URL del webhook está mal. | Revisá el paso 3. En Apps Script, **Ejecuciones** muestra el error (nunca muestra la contraseña). |
| **Error 401 / 403 de Google** | La cuenta de servicio está incompleta o mal pegada, o falta habilitar la API de FCM. | Volvé a generar el `.json` (paso 1.7) y pegalo entero. Confirmá el paso 1.5. |
| **La firma es inválida** | La contraseña de Cloudflare y la de Apps Script no son idénticas. | Copialas de nuevo, sin espacios al principio ni al final. |
| **Llega la notificación duplicada** | Suele ser un service worker viejo. | Cerrá la app, borrá datos del sitio y volvé a activar. El sistema descarta duplicados por evento, así que no debería repetirse. |
| **El aviso abre el inicio y no el pedido** | El pedido fue eliminado, o la sesión venció y el panel pidió login. | Al volver a iniciar sesión el destino se retoma solo. Si el pedido no existe, la tarjeta lo avisa. |
| **"Token inválido"** | El navegador rotó el token o se borraron los datos. | Tocá **Activar notificaciones** otra vez: se registra el token nuevo y el viejo queda desactivado solo. |

---

## 6. Pruebas manuales obligatorias

Después de desplegar, conviene recorrer esta matriz al menos una vez.

| # | Escenario | Resultado esperado |
|---|---|---|
| 1 | Chrome Android, app instalada, permiso concedido | Llega una notificación por pedido |
| 2 | Chrome Android sin instalar, permiso concedido | Llega igual (Android no exige instalar) |
| 3 | Safari iPhone instalado, permiso concedido | Llega una notificación por pedido |
| 4 | Safari iPhone sin instalar | La tarjeta muestra "Instalación requerida en iPhone" y no pide permiso |
| 5 | Chrome escritorio | Se puede activar y llega la notificación |
| 6 | Panel abierto en primer plano | Aparece un aviso discreto dentro de la tarjeta, sin interrumpir |
| 7 | Panel cerrado / celular bloqueado | Llega igual la notificación del sistema |
| 8 | Permiso denegado | Estado "Permiso bloqueado" con instrucciones; no se vuelve a pedir solo |
| 9 | Token eliminado (borrar datos del sitio) | Al tocar Activar se registra de nuevo; el token viejo queda inactivo |
| 10 | Dos dispositivos activos | Cada uno recibe **una** notificación |
| 11 | Pedido normal | Una sola notificación por dispositivo |
| 12 | Reintento del mismo pedido | No llega un segundo aviso (mismo `eventId`) |
| 13 | Pedido existente que devuelve `created: false` | Se reintenta el aviso; si ya se había enviado, no se repite |
| 14 | Fallo temporal del webhook de Apps Script | El respaldo del correo dispara el aviso; el pedido no falla |
| 15 | Fallo del correo | La notificación llega igual |
| 16 | Token FCM inválido | Ese dispositivo queda inactivo y no se vuelve a intentar; los demás siguen |
| 17 | Notificación de prueba | Llega "Tintin Pedidos — Las notificaciones están funcionando correctamente." |

Además, en todos los casos:

- El checkout **nunca** falla por un problema de notificaciones.
- El stock y el pedido no cambian por esta función.
- La notificación no muestra datos personales.
- La tienda pública sigue funcionando y se instala igual que antes.

---

## 7. Para quien mantenga el código

- Envío: API **HTTP v1** de FCM
  (`https://fcm.googleapis.com/v1/projects/tintin-accesorios/messages:send`),
  con token OAuth 2.0 de corta duración firmado con Web Crypto. No se usa la
  API heredada ni ninguna *server key*.
- El único disparador confiable del evento es el commit del pedido en
  `apps-script/Phase4CreateOrder.gs`, que firma el webhook con HMAC-SHA256
  sobre `<timestamp>.<rawBody>`.
- `functions/api/order-email.js` es un **respaldo**, con el mismo
  `eventId` (`order.created:<orderId>`), así que la idempotencia impide un
  segundo aviso.
- Idempotencia: colección `pushEvents`, documento con el hash del `eventId`,
  estados `processing` / `sent` / `partial` / `failed` / `no_devices`.
- Dispositivos: colección `adminPushDevices`, un documento por dispositivo,
  id = hash de `uid + deviceId` (nunca el token). Las reglas de Firestore
  niegan el acceso a las dos colecciones desde cualquier cliente.
- Para pagos futuros ya existe `dispatchOrderPushEvent(env, type, orderId,
  externalEventId)` con los tipos `payment.completed`, `payment.failed` y
  `payment.refunded`. **Ninguno se dispara hoy**: `payment.completed` sólo
  podrá originarse después de verificar server-side el webhook oficial de
  PayPal (monto, moneda, order ID, capture ID y firma), nunca desde
  `onApprove` en el navegador, y su `eventId` deberá incluir el capture ID.
- Auditoría: `npm run audit:web-push`. Pruebas: `npm run test:web-push`.
