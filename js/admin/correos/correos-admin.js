// Dependencias explícitas; el estado de sesión y las fuentes vivas se leen al usarse.
export function iniciarCorreos({
  db, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, query, orderBy, limit, writeBatch, serverTimestamp, onSnapshot, getDocsPaginated, withAdminSiteChange, sendTestCustomerEmail, sendTemplatedEmail, sendBulkTemplatedEmail, EMAIL_WEBHOOK_URL, ORDER_STATUS_LABELS, adminEventAttributes, addAdminBulkSelection, rejectOversizedAdminBulkSelection, batchUpdateChunked, downloadCsv, emailErrorMessage_, escapeHtmlAdmin, formatDate, formatPrice, logAudit, toast, toJsDate_, getCurrentUser, getAllUsers, getAllOrders
}) {
// ======== CORREOS (Super Admin) ========
// Módulo completo de correos: dashboard, correos de pedidos configurables,
// correos de prueba, plantillas (CRUD), clientas registradas, promociones
// controladas, historial y configuración. Todo persiste en Firestore
// (emailSettings/emailTemplates/emailLogs/emailCampaigns) — ver
// firestore.rules y functions/configuracion-correo.md.

const EMAIL_SENDER_ADDRESS = 'pedidos@tintinaccs.com'; // fijo por Apps Script — informativo, no editable
const TEST_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROMO_BATCH_SIZE = 20;

// {{variable}} protegidas — siempre las calcula el sitio a partir del pedido
// real, del perfil real de la clienta, o de datos ficticios de prueba. El
// Super Admin nunca escribe el valor final a mano en su lugar.
const PROTECTED_VARS = ['clienteNombre','pedidoNumero','productos','total','estadoPedido','metodoEntrega','fechaPedido'];

const ORDER_TYPE_KEYS = [
  'pedido_recibido_clienta','pedido_recibido_tintin','pedido_confirmado','pedido_cancelado',
  'pedido_rechazado','pago_recibido','pedido_listo_retiro','pedido_en_camino','pedido_entregado'
];
const ORDER_TYPE_NAMES = {
  pedido_recibido_clienta: 'Pedido recibido (clienta)',
  pedido_recibido_tintin:  'Pedido recibido (Tintin)',
  pedido_confirmado:       'Pedido confirmado',
  pedido_cancelado:        'Pedido cancelado',
  pedido_rechazado:        'Pedido rechazado',
  pago_recibido:           'Pago recibido',
  pedido_listo_retiro:     'Pedido listo para retirar',
  pedido_en_camino:        'Pedido en camino',
  pedido_entregado:        'Pedido entregado'
};
// Mapea el status/estado de pago real de un pedido (Pedidos) al tipo de
// correo configurable acá — solo estos 6 disparan el nuevo correo automático
// opcional; "recibido" ya funciona desde siempre vía checkout, aparte de esto.
const ORDER_STATUS_TO_TYPE = {
  confirmado: 'pedido_confirmado', cancelado: 'pedido_cancelado', rechazado: 'pedido_rechazado',
  listo_retiro: 'pedido_listo_retiro', en_camino: 'pedido_en_camino', entregado: 'pedido_entregado'
};
const PAY_STATUS_TO_TYPE = { pagado: 'pago_recibido' };

// Contenido inicial de las 15 plantillas — se crean en Firestore la primera
// vez que se abre Correos (ensureTemplatesSeeded_), una sola vez por key.
const TEMPLATE_SEEDS = {
  pedido_recibido_clienta: { name: 'Pedido recibido para clienta', category: 'pedido',
    subject: 'Recibimos tu pedido en Tintin — Pedido #{{pedidoNumero}}',
    greeting: 'Gracias por tu pedido, {{clienteNombre}}.',
    intro: 'Recibimos tu pedido en Tintin Accesorios. Estamos preparando todo con cuidado y te vamos a contactar para confirmar los detalles del envío.',
    closing: 'Gracias por elegirnos.', signature: 'Tintin Accesorios', promoText: '', buttonText: '', buttonUrl: '',
    brandPhrase: 'Tintin Accesorios', footer: '' },
  pedido_recibido_tintin: { name: 'Pedido recibido para Tintin', category: 'pedido',
    subject: 'Nuevo pedido recibido en Tintin — Pedido #{{pedidoNumero}}',
    greeting: 'Nuevo pedido de {{clienteNombre}}.',
    intro: 'Se recibió un nuevo pedido en la tienda.',
    closing: 'Revisalo en el panel de administración.', signature: 'Tintin Accesorios', promoText: '',
    buttonText: 'Ver en el panel', buttonUrl: 'https://tintinaccs.com/admin.html',
    brandPhrase: 'Tintin Accesorios', footer: '' },
  pedido_confirmado: { name: 'Pedido confirmado', category: 'pedido',
    subject: 'Tu pedido #{{pedidoNumero}} fue confirmado',
    greeting: 'Hola {{clienteNombre}},',
    intro: 'Tu pedido #{{pedidoNumero}} fue confirmado y ya lo estamos preparando.',
    closing: 'Te avisamos en cuanto esté listo.', signature: 'Tintin Accesorios', promoText: '', buttonText: '', buttonUrl: '',
    brandPhrase: 'Tintin Accesorios', footer: '' },
  pedido_cancelado: { name: 'Pedido cancelado', category: 'pedido',
    subject: 'Tu pedido #{{pedidoNumero}} fue cancelado',
    greeting: 'Hola {{clienteNombre}},',
    intro: 'Tu pedido #{{pedidoNumero}} fue cancelado.',
    closing: 'Si tenés dudas, escribinos y te ayudamos.', signature: 'Tintin Accesorios', promoText: '', buttonText: '', buttonUrl: '',
    brandPhrase: 'Tintin Accesorios', footer: '' },
  pedido_rechazado: { name: 'Pedido rechazado', category: 'pedido',
    subject: 'Tu pedido #{{pedidoNumero}} no pudo procesarse',
    greeting: 'Hola {{clienteNombre}},',
    intro: 'No pudimos procesar tu pedido #{{pedidoNumero}}.',
    closing: 'Escribinos si querés que te ayudemos a resolverlo.', signature: 'Tintin Accesorios', promoText: '', buttonText: '', buttonUrl: '',
    brandPhrase: 'Tintin Accesorios', footer: '' },
  pago_recibido: { name: 'Pago recibido', category: 'pedido',
    subject: 'Recibimos tu pago del pedido #{{pedidoNumero}}',
    greeting: 'Hola {{clienteNombre}},',
    intro: 'Confirmamos que recibimos el pago de tu pedido #{{pedidoNumero}}.',
    closing: 'Gracias por tu compra.', signature: 'Tintin Accesorios', promoText: '', buttonText: '', buttonUrl: '',
    brandPhrase: 'Tintin Accesorios', footer: '' },
  pedido_listo_retiro: { name: 'Pedido listo para retirar', category: 'pedido',
    subject: 'Tu pedido #{{pedidoNumero}} está listo para retirar',
    greeting: 'Hola {{clienteNombre}},',
    intro: 'Tu pedido #{{pedidoNumero}} ya está listo para que lo retires.',
    closing: 'Te esperamos.', signature: 'Tintin Accesorios', promoText: '', buttonText: '', buttonUrl: '',
    brandPhrase: 'Tintin Accesorios', footer: '' },
  pedido_en_camino: { name: 'Pedido en camino', category: 'pedido',
    subject: 'Tu pedido #{{pedidoNumero}} está en camino',
    greeting: 'Hola {{clienteNombre}},',
    intro: 'Tu pedido #{{pedidoNumero}} ya está en camino.',
    closing: 'Pronto lo vas a tener en tus manos.', signature: 'Tintin Accesorios', promoText: '', buttonText: '', buttonUrl: '',
    brandPhrase: 'Tintin Accesorios', footer: '' },
  pedido_entregado: { name: 'Pedido entregado', category: 'pedido',
    subject: 'Tu pedido #{{pedidoNumero}} fue entregado',
    greeting: 'Hola {{clienteNombre}},',
    intro: 'Tu pedido #{{pedidoNumero}} fue entregado.',
    closing: 'Gracias por elegirnos, esperamos que lo disfrutes.', signature: 'Tintin Accesorios', promoText: '', buttonText: '', buttonUrl: '',
    brandPhrase: 'Tintin Accesorios', footer: '' },
  promo_general: { name: 'Promoción general', category: 'promo',
    subject: 'Tenemos novedades para vos, {{clienteNombre}}',
    greeting: 'Hola {{clienteNombre}},',
    intro: 'Queremos contarte sobre nuestras últimas novedades en Tintin Accesorios.',
    promoText: 'Descubrí los nuevos productos en nuestra tienda.',
    closing: 'Gracias por ser parte de Tintin.', signature: 'Tintin Accesorios',
    buttonText: 'Ver tienda', buttonUrl: 'https://tintinaccs.com/',
    brandPhrase: 'Tintin Accesorios', footer: 'Si no querés recibir más promociones, respondé este correo y te sacamos de la lista.' },
  novedades: { name: 'Novedades', category: 'promo',
    subject: 'Novedades en Tintin Accesorios',
    greeting: 'Hola {{clienteNombre}},',
    intro: 'Llegaron productos nuevos a la tienda.',
    promoText: 'Vení a conocerlos.',
    closing: 'Te esperamos.', signature: 'Tintin Accesorios',
    buttonText: 'Ver novedades', buttonUrl: 'https://tintinaccs.com/',
    brandPhrase: 'Tintin Accesorios', footer: 'Si no querés recibir más promociones, respondé este correo y te sacamos de la lista.' },
  promo_dia_amistad: { name: 'Promo Día de la Amistad', category: 'promo',
    subject: 'Feliz Día de la Amistad, {{clienteNombre}}',
    greeting: 'Hola {{clienteNombre}},',
    intro: 'En el Día de la Amistad te dejamos una selección especial de regalos.',
    promoText: 'Encontrá el regalo ideal para esa amiga especial.',
    closing: 'Gracias por elegirnos.', signature: 'Tintin Accesorios',
    buttonText: 'Ver regalos', buttonUrl: 'https://tintinaccs.com/',
    brandPhrase: 'Tintin Accesorios', footer: 'Si no querés recibir más promociones, respondé este correo y te sacamos de la lista.' },
  promo_relojes: { name: 'Promo de relojes', category: 'promo',
    subject: 'Nuevos relojes en Tintin Accesorios',
    greeting: 'Hola {{clienteNombre}},',
    intro: 'Llegó una nueva colección de relojes.',
    promoText: 'Conocé los modelos disponibles.',
    closing: 'Te esperamos en la tienda.', signature: 'Tintin Accesorios',
    buttonText: 'Ver relojes', buttonUrl: 'https://tintinaccs.com/',
    brandPhrase: 'Tintin Accesorios', footer: 'Si no querés recibir más promociones, respondé este correo y te sacamos de la lista.' },
  promo_bolsos: { name: 'Promo de bolsos', category: 'promo',
    subject: 'Nuevos bolsos en Tintin Accesorios',
    greeting: 'Hola {{clienteNombre}},',
    intro: 'Llegó una nueva colección de bolsos.',
    promoText: 'Conocé los modelos disponibles.',
    closing: 'Te esperamos en la tienda.', signature: 'Tintin Accesorios',
    buttonText: 'Ver bolsos', buttonUrl: 'https://tintinaccs.com/',
    brandPhrase: 'Tintin Accesorios', footer: 'Si no querés recibir más promociones, respondé este correo y te sacamos de la lista.' },
  mensaje_libre: { name: 'Mensaje libre', category: 'libre',
    subject: 'Un mensaje de Tintin Accesorios',
    greeting: 'Hola {{clienteNombre}},', intro: '',
    promoText: 'Escribí acá el mensaje que quieras enviar.',
    closing: 'Gracias.', signature: 'Tintin Accesorios', buttonText: '', buttonUrl: '',
    brandPhrase: 'Tintin Accesorios', footer: '' },
};

let emailSettingsCache = null;
let allEmailTemplates = [];
let allEmailLogs = [];
let allEmailCampaigns = [];
let allClientUsers = [];
let emailRealtimeUnsubscribers = [];
let emailModuleStarted = false;
let promoRecipients = [];   // [{email, name}] — destinatarias armadas para Promociones
let cliSelected = new Set(); // emails seleccionados en Clientas registradas
let promoPendingSend = null;
let tplFilterCategory = '';
let tplShowArchived = false;
let tplSearchQuery = '';

function defaultEmailSettings_() {
  const orderTypesEnabled = {};
  ORDER_TYPE_KEYS.forEach(k => { orderTypesEnabled[k] = (k === 'pedido_recibido_clienta' || k === 'pedido_recibido_tintin'); });
  const orderTypeTemplateMap = {};
  ORDER_TYPE_KEYS.forEach(k => { orderTypeTemplateMap[k] = k; });
  return {
    orderEmailsEnabled: true, internalEmailEnabled: true, customerEmailEnabled: true,
    testEmailsEnabled: true, promoEnabled: true,
    senderName: 'Tintin Accesorios', senderEmail: EMAIL_SENDER_ADDRESS, internalEmail: 'tintinaccs@gmail.com',
    signature: 'Tintin Accesorios', footer: '', whatsappNumber: '',
    testDailyLimit: 20, promoDailyLimit: 100, resendDailyLimit: 30,
    orderTypesEnabled, orderTypeTemplateMap
  };
}

// Detecta un remitente @gmail.com para aplicarle la protección anti-spam
// pensada para una cuenta de Gmail común (alto riesgo de que Google la
// marque como spam o la suspenda ante un envío masivo). El remitente actual,
// pedidos@tintinaccs.com, es un dominio propio y ya no cae acá — la función
// queda por si en el futuro se vuelve a usar una cuenta @gmail.com común.
function isGmailSender_(senderEmail) {
  return /@gmail\.com\s*$/i.test(String(senderEmail || '').trim());
}

function renderVarsClient_(str, vars) {
  return String(str || '').replace(/\{\{(\w+)\}\}/g, (m, key) => {
    const v = vars && vars[key];
    return (v === undefined || v === null) ? '' : String(v);
  });
}

function buildPreviewHtml_(t, vars) {
  const v = vars || {};
  const brandPhrase = renderVarsClient_(t.brandPhrase, v);
  const greeting = renderVarsClient_(t.greeting, v);
  const intro = renderVarsClient_(t.intro, v);
  const promoText = renderVarsClient_(t.promoText, v);
  const closing = renderVarsClient_(t.closing, v);
  const signature = renderVarsClient_(t.signature, v) || 'Tintin Accesorios';
  const footer = renderVarsClient_(t.footer, v);
  const buttonText = renderVarsClient_(t.buttonText, v);
  const buttonUrl = t.buttonUrl || '';
  const buttonHtml = (buttonText && buttonUrl)
    ? `<p style="text-align:center;margin:24px 0"><a href="${buttonUrl}" style="background:#F8AACA;color:#713C53;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px;display:inline-block">${buttonText}</a></p>`
    : '';
  const fontBase = new URL('assets-tintin/fonts/', document.baseURI).href;
  const fontCss = `<style>` +
    `@font-face{font-family:Montserrat;font-style:normal;font-weight:100 900;font-display:block;src:url("${fontBase}montserrat-latin-wght-normal.woff2") format("woff2")}` +
    `@font-face{font-family:Montserrat;font-style:italic;font-weight:100 900;font-display:block;src:url("${fontBase}montserrat-latin-wght-italic.woff2") format("woff2")}` +
    `html,body,body *{font-family:Montserrat!important;font-synthesis:none}` +
    `</style>`;
  return `<!DOCTYPE html><html><head>${fontCss}</head><body style="font-family:Montserrat;max-width:600px;margin:auto;background:#ffffff;padding:24px;color:#713C53">` +
    `<div style="border:1px solid #e5e5e5;border-radius:8px;padding:28px">` +
    (brandPhrase ? `<p style="color:#713C53;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:.06em;margin:0 0 14px">${brandPhrase}</p>` : '') +
    (greeting ? `<h2 style="color:#713C53;margin:0 0 14px;font-size:18px">${greeting}</h2>` : '') +
    (intro ? `<p style="color:#713C53;line-height:1.6;margin:0 0 16px;font-size:14px;white-space:pre-line">${intro}</p>` : '') +
    (promoText ? `<p style="color:#713C53;line-height:1.6;margin:0 0 16px;font-size:14px;white-space:pre-line">${promoText}</p>` : '') +
    buttonHtml +
    (closing ? `<p style="color:#713C53;line-height:1.6;margin:16px 0 0;font-size:14px;white-space:pre-line">${closing}</p>` : '') +
    `<div style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e5e5">` +
    `<p style="color:#999;font-size:12px;margin:0;white-space:pre-line">${signature}</p>` +
    (footer ? `<p style="color:#bbb;font-size:11px;margin:10px 0 0;white-space:pre-line">${footer}</p>` : '') +
    `</div></div></body></html>`;
}

function fakeTestVariables_() {
  return {
    clienteNombre: 'Cliente de prueba', pedidoNumero: 'TEST123', productos: '1x BAG RUBY',
    total: formatPrice(190000), estadoPedido: 'Pendiente de confirmación', metodoEntrega: 'Delivery',
    fechaPedido: new Date().toLocaleDateString('es-PY')
  };
}

function orderToVariables_(order) {
  return {
    clienteNombre: order.userName || '',
    pedidoNumero: order.shortId || (order.id ? String(order.id).slice(0,8).toUpperCase() : ''),
    productos: (order.items||[]).map(i => `${i.qty}x ${i.name}`).join(', '),
    total: formatPrice(order.total || 0),
    estadoPedido: ORDER_STATUS_LABELS[order.status] || order.status || '',
    metodoEntrega: ({delivery:'Delivery', encomienda:'Encomienda', retiro:'Retiro en tienda'})[order.shipping?.method] || '',
    fechaPedido: formatDate(order.createdAt)
  };
}

function templateContentPayload_(tpl) {
  return {
    subject: tpl.subject || '', greeting: tpl.greeting || '', intro: tpl.intro || '', closing: tpl.closing || '',
    signature: tpl.signature || '', promoText: tpl.promoText || '', buttonText: tpl.buttonText || '',
    buttonUrl: tpl.buttonUrl || '', brandPhrase: tpl.brandPhrase || '', footer: tpl.footer || ''
  };
}

function logStatusBadge_(status) {
  const map = { sent: 'badge-entregado', failed: 'badge-cancelado', partial: 'badge-preparando', pending: 'badge-pendiente' };
  const labels = { sent: 'Enviado', failed: 'Fallido', partial: 'Parcial', pending: 'Pendiente' };
  return `<span class="adm-badge ${map[status] || 'badge-pendiente'}">${escapeHtmlAdmin(labels[status] || status || '—')}</span>`;
}

function templateLabel_(key) {
  if (ORDER_TYPE_NAMES[key]) return ORDER_TYPE_NAMES[key];
  const t = allEmailTemplates.find(t => t.key === key || t.id === key);
  if (t) return t.name;
  if (key === 'promo') return 'Promoción';
  return key || '—';
}

async function getEmailSettingsFresh_() {
  try {
    const snap = await getDoc(doc(db, 'emailSettings', 'main'));
    return snap.exists() ? snap.data() : {};
  } catch (e) { return {}; }
}

async function saveEmailSettingsMerge_(patch) {
  try {
    await withAdminSiteChange(async () => setDoc(doc(db, 'emailSettings', 'main'), { ...patch, updatedAt: serverTimestamp(), updatedBy: getCurrentUser()?.email || '' }, { merge: true }));
    return true;
  } catch (e) {
    toast('Error al guardar: ' + e.message);
    return false;
  }
}

async function ensureTemplatesSeeded_(existing) {
  const existingKeys = new Set(existing.map(t => t.key).filter(Boolean));
  const toCreate = Object.keys(TEMPLATE_SEEDS).filter(k => !existingKeys.has(k));
  for (const key of toCreate) {
    const seed = TEMPLATE_SEEDS[key];
    const content = { subject: seed.subject, greeting: seed.greeting, intro: seed.intro, closing: seed.closing,
      signature: seed.signature, promoText: seed.promoText, buttonText: seed.buttonText, buttonUrl: seed.buttonUrl || '',
      brandPhrase: seed.brandPhrase, footer: seed.footer };
    try {
      await withAdminSiteChange(async () => setDoc(doc(db, 'emailTemplates', key), {
        key, name: seed.name, category: seed.category, ...content,
        active: true, archived: false, original: content,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: getCurrentUser()?.email || ''
      }));
      existing.push({ id: key, key, name: seed.name, category: seed.category, ...content, active: true, archived: false, original: content });
    } catch (e) {
      console.error('No se pudo crear la plantilla inicial ' + key + ':', e);
    }
  }
  return existing;
}

async function logEmailSend_(entry) {
  // OJO: el timestamp queda fijo en el momento de crear el objeto (una
  // variable capturada), NO como `() => new Date()` — si el closure llamara
  // a `new Date()` en cada lectura, cualquier chequeo que reevalúe
  // `sentAt.toDate()` más tarde (como el cooldown de correos de prueba)
  // vería SIEMPRE "recién enviado", sin importar cuánto tiempo real pasó.
  const sentAtSnapshot = new Date();
  const local = {
    id: 'local-' + Date.now() + Math.random(), sentAt: { toDate: () => sentAtSnapshot },
    isAutomatic: !!entry.isAutomatic, sentBy: getCurrentUser()?.email || '', error: entry.error || '',
    orderId: entry.orderId || '', campaignId: entry.campaignId || '', templateKey: entry.templateKey || '',
    // 'pedido' (correo real de un pedido, ej. estado automático) / 'prueba'
    // (Correos de prueba) / 'promo' (Promociones) — separa pedidos reales
    // de pruebas en Historial, en vez de que todo se vea igual.
    category: entry.category || 'pedido',
    type: entry.type || '', recipient: entry.recipient || '', status: entry.status || 'pending',
    variables: entry.variables || null
  };
  allEmailLogs.unshift(local);
  renderCorreosDashboard();
  renderCorreosHistorialTab();
  try {
    await withAdminSiteChange(async () => addDoc(collection(db, 'emailLogs'), {
      category: local.category, type: local.type, recipient: local.recipient, status: local.status, templateKey: local.templateKey,
      isAutomatic: local.isAutomatic, sentBy: local.sentBy, error: local.error, orderId: local.orderId,
      campaignId: local.campaignId, variables: local.variables, sentAt: serverTimestamp()
    }));
  } catch (e) {
    console.error('No se pudo registrar en emailLogs:', e);
  }
}

// ---- Carga principal del módulo ----
function refreshCorreosClientasFromRealtime() {
  allClientUsers = getAllUsers()
    .filter(user => (user.role || 'client') === 'client')
    .map(user => {
      const theirOrders = getAllOrders().filter(order =>
        order.userId === user.uid ||
        (order.userEmail && user.email && order.userEmail.toLowerCase() === user.email.toLowerCase())
      );
      let lastPurchase = null;
      theirOrders.forEach(order => {
        const date = order.createdAt?.toDate ? order.createdAt.toDate() : (order.createdAt ? new Date(order.createdAt) : null);
        if (date && (!lastPurchase || date > lastPurchase)) lastPurchase = date;
      });
      return { ...user, orderCount: theirOrders.length, lastPurchase };
    });
  if (!emailModuleStarted) return;
  renderCorreosClientasTab();
  renderCorreosPromocionesTab();
}

function renderCorreosRealtimeViews() {
  if (!emailModuleStarted) return;
  renderCorreosDashboard();
  renderCorreosPedidosTab();
  renderCorreosPruebaTab();
  renderCorreosPlantillasTab();
  renderCorreosHistorialTab();
  renderCorreosConfigTab();
}

function startCorreosRealtimeListeners() {
  if (emailRealtimeUnsubscribers.length) return;
  emailModuleStarted = true;
  emailRealtimeUnsubscribers.push(
    onSnapshot(query(collection(db, 'emailTemplates'), limit(500)), snapshot => {
      allEmailTemplates = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      renderCorreosRealtimeViews();
    }, error => console.warn('Plantillas de correo no disponibles:', error)),
    onSnapshot(query(collection(db, 'emailLogs'), orderBy('sentAt', 'desc'), limit(300)), snapshot => {
      allEmailLogs = snapshot.docs.map(item => ({ ...item.data(), id: item.id }));
      renderCorreosRealtimeViews();
    }, error => console.warn('Historial de correos no disponible:', error)),
    onSnapshot(query(collection(db, 'emailCampaigns'), orderBy('createdAt', 'desc'), limit(50)), snapshot => {
      allEmailCampaigns = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      renderCorreosRealtimeViews();
    }, error => console.warn('Campañas de correo no disponibles:', error)),
    onSnapshot(doc(db, 'emailSettings', 'main'), snapshot => {
      const defaults = defaultEmailSettings_();
      const settings = snapshot.exists() ? snapshot.data() : {};
      emailSettingsCache = Object.assign({}, defaults, settings, {
        orderTypesEnabled: Object.assign({}, defaults.orderTypesEnabled, settings.orderTypesEnabled || {}),
        orderTypeTemplateMap: Object.assign({}, defaults.orderTypeTemplateMap, settings.orderTypeTemplateMap || {})
      });
      renderCorreosRealtimeViews();
    }, error => console.warn('Configuración de correos no disponible:', error))
  );
  refreshCorreosClientasFromRealtime();
}

async function loadCorreos() {
  try {
    const [settings, tplSnap, logsSnap, campSnap] = await Promise.all([
      getEmailSettingsFresh_(),
      getDocsPaginated(collection(db, 'emailTemplates'), { pageSize: 100, maxDocs: 500 }),
      getDocs(query(collection(db, 'emailLogs'), orderBy('sentAt', 'desc'), limit(300))),
      getDocs(query(collection(db, 'emailCampaigns'), orderBy('createdAt', 'desc'), limit(50)))
    ]);
    const defaults = defaultEmailSettings_();
    emailSettingsCache = Object.assign({}, defaults, settings, {
      orderTypesEnabled: Object.assign({}, defaults.orderTypesEnabled, settings.orderTypesEnabled || {}),
      orderTypeTemplateMap: Object.assign({}, defaults.orderTypeTemplateMap, settings.orderTypeTemplateMap || {})
    });
    let templates = tplSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    templates = await ensureTemplatesSeeded_(templates);
    allEmailTemplates = templates;
    // Se reordena también acá (no solo confiar en orderBy de Firestore) por
    // las dudas de que falte el índice compuesto la primera vez — mismo
    // criterio defensivo que ya usa loadOrders() más abajo.
    const byDateDesc_ = (a, b) => (b.sentAt?.toDate?.() || new Date(0)) - (a.sentAt?.toDate?.() || new Date(0));
    allEmailLogs = logsSnap.docs.map(d => ({ ...d.data(), id: d.id })).sort(byDateDesc_);
    allEmailCampaigns = campSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toDate?.() || new Date(0)) - (a.createdAt?.toDate?.() || new Date(0)));

    await loadCorreosClientas();
    renderCorreosDashboard();
    renderCorreosPedidosTab();
    renderCorreosPruebaTab();
    renderCorreosPlantillasTab();
    renderCorreosHistorialTab();
    renderCorreosConfigTab();
    startCorreosRealtimeListeners();
  } catch (e) {
    console.error('Error al cargar Correos:', e);
    toast('Error al cargar el módulo Correos: ' + e.message);
  }
}

async function loadCorreosClientas() {
  refreshCorreosClientasFromRealtime();
}

// ---- Dashboard ----
function renderCorreosDashboard() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const logsToday = allEmailLogs.filter(l => { const d = l.sentAt?.toDate?.(); return d && d >= today; });
  const sentToday = logsToday.filter(l => l.status === 'sent').length;
  const failedToday = logsToday.filter(l => l.status === 'failed').length;
  const pendingCampaigns = allEmailCampaigns.filter(c => c.status === 'sending').length;

  const statsEl = document.getElementById('correos-stats');
  if (statsEl) statsEl.innerHTML = [
    { label: 'Enviados hoy', val: sentToday },
    { label: 'Fallidos hoy', val: failedToday },
    { label: 'Pendientes', val: pendingCampaigns },
  ].map(s => `<div class="adm-stat"><div class="adm-stat-val">${s.val}</div><div class="adm-stat-label">${s.label}</div></div>`).join('');

  const s = emailSettingsCache || defaultEmailSettings_();
  const webhookConfigured = typeof EMAIL_WEBHOOK_URL === 'string' && EMAIL_WEBHOOK_URL && !EMAIL_WEBHOOK_URL.includes('PEGAR_');
  const chip = (label, on) => `<div><strong>${label}:</strong> <span class="adm-badge ${on ? 'badge-entregado' : 'badge-cancelado'}">${on ? 'Activado' : 'Desactivado'}</span></div>`;
  const statusEl = document.getElementById('correos-system-status');
  if (statusEl) statusEl.innerHTML =
    `<div><strong>Remitente actual:</strong> ${escapeHtmlAdmin(s.senderEmail || EMAIL_SENDER_ADDRESS)}</div>` +
    `<div><strong>Webhook configurado:</strong> <span class="adm-badge ${webhookConfigured ? 'badge-entregado' : 'badge-cancelado'}">${webhookConfigured ? 'Sí' : 'No'}</span></div>` +
    chip('Envío de pedidos', s.orderEmailsEnabled !== false) +
    chip('Envío de pruebas', s.testEmailsEnabled !== false) +
    chip('Envío promocional', s.promoEnabled !== false);

  const tbody = document.getElementById('correos-dash-recent');
  if (tbody) {
    const recent = allEmailLogs.slice(0, 5);
    tbody.innerHTML = recent.length ? recent.map(l => `
      <tr>
        <td data-label="Fecha" style="white-space:nowrap;font-size:12px">${formatDate(l.sentAt)}</td>
        <td data-label="Tipo" style="font-size:12px">${escapeHtmlAdmin(templateLabel_(l.type))}</td>
        <td data-label="Destinatario" style="font-size:12px">${escapeHtmlAdmin(l.recipient || '—')}</td>
        <td data-label="Estado">${logStatusBadge_(l.status)}</td>
      </tr>
    `).join('') : '<tr><td colspan="4" style="text-align:center;color:#aaa;padding:24px">Sin envíos todavía</td></tr>';
  }
}

// ---- Correos de pedidos ----
function templatesForCategory_(cat) {
  return allEmailTemplates.filter(t => t.category === cat && !t.archived);
}

function renderCorreosPedidosTab() {
  const s = emailSettingsCache || defaultEmailSettings_();
  const tbody = document.getElementById('correos-pedidos-tbody');
  if (!tbody) return;
  const options = templatesForCategory_('pedido').concat(templatesForCategory_('libre'));
  tbody.innerHTML = ORDER_TYPE_KEYS.map(key => {
    const enabled = !!(s.orderTypesEnabled && s.orderTypesEnabled[key]);
    const tplKey = (s.orderTypeTemplateMap && s.orderTypeTemplateMap[key]) || key;
    const lastLog = allEmailLogs.find(l => l.type === key);
    const lastSent = lastLog ? `${formatDate(lastLog.sentAt)} · ${escapeHtmlAdmin(lastLog.recipient || '')}` : '—';
    const tplOptionsHtml = options.map(t => `<option value="${t.key || t.id}" ${((t.key || t.id) === tplKey) ? 'selected' : ''}>${t.name}</option>`).join('');
    return `
      <tr>
        <td class="col-select" data-label="Sel."><input type="checkbox" class="cop-row-check" data-key="${key}" onclick="toggleOrderTypeSelect(this)" ${_selectedOrderTypes.has(key) ? 'checked' : ''}></td>
        <td data-label="Tipo">${ORDER_TYPE_NAMES[key]}</td>
        <td data-label="Activo"><label class="adm-toggle" style="width:40px;height:22px"><input type="checkbox" ${enabled ? 'checked' : ''} ${adminEventAttributes('change','toggleOrderTypeEnabled',[key,{control:'checked'}])}><span class="adm-toggle-slider"></span></label></td>
        <td data-label="Plantilla"><select class="adm-select" style="width:auto;font-size:12px" ${adminEventAttributes('change','setOrderTypeTemplate',[key,{control:'value'}])}>${tplOptionsHtml}</select></td>
        <td data-label="Último envío" style="font-size:12px">${lastSent}</td>
        <td data-label="Vista previa"><button class="adm-btn adm-btn-sm adm-btn-outline" ${adminEventAttributes('click','previewOrderType',[key])} type="button">Ver</button></td>
      </tr>
    `;
  }).join('');
  updateOrderTypeBulkToolbar();
}

// ══════════════════════════════════════════════
// CORREOS DE PEDIDOS: SELECCIÓN MÚLTIPLE Y ACTIVAR/DESACTIVAR MASIVO
// ══════════════════════════════════════════════
let _selectedOrderTypes = new Set();

window.toggleSelectAllOrderTypes = function(masterCb) {
  document.querySelectorAll('.cop-row-check').forEach(cb => {
    cb.checked = masterCb.checked;
    if (masterCb.checked) _selectedOrderTypes.add(cb.dataset.key);
    else _selectedOrderTypes.delete(cb.dataset.key);
  });
  updateOrderTypeBulkToolbar();
};

window.toggleOrderTypeSelect = function(cb) {
  if (cb.checked) _selectedOrderTypes.add(cb.dataset.key);
  else _selectedOrderTypes.delete(cb.dataset.key);
  updateOrderTypeBulkToolbar();
};

function updateOrderTypeBulkToolbar() {
  const count = _selectedOrderTypes.size;
  const toolbar = document.getElementById('cop-bulk-toolbar');
  const countEl = document.getElementById('cop-bulk-count');
  if (toolbar) toolbar.classList.toggle('show', count > 0);
  if (countEl) countEl.textContent = `${count} seleccionado${count !== 1 ? 's' : ''}`;
}

window.clearOrderTypeSelection = function() {
  _selectedOrderTypes.clear();
  document.querySelectorAll('.cop-row-check').forEach(cb => cb.checked = false);
  const master = document.getElementById('check-all-cop');
  if (master) { master.checked = false; master.indeterminate = false; }
  updateOrderTypeBulkToolbar();
};

// Los dos correos "recibido" son el envío REAL del checkout — si están en la
// selección al desactivar en lote, se avisa explícitamente antes de aplicar
// (mismo riesgo que ya existe al desactivarlos de a uno, pero acá puede pasar
// sin querer si se seleccionaron todas las filas con "Seleccionar todos").
window.bulkSetOrderTypeEnabled = async function(enabled) {
  if (!_selectedOrderTypes.size) return;
  const keys = [..._selectedOrderTypes];
  const n = keys.length;
  const includesReal = keys.includes('pedido_recibido_clienta') || keys.includes('pedido_recibido_tintin');
  let msg = `¿${enabled ? 'Activar' : 'Desactivar'} ${n} tipo(s) de correo?`;
  if (!enabled && includesReal) msg += '\n\n⚠️ La selección incluye "Pedido recibido" — desactivarlo corta el correo REAL que ya manda el checkout.';
  if (!confirm(msg)) return;
  try {
    emailSettingsCache = emailSettingsCache || defaultEmailSettings_();
    keys.forEach(key => { emailSettingsCache.orderTypesEnabled[key] = enabled; });
    await saveEmailSettingsMerge_({ orderTypesEnabled: emailSettingsCache.orderTypesEnabled });
    logAudit('config_correo_pedido', 'correo_pedido', '', '', `${n} tipo(s) → ${enabled ? 'activados' : 'desactivados'}`, { bulk: true, count: n });
    toast(`${n} tipo(s) de correo ${enabled ? 'activados' : 'desactivados'}`);
    clearOrderTypeSelection();
    renderCorreosPedidosTab();
    renderCorreosDashboard();
  } catch (e) { toast('Error: ' + e.message); }
};

window.toggleOrderTypeEnabled = async (key, checked) => {
  emailSettingsCache.orderTypesEnabled[key] = checked;
  await saveEmailSettingsMerge_({ orderTypesEnabled: emailSettingsCache.orderTypesEnabled });
  toast(`${ORDER_TYPE_NAMES[key]}: ${checked ? 'activado' : 'desactivado'}`);
  renderCorreosPedidosTab();
  renderCorreosDashboard();
};
window.setOrderTypeTemplate = async (key, tplKey) => {
  emailSettingsCache.orderTypeTemplateMap[key] = tplKey;
  await saveEmailSettingsMerge_({ orderTypeTemplateMap: emailSettingsCache.orderTypeTemplateMap });
  toast('Plantilla asociada actualizada');
};
window.previewOrderType = (key) => {
  const tplKey = (emailSettingsCache.orderTypeTemplateMap && emailSettingsCache.orderTypeTemplateMap[key]) || key;
  const tpl = allEmailTemplates.find(t => (t.key || t.id) === tplKey);
  if (!tpl) { toast('Plantilla no encontrada'); return; }
  openTplPreview_(tpl, fakeTestVariables_());
};

// ---- Correos de prueba ----
// Cooldown fijo de 2 minutos + límite diario configurable — la lectura de
// emailLogs para calcularlo acá es segura porque Correos es 100% exclusivo
// de Super Admin (nunca lo abre admin/agent), así que allEmailLogs siempre
// está disponible. Apps Script vuelve a exigir lo mismo del lado del
// servidor, así que esto es solo para avisar ANTES de intentar el envío.
const TEST_EMAIL_COOLDOWN_SECONDS = 120;
// Acepta un Timestamp real de Firestore (.toDate()) o un valor ya utilizable
// directamente (Date/ISO string) — mismo criterio dual que ya usa el resto
// del admin para createdAt/lastResendAt en todo el código.
function testEmailGuardStatus_() {
  const s = emailSettingsCache || defaultEmailSettings_();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const testLogsSent = allEmailLogs.filter(l => (l.category || 'pedido') === 'prueba' && l.status === 'sent');
  const sentToday = testLogsSent.filter(l => { const d = toJsDate_(l.sentAt); return d && d >= todayStart; }).length;
  const lastSent = testLogsSent.reduce((max, l) => { const d = toJsDate_(l.sentAt); return d && (!max || d > max) ? d : max; }, null);
  const cooldownRemaining = lastSent ? Math.max(0, Math.ceil((TEST_EMAIL_COOLDOWN_SECONDS * 1000 - (Date.now() - lastSent.getTime())) / 1000)) : 0;
  const dailyLimit = s.testDailyLimit || 20;
  return { cooldownRemaining, sentToday, dailyLimit, limitReached: sentToday >= dailyLimit };
}
function renderTestEmailLimitInfo_() {
  const el = document.getElementById('test-email-limit-info');
  if (!el) return;
  const g = testEmailGuardStatus_();
  const parts = [`${g.sentToday}/${g.dailyLimit} pruebas enviadas hoy`];
  if (g.cooldownRemaining > 0) parts.push(`próximo envío disponible en ${g.cooldownRemaining}s`);
  el.textContent = parts.join(' · ');
  el.style.color = (g.limitReached || g.cooldownRemaining > 0) ? '#c0392b' : 'var(--adm-muted)';
}

function renderCorreosPruebaTab() {
  const s = emailSettingsCache || defaultEmailSettings_();
  const toggle = document.getElementById('prueba-enabled-toggle');
  if (toggle) toggle.checked = s.testEmailsEnabled !== false;

  const cliSelect = document.getElementById('prueba-cliente-select');
  if (cliSelect) {
    cliSelect.innerHTML = '<option value="">Elegí una clienta…</option>' +
      allClientUsers.map(c => `<option value="${escapeHtmlAdmin(c.email)}">${escapeHtmlAdmin(c.name || c.email)} (${escapeHtmlAdmin(c.email)})</option>`).join('');
  }

  const tplSelect = document.getElementById('prueba-template-select');
  if (tplSelect) {
    const activeTpls = allEmailTemplates.filter(t => !t.archived);
    tplSelect.innerHTML = activeTpls.map(t => `<option value="${t.key || t.id}" ${((t.key || t.id) === 'pedido_recibido_clienta') ? 'selected' : ''}>${t.name}</option>`).join('');
  }
  renderTestEmailLimitInfo_();
}

document.querySelectorAll('[data-prueba-mode]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-prueba-mode]').forEach(b => b.classList.toggle('active', b === btn));
    const mode = btn.dataset.pruebaMode;
    document.getElementById('prueba-mode-manual').style.display = mode === 'manual' ? '' : 'none';
    document.getElementById('prueba-mode-cliente').style.display = mode === 'cliente' ? '' : 'none';
  });
});

function resolveTestEmailTarget_() {
  const activeBtn = document.querySelector('[data-prueba-mode].active');
  const mode = activeBtn ? activeBtn.dataset.pruebaMode : 'manual';
  if (mode === 'cliente') return document.getElementById('prueba-cliente-select').value.trim();
  return document.getElementById('test-email-input').value.trim();
}

document.getElementById('prueba-enabled-toggle').onchange = async (e) => {
  emailSettingsCache = emailSettingsCache || defaultEmailSettings_();
  emailSettingsCache.testEmailsEnabled = e.target.checked;
  await saveEmailSettingsMerge_({ testEmailsEnabled: e.target.checked });
  toast(`Correos de prueba: ${e.target.checked ? 'activados' : 'desactivados'}`);
};

document.getElementById('btn-test-email').onclick = async () => {
  const resultEl = document.getElementById('test-email-result');
  const btn = document.getElementById('btn-test-email');
  const email = resolveTestEmailTarget_();

  if (emailSettingsCache && emailSettingsCache.testEmailsEnabled === false) {
    resultEl.style.color = '#c0392b';
    resultEl.textContent = 'Los envíos de prueba están desactivados en Correos → Configuración.';
    return;
  }
  if (!TEST_EMAIL_RE.test(email)) {
    resultEl.style.color = '#c0392b';
    resultEl.textContent = 'Escribí (o elegí) un email con formato válido.';
    return;
  }

  // Protección anti-spam de la cuenta: cooldown de 2 minutos + límite diario
  // configurable — se revisa ANTES de llamar al webhook, para no gastar el
  // envío ni el intento. Apps Script vuelve a exigir lo mismo del lado del
  // servidor (no se puede saltear llamando directo con el secreto).
  const guard = testEmailGuardStatus_();
  if (guard.cooldownRemaining > 0) {
    resultEl.style.color = '#c0392b';
    resultEl.textContent = `Esperá ${guard.cooldownRemaining}s antes de enviar otra prueba — cooldown anti-spam de 2 minutos.`;
    return;
  }
  if (guard.limitReached) {
    resultEl.style.color = '#c0392b';
    resultEl.textContent = `Se alcanzó el límite diario de correos de prueba (${guard.sentToday}/${guard.dailyLimit}). No se envió nada. Podés subir el límite en Correos → Configuración.`;
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Enviando…';
  resultEl.style.color = 'var(--adm-muted)';
  resultEl.textContent = '';

  const tplKey = document.getElementById('prueba-template-select').value;
  const isDefaultDesign = tplKey === 'pedido_recibido_clienta';
  try {
    let result;
    const vars = fakeTestVariables_();
    const testDailyLimit = (emailSettingsCache || defaultEmailSettings_()).testDailyLimit || 20;
    if (isDefaultDesign) {
      result = await sendTestCustomerEmail(email);
    } else {
      // isTest:true hace que Apps Script le aplique el MISMO cooldown/tope
      // diario que sendTestCustomerEmail, aunque viaje por sendPromoEmail
      // (la función genérica de un solo destinatario) — si no, elegir
      // cualquier plantilla que no sea "Pedido recibido (clienta)" acá
      // saltearía la protección por completo.
      const tpl = allEmailTemplates.find(t => (t.key || t.id) === tplKey);
      result = await sendTemplatedEmail({ to: email, ...templateContentPayload_(tpl || {}), variables: vars, isTest: true, testDailyLimit });
    }
    if (result && result.success) {
      resultEl.style.color = '#065f46';
      resultEl.textContent = 'Correo de prueba enviado correctamente.';
    } else {
      resultEl.style.color = '#c0392b';
      resultEl.textContent = 'No se pudo enviar el correo de prueba' + (result?.error ? ': ' + (emailErrorMessage_(result.error) || result.error) : '.');
    }
    await logEmailSend_({ category: 'prueba', type: tplKey, recipient: email, status: result?.success ? 'sent' : 'failed', templateKey: tplKey, isAutomatic: false, error: result?.error || '', variables: vars });
  } catch (e) {
    resultEl.style.color = '#c0392b';
    resultEl.textContent = 'No se pudo enviar el correo de prueba: ' + e.message;
    await logEmailSend_({ category: 'prueba', type: tplKey, recipient: email, status: 'failed', templateKey: tplKey, isAutomatic: false, error: e.message });
  } finally {
    btn.disabled = false;
    btn.textContent = 'Enviar prueba';
    renderTestEmailLimitInfo_();
  }
};

document.getElementById('btn-test-preview').onclick = () => {
  const tplKey = document.getElementById('prueba-template-select').value;
  const tpl = allEmailTemplates.find(t => (t.key || t.id) === tplKey);
  if (!tpl) { toast('Elegí una plantilla'); return; }
  openTplPreview_(tpl, fakeTestVariables_());
};

// ---- Vista previa (modal compartido) ----
function openTplPreview_(tpl, vars) {
  const html = buildPreviewHtml_(tpl, vars);
  document.getElementById('tpl-preview-subject').textContent = renderVarsClient_(tpl.subject, vars);
  document.getElementById('tpl-preview-frame').srcdoc = html;
  document.getElementById('tpl-preview-overlay').style.display = '';
}
window.closeTplPreview = () => { document.getElementById('tpl-preview-overlay').style.display = 'none'; };

window.previewTemplateById = (id) => {
  const t = allEmailTemplates.find(x => x.id === id);
  if (!t) return;
  const overlayOpen = document.getElementById('tpl-edit-overlay').style.display !== 'none' && document.getElementById('tpl-edit-id').value === id;
  const draft = overlayOpen ? {
    ...t,
    subject: document.getElementById('tpl-edit-subject').value,
    greeting: document.getElementById('tpl-edit-greeting').value,
    intro: document.getElementById('tpl-edit-intro').value,
    promoText: document.getElementById('tpl-edit-promo').value,
    closing: document.getElementById('tpl-edit-closing').value,
    signature: document.getElementById('tpl-edit-signature').value,
    buttonText: document.getElementById('tpl-edit-button-text').value,
    buttonUrl: document.getElementById('tpl-edit-button-url').value,
    brandPhrase: document.getElementById('tpl-edit-brand').value,
    footer: document.getElementById('tpl-edit-footer').value,
  } : t;
  openTplPreview_(draft, fakeTestVariables_());
};

// ---- Plantillas (CRUD) ----
function renderCorreosPlantillasTab() {
  let list = allEmailTemplates.slice();
  if (!tplShowArchived) list = list.filter(t => !t.archived);
  if (tplFilterCategory) list = list.filter(t => t.category === tplFilterCategory);
  if (tplSearchQuery) list = list.filter(t => (t.name || '').toLowerCase().includes(tplSearchQuery) || (t.subject || '').toLowerCase().includes(tplSearchQuery));
  list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const tbody = document.getElementById('tpl-tbody');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#aaa;padding:24px">Sin plantillas para mostrar</td></tr>';
    return;
  }
  const visibleIds = new Set(list.map(t => t.id));
  [..._selectedTemplates].forEach(id => { if (!visibleIds.has(id)) _selectedTemplates.delete(id); });
  const CAT_LABELS = { pedido: 'Pedidos', promo: 'Promociones', libre: 'Mensaje libre' };
  tbody.innerHTML = list.map(t => {
    const id = t.id;
    const isCustom = !t.key;
    return `
      <tr style="${t.archived ? 'opacity:.55' : ''}">
        <td class="col-select" data-label="Sel."><input type="checkbox" class="tpl-row-check" data-id="${id}" onclick="toggleTemplateSelect(this)" ${_selectedTemplates.has(id) ? 'checked' : ''}></td>
        <td data-label="Plantilla"><strong>${t.name}</strong><br><small style="color:#aaa">${(t.subject || '').slice(0, 60)}</small></td>
        <td data-label="Categoría"><span class="adm-badge badge-confirmado">${CAT_LABELS[t.category] || t.category}</span></td>
        <td data-label="Activa">${t.active !== false ? '<span class="adm-badge badge-entregado">Activa</span>' : '<span class="adm-badge badge-cancelado">Inactiva</span>'}</td>
        <td data-label="Últ. edición" style="font-size:12px">${formatDate(t.updatedAt)}</td>
        <td data-label="Editado por" style="font-size:12px">${t.updatedBy || '—'}</td>
        <td data-label="Acciones">
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="adm-btn adm-btn-sm adm-btn-outline" ${adminEventAttributes('click','openTplEdit',[id])} type="button">Editar</button>
            <button class="adm-btn adm-btn-sm adm-btn-outline" ${adminEventAttributes('click','previewTemplateById',[id])} type="button">Vista previa</button>
            <button class="adm-btn adm-btn-sm adm-btn-outline" ${adminEventAttributes('click','duplicateTemplate',[id])} type="button">Duplicar</button>
            <button class="adm-btn adm-btn-sm adm-btn-outline" ${adminEventAttributes('click','toggleArchiveTemplate',[id])} type="button">${t.archived ? 'Reactivar' : 'Archivar'}</button>
            ${isCustom ? `<button class="adm-btn adm-btn-sm adm-btn-danger" ${adminEventAttributes('click','deleteTemplate',[id])} type="button">Eliminar</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
  updateTemplatesBulkToolbar();
}

document.getElementById('tpl-search').oninput = (e) => { tplSearchQuery = e.target.value.toLowerCase(); renderCorreosPlantillasTab(); };
document.getElementById('tpl-filter-category').onchange = (e) => { tplFilterCategory = e.target.value; renderCorreosPlantillasTab(); };
document.getElementById('tpl-show-archived').onchange = (e) => { tplShowArchived = e.target.checked; renderCorreosPlantillasTab(); };

// ══════════════════════════════════════════════
// PLANTILLAS: SELECCIÓN MÚLTIPLE Y ACCIONES MASIVAS
// ══════════════════════════════════════════════
let _selectedTemplates = new Set();

window.toggleSelectAllTemplates = function(masterCb) {
  document.querySelectorAll('.tpl-row-check').forEach(cb => {
    if (masterCb.checked) cb.checked = addAdminBulkSelection(_selectedTemplates, cb.dataset.id, true, 'plantillas');
    else { cb.checked = false; _selectedTemplates.delete(cb.dataset.id); }
  });
  updateTemplatesBulkToolbar();
};

window.toggleTemplateSelect = function(cb) {
  cb.checked = addAdminBulkSelection(_selectedTemplates, cb.dataset.id, cb.checked, 'plantillas');
  updateTemplatesBulkToolbar();
};

function updateTemplatesBulkToolbar() {
  const count = _selectedTemplates.size;
  const toolbar = document.getElementById('tpl-bulk-toolbar');
  const countEl = document.getElementById('tpl-bulk-count');
  if (toolbar) toolbar.classList.toggle('show', count > 0);
  if (countEl) countEl.textContent = `${count} seleccionada${count !== 1 ? 's' : ''}`;
}

window.clearTemplatesSelection = function() {
  _selectedTemplates.clear();
  document.querySelectorAll('.tpl-row-check').forEach(cb => cb.checked = false);
  const master = document.getElementById('check-all-tpl');
  if (master) { master.checked = false; master.indeterminate = false; }
  updateTemplatesBulkToolbar();
};

window.bulkArchiveTemplates = async function(archived) {
  if (!_selectedTemplates.size) return;
  const n = _selectedTemplates.size;
  const label = archived ? 'archivar' : 'reactivar';
  if (!confirm(`¿${label.charAt(0).toUpperCase() + label.slice(1)} ${n} plantilla(s)?`)) return;
  try {
    const ids = [..._selectedTemplates];
    await batchUpdateChunked(ids, () => ({ archived, updatedAt: serverTimestamp(), updatedBy: getCurrentUser()?.email || '' }), 'emailTemplates');
    ids.forEach(id => { const t = allEmailTemplates.find(x => x.id === id); if (t) t.archived = archived; });
    logAudit('plantilla_archivada', 'plantilla', '', '', archived ? 'Archivadas' : 'Reactivadas', { bulk: true, count: n });
    toast(`${n} plantilla(s) ${archived ? 'archivadas' : 'reactivadas'}`);
    clearTemplatesSelection();
    renderCorreosPlantillasTab();
    renderCorreosPedidosTab();
    renderCorreosPruebaTab();
    renderCorreosPromocionesTab();
  } catch (e) { toast('Error: ' + e.message); }
};

// Solo elimina las plantillas personalizadas de la selección (las de sistema
// —con `key`— nunca se eliminan, ni de a una ni en lote, solo se archivan).
window.bulkDeleteTemplates = async function() {
  if (!_selectedTemplates.size) return;
  if (rejectOversizedAdminBulkSelection(_selectedTemplates, 'plantillas')) return;
  const ids = [..._selectedTemplates].filter(id => { const t = allEmailTemplates.find(x => x.id === id); return t && !t.key; });
  if (!ids.length) { toast('La selección solo tiene plantillas de sistema — esas no se pueden eliminar, solo archivar.'); return; }
  const n = ids.length;
  if (!confirm(`¿ELIMINAR DEFINITIVAMENTE ${n} plantilla(s) personalizada(s)? Esta acción no se puede deshacer.`)) return;
  try {
    const CHUNK = 450;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const batch = writeBatch(db);
      ids.slice(i, i + CHUNK).forEach(id => batch.delete(doc(db, 'emailTemplates', id)));
      await withAdminSiteChange(async () => batch.commit());
    }
    const idSet = new Set(ids);
    allEmailTemplates = allEmailTemplates.filter(t => !idSet.has(t.id));
    logAudit('plantilla_eliminada', 'plantilla', '', '', `${n} plantillas eliminadas`, { bulk: true, count: n });
    toast(`${n} plantilla(s) eliminadas definitivamente`);
    clearTemplatesSelection();
    renderCorreosPlantillasTab();
    renderCorreosPromocionesTab();
  } catch (e) { toast('Error: ' + e.message); }
};

window.openTplEdit = (id) => {
  const t = allEmailTemplates.find(x => x.id === id);
  if (!t) return;
  const isCustom = !t.key;
  document.getElementById('tpl-edit-id').value = id;
  document.getElementById('tpl-edit-name').textContent = t.name ? `— ${t.name}` : '';
  document.getElementById('tpl-edit-name-field').style.display = isCustom ? '' : 'none';
  document.getElementById('tpl-edit-name-input').value = t.name || '';
  document.getElementById('tpl-edit-subject').value = t.subject || '';
  document.getElementById('tpl-edit-greeting').value = t.greeting || '';
  document.getElementById('tpl-edit-intro').value = t.intro || '';
  document.getElementById('tpl-edit-promo').value = t.promoText || '';
  document.getElementById('tpl-edit-closing').value = t.closing || '';
  document.getElementById('tpl-edit-signature').value = t.signature || '';
  document.getElementById('tpl-edit-button-text').value = t.buttonText || '';
  document.getElementById('tpl-edit-button-url').value = t.buttonUrl || '';
  document.getElementById('tpl-edit-brand').value = t.brandPhrase || '';
  document.getElementById('tpl-edit-footer').value = t.footer || '';
  document.getElementById('tpl-edit-active').checked = t.active !== false;
  document.getElementById('tpl-edit-vars-list').innerHTML = PROTECTED_VARS.map(v => `<code style="background:#fff;border:1px solid var(--adm-border);border-radius:6px;padding:2px 6px">{{${v}}}</code>`).join('');
  document.getElementById('tpl-edit-overlay').style.display = '';
  window.AdminUnsaved?.register('email-template-editor', {
    root: '#tpl-edit-overlay',
    active: () => document.getElementById('tpl-edit-overlay')?.style.display !== 'none',
    label: 'la plantilla de correo',
    save: saveTplEdit_,
  });
};
window.closeTplEdit = (force = false) => {
  if (!force && window.AdminUnsaved?.isDirty('email-template-editor')) {
    window.AdminUnsaved.requestNavigation(() => window.closeTplEdit(true), { scopeIds: ['email-template-editor'] });
    return;
  }
  document.getElementById('tpl-edit-overlay').style.display = 'none';
  window.AdminUnsaved?.unregister('email-template-editor');
};

document.getElementById('tpl-edit-preview-btn').onclick = () => {
  window.previewTemplateById(document.getElementById('tpl-edit-id').value);
};

async function saveTplEdit_() {
  const id = document.getElementById('tpl-edit-id').value;
  const t = allEmailTemplates.find(x => x.id === id);
  if (!t) return false;
  const patch = {
    subject: document.getElementById('tpl-edit-subject').value,
    greeting: document.getElementById('tpl-edit-greeting').value,
    intro: document.getElementById('tpl-edit-intro').value,
    promoText: document.getElementById('tpl-edit-promo').value,
    closing: document.getElementById('tpl-edit-closing').value,
    signature: document.getElementById('tpl-edit-signature').value,
    buttonText: document.getElementById('tpl-edit-button-text').value,
    buttonUrl: document.getElementById('tpl-edit-button-url').value,
    brandPhrase: document.getElementById('tpl-edit-brand').value,
    footer: document.getElementById('tpl-edit-footer').value,
    active: document.getElementById('tpl-edit-active').checked,
    updatedAt: serverTimestamp(), updatedBy: getCurrentUser()?.email || ''
  };
  if (!t.key) patch.name = document.getElementById('tpl-edit-name-input').value.trim() || t.name;
  try {
    await withAdminSiteChange(async () => updateDoc(doc(db, 'emailTemplates', id), patch));
    Object.assign(t, patch, { updatedAt: new Date() });
    toast('Plantilla guardada');
    window.AdminUnsaved?.markClean('email-template-editor');
    window.closeTplEdit(true);
    renderCorreosPlantillasTab();
    renderCorreosPedidosTab();
    renderCorreosPruebaTab();
    renderCorreosPromocionesTab();
    return true;
  } catch (e) {
    toast('Error al guardar la plantilla: ' + e.message);
    return false;
  }
}
document.getElementById('tpl-edit-save-btn').onclick = saveTplEdit_;

document.getElementById('tpl-edit-restore-btn').onclick = async () => {
  const id = document.getElementById('tpl-edit-id').value;
  const t = allEmailTemplates.find(x => x.id === id);
  if (!t || !t.original) { toast('No hay versión original guardada'); return; }
  if (!confirm('¿Restaurar esta plantilla a su versión original? Se pierden los cambios actuales.')) return;
  try {
    const patch = { ...t.original, updatedAt: serverTimestamp(), updatedBy: getCurrentUser()?.email || '' };
    await withAdminSiteChange(async () => updateDoc(doc(db, 'emailTemplates', id), patch));
    Object.assign(t, patch, { updatedAt: new Date() });
    toast('Plantilla restaurada a su versión original');
    window.openTplEdit(id);
    renderCorreosPlantillasTab();
  } catch (e) { toast('Error al restaurar: ' + e.message); }
};

document.getElementById('btn-tpl-nueva').onclick = async () => {
  const seed = TEMPLATE_SEEDS.mensaje_libre;
  const content = { subject: seed.subject, greeting: seed.greeting, intro: seed.intro, closing: seed.closing,
    signature: seed.signature, promoText: seed.promoText, buttonText: seed.buttonText, buttonUrl: seed.buttonUrl || '',
    brandPhrase: seed.brandPhrase, footer: seed.footer };
  try {
    const ref = await withAdminSiteChange(async () => addDoc(collection(db, 'emailTemplates'), {
      key: null, name: 'Mensaje libre (nuevo)', category: 'libre', ...content,
      active: true, archived: false, original: content,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: getCurrentUser()?.email || ''
    }));
    allEmailTemplates.push({ id: ref.id, key: null, name: 'Mensaje libre (nuevo)', category: 'libre', ...content, active: true, archived: false, original: content, updatedAt: new Date() });
    toast('Plantilla creada');
    renderCorreosPlantillasTab();
    window.openTplEdit(ref.id);
  } catch (e) { toast('Error al crear la plantilla: ' + e.message); }
};

window.duplicateTemplate = async (id) => {
  const t = allEmailTemplates.find(x => x.id === id);
  if (!t) return;
  const content = templateContentPayload_(t);
  try {
    const ref = await withAdminSiteChange(async () => addDoc(collection(db, 'emailTemplates'), {
      key: null, name: t.name + ' (copia)', category: t.category, ...content,
      active: true, archived: false, original: content,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: getCurrentUser()?.email || ''
    }));
    allEmailTemplates.push({ id: ref.id, key: null, name: t.name + ' (copia)', category: t.category, ...content, active: true, archived: false, original: content, updatedAt: new Date() });
    logAudit('plantilla_creada', 'plantilla', ref.id, t.name + ' (copia)', `Duplicada de "${t.name}"`);
    toast('Plantilla duplicada');
    renderCorreosPlantillasTab();
  } catch (e) { toast('Error al duplicar: ' + e.message); }
};

window.toggleArchiveTemplate = async (id) => {
  const t = allEmailTemplates.find(x => x.id === id);
  if (!t) return;
  const archived = !t.archived;
  try {
    await withAdminSiteChange(async () => updateDoc(doc(db, 'emailTemplates', id), { archived, updatedAt: serverTimestamp(), updatedBy: getCurrentUser()?.email || '' }));
    t.archived = archived;
    logAudit('plantilla_archivada', 'plantilla', id, t.name, archived ? 'Archivada' : 'Reactivada');
    toast(archived ? 'Plantilla archivada' : 'Plantilla reactivada');
    renderCorreosPlantillasTab();
    renderCorreosPedidosTab();
    renderCorreosPruebaTab();
    renderCorreosPromocionesTab();
  } catch (e) { toast('Error: ' + e.message); }
};

window.deleteTemplate = async (id) => {
  const t = allEmailTemplates.find(x => x.id === id);
  if (!t) return;
  if (t.key) { toast('Esta plantilla no se puede eliminar — solo archivar.'); return; }
  if (!confirm(`¿Eliminar definitivamente la plantilla "${t.name}"? Esta acción no se puede deshacer.`)) return;
  try {
    await withAdminSiteChange(async () => deleteDoc(doc(db, 'emailTemplates', id)));
    allEmailTemplates = allEmailTemplates.filter(x => x.id !== id);
    logAudit('plantilla_eliminada', 'plantilla', id, t.name);
    toast('Plantilla eliminada');
    renderCorreosPlantillasTab();
    renderCorreosPromocionesTab();
  } catch (e) { toast('Error al eliminar: ' + e.message); }
};

// ---- Clientas registradas ----
function filteredClients_() {
  const q = (document.getElementById('cli-search').value || '').toLowerCase();
  const filterVal = document.getElementById('cli-filter').value;
  let list = allClientUsers.filter(c => (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q));
  if (filterVal === 'active') list = list.filter(c => !c.blocked);
  if (filterVal === 'blocked') list = list.filter(c => c.blocked);
  if (filterVal === 'with_orders') list = list.filter(c => c.orderCount > 0);
  if (filterVal === 'without_orders') list = list.filter(c => !c.orderCount);
  return list;
}

function renderCorreosClientasTab() {
  const list = filteredClients_();
  const tbody = document.getElementById('cli-tbody');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#aaa;padding:24px">Sin clientas para mostrar</td></tr>';
  } else {
    tbody.innerHTML = list.map(c => {
      const checked = cliSelected.has(c.email) ? 'checked' : '';
      const disabledAttr = c.blocked ? 'disabled title="No se puede seleccionar una clienta bloqueada"' : '';
      const optIn = c.marketingOptIn === false ? 'No' : (c.marketingOptIn === true ? 'Sí' : 'No especificado');
      return `
        <tr class="adm-cliente-row">
          <td data-label="Sel."><input type="checkbox" ${checked} ${disabledAttr} ${adminEventAttributes('change','toggleClientSelected',[String(c.email ?? ''),{control:'checked'}])} /></td>
          <td data-label="Nombre"><strong>${escapeHtmlAdmin(c.name || '—')}</strong></td>
          <td data-label="Email" style="font-size:12px">${escapeHtmlAdmin(c.email || '—')}</td>
          <td data-label="Teléfono" style="font-size:12px">${escapeHtmlAdmin(c.phone || '—')}</td>
          <td data-label="Registro" style="font-size:12px">${c.createdAt ? formatDate(c.createdAt) : '—'}</td>
          <td data-label="Pedidos">${c.orderCount || 0}</td>
          <td data-label="Últ. compra" style="font-size:12px">${c.lastPurchase ? c.lastPurchase.toLocaleDateString('es-PY') : '—'}</td>
          <td data-label="Estado">${c.blocked ? '<span class="adm-badge badge-cancelado">Bloqueada</span>' : '<span class="adm-badge badge-entregado">Activa</span>'}</td>
          <td data-label="Promos" style="font-size:12px">${optIn}</td>
        </tr>
      `;
    }).join('');
  }
  updateClientSelectionCount_();
}

window.toggleClientSelected = (email, checked) => {
  if (checked) cliSelected.add(email); else cliSelected.delete(email);
  updateClientSelectionCount_();
};
function updateClientSelectionCount_() {
  const el = document.getElementById('cli-selected-count');
  if (el) el.textContent = `${cliSelected.size} seleccionadas`;
}

document.getElementById('cli-search').oninput = () => renderCorreosClientasTab();
document.getElementById('cli-filter').onchange = () => renderCorreosClientasTab();
document.getElementById('cli-select-all').onchange = (e) => {
  const list = filteredClients_().filter(c => !c.blocked);
  if (e.target.checked) list.forEach(c => cliSelected.add(c.email));
  else list.forEach(c => cliSelected.delete(c.email));
  renderCorreosClientasTab();
};
document.getElementById('cli-clear-selection').onclick = () => { cliSelected.clear(); renderCorreosClientasTab(); };
document.getElementById('cli-use-in-promo').onclick = () => {
  promoRecipients = Array.from(cliSelected).map(email => {
    const c = allClientUsers.find(x => x.email === email);
    return { email, name: c?.name || '' };
  });
  renderCorreosPromocionesTab();
  toast(`${promoRecipients.length} destinatarias cargadas en Promociones`);
  document.querySelector('[data-correos-tab="promociones"]').click();
};

// ---- Promociones ----
function promoTemplateIds_() { return allEmailTemplates.filter(t => t.category === 'promo').map(t => t.id); }

function renderCorreosPromocionesTab() {
  const s = emailSettingsCache || defaultEmailSettings_();
  const gmailSender = isGmailSender_(s.senderEmail || EMAIL_SENDER_ADDRESS);
  const toggle = document.getElementById('promo-enabled-toggle');
  if (toggle) { toggle.checked = gmailSender ? false : (s.promoEnabled !== false); toggle.disabled = gmailSender; }

  const tplSelect = document.getElementById('promo-template-select');
  if (tplSelect) {
    const promoTemplates = allEmailTemplates.filter(t => (t.category === 'promo' || t.category === 'libre') && !t.archived && t.active !== false);
    tplSelect.innerHTML = promoTemplates.map(t => `<option value="${t.id}">${escapeHtmlAdmin(t.name)}</option>`).join('');
  }
  document.getElementById('promo-gmail-lock-banner').style.display = gmailSender ? '' : 'none';
  ['promo-template-select', 'promo-add-email', 'promo-add-email-btn', 'promo-preview-btn', 'promo-open-confirm-btn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = gmailSender;
  });
  renderPromoChips_();
}

function renderPromoChips_() {
  const wrap = document.getElementById('promo-recipients-chips');
  if (!wrap) return;
  wrap.innerHTML = promoRecipients.map((r, i) => {
    const c = allClientUsers.find(x => x.email.toLowerCase() === r.email.toLowerCase());
    const blockedClass = c && c.blocked ? ' blocked' : '';
    return `<span class="correos-chip${blockedClass}"><span>${r.name ? escapeHtmlAdmin(r.name) + ' — ' : ''}${escapeHtmlAdmin(r.email)}${c && c.blocked ? ' (bloqueada)' : ''}</span><button ${adminEventAttributes('click','removePromoRecipient',[i])} title="Quitar" type="button"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></span>`;
  }).join('');
  const countEl = document.getElementById('promo-recipients-count');
  if (countEl) countEl.textContent = `${promoRecipients.length} destinatarias`;
}
window.removePromoRecipient = (i) => { promoRecipients.splice(i, 1); renderPromoChips_(); };

document.getElementById('promo-enabled-toggle').onchange = async (e) => {
  const s = emailSettingsCache || defaultEmailSettings_();
  if (isGmailSender_(s.senderEmail || EMAIL_SENDER_ADDRESS)) {
    e.target.checked = false;
    toast('No se puede activar: el remitente actual es una cuenta de Gmail común, reservada para correos transaccionales.');
    return;
  }
  emailSettingsCache = emailSettingsCache || defaultEmailSettings_();
  emailSettingsCache.promoEnabled = e.target.checked;
  await saveEmailSettingsMerge_({ promoEnabled: e.target.checked });
  toast(`Promociones: ${e.target.checked ? 'activadas' : 'desactivadas'}`);
};

document.getElementById('promo-add-email-btn').onclick = () => {
  const input = document.getElementById('promo-add-email');
  const email = input.value.trim();
  if (!TEST_EMAIL_RE.test(email)) { toast('Email con formato inválido'); return; }
  const client = allClientUsers.find(c => c.email.toLowerCase() === email.toLowerCase());
  if (client && client.blocked) { toast('No se puede agregar: esa clienta está bloqueada'); return; }
  if (promoRecipients.some(r => r.email.toLowerCase() === email.toLowerCase())) { toast('Ya está en la lista'); return; }
  promoRecipients.push({ email, name: client?.name || '' });
  input.value = '';
  renderPromoChips_();
};

document.getElementById('promo-preview-btn').onclick = () => {
  const tplId = document.getElementById('promo-template-select').value;
  const t = allEmailTemplates.find(x => x.id === tplId);
  if (!t) { toast('Elegí una plantilla'); return; }
  const first = promoRecipients[0];
  openTplPreview_(t, { ...fakeTestVariables_(), clienteNombre: first?.name || 'Cliente de prueba' });
};

document.getElementById('promo-open-confirm-btn').onclick = async () => {
  const s = emailSettingsCache || defaultEmailSettings_();
  if (isGmailSender_(s.senderEmail || EMAIL_SENDER_ADDRESS)) { toast('Promociones bloqueado: el remitente actual es una cuenta de Gmail común, reservada para correos transaccionales de pedidos.'); return; }
  if (s.promoEnabled === false) { toast('Las promociones están desactivadas en Correos → Configuración'); return; }
  const tplId = document.getElementById('promo-template-select').value;
  const tpl = allEmailTemplates.find(x => x.id === tplId);
  if (!tpl) { toast('Elegí una plantilla promocional'); return; }
  if (!promoRecipients.length) { toast('Agregá al menos una destinataria'); return; }

  const safeRecipients = promoRecipients.filter(r => {
    const c = allClientUsers.find(x => x.email.toLowerCase() === r.email.toLowerCase());
    if (c && c.blocked) return false;
    if (c && c.marketingOptIn === false) return false;
    return true;
  });
  const excludedCount = promoRecipients.length - safeRecipients.length;
  if (!safeRecipients.length) { toast('No hay destinatarias válidas para enviar (revisá bloqueadas / sin consentimiento)'); return; }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const sentToday = allEmailLogs.filter(l => {
    const d = l.sentAt?.toDate?.();
    return d && d >= today && l.status === 'sent' && l.type === 'promo';
  }).length;
  const dailyLimit = s.promoDailyLimit || 100;
  const remaining = Math.max(0, dailyLimit - sentToday);
  const warnEl = document.getElementById('promo-confirm-warning');
  const sendBtn = document.getElementById('promo-confirm-send-btn');
  if (safeRecipients.length > remaining) {
    warnEl.style.display = '';
    warnEl.textContent = `Ya se enviaron ${sentToday} promociones hoy — el límite diario es ${dailyLimit}. Con esta lista (${safeRecipients.length}) se superaría el límite. Reducí la lista a ${remaining} o menos, o subí el límite en Configuración.`;
    sendBtn.dataset.blocked = '1';
  } else {
    if (safeRecipients.length > 20) {
      warnEl.style.display = '';
      warnEl.textContent = `Vas a enviar esta promoción a ${safeRecipients.length} destinatarias.`;
    } else {
      warnEl.style.display = 'none';
    }
    sendBtn.dataset.blocked = '';
  }

  document.getElementById('promo-confirm-summary').innerHTML =
    `Plantilla: <strong>${escapeHtmlAdmin(tpl.name)}</strong><br>Destinatarias: <strong>${safeRecipients.length}</strong>` +
    (excludedCount ? `<br><span style="color:#c0392b">${excludedCount} excluida(s) automáticamente (bloqueada o sin consentimiento)</span>` : '');
  document.getElementById('promo-confirm-input').value = '';
  sendBtn.disabled = true;
  promoPendingSend = { tpl, recipients: safeRecipients };
  document.getElementById('promo-confirm-overlay').style.display = 'flex';
};

window.closePromoConfirm = () => { document.getElementById('promo-confirm-overlay').style.display = 'none'; promoPendingSend = null; };

document.getElementById('promo-confirm-input').oninput = (e) => {
  const btn = document.getElementById('promo-confirm-send-btn');
  const blocked = btn.dataset.blocked === '1';
  btn.disabled = blocked || e.target.value.trim() !== 'CONFIRMAR';
};

document.getElementById('promo-confirm-send-btn').onclick = async () => {
  if (!promoPendingSend) return;
  const { tpl, recipients } = promoPendingSend;
  document.getElementById('promo-confirm-overlay').style.display = 'none';
  promoPendingSend = null;
  await runPromoCampaign_(tpl, recipients);
};

async function runPromoCampaign_(tpl, recipients) {
  const sendBtn = document.getElementById('promo-open-confirm-btn');
  const resultEl = document.getElementById('promo-result');
  const progressWrap = document.getElementById('promo-progress-wrap');
  const progressBar = document.getElementById('promo-progress-bar');
  const progressText = document.getElementById('promo-progress-text');

  sendBtn.disabled = true;
  progressWrap.style.display = '';
  progressBar.style.width = '0%';
  resultEl.textContent = '';

  let campaignId = null;
  try {
    const ref = await withAdminSiteChange(async () => addDoc(collection(db, 'emailCampaigns'), {
      templateKey: tpl.id, templateName: tpl.name,
      recipients: recipients.map(r => r.email),
      status: 'sending', createdBy: getCurrentUser()?.email || '', createdAt: serverTimestamp(),
      sentCount: 0, failedCount: 0, results: []
    }));
    campaignId = ref.id;
  } catch (e) {
    console.error('No se pudo crear el registro de campaña:', e);
  }

  let sent = 0, failed = 0;
  const allResults = [];
  for (let i = 0; i < recipients.length; i += PROMO_BATCH_SIZE) {
    const batch = recipients.slice(i, i + PROMO_BATCH_SIZE);
    progressText.textContent = `Enviando ${Math.min(i + batch.length, recipients.length)} de ${recipients.length}…`;
    try {
      const resp = await sendBulkTemplatedEmail({
        ...templateContentPayload_(tpl),
        recipients: batch.map(r => ({ to: r.email, variables: { clienteNombre: r.name || '' } }))
      });
      const results = resp.results || batch.map(() => ({ sent: false, error: resp.error || 'sin respuesta' }));
      results.forEach((r, idx) => {
        const recipient = batch[idx];
        const ok = !!r.sent;
        if (ok) sent++; else failed++;
        allResults.push({ email: recipient.email, status: ok ? 'sent' : 'failed', error: r.error || '' });
        logEmailSend_({ category: 'promo', type: 'promo', recipient: recipient.email, status: ok ? 'sent' : 'failed', templateKey: tpl.id, isAutomatic: false, error: r.error || '', campaignId, variables: { clienteNombre: recipient.name || '' } });
      });
    } catch (e) {
      batch.forEach(recipient => {
        failed++;
        allResults.push({ email: recipient.email, status: 'failed', error: e.message });
        logEmailSend_({ category: 'promo', type: 'promo', recipient: recipient.email, status: 'failed', templateKey: tpl.id, isAutomatic: false, error: e.message, campaignId });
      });
    }
    progressBar.style.width = `${Math.round((Math.min(i + batch.length, recipients.length) / recipients.length) * 100)}%`;
    if (campaignId) {
      try { await withAdminSiteChange(async () => updateDoc(doc(db, 'emailCampaigns', campaignId), { sentCount: sent, failedCount: failed, results: allResults })); }
      catch (e) { console.error('No se pudo actualizar la campaña:', e); }
    }
  }

  if (campaignId) {
    try { await withAdminSiteChange(async () => updateDoc(doc(db, 'emailCampaigns', campaignId), { status: 'completed' })); }
    catch (e) { console.error('No se pudo marcar la campaña como completada:', e); }
  }

  progressText.textContent = `Listo: ${sent} enviados, ${failed} fallidos.`;
  resultEl.style.color = failed === 0 ? '#065f46' : (sent === 0 ? '#c0392b' : '#856404');
  resultEl.textContent = failed === 0
    ? `Promoción enviada a ${sent} destinatarias.`
    : `Se enviaron ${sent} de ${recipients.length} — ${failed} fallidas (ver Historial para el detalle).`;

  sendBtn.disabled = false;
  promoRecipients = [];
  renderPromoChips_();
  renderCorreosDashboard();
  renderCorreosHistorialTab();
}

// ---- Historial ----
function categoryBadge_(category) {
  const map = { pedido: ['#dbeafe', '#1e40af', 'Pedido real'], prueba: ['#fff3cd', '#856404', 'Prueba'], promo: ['#ede9fe', '#5b21b6', 'Promoción'] };
  const [bg, color, label] = map[category] || map.pedido;
  return `<span class="adm-badge" style="background:${bg};color:${color}">${label}</span>`;
}

function renderCorreosHistorialTab() {
  const typeSelect = document.getElementById('hist-filter-type');
  if (!typeSelect) return;
  const types = Array.from(new Set(allEmailLogs.map(l => l.type).filter(Boolean)));
  const currentVal = typeSelect.value;
  typeSelect.innerHTML = '<option value="">Todos los tipos</option>' + types.map(t => `<option value="${escapeHtmlAdmin(t)}">${escapeHtmlAdmin(templateLabel_(t))}</option>`).join('');
  typeSelect.value = types.includes(currentVal) ? currentVal : '';

  const q = (document.getElementById('hist-search').value || '').toLowerCase();
  const statusVal = document.getElementById('hist-filter-status').value;
  const categoryVal = document.getElementById('hist-filter-category').value;
  const typeVal = document.getElementById('hist-filter-type').value;
  const fromVal = document.getElementById('hist-filter-from').value;
  const toVal = document.getElementById('hist-filter-to').value;

  let list = allEmailLogs.slice();
  if (q) list = list.filter(l => (l.recipient || '').toLowerCase().includes(q));
  if (statusVal) list = list.filter(l => l.status === statusVal);
  if (categoryVal) list = list.filter(l => (l.category || 'pedido') === categoryVal);
  if (typeVal) list = list.filter(l => l.type === typeVal);
  if (fromVal) { const from = new Date(fromVal); list = list.filter(l => { const d = l.sentAt?.toDate?.(); return d && d >= from; }); }
  if (toVal) { const to = new Date(toVal); to.setHours(23, 59, 59, 999); list = list.filter(l => { const d = l.sentAt?.toDate?.(); return d && d <= to; }); }

  const tbody = document.getElementById('hist-tbody');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#aaa;padding:24px">Sin resultados</td></tr>';
    return;
  }
  const visibleIds = new Set(list.slice(0, 200).map(l => l.id));
  [..._selectedLogs].forEach(id => { if (!visibleIds.has(id)) _selectedLogs.delete(id); });
  tbody.innerHTML = list.slice(0, 200).map(l => `
    <tr class="adm-log-row">
      <td class="col-select" data-label="Sel."><input type="checkbox" class="hist-row-check" data-id="${escapeHtmlAdmin(l.id)}" onclick="toggleLogSelect(this)" ${_selectedLogs.has(l.id) ? 'checked' : ''}></td>
      <td data-label="Fecha" style="font-size:12px;white-space:nowrap">${formatDate(l.sentAt)}</td>
      <td data-label="Origen real/prueba">${categoryBadge_(l.category || 'pedido')}</td>
      <td data-label="Tipo" style="font-size:12px">${escapeHtmlAdmin(templateLabel_(l.type))}</td>
      <td data-label="Destinatario" style="font-size:12px">${escapeHtmlAdmin(l.recipient || '—')}</td>
      <td data-label="Estado">${logStatusBadge_(l.status)}</td>
      <td data-label="Enviado por" style="font-size:12px">${escapeHtmlAdmin(l.sentBy || '—')}</td>
      <td data-label="Automático/Manual" style="font-size:12px">${l.isAutomatic ? 'Automático' : 'Manual'}</td>
      <td data-label="Acciones">
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="adm-btn adm-btn-sm adm-btn-outline" ${adminEventAttributes('click','viewLogDetail',[String(l.id ?? '')])} type="button">Ver</button>
          ${l.status === 'failed' ? `<button class="adm-btn adm-btn-sm adm-btn-outline" ${adminEventAttributes('click','retryFailedLog',[String(l.id ?? '')])} type="button">Reintentar</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');
  updateLogsBulkToolbar();
}

// ══════════════════════════════════════════════
// HISTORIAL: SELECCIÓN MÚLTIPLE — exportar / reintentar fallidos
// ══════════════════════════════════════════════
let _selectedLogs = new Set();

window.toggleSelectAllLogs = function(masterCb) {
  document.querySelectorAll('.hist-row-check').forEach(cb => {
    cb.checked = masterCb.checked;
    if (masterCb.checked) _selectedLogs.add(cb.dataset.id);
    else _selectedLogs.delete(cb.dataset.id);
  });
  updateLogsBulkToolbar();
};

window.toggleLogSelect = function(cb) {
  if (cb.checked) _selectedLogs.add(cb.dataset.id);
  else _selectedLogs.delete(cb.dataset.id);
  updateLogsBulkToolbar();
};

function updateLogsBulkToolbar() {
  const count = _selectedLogs.size;
  const toolbar = document.getElementById('hist-bulk-toolbar');
  const countEl = document.getElementById('hist-bulk-count');
  if (toolbar) toolbar.classList.toggle('show', count > 0);
  if (countEl) countEl.textContent = `${count} seleccionado${count !== 1 ? 's' : ''}`;
}

window.clearLogsSelection = function() {
  _selectedLogs.clear();
  document.querySelectorAll('.hist-row-check').forEach(cb => cb.checked = false);
  const master = document.getElementById('check-all-hist');
  if (master) { master.checked = false; master.indeterminate = false; }
  updateLogsBulkToolbar();
};

// Los logs en sí NUNCA se editan/borran (registro inmutable) — "reintentar"
// no toca el log fallido, crea una entrada NUEVA con el resultado del
// reintento, igual que ya hace el reintento individual.
window.bulkRetryFailedLogs = async function() {
  if (!_selectedLogs.size) return;
  const ids = [..._selectedLogs].filter(id => { const l = allEmailLogs.find(x => x.id === id); return l && l.status === 'failed' && l.templateKey; });
  if (!ids.length) { toast('No hay envíos fallidos reintentables en la selección'); return; }
  const n = ids.length;
  if (!confirm(`¿Reintentar ${n} envío(s) fallido(s)?`)) return;
  let ok = 0, fail = 0;
  for (const id of ids) {
    const l = allEmailLogs.find(x => x.id === id);
    try {
      const tpl = allEmailTemplates.find(t => (t.key || t.id) === l.templateKey);
      if (!tpl) throw new Error('plantilla no existe');
      const result = await sendTemplatedEmail({ to: l.recipient, ...templateContentPayload_(tpl), variables: l.variables || {} });
      await logEmailSend_({ category: l.category || 'pedido', type: l.type, recipient: l.recipient, status: result?.success ? 'sent' : 'failed', templateKey: l.templateKey, isAutomatic: false, error: result?.error || '', orderId: l.orderId, variables: l.variables });
      if (result?.success) ok++; else fail++;
    } catch (e) { fail++; }
  }
  toast(fail ? `${ok} reenviados, ${fail} fallaron` : `${ok} reenviados correctamente`);
  clearLogsSelection();
  renderCorreosHistorialTab();
};

const CATEGORY_LABELS_ = { pedido: 'Pedido real', prueba: 'Prueba', promo: 'Promoción' };

function logRowsToCsv_(logs) {
  const header = ['Fecha', 'Origen real/prueba', 'Tipo', 'Destinatario', 'Estado', 'Enviado por', 'Automático/Manual'];
  const rows = logs.map(l => [
    l.sentAt?.toDate ? l.sentAt.toDate().toLocaleString('es-PY') : '',
    CATEGORY_LABELS_[l.category || 'pedido'] || 'Pedido real',
    templateLabel_(l.type), l.recipient || '', l.status || '', l.sentBy || '', l.isAutomatic ? 'Automático' : 'Manual'
  ]);
  return [header, ...rows];
}

window.bulkExportLogs = function() {
  if (!_selectedLogs.size) { toast('No hay envíos seleccionados'); return; }
  const list = allEmailLogs.filter(l => _selectedLogs.has(l.id));
  downloadCsv(`historial_correos_${Date.now()}.csv`, logRowsToCsv_(list));
  toast(`Exportados ${list.length} envío(s) a CSV`);
};

document.getElementById('hist-search').oninput = () => renderCorreosHistorialTab();
document.getElementById('hist-filter-status').onchange = () => renderCorreosHistorialTab();
document.getElementById('hist-filter-category').onchange = () => renderCorreosHistorialTab();
document.getElementById('hist-filter-type').onchange = () => renderCorreosHistorialTab();
document.getElementById('hist-filter-from').onchange = () => renderCorreosHistorialTab();
document.getElementById('hist-filter-to').onchange = () => renderCorreosHistorialTab();

window.viewLogDetail = (id) => {
  const l = allEmailLogs.find(x => x.id === id);
  if (!l) return;
  alert(
    `Origen: ${CATEGORY_LABELS_[l.category || 'pedido'] || 'Pedido real'}\nTipo: ${escapeHtmlAdmin(templateLabel_(l.type))}\nDestinatario: ${l.recipient || '—'}\nEstado: ${l.status}\n` +
    `Enviado por: ${l.sentBy || '—'}\nAutomático/Manual: ${l.isAutomatic ? 'Automático' : 'Manual'}\n` +
    `Pedido relacionado: ${l.orderId || '—'}\n` + (l.error ? `Error: ${l.error}` : 'Sin errores')
  );
};

window.retryFailedLog = async (id) => {
  const l = allEmailLogs.find(x => x.id === id);
  if (!l) { toast('No se puede reintentar este envío'); return; }
  // Los correos de pedido (pedido_nuevo/reenvio_pedido) no tienen templateKey:
  // se arman desde el pedido real, no desde una plantilla. Reintentarlos usa
  // el mismo camino que el botón "Reenviar" del módulo Pedidos.
  if (l.orderId && (l.type === 'pedido_nuevo' || l.type === 'reenvio_pedido')) {
    await window.resendOrderEmail(l.orderId);
    return;
  }
  if (!l.templateKey) { toast('No se puede reintentar este envío'); return; }
  const tpl = allEmailTemplates.find(t => (t.key || t.id) === l.templateKey);
  if (!tpl) { toast('La plantilla original ya no existe'); return; }
  try {
    const result = await sendTemplatedEmail({ to: l.recipient, ...templateContentPayload_(tpl), variables: l.variables || {} });
    await logEmailSend_({ category: l.category || 'pedido', type: l.type, recipient: l.recipient, status: result?.success ? 'sent' : 'failed', templateKey: l.templateKey, isAutomatic: false, error: result?.error || '', orderId: l.orderId, variables: l.variables });
    toast(result?.success ? 'Reenviado correctamente' : 'Falló el reintento');
  } catch (e) {
    toast('Error al reintentar: ' + e.message);
  }
};

// ---- Configuración de correos ----
function renderCorreosConfigTab() {
  const s = emailSettingsCache || defaultEmailSettings_();
  const gmailSender = isGmailSender_(s.senderEmail || EMAIL_SENDER_ADDRESS);
  document.getElementById('cec-order-enabled').checked = s.orderEmailsEnabled !== false;
  document.getElementById('cec-internal-enabled').checked = s.internalEmailEnabled !== false;
  document.getElementById('cec-customer-enabled').checked = s.customerEmailEnabled !== false;
  document.getElementById('cec-test-enabled').checked = s.testEmailsEnabled !== false;
  const promoToggle = document.getElementById('cec-promo-enabled');
  promoToggle.checked = gmailSender ? false : (s.promoEnabled !== false);
  promoToggle.disabled = gmailSender;
  document.getElementById('cec-sender-name').value = s.senderName || 'Tintin Accesorios';
  document.getElementById('cec-sender-email').value = s.senderEmail || EMAIL_SENDER_ADDRESS;
  document.getElementById('cec-internal-email').value = s.internalEmail || 'tintinaccs@gmail.com';
  document.getElementById('cec-whatsapp').value = s.whatsappNumber || '';
  document.getElementById('cec-signature').value = s.signature || '';
  document.getElementById('cec-footer').value = s.footer || '';
  document.getElementById('cec-test-limit').value = s.testDailyLimit || 20;
  document.getElementById('cec-resend-limit').value = s.resendDailyLimit || 30;
  document.getElementById('cec-promo-limit').value = s.promoDailyLimit || 100;
  const alertEl = document.getElementById('cec-gmail-sender-alert');
  alertEl.style.display = gmailSender ? '' : 'none';
  if (gmailSender) document.getElementById('cec-gmail-sender-name').textContent = s.senderEmail || EMAIL_SENDER_ADDRESS;
  window.AdminUnsaved?.register('email-config', {
    root: '#correos-panel-config',
    active: () => document.getElementById('section-correos')?.classList.contains('active'),
    label: 'Configuración de correos',
    save: () => {
      const waiting = window.AdminUnsaved.waitForEvent('tintin:admin-email-config-saved', 'tintin:admin-email-config-save-failed');
      document.getElementById('btn-save-correos-config').click();
      return waiting;
    },
  });
}

document.getElementById('btn-save-correos-config').onclick = async () => {
  const s = emailSettingsCache || defaultEmailSettings_();
  const gmailSender = isGmailSender_(s.senderEmail || EMAIL_SENDER_ADDRESS);
  const patch = {
    orderEmailsEnabled: document.getElementById('cec-order-enabled').checked,
    internalEmailEnabled: document.getElementById('cec-internal-enabled').checked,
    customerEmailEnabled: document.getElementById('cec-customer-enabled').checked,
    testEmailsEnabled: document.getElementById('cec-test-enabled').checked,
    // Con remitente Gmail común, Promociones queda forzado a apagado sin
    // importar lo que diga el checkbox (que además está disabled en el DOM)
    // — protege el dato guardado aunque alguien lo togglee desde la consola.
    promoEnabled: gmailSender ? false : document.getElementById('cec-promo-enabled').checked,
    senderName: document.getElementById('cec-sender-name').value.trim() || 'Tintin Accesorios',
    internalEmail: document.getElementById('cec-internal-email').value.trim() || 'tintinaccs@gmail.com',
    whatsappNumber: document.getElementById('cec-whatsapp').value.trim(),
    signature: document.getElementById('cec-signature').value,
    footer: document.getElementById('cec-footer').value,
    testDailyLimit: Number(document.getElementById('cec-test-limit').value) || 20,
    resendDailyLimit: Number(document.getElementById('cec-resend-limit').value) || 30,
    promoDailyLimit: Number(document.getElementById('cec-promo-limit').value) || 100,
  };
  try {
    emailSettingsCache = Object.assign(emailSettingsCache || defaultEmailSettings_(), patch);
    const saved = await saveEmailSettingsMerge_(patch);
    if (!saved) throw new Error('No se pudo guardar la configuración de correos.');
    toast('Configuración de correos guardada');
    renderCorreosDashboard();
    renderCorreosConfigTab();
    window.AdminUnsaved?.markClean('email-config');
    window.dispatchEvent(new Event('tintin:admin-email-config-saved'));
  } catch (error) {
    window.dispatchEvent(new Event('tintin:admin-email-config-save-failed'));
    throw error;
  }
};

// ---- Tabs del módulo Correos ----
document.querySelectorAll('#correos-tabs .correos-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const switchNow = () => {
      document.querySelectorAll('#correos-tabs .correos-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.correos-panel').forEach(p => p.classList.toggle('active', p.id === `correos-panel-${btn.dataset.correosTab}`));
    };
    if (window.AdminUnsaved?.isDirty('email-config')) {
      window.AdminUnsaved.requestNavigation(switchNow, { scopeIds: ['email-config'] });
    } else {
      switchNow();
    }
  });
});

// ---- Disparo automático desde Pedidos (updateOrderStatus/updatePayStatus) ----
async function maybeSendOrderStatusEmail_(order, kind, value) {
  try {
    const key = kind === 'payment' ? PAY_STATUS_TO_TYPE[value] : ORDER_STATUS_TO_TYPE[value];
    if (!key || !order || !order.userEmail) return;
    const settings = emailSettingsCache || await getEmailSettingsFresh_();
    if (settings.orderEmailsEnabled === false) return;
    if (!(settings.orderTypesEnabled && settings.orderTypesEnabled[key])) return;
    const tplKey = (settings.orderTypeTemplateMap && settings.orderTypeTemplateMap[key]) || key;
    let tpl = allEmailTemplates.find(t => (t.key || t.id) === tplKey);
    if (!tpl) {
      const snap = await getDoc(doc(db, 'emailTemplates', tplKey));
      if (snap.exists()) tpl = { id: snap.id, ...snap.data() };
    }
    if (!tpl || tpl.active === false) return;
    const variables = orderToVariables_(order);
    const result = await sendTemplatedEmail({ to: order.userEmail, ...templateContentPayload_(tpl), variables });
    await logEmailSend_({ category: 'pedido', type: key, recipient: order.userEmail, status: result?.success ? 'sent' : 'failed', templateKey: tplKey, isAutomatic: true, error: result?.error || '', orderId: order.id, variables });
  } catch (e) {
    console.error('[correos] auto-send falló (no bloquea el cambio de estado):', e);
  }
}


function stopCorreosRealtimeListeners() {
  emailRealtimeUnsubscribers.forEach(unsubscribe => unsubscribe());
  emailRealtimeUnsubscribers = [];
  emailModuleStarted = false;
}
return { loadCorreos, refreshCorreosClientasFromRealtime, stopCorreosRealtimeListeners };
}
