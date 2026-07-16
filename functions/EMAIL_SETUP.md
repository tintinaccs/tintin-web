# Tintin — Emails de pedidos con Google Apps Script (gratis, sin tarjeta)

Esta es la forma que usa el sitio HOY para mandar el correo de cada pedido y
para el botón "Reenviar" de Super Admin → Pedidos. No requiere el plan Blaze
de Firebase ni ninguna tarjeta de crédito — usa la cuota gratuita de tu propia
cuenta de Gmail (100 correos/día, de sobra para una tienda).

> Si en el futuro preferís usar Firebase Cloud Functions en vez de esto,
> el código ya está listo en `functions/index.js` — ver `DEPLOY.md`. Pero
> requiere activar el plan Blaze (pago por uso, con tarjeta cargada).

**Cuenta que envía los correos: `tintinpedidos@gmail.com`.** El proyecto de
Apps Script vive ahí (no en `tintinaccs@gmail.com`) porque `MailApp.sendEmail`
siempre envía como la cuenta que autorizó/desplegó el script — no hay forma
de pasarle un remitente distinto. `tintinaccs@gmail.com` sigue siendo el
destinatario del correo interno, pero ya no envía nada.

> **Ya tenés el script funcionando y solo agregaste la protección
> anti-spam (cooldowns/topes diarios/bloqueo de campañas masivas)?** No hace
> falta repetir el paso 1 — solo reemplazá TODO el contenido de tu proyecto
> de Apps Script existente por el código actualizado de la sección "2.
> Código" de más abajo, y volvé a implementar una **nueva versión** (paso 3:
> Implementar → Administrar implementaciones → ✏️ editar la implementación
> activa → Versión: **Nueva versión** → Implementar). Si en cambio publicás
> una implementación *nueva* con una URL distinta, acordate de actualizar
> `js/email-config.js` con la URL nueva.

## 1. Crear el proyecto de Apps Script

1. Andá a **https://script.google.com** (con la cuenta `tintinpedidos@gmail.com`)
2. Click en **"Nuevo proyecto"**
3. Borrá todo el código de ejemplo que aparece
4. Pegá el código completo de la sección "2. Código" de más abajo
5. Reemplazá `TU_SECRETO_AQUI` (arriba del todo del código) por una clave
   larga inventada por vos (ej: `tintin-2026-x7k9mQ2p`) — cualquier texto
   difícil de adivinar sirve, no hace falta que la memorices
6. Arriba, hacé clic en el nombre "Proyecto sin título" y ponele
   `Tintin - Emails de pedidos`

## 2. Código para pegar

Este script maneja **todas las acciones** del módulo Super Admin → Correos, a
través de un único campo `action` en el body del POST (si no viene ninguno,
se asume `sendOrderEmail` — así el checkout de siempre, que nunca mandó este
campo, sigue funcionando exactamente igual sin ningún cambio):

| `action` | Quién la usa | Qué hace |
|---|---|---|
| `sendOrderEmail` (o sin `action`) | Checkout público al confirmar un pedido | Manda el correo operativo a la tienda y la confirmación a la clienta — el flujo de siempre. |
| `resendOrderEmail` | Alias explícito del mismo flujo de arriba, forzando `isResend: true` | Hoy el botón "✉️ Reenviar" sigue llamando al flujo de siempre con `isResend:true` (sin `action`) — este nombre queda disponible para quien prefiera llamarlo así, es 100% equivalente. |
| `sendTestCustomerEmail` (acepta también el nombre viejo `testCustomerEmail`) | Super Admin → Correos → Correos de prueba | Manda ÚNICAMENTE la confirmación a la clienta, a una dirección de prueba, con datos ficticios fijos. |
| `sendPromoEmail` | Super Admin → Correos → Promociones (o correo de pedido con plantilla editable) | Manda UN correo armado desde una plantilla (asunto/saludo/cierre/firma/etc.), sustituyendo variables protegidas (`{{clienteNombre}}`, `{{pedidoNumero}}`, etc.) que siempre vienen calculadas por el sitio, nunca tipeadas a mano por el Super Admin. |
| `sendBulkPromoEmail` | Super Admin → Correos → Promociones (envío a varias clientas) | **Deshabilitada a propósito** (ver "Protección anti-spam" abajo) — siempre devuelve `bulk_campaigns_disabled_gmail_sender`, nunca manda nada, sin importar cuántas destinatarias se le pasen. |

## Protección anti-spam de la cuenta (`tintinpedidos@gmail.com`)

Esta cuenta de Gmail común manda todos los correos del sitio — para que nunca
se use (por error, por un bug, o por alguien que descubra el `SHARED_SECRET`
público) como un "robot de envíos" que arriesgue que Google la marque como
spam o la suspenda, el script aplica estos límites **del lado del servidor**
(no solo en el panel — así no se pueden saltear llamando directo al webhook):

- **Correo original de un pedido** (`sendOrderEmail`, `isResend:false`): no se
  manda dos veces para el mismo `orderId` (`CacheService`, ventana de 6 horas).
- **Reenvío manual** (`isResend:true`): cooldown fijo de **60 segundos** para
  el mismo `orderId` (no se puede reenviar "varias veces seguidas") + un tope
  diario **total** de reenvíos — el sitio sugiere el valor configurado en
  Correos → Configuración, pero el techo real es `ABSOLUTE_MAX_RESEND_PER_DAY`
  (80 por defecto), que nadie puede subir desde el navegador.
- **Correos de prueba** (`sendTestCustomerEmail`, y `sendPromoEmail` cuando
  viene con `isTest:true` desde la pestaña de pruebas): cooldown fijo de
  **2 minutos** entre cada uno + un tope diario — el sitio sugiere el valor de
  Configuración, techo real `ABSOLUTE_MAX_TEST_PER_DAY` (50 por defecto).
- **Campañas/promos masivas** (`sendBulkPromoEmail`): **deshabilitadas por
  completo**, siempre, sin excepción — un envío masivo desde una cuenta de
  Gmail común es justamente el patrón que arriesga la cuenta. El correo
  transaccional de UN pedido (`sendPromoEmail`, usado también por Correos de
  pedidos) no se toca, sigue funcionando normal.

Los contadores y cooldowns viven en `PropertiesService`/`CacheService` del
propio proyecto de Apps Script (no en Firestore) — persisten aunque se cierre
la pestaña o se recargue la página, y no dependen de que el sitio los respete.
Si necesitás subir alguno de los techos absolutos, hay que editarlos acá
arriba (`TEST_EMAIL_COOLDOWN_MS`, `RESEND_COOLDOWN_MS`,
`ABSOLUTE_MAX_TEST_PER_DAY`, `ABSOLUTE_MAX_RESEND_PER_DAY`) y volver a
implementar una nueva versión (ver paso 3 más abajo) — no alcanza con
guardarlo en Correos → Configuración.

**Sobre seguridad — el `SHARED_SECRET` ya no alcanza solo:** ese secreto viaja
en el JS público del sitio (`js/email-config.js`), así que cualquiera que
abra la consola del navegador puede leerlo y llamar al webhook directamente,
sin pasar por ningún botón ni login. Eso era un riesgo aceptable cuando la
única acción "extra" era mandar UN correo de prueba, pero no alcanza para
promociones masivas. Por eso, además del secreto:

- `sendTestCustomerEmail`, `sendPromoEmail` y `sendBulkPromoEmail` exigen
  también un **idToken de Firebase Auth** válido de la cuenta exacta
  `tintinaccs@gmail.com` (con el email verificado). El script se lo pregunta
  directamente a Google (`identitytoolkit.googleapis.com`, sin librerías ni
  JWT/RSA a mano) — nadie puede fabricar un idToken válido de esa cuenta sin
  haber iniciado sesión de verdad con ella, y uno robado vence solo (~1 hora).
- `resendOrderEmail` (y el flujo normal con `isResend:true`) exige un
  idToken válido de **cualquier** cuenta con sesión iniciada — no
  restringido a `tintinaccs@gmail.com`, porque hoy también lo usan Admin y
  Modder desde "✉️ Reenviar" en Pedidos, y no quería romper eso. Sigue
  siendo mucho más seguro que solo el secreto: ya no se puede disparar un
  reenvío sin tener una sesión real de Firebase abierta.
- `sendOrderEmail` original del checkout (`isResend:false`) no pide ningún
  idToken — ahí no hay Super Admin ni panel de por medio, es la clienta
  comprando, y exigirle un token de "administrador" no tendría sentido.

Si alguna vez preferís que `resendOrderEmail` quede restringido solo a
`tintinaccs@gmail.com` (y no a Admin/Modder), avisame — hoy decidí no
tocar esa función porque ya la usan esos dos roles y no me pediste
específicamente cambiar sus permisos.

Los primeros dos (`sendOrderEmail`/`resendOrderEmail`) mandan **dos correos
distintos** por cada pedido, cada uno en su propio `try/catch` (para poder
distinguir si salió uno solo de los dos, no solo "todo bien" o "todo mal"):

1. **A la tienda** (`tintinaccs@gmail.com`) — el correo operativo completo: todos los
   datos del cliente, dirección/mapa, productos con imagen y variante, totales
   y un link para escribirle al cliente por WhatsApp con un mensaje ya
   redactado (lo podés editar antes de enviarlo, como cualquier link de
   `wa.me`).
2. **A la clienta** (solo si dejó su email en el checkout) — una confirmación
   corta y prolija, con el número de pedido, sus productos, el total y la
   dirección de entrega. No incluye ningún link de WhatsApp — se sacó a
   pedido para reducir la cantidad de links del correo.

Cuando usás el botón **"✉️ Reenviar"** de Super Admin → Pedidos, por defecto
solo se reenvía la copia operativa de la tienda (no se le vuelve a mandar la
confirmación a la clienta, para no ser repetitiva). Si alguna vez preferís
que el reenvío también le llegue de nuevo a la clienta, buscá el comentario
`!isResend` en `doPost` y quitalo.

El resultado que devuelve `doPost` para estas dos acciones ya no es un único
`success: true/false`: incluye `adminSent`/`customerSent` por separado, para
que el sitio pueda guardar `notificationStatus: 'sent'` (los dos salieron),
`'partial'` (salió uno solo) o `'failed'` (fallaron los dos) en vez de un
simple sí/no. Además ahora acepta dos campos opcionales `sendAdmin`/
`sendCustomer` (por defecto `true` los dos) para poder activar/desactivar
por separado el correo interno a Tintin y la confirmación a la clienta desde
Super Admin → Correos → Configuración, sin tocar el flujo real del checkout.

**`sendTestCustomerEmail`** — la usa el botón "Enviar prueba" de
Super Admin → Correos → Correos de prueba. Manda ÚNICAMENTE el correo
de confirmación a la clienta (mismo diseño, con un aviso de "correo de
prueba" agregado arriba), a la dirección que escriba el Super Admin, con
datos de pedido ficticios fijos (`TEST_ORDER_`, definidos en el propio
script, nunca vienen del navegador) — salvo que el Super Admin haya elegido
una clienta registrada real de la lista, en cuyo caso solo el email de
destino cambia por el suyo, los datos del pedido siguen siendo los mismos
ficticios. No manda el correo interno a la tienda, no crea ningún pedido en
Firestore, no toca stock — es una rama totalmente aparte de `doPost`, con su
propio chequeo de `SHARED_SECRET`.

**`sendPromoEmail` / `sendBulkPromoEmail`** — arman un correo genérico con
la marca de Tintin a partir de los campos editables de una plantilla
(`subject`, `greeting`, `intro`, `closing`, `signature`, `promoText`,
`buttonText`, `buttonUrl`, `brandPhrase`, `footer`), sustituyendo cualquier
variable protegida (`{{clienteNombre}}`, `{{pedidoNumero}}`, `{{productos}}`,
`{{total}}`, `{{estadoPedido}}`, `{{metodoEntrega}}`, `{{fechaPedido}}`) por
el valor real que le manda el sitio — nunca un valor escrito a mano por el
Super Admin en el lugar de esas variables. `sendBulkPromoEmail` además
consulta `MailApp.getRemainingDailyQuota()` antes de empezar y corta el envío
si se queda sin cuota diaria de Gmail (100 correos/día en una cuenta gratuita
— ver la sección de riesgos más abajo), devolviendo el detalle de qué
destinatarias sí y cuáles no recibieron el correo.

**Sobre entregabilidad (que no caiga en spam):** el contenido de ambos
correos está pensado para que una cuenta de Gmail nueva como
`tintinpedidos@gmail.com` — sin historial de envío — tenga menos chances de
que Gmail lo marque como spam: sin emojis, sin signos de exclamación, con
asuntos simples ("Nuevo pedido recibido en Tintin" / "Recibimos tu pedido en
Tintin"), sin ningún link de WhatsApp en la confirmación a la clienta (se
sacó a pedido, incluso el que tenía antes) ni link a Instagram, y con
`name: STORE_NAME` para
que el remitente se vea como "Tintin Accesorios" en vez de una dirección
pelada. `MailApp.sendEmail` arma automáticamente un correo multipart
texto+HTML cuando se le pasan `body` y `htmlBody` juntos (como hace este
código) — eso ya está bien. Aun así, una cuenta nueva puede seguir cayendo
en spam los primeros días hasta que Gmail le genere reputación de envío —
marcar los primeros correos como "No es spam" y agregar la cuenta a
contactos ayuda a acelerar eso.

```javascript
const SHARED_SECRET   = 'TU_SECRETO_AQUI';
const ADMIN_EMAIL     = 'tintinaccs@gmail.com';  // a quién le llega el correo interno — NO es quien envía
const STORE_NAME      = 'Tintin Accesorios';
const ADMIN_PANEL     = 'https://tintinaccs.github.io/tintin-web/admin.html';

// Cuenta que puede usar las acciones de Super Admin (prueba, promociones,
// campañas) — se compara contra el email verificado que devuelve Google al
// validar el idToken, NUNCA contra algo que mande el propio navegador.
const SUPER_ADMIN_EMAIL = 'tintinaccs@gmail.com';

// Clave pública del proyecto Firebase (tintin-accesorios) — es la misma que
// ya viaja en js/firebase.js del sitio. NO es secreta (Google documenta que
// las API key de apps Firebase web no protegen nada por sí solas); acá se
// usa únicamente para pedirle a Google que valide un idToken, nunca para
// escribir ni leer datos.
const FIREBASE_API_KEY = 'AIzaSyDMD_-656XR3WHJpGikMxKHMMkJV_re5t0';

// ============================================================
// PROTECCIÓN ANTI-SPAM DE LA CUENTA — tintinpedidos@gmail.com es una
// cuenta de Gmail común, no un servicio transaccional dedicado. Estos
// límites viven ACÁ (no solo en el sitio) porque son el único lugar que no
// se puede saltear: el SHARED_SECRET viaja en el JS público del sitio, así
// que cualquiera que lo lea podría llamar al webhook directo sin pasar por
// ningún botón del panel — con estos topes, ni siquiera así se puede
// mandar más de la cuenta de la que este script decide, sin importar qué
// límite diga el navegador que llama.
// ============================================================
const TEST_EMAIL_COOLDOWN_MS   = 2 * 60 * 1000;  // 2 minutos — fijo, no configurable
const RESEND_COOLDOWN_MS       = 60 * 1000;      // 60 segundos por PEDIDO — no configurable
const ABSOLUTE_MAX_TEST_PER_DAY   = 50;  // techo duro aunque el sitio pida más
const ABSOLUTE_MAX_RESEND_PER_DAY = 80;  // techo duro aunque el sitio pida más
const ORDER_EMAIL_DEDUPE_TTL_SECONDS = 21600; // 6 horas

function todayKey_() {
  return Utilities.formatDate(new Date(), 'America/Asuncion', 'yyyy-MM-dd');
}

// Tope diario con contador propio del script (PropertiesService, persiste
// entre ejecuciones) — el sitio puede pedir un límite más bajo (lo
// configurado en Correos → Configuración), pero nunca uno más alto que
// absoluteMax: ese es el verdadero techo, decidido acá, no en el navegador.
function checkAndBumpDailyCounter_(counterName, requestedLimit, absoluteMax) {
  const props = PropertiesService.getScriptProperties();
  const dateKey = counterName + '_' + todayKey_();
  const current = Number(props.getProperty(dateKey) || '0');
  const limit = Math.max(1, Math.min(Number(requestedLimit) || absoluteMax, absoluteMax));
  if (current >= limit) {
    return { ok: false, error: 'daily_limit_exceeded', current: current, limit: limit };
  }
  props.setProperty(dateKey, String(current + 1));
  return { ok: true, current: current + 1, limit: limit };
}

// Cooldown entre dos llamadas de la MISMA categoría (ej. dos correos de
// prueba, o dos reenvíos del mismo pedido si se le pasa un orderId en la
// propKey) — guarda el último timestamp real en PropertiesService, no en
// el navegador, así que no se resetea recargando la página ni abriendo
// otra pestaña.
function checkCooldown_(propKey, cooldownMs) {
  const props = PropertiesService.getScriptProperties();
  const lastTs = Number(props.getProperty(propKey) || '0');
  const now = Date.now();
  const elapsed = now - lastTs;
  if (lastTs && elapsed < cooldownMs) {
    return { ok: false, error: 'cooldown_active', retryAfterSeconds: Math.ceil((cooldownMs - elapsed) / 1000) };
  }
  props.setProperty(propKey, String(now));
  return { ok: true };
}

// Evita mandar dos veces el correo ORIGINAL (isResend:false) de un mismo
// pedido si doPost se llega a llamar más de una vez con el mismo orderId
// (reintento de red, doble tap, un bug futuro) — CacheService alcanza acá
// (no hace falta que dure más de unas horas) y es más liviano que
// PropertiesService para algo de corta duración.
function checkOrderEmailNotDuplicate_(orderId) {
  if (!orderId) return { ok: true }; // sin orderId no hay con qué deduplicar, se deja pasar
  const cache = CacheService.getScriptCache();
  const key = 'order_sent_' + orderId;
  if (cache.get(key)) return { ok: false, error: 'duplicate_order_email' };
  cache.put(key, '1', ORDER_EMAIL_DEDUPE_TTL_SECONDS);
  return { ok: true };
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action || 'sendOrderEmail';

    // Prueba de correo (Super Admin → Correos → Correos de prueba): manda
    // ÚNICAMENTE el correo de confirmación a la clienta, a una dirección de
    // prueba, con datos de pedido ficticios. Nunca crea un pedido, nunca
    // toca stock, nunca manda el correo interno a la tienda — es una acción
    // totalmente aparte del flujo real, con su propio chequeo de secreto.
    // Acepta el nombre nuevo y el viejo por compatibilidad.
    if (action === 'sendTestCustomerEmail' || action === 'testCustomerEmail') {
      return jsonOut(handleTestCustomerEmail_(data));
    }

    // Promociones / correos de pedido con plantilla editable (Super Admin →
    // Correos → Promociones / Correos de pedidos): un solo correo o una
    // tanda de varios, armados desde una plantilla — nunca desde datos
    // escritos a mano por el Super Admin en lugar de las variables
    // protegidas (esas las calcula siempre el sitio a partir del pedido
    // real o de datos ficticios de prueba).
    if (action === 'sendPromoEmail') {
      return jsonOut(handleSendPromoEmail_(data));
    }
    if (action === 'sendBulkPromoEmail') {
      return jsonOut(handleSendBulkPromoEmail_(data));
    }

    if (data.secret !== SHARED_SECRET) {
      return jsonOut({ success: false, error: 'unauthorized' });
    }
    const order    = data.order || {};
    const orderId  = data.orderId || '';
    // 'resendOrderEmail' es un alias explícito del mismo flujo de abajo con
    // isResend forzado a true — el sitio hoy sigue llamando sin `action`
    // más el flag `isResend:true` (compatibilidad total), este nombre queda
    // disponible para quien prefiera llamarlo así.
    const isResend = action === 'resendOrderEmail' ? true : !!data.isResend;
    const shortId  = order.shortId || (orderId ? orderId.slice(0, 8).toUpperCase() : '—');

    // Reenviar (botón "✉️ Reenviar" de Pedidos, disponible para Admin y
    // Modder además de Super Admin — no es una acción exclusiva de Super
    // Admin) exige un idToken de Firebase válido: cualquier cuenta con
    // sesión real, no una restringida a un email puntual. Esto cierra el
    // hueco de que alguien dispare reenvíos solo con el SHARED_SECRET
    // (público en el JS del sitio) sin tener sesión iniciada de verdad. El
    // envío ORIGINAL del checkout (isResend=false) no pide esto — ahí no
    // hay ningún Super Admin ni panel de por medio, es la clienta comprando.
    if (isResend) {
      const authCheck = verifyFirebaseIdToken_(data.idToken);
      if (!authCheck.ok) {
        return jsonOut({ success: false, adminSent: false, customerSent: null, error: authCheck.error });
      }
      // Protege a tintinpedidos@gmail.com de usarse como robot de reenvíos:
      // cooldown fijo de 60s para el MISMO pedido (no se puede reenviar
      // "varias veces seguidas") + tope diario total de reenvíos, con el
      // valor configurado en Correos → Configuración como sugerencia y
      // ABSOLUTE_MAX_RESEND_PER_DAY como techo real que nadie puede subir
      // desde el navegador.
      const resendCooldown = checkCooldown_('resend_ts_' + orderId, RESEND_COOLDOWN_MS);
      if (!resendCooldown.ok) {
        return jsonOut({ success: false, adminSent: null, customerSent: null, error: resendCooldown.error, retryAfterSeconds: resendCooldown.retryAfterSeconds });
      }
      const resendDaily = checkAndBumpDailyCounter_('resend_count', data.resendDailyLimit, ABSOLUTE_MAX_RESEND_PER_DAY);
      if (!resendDaily.ok) {
        return jsonOut({ success: false, adminSent: null, customerSent: null, error: resendDaily.error, limit: resendDaily.limit });
      }
    } else {
      // Envío ORIGINAL de un pedido (checkout): evita mandarlo dos veces
      // para el mismo orderId si doPost se llega a invocar más de una vez.
      const dupCheck = checkOrderEmailNotDuplicate_(orderId);
      if (!dupCheck.ok) {
        return jsonOut({ success: false, adminSent: null, customerSent: null, error: dupCheck.error });
      }
    }

    // Activar/desactivar por separado el correo interno a Tintin y la
    // confirmación a la clienta (Super Admin → Correos → Configuración).
    // Por defecto los dos true, así ningún llamado que no mande estos
    // campos (el checkout de siempre) cambia de comportamiento.
    const sendAdmin_    = data.sendAdmin    !== false;
    const sendCustomer_ = data.sendCustomer !== false;

    // 1) Correo operativo a la tienda. Se prueba en su propio try/catch,
    // separado del correo a la clienta, para poder reportar un resultado
    // PARCIAL si uno de los dos falla sin que eso oculte que el otro sí
    // salió bien. Queda en `null` (no `false`) cuando directamente estaba
    // desactivado en Configuración — no correspondía intentarlo, así que no
    // cuenta como una falla real, igual que ya hace `customerSent`.
    let adminSent = null, adminError = '';
    if (sendAdmin_) {
      try {
        const adminSubject = (isResend ? 'Reenvío: ' : '') +
          'Nuevo pedido recibido en Tintin — Pedido #' + shortId;
        MailApp.sendEmail({
          to: ADMIN_EMAIL,
          name: STORE_NAME,
          subject: adminSubject,
          body: buildAdminText(shortId, order),
          htmlBody: buildAdminHtml(shortId, order)
        });
        adminSent = true;
      } catch (err) {
        adminSent = false;
        adminError = String(err);
      }
    }

    // 2) Confirmación a la clienta — solo si dejó su email, solo en el
    //    envío original (no en cada reenvío manual desde el admin), y solo
    //    si no está desactivada en Configuración. `customerSent` queda en
    //    null (no false) cuando ni siquiera correspondía intentarlo.
    let customerSent = null, customerError = '';
    if (sendCustomer_ && order.userEmail && !isResend) {
      try {
        MailApp.sendEmail({
          to: order.userEmail,
          name: STORE_NAME,
          subject: 'Recibimos tu pedido en Tintin — Pedido #' + shortId,
          body: buildCustomerText(shortId, order),
          htmlBody: buildCustomerHtml(shortId, order)
        });
        customerSent = true;
      } catch (err) {
        customerSent = false;
        customerError = String(err);
      }
    }

    // `success` se mantiene por compatibilidad con lo que ya usa el sitio;
    // `adminSent`/`customerSent` son los que permiten calcular
    // 'sent' / 'partial' / 'failed' del lado del frontend. Un correo
    // desactivado a propósito (null) nunca cuenta como falla.
    const success = adminSent !== false && customerSent !== false;
    return jsonOut({
      success,
      adminSent,
      customerSent,
      error: [adminError, customerError].filter(Boolean).join(' | ') || undefined
    });
  } catch (err) {
    return jsonOut({ success: false, adminSent: false, customerSent: null, error: String(err) });
  }
}

// Datos de pedido ficticios fijos — siempre los mismos, nunca vienen del
// navegador, así esta acción no puede usarse para mandar contenido
// arbitrario a nombre de la tienda más allá del email de destino.
const TEST_ORDER_ = {
  shortId: 'TEST123',
  userName: 'Cliente de prueba',
  items: [{ qty: 1, name: 'BAG RUBY', price: 190000 }],
  subtotal: 190000,
  total: 190000,
  shippingCost: 0,
  shippingPending: false,
  shipping: { method: 'delivery', city: 'San Lorenzo' },
  createdAt: new Date().toISOString(),
};

// ============================================================
// AUTENTICACIÓN REAL (no solo el SHARED_SECRET) — el secreto viaja en el JS
// público del sitio, así que cualquiera que abra la consola del navegador
// puede leerlo. Para las acciones exclusivas de Super Admin (prueba,
// promociones, campañas) eso NO alcanza: acá se le pide a Google que valide
// el idToken de Firebase Auth que mandó el navegador — nadie puede fabricar
// un idToken válido de una cuenta sin haber iniciado sesión de verdad con
// ella, y un idToken robado vence solo (~1 hora). No hace falta ninguna
// librería ni implementar JWT/RSA a mano: identitytoolkit.googleapis.com
// hace la verificación completa (firma, vencimiento, proyecto) del lado de
// Google y devuelve el email real de la cuenta si el token es válido.
// ============================================================

function verifyFirebaseIdToken_(idToken) {
  if (!idToken) return { ok: false, error: 'missing_id_token' };
  try {
    const resp = UrlFetchApp.fetch(
      'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FIREBASE_API_KEY,
      {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ idToken: idToken }),
        muteHttpExceptions: true
      }
    );
    if (resp.getResponseCode() !== 200) return { ok: false, error: 'invalid_id_token' };
    const body = JSON.parse(resp.getContentText());
    const user = body.users && body.users[0];
    if (!user) return { ok: false, error: 'invalid_id_token' };
    return { ok: true, email: user.email || '', emailVerified: !!user.emailVerified, uid: user.localId || '' };
  } catch (err) {
    return { ok: false, error: 'token_verify_failed' };
  }
}

// Exclusivo Super Admin: no alcanza con cualquier idToken válido, tiene que
// ser exactamente la cuenta SUPER_ADMIN_EMAIL, con el email verificado.
function requireSuperAdmin_(idToken) {
  const v = verifyFirebaseIdToken_(idToken);
  if (!v.ok) return v;
  if (!v.emailVerified) return { ok: false, error: 'email_not_verified' };
  if (v.email !== SUPER_ADMIN_EMAIL) return { ok: false, error: 'not_super_admin' };
  return v;
}

function handleTestCustomerEmail_(data) {
  if (data.secret !== SHARED_SECRET) {
    return { success: false, error: 'unauthorized' };
  }
  const auth_ = requireSuperAdmin_(data.idToken);
  if (!auth_.ok) {
    return { success: false, error: auth_.error };
  }
  const toEmail = String(data.toEmail || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
    return { success: false, error: 'invalid_email' };
  }
  // Protección anti-spam: cooldown fijo de 2 minutos entre pruebas + tope
  // diario (configurable desde el panel, con un techo real que no se puede
  // subir llamando directo al webhook). Comparte contador con sendPromoEmail
  // cuando esa función se usa en modo prueba (isTest:true) — ver más abajo.
  const cooldown = checkCooldown_('test_email_ts', TEST_EMAIL_COOLDOWN_MS);
  if (!cooldown.ok) return { success: false, error: cooldown.error, retryAfterSeconds: cooldown.retryAfterSeconds };
  const daily = checkAndBumpDailyCounter_('test_email_count', data.testDailyLimit, ABSOLUTE_MAX_TEST_PER_DAY);
  if (!daily.ok) return { success: false, error: daily.error, limit: daily.limit };
  try {
    MailApp.sendEmail({
      to: toEmail,
      name: STORE_NAME,
      subject: '[PRUEBA] Recibimos tu pedido en Tintin — Pedido #' + TEST_ORDER_.shortId,
      body: buildCustomerText(TEST_ORDER_.shortId, TEST_ORDER_, true),
      htmlBody: buildCustomerHtml(TEST_ORDER_.shortId, TEST_ORDER_, true)
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ============================================================
// PLANTILLAS EDITABLES — Promociones y correos de pedido configurables
// (Super Admin → Correos). Un solo renderer genérico para un correo con
// marca: asunto/saludo/introducción/cierre/firma/mensaje promocional/botón/
// frase de marca/pie, todos editables desde la plantilla, con variables
// protegidas del tipo {{clienteNombre}} que solo el SITIO sustituye por un
// valor real — el Super Admin nunca escribe el valor final a mano acá.
// ============================================================

function isValidEmail_(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
}

// Sustituye {{clave}} por vars[clave] — si falta la variable, la deja vacía
// en vez de tirar error o dejar el "{{...}}" crudo en el correo final.
function renderVars_(str, vars) {
  return String(str || '').replace(/\{\{(\w+)\}\}/g, function (m, key) {
    const v = vars && vars[key];
    return (v === undefined || v === null) ? '' : String(v);
  });
}

function buildGenericEmailText_(t, vars) {
  const line = '-'.repeat(40);
  const brandPhrase = renderVars_(t.brandPhrase, vars);
  const greeting    = renderVars_(t.greeting, vars);
  const intro       = renderVars_(t.intro, vars);
  const promoText   = renderVars_(t.promoText, vars);
  const closing     = renderVars_(t.closing, vars);
  const signature   = renderVars_(t.signature, vars) || STORE_NAME;
  const footer      = renderVars_(t.footer, vars);
  return [brandPhrase, greeting, '', intro, '', promoText, '', closing, '', signature, line, footer]
    .filter(function (p) { return p !== ''; })
    .join('\n') + '\n';
}

function buildGenericEmailHtml_(t, vars) {
  const brandPhrase = renderVars_(t.brandPhrase, vars);
  const greeting     = renderVars_(t.greeting, vars);
  const intro        = renderVars_(t.intro, vars);
  const promoText    = renderVars_(t.promoText, vars);
  const closing      = renderVars_(t.closing, vars);
  const signature    = renderVars_(t.signature, vars) || STORE_NAME;
  const footer       = renderVars_(t.footer, vars);
  const buttonText   = renderVars_(t.buttonText, vars);
  const buttonUrl    = t.buttonUrl || '';
  const buttonHtml = (buttonText && buttonUrl)
    ? '<p style="text-align:center;margin:24px 0"><a href="' + buttonUrl + '" style="background:#b84c72;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px;display:inline-block">' + buttonText + '</a></p>'
    : '';
  return '<!DOCTYPE html><html><body style="font-family:Montserrat;max-width:600px;margin:auto;background:#ffffff;padding:24px;color:#333">' +
    '<div style="border:1px solid #e5e5e5;border-radius:8px;padding:28px">' +
    (brandPhrase ? '<p style="color:#b84c72;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:.06em;margin:0 0 14px">' + brandPhrase + '</p>' : '') +
    (greeting ? '<h2 style="color:#b84c72;margin:0 0 14px;font-size:18px">' + greeting + '</h2>' : '') +
    (intro ? '<p style="color:#555;line-height:1.6;margin:0 0 16px;font-size:14px;white-space:pre-line">' + intro + '</p>' : '') +
    (promoText ? '<p style="color:#333;line-height:1.6;margin:0 0 16px;font-size:14px;white-space:pre-line">' + promoText + '</p>' : '') +
    buttonHtml +
    (closing ? '<p style="color:#555;line-height:1.6;margin:16px 0 0;font-size:14px;white-space:pre-line">' + closing + '</p>' : '') +
    '<div style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e5e5">' +
    '<p style="color:#999;font-size:12px;margin:0;white-space:pre-line">' + signature + '</p>' +
    (footer ? '<p style="color:#bbb;font-size:11px;margin:10px 0 0;white-space:pre-line">' + footer + '</p>' : '') +
    '</div></div></body></html>';
}

// Un solo correo (Promociones a una clienta, o correo de pedido con
// plantilla editable — confirmado/cancelado/rechazado/pago recibido/listo
// para retirar/en camino/entregado).
function handleSendPromoEmail_(data) {
  if (data.secret !== SHARED_SECRET) {
    return { success: false, error: 'unauthorized', recipientsProcessed: 0, recipientsFailed: 0 };
  }
  const auth_ = requireSuperAdmin_(data.idToken);
  if (!auth_.ok) {
    return { success: false, error: auth_.error, recipientsProcessed: 0, recipientsFailed: 0 };
  }
  const to = String(data.to || '').trim();
  if (!isValidEmail_(to)) {
    return { success: false, error: 'invalid_email', recipientsProcessed: 0, recipientsFailed: 1 };
  }
  // Correos de prueba → Configuración: cuando el sitio manda una plantilla
  // distinta de "Pedido recibido (clienta)" desde la pestaña de pruebas,
  // llama a esta misma función (no a handleTestCustomerEmail_) con
  // isTest:true — sin este chequeo, elegir cualquier otra plantilla ahí
  // saltearía por completo el cooldown/tope diario de pruebas. Comparte los
  // mismos contadores que handleTestCustomerEmail_ (mismo abuso, mismo tope).
  if (data.isTest) {
    const cooldown = checkCooldown_('test_email_ts', TEST_EMAIL_COOLDOWN_MS);
    if (!cooldown.ok) return { success: false, error: cooldown.error, retryAfterSeconds: cooldown.retryAfterSeconds, recipientsProcessed: 0, recipientsFailed: 0 };
    const daily = checkAndBumpDailyCounter_('test_email_count', data.testDailyLimit, ABSOLUTE_MAX_TEST_PER_DAY);
    if (!daily.ok) return { success: false, error: daily.error, limit: daily.limit, recipientsProcessed: 0, recipientsFailed: 0 };
  }
  const vars = data.variables || {};
  try {
    MailApp.sendEmail({
      to: to,
      name: STORE_NAME,
      subject: renderVars_(data.subject, vars) || STORE_NAME,
      body: buildGenericEmailText_(data, vars),
      htmlBody: buildGenericEmailHtml_(data, vars)
    });
    return { success: true, sent: 1, failed: 0, recipientsProcessed: 1, recipientsFailed: 0, partial: false };
  } catch (err) {
    return { success: false, sent: 0, failed: 1, recipientsProcessed: 1, recipientsFailed: 1, partial: false, error: String(err) };
  }
}

// Varios destinatarios en una sola llamada (Promociones a varias/todas las
// seleccionadas) — DESHABILITADO A PROPÓSITO. tintinpedidos@gmail.com es
// siempre una cuenta de Gmail común (MailApp.sendEmail manda como la cuenta
// que autorizó el script, nunca un remitente distinto — ver el inicio de
// este documento), nunca un dominio propio: un envío masivo desde ahí
// arriesga que Google marque la cuenta como spam o la suspenda. Por eso
// esta acción queda bloqueada acá, en el servidor — no alcanza con apagar
// el switch "Promociones" del panel, porque ese switch vive en Firestore y
// alguien con el SHARED_SECRET podría llamar al webhook directo salteándolo.
// El correo transaccional de UN pedido (handleSendPromoEmail_, usado por
// Correos de pedidos) NO se toca — ese uso es legítimo y sigue funcionando.
function handleSendBulkPromoEmail_(data) {
  if (data.secret !== SHARED_SECRET) {
    return { success: false, error: 'unauthorized', recipientsProcessed: 0, recipientsFailed: 0 };
  }
  const auth_ = requireSuperAdmin_(data.idToken);
  if (!auth_.ok) {
    return { success: false, error: auth_.error, recipientsProcessed: 0, recipientsFailed: 0 };
  }
  return {
    success: false,
    error: 'bulk_campaigns_disabled_gmail_sender',
    sent: 0,
    failed: 0,
    recipientsProcessed: 0,
    recipientsFailed: 0,
    results: []
  };
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function fmtPrice(n) {
  return 'Gs. ' + Math.round(Number(n || 0)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function fmtShipping(order) {
  if (order.shippingCost === null || order.shippingCost === undefined || order.shippingPending) {
    return 'A confirmar con un vendedor';
  }
  return fmtPrice(order.shippingCost);
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return Utilities.formatDate(new Date(iso), 'America/Asuncion', "dd/MM/yyyy HH:mm 'hs (hora de Paraguay)'");
  } catch (e) {
    return String(iso);
  }
}

function zoneLabel(order) {
  const z = order.shipping && order.shipping.zone;
  if (z === 'central') return 'Zona Central';
  if (z === 'interior') return 'Interior del país';
  return '—';
}

// text opcional: precarga el mensaje de WhatsApp, pero sigue siendo 100% editable
// antes de enviarlo — así funciona cualquier link de wa.me con `?text=`.
function waLink(phone, text) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return 'https://wa.me/' + digits + (text ? '?text=' + encodeURIComponent(text) : '');
}

// Mensaje que la tienda le manda a la CLIENTA (editable antes de enviar en WhatsApp)
function waGreetingToCustomer(shortId, order) {
  const first = String(order.userName || '').trim().split(' ')[0] || '';
  return 'Hola' + (first ? ' ' + first : '') + ', soy de ' + STORE_NAME +
    ', te escribo por tu pedido #' + shortId + '.';
}

function shipMethodLabel(order) {
  const m = (order.shipping && order.shipping.method) || '';
  return { delivery: 'Delivery (Zona Central)', encomienda: 'Encomienda (Interior)', retiro: 'Retiro en tienda' }[m] || m || '—';
}

function payMethodLabel(order) {
  const m = (order.payment && order.payment.method) || '';
  return { efectivo: 'Efectivo (contra entrega)', transferencia: 'Transferencia bancaria', pagopark: 'PagoPark', tarjeta: 'Tarjeta' }[m] || m || '—';
}

// order.discount es opcional — hoy la tienda no tiene cupones, pero si algún
// día se agrega ese campo al pedido, ya se va a mostrar solo en ese caso.
function discountAmount(order) {
  const d = Number(order.discount || 0);
  return d > 0 ? d : 0;
}

function itemLineText(i) {
  const variant = i.variant ? ' (' + i.variant + ')' : '';
  return '  ' + i.qty + 'x ' + i.name + variant + ' — ' + fmtPrice(i.price) + ' c/u = ' + fmtPrice(i.price * i.qty);
}

function itemRowHtml(i) {
  const img = i.imageUrl
    ? '<img src="' + i.imageUrl + '" width="44" height="44" style="width:44px;height:44px;object-fit:cover;border-radius:8px;display:block">'
    : '';
  const variant = i.variant ? '<div style="font-size:11px;color:#999">' + i.variant + '</div>' : '';
  return '<tr>' +
    '<td style="padding:8px;width:44px">' + img + '</td>' +
    '<td style="padding:8px">' + i.qty + 'x ' + i.name + variant +
      '<div style="font-size:11px;color:#aaa">' + fmtPrice(i.price) + ' c/u</div></td>' +
    '<td style="padding:8px;text-align:right;white-space:nowrap">' + fmtPrice(i.price * i.qty) + '</td>' +
  '</tr>';
}

// ============================================================
// CORREO 1 — a la tienda (operativo, con todos los datos)
// ============================================================

function buildAdminText(shortId, order) {
  const items = (order.items || []).map(itemLineText).join('\n');
  const wa = waLink(order.userPhone, waGreetingToCustomer(shortId, order));
  const shipping = order.shipping || {};
  const discount = discountAmount(order);
  const line = '-'.repeat(40);

  return 'Nuevo pedido en ' + STORE_NAME + '\n' + line + '\n' +
    'Pedido:   #' + shortId + '\n' +
    'Fecha:    ' + fmtDate(order.createdAt) + '\n' + line + '\n' +
    'Cliente:  ' + (order.userName || '—') + '\n' +
    'Teléfono: ' + (order.userPhone || '—') + '\n' +
    (wa ? 'WhatsApp: ' + wa + '\n' : '') +
    (order.userEmail ? 'Email:    ' + order.userEmail + '\n' : '') +
    'Ciudad:   ' + (shipping.city || '—') + '\n' +
    'Zona:     ' + zoneLabel(order) + '\n' +
    (shipping.address ? 'Dirección: ' + shipping.address + '\n' : '') +
    (shipping.mapLocation && shipping.mapLocation.name ? 'Lugar: ' + shipping.mapLocation.name + '\n' : '') +
    (shipping.referencia ? 'Referencia: ' + shipping.referencia + '\n' : '') +
    (shipping.mapLocation ? 'Ubicación: https://maps.google.com/?q=' + shipping.mapLocation.lat + ',' + shipping.mapLocation.lng + '\n' : '') +
    line + '\n' +
    'Entrega:  ' + shipMethodLabel(order) + '\n' +
    'Pago:     ' + payMethodLabel(order) + '\n' + line + '\n' +
    'Productos:\n' + items + '\n' + line + '\n' +
    '  Subtotal:  ' + fmtPrice(order.subtotal) + '\n' +
    (discount > 0 ? '  Descuento: -' + fmtPrice(discount) + '\n' : '') +
    '  Envío:     ' + fmtShipping(order) + '\n' +
    'Total:    ' + fmtPrice(order.total) + (order.shippingPending ? ' (+ envío a coordinar)' : '') + '\n' + line + '\n' +
    'Estado pedido: ' + (order.status || 'pendiente') + '\n' +
    'Estado pago:   ' + ((order.payment && order.payment.status) || 'pendiente') + '\n' +
    (order.notes ? '\nNotas: ' + order.notes + '\n' : '') + line + '\n' +
    'Ver en admin: ' + ADMIN_PANEL + '\n';
}

function buildAdminHtml(shortId, order) {
  const wa = waLink(order.userPhone, waGreetingToCustomer(shortId, order));
  const shipping = order.shipping || {};
  const discount = discountAmount(order);
  const itemRows = (order.items || []).map(itemRowHtml).join('');

  return '<!DOCTYPE html><html><body style="font-family:Montserrat;max-width:600px;margin:auto;background:#ffffff;padding:24px;color:#333">' +
    '<div style="border:1px solid #e5e5e5;border-radius:8px;padding:24px">' +
    '<h2 style="color:#b84c72;margin:0 0 16px;font-size:18px">Nuevo pedido en ' + STORE_NAME + '</h2>' +
    '<p style="color:#666;margin:0 0 20px;font-size:13px">Pedido #' + shortId + ' recibido el ' + fmtDate(order.createdAt) + '</p>' +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:13px">' +
    '<tr><td style="color:#888;padding:4px 0;width:140px">Cliente</td><td>' + (order.userName || '—') + '</td></tr>' +
    '<tr><td style="color:#888;padding:4px 0">Teléfono</td><td>' + (order.userPhone || '—') + '</td></tr>' +
    (order.userEmail ? '<tr><td style="color:#888;padding:4px 0">Email</td><td>' + order.userEmail + '</td></tr>' : '') +
    '<tr><td style="color:#888;padding:4px 0">Ciudad</td><td>' + (shipping.city || '—') + '</td></tr>' +
    '<tr><td style="color:#888;padding:4px 0">Zona</td><td>' + zoneLabel(order) + '</td></tr>' +
    (shipping.address ? '<tr><td style="color:#888;padding:4px 0">Dirección</td><td>' + shipping.address + '</td></tr>' : '') +
    (shipping.mapLocation && shipping.mapLocation.name ? '<tr><td style="color:#888;padding:4px 0">Lugar</td><td>' + shipping.mapLocation.name + '</td></tr>' : '') +
    (shipping.referencia ? '<tr><td style="color:#888;padding:4px 0">Referencia</td><td>' + shipping.referencia + '</td></tr>' : '') +
    (shipping.mapLocation ? '<tr><td style="color:#888;padding:4px 0">Ubicación</td><td><a href="https://maps.google.com/?q=' + shipping.mapLocation.lat + ',' + shipping.mapLocation.lng + '" style="color:#b84c72">Ver en el mapa</a></td></tr>' : '') +
    '<tr><td style="color:#888;padding:4px 0">Entrega</td><td>' + shipMethodLabel(order) + '</td></tr>' +
    '<tr><td style="color:#888;padding:4px 0">Pago</td><td>' + payMethodLabel(order) + '</td></tr>' +
    '<tr><td style="color:#888;padding:4px 0">Estado pedido</td><td>' + (order.status || 'pendiente') + '</td></tr>' +
    '<tr><td style="color:#888;padding:4px 0">Estado pago</td><td>' + ((order.payment && order.payment.status) || 'pendiente') + '</td></tr>' +
    '</table>' +
    '<h3 style="color:#b84c72;margin:16px 0 8px;font-size:14px">Productos</h3>' +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:13px">' + itemRows +
    '<tr style="border-top:1px solid #e5e5e5"><td colspan="2" style="padding:8px;color:#888">Subtotal</td><td style="padding:8px;text-align:right">' + fmtPrice(order.subtotal) + '</td></tr>' +
    (discount > 0 ? '<tr><td colspan="2" style="padding:4px 8px;color:#888">Descuento</td><td style="padding:4px 8px;text-align:right;color:#c0392b">-' + fmtPrice(discount) + '</td></tr>' : '') +
    '<tr><td colspan="2" style="padding:4px 8px;color:#888">Envío</td><td style="padding:4px 8px;text-align:right">' + fmtShipping(order) + '</td></tr>' +
    '<tr><td colspan="2" style="padding:10px 8px;font-weight:bold;color:#b84c72">Total</td>' +
    '<td style="padding:10px 8px;text-align:right;font-weight:bold;color:#b84c72">' + fmtPrice(order.total) +
    (order.shippingPending ? ' <span style="font-size:11px;font-weight:normal;color:#888">(+ envío a coordinar)</span>' : '') + '</td></tr>' +
    '</table>' +
    (order.notes ? '<p style="color:#555;font-size:13px"><strong>Notas:</strong> ' + order.notes + '</p>' : '') +
    '<p style="font-size:13px;margin-top:20px">' +
    '<a href="' + ADMIN_PANEL + '" style="color:#b84c72">Ver pedido en el panel de administración</a>' +
    (wa ? '<br><a href="' + wa + '" style="color:#25D366">Escribirle por WhatsApp al cliente</a>' : '') +
    '</p>' +
    '</div></body></html>';
}

// ============================================================
// CORREO 2 — a la clienta (confirmación, solo si dejó su email)
// ============================================================

function buildCustomerText(shortId, order, isTest) {
  const items = (order.items || []).map(itemLineText).join('\n');
  const shipping = order.shipping || {};
  const first = String(order.userName || '').trim().split(' ')[0] || '';
  const line = '-'.repeat(40);
  const testNotice = isTest
    ? 'Este es un correo de prueba de Tintin Accesorios. No corresponde a un pedido real.\n' + line + '\n'
    : '';

  return testNotice + 'Gracias por tu pedido' + (first ? ', ' + first : '') + '.\n' + line + '\n' +
    'Recibimos tu pedido en ' + STORE_NAME + '. Estamos preparando todo con\n' +
    'cuidado y te vamos a contactar para confirmar los detalles del envío.\n' + line + '\n' +
    'Pedido:  #' + shortId + '\n' +
    'Fecha:   ' + fmtDate(order.createdAt) + '\n' +
    'Estado:  Pendiente de confirmación\n' + line + '\n' +
    'Tus productos:\n' + items + '\n' + line + '\n' +
    '  Subtotal: ' + fmtPrice(order.subtotal) + '\n' +
    '  Envío:    ' + fmtShipping(order) + '\n' +
    'Total:   ' + fmtPrice(order.total) + (order.shippingPending ? ' (+ envío a coordinar)' : '') + '\n' + line + '\n' +
    (shipping.address ? 'Dirección de entrega: ' + shipping.address + (shipping.city ? ', ' + shipping.city : '') + '\n' : '') +
    (shipping.city && !shipping.address ? 'Ciudad: ' + shipping.city + '\n' : '') + line + '\n' +
    'Gracias por elegirnos,\n' + STORE_NAME + '\n';
}

function buildCustomerHtml(shortId, order, isTest) {
  const shipping = order.shipping || {};
  const first = String(order.userName || '').trim().split(' ')[0] || '';
  const itemRows = (order.items || []).map(itemRowHtml).join('');
  const testBanner = isTest
    ? '<div style="background:#fff3cd;color:#856404;padding:10px 14px;border-radius:6px;margin-bottom:16px;font-size:12px;text-align:center">Este es un correo de prueba de Tintin Accesorios. No corresponde a un pedido real.</div>'
    : '';

  return '<!DOCTYPE html><html><body style="font-family:Montserrat;max-width:600px;margin:auto;background:#ffffff;padding:24px;color:#333">' +
    '<div style="border:1px solid #e5e5e5;border-radius:8px;padding:28px">' +
    testBanner +
    '<h2 style="color:#b84c72;margin:0 0 12px;font-size:18px">Gracias por tu pedido' + (first ? ', ' + first : '') + '.</h2>' +
    '<p style="color:#555;line-height:1.6;margin:0 0 20px;font-size:14px">Recibimos tu pedido en ' + STORE_NAME + '. ' +
    'Estamos preparando todo con cuidado y te vamos a contactar para confirmar los detalles del envío.</p>' +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:13px">' +
    '<tr><td style="padding:6px 0;color:#888">Pedido</td><td style="padding:6px 0;text-align:right">#' + shortId + '</td></tr>' +
    '<tr><td style="padding:6px 0;color:#888">Fecha</td><td style="padding:6px 0;text-align:right">' + fmtDate(order.createdAt) + '</td></tr>' +
    '<tr><td style="padding:6px 0;color:#888">Estado</td><td style="padding:6px 0;text-align:right">Pendiente de confirmación</td></tr>' +
    '</table>' +
    '<h3 style="color:#b84c72;margin:16px 0 8px;font-size:14px">Tus productos</h3>' +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:13px">' + itemRows +
    '<tr style="border-top:1px solid #e5e5e5"><td colspan="2" style="padding:8px;color:#888">Subtotal</td><td style="padding:8px;text-align:right">' + fmtPrice(order.subtotal) + '</td></tr>' +
    '<tr><td colspan="2" style="padding:4px 8px;color:#888">Envío</td><td style="padding:4px 8px;text-align:right">' + fmtShipping(order) + '</td></tr>' +
    '<tr><td colspan="2" style="padding:10px 8px;font-weight:bold;color:#b84c72">Total</td>' +
    '<td style="padding:10px 8px;text-align:right;font-weight:bold;color:#b84c72">' + fmtPrice(order.total) +
    (order.shippingPending ? ' <span style="font-size:11px;font-weight:normal;color:#888">(+ envío a coordinar)</span>' : '') + '</td></tr>' +
    '</table>' +
    (shipping.address ? '<p style="color:#555;font-size:13px;margin:0 0 4px"><strong>Dirección de entrega:</strong> ' + shipping.address + (shipping.city ? ', ' + shipping.city : '') + '</p>' : (shipping.city ? '<p style="color:#555;font-size:13px;margin:0 0 4px"><strong>Ciudad:</strong> ' + shipping.city + '</p>' : '')) +
    '<div style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e5e5">' +
    '<p style="color:#999;font-size:12px;margin:0">Gracias por elegirnos,<br>' + STORE_NAME + '</p>' +
    '</div></div></body></html>';
}
```

## 3. Publicar como Web App

1. Arriba a la derecha, click en **"Implementar"** → **"Nueva implementación"**
2. Click en el ícono de engranaje ⚙️ al lado de "Seleccionar tipo" → elegí **"Aplicación web"**
3. Configurá:
   - **Descripción**: `Emails de pedidos Tintin`
   - **Ejecutar como**: `Yo (tintinpedidos@gmail.com)`
   - **Quién tiene acceso**: **`Cualquier usuario`** (importante — sin esto, el checkout público no va a poder llamarlo)
4. Click en **"Implementar"**
5. Te va a pedir autorizar permisos — elegí la cuenta `tintinpedidos@gmail.com`, puede avisar "Google no verificó esta app": hacé clic en **"Configuración avanzada"** → **"Ir a Tintin - Emails de pedidos (no seguro)"** → **"Permitir"** (es tu propio script, es seguro)
   - **Novedad de esta versión**: el script ahora también le pide a Google
     que valide un idToken (`UrlFetchApp` llamando a
     `identitytoolkit.googleapis.com`), un permiso nuevo que el script no
     pedía antes. Al guardar/implementar es normal que la pantalla de
     autorización pida un permiso adicional ("Conectarse a un servicio
     externo" o similar) — aceptalo igual, es necesario para que la
     verificación de Super Admin funcione.
6. Copiá la **URL de la aplicación web** que te da al final (termina en `/exec`)

## 4. Conectar la URL al sitio

**Ya hecho — estado actual (migración completada):** `js/email-config.js` ya apunta a la
implementación desplegada desde `tintinpedidos@gmail.com`:

```javascript
export const EMAIL_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbxia47SEM2GmGrjSF2Cy1cviYhTt9PVF7n3M_vYVuIl26PQeoZ-f2OqSC0IyMBr5Ob0lA/exec';
```

Si en algún momento se vuelve a implementar el script de cero (URL `/exec` nueva) o se
rota la implementación, hay que actualizar solamente la URL en `js/email-config.js`.
El flujo actual valida la identidad de Firebase y no publica secretos en el navegador
ni en esta documentación.

El proyecto viejo bajo `tintinaccs@gmail.com` ya no está conectado a nada — el
sitio no le manda ninguna llamada. Si todavía existe una implementación activa
ahí, se puede archivar/eliminar desde ese Apps Script sin afectar el flujo actual.

## 5. Probar

1. Hacé un pedido de prueba desde el checkout público
2. Revisá la bandeja de `tintinaccs@gmail.com` — debería llegar en segundos, con
   remitente **`tintinpedidos@gmail.com`**
3. Revisá que también llegue la confirmación a la cuenta de la clienta de prueba,
   mismo remitente
4. En Super Admin → Pedidos, probá el botón **"✉️ Reenviar"** en cualquier pedido —
   también debe salir desde `tintinpedidos@gmail.com`
5. Confirmá en Super Admin → Pedidos que la columna de notificación muestra
   "Notificado" cuando salieron los dos correos — para probar `partial`/`failed`
   hace falta forzar un error real (ej. un `order.userEmail` con formato inválido)
6. Revisá también la carpeta de Spam de ambas bandejas — con una cuenta de
   Gmail nueva es normal que los primeros correos caigan ahí. Marcá "No es
   spam" y agregá `tintinpedidos@gmail.com` a los contactos para acelerar que
   Gmail deje de filtrarlo
7. En Super Admin → Correos → Correos de prueba, escribí cualquier
   email tuyo (o elegí una clienta registrada) y tocá "Enviar prueba" —
   debería llegar el correo de confirmación (con el aviso de "correo de
   prueba" arriba) sin que se cree ningún pedido nuevo en Super Admin →
   Pedidos ni llegue nada a `tintinaccs@gmail.com`
8. En Super Admin → Correos → Plantillas, editá el asunto o el saludo de
   "Promoción general", guardalo, y volvé a Correos de prueba con esa
   plantilla elegida — el cambio tiene que verse en el correo que llega
9. En Super Admin → Correos → Promociones, seleccioná una sola clienta de
   prueba (tu propio email registrado como cliente) y confirmá el envío
   escribiendo `CONFIRMAR` — revisá que quede una fila nueva en
   Super Admin → Correos → Historial con el resultado

## Si algo falla
- Si no llega nada: abrí la consola del navegador (F12) en el checkout y buscá mensajes que empiecen con `[email-notify]`
- Revisá que la URL en `js/email-config.js` termine en `/exec` (no `/dev`)
- Revisá que en el paso 3 hayas elegido "Cualquier usuario" con acceso, no "Solo yo"
- Si editaste el script después de implementarlo, tenés que crear una **nueva implementación** (Implementar → Administrar implementaciones → editar → nueva versión) para que los cambios tomen efecto
- Si el correo sigue llegando "De: tintinaccs@gmail.com", es porque `js/email-config.js`
  todavía apunta a la URL vieja, o la implementación activa en Apps Script sigue
  siendo la del proyecto bajo `tintinaccs@gmail.com`
- Si un envío devuelve `cooldown_active` o `daily_limit_exceeded`: es la protección
  anti-spam funcionando como corresponde, no un error real — el panel ya traduce
  estos códigos a un mensaje en español ("esperá X segundos", "se alcanzó el
  límite diario"). Para pruebas: cooldown fijo de 2 min entre envíos. Para
  reenvíos: cooldown fijo de 60s para el mismo pedido. Los topes diarios se
  configuran en Correos → Configuración (dentro de un techo absoluto fijo acá).
- Si Promociones devuelve `bulk_campaigns_disabled_gmail_sender`: está bloqueado
  a propósito mientras el remitente sea una cuenta de Gmail común — no es un bug.
