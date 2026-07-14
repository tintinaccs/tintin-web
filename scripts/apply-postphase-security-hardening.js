const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const changed = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}
function write(file, content) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const previous = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
  if (previous !== content) {
    fs.writeFileSync(target, content);
    changed.push(file);
  }
}
function replaceOnce(content, search, replacement, label) {
  if (content.includes(replacement)) return content;
  const index = content.indexOf(search);
  if (index < 0) throw new Error(`No se encontró el bloque: ${label}`);
  return content.slice(0, index) + replacement + content.slice(index + search.length);
}
function replaceRegex(content, regex, replacement, label) {
  if (typeof replacement === 'string' && content.includes(replacement)) return content;
  if (!regex.test(content)) throw new Error(`No se encontró el patrón: ${label}`);
  regex.lastIndex = 0;
  return content.replace(regex, replacement);
}

write('js/security-utils.js', `/* =============================================================
   TINTIN — endurecimiento posterior a las fases

   Los datos de Firestore y localStorage se convierten siempre en texto plano
   antes de llegar a renderizadores históricos que todavía usan plantillas.
   ============================================================= */

const CONTROL_CHARS = /[\\u0000-\\u001f\\u007f]/g;

export function cleanText(value, maxLength = 4000) {
  return String(value == null ? '' : value)
    .replace(CONTROL_CHARS, ' ')
    .replace(/[<>]/g, '')
    .replace(/\\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function cleanMultilineText(value, maxLength = 4000) {
  return String(value == null ? '' : value)
    .replace(/<\\s*br\\s*\\/?\\s*>/gi, '\\n')
    .replace(/<\\/(?:p|div|li|h[1-6])\\s*>/gi, '\\n')
    .replace(/<script[\\s\\S]*?<\\/script\\s*>/gi, ' ')
    .replace(/<style[\\s\\S]*?<\\/style\\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(CONTROL_CHARS, ' ')
    .replace(/[ \\t]+/g, ' ')
    .replace(/\\n{3,}/g, '\\n\\n')
    .trim()
    .slice(0, maxLength);
}

export function sanitizeVariantData(value, depth = 0) {
  if (depth > 3 || value == null) return null;
  if (typeof value === 'string') return cleanText(value, 180);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.slice(0, 50).map(item => sanitizeVariantData(item, depth + 1)).filter(item => item != null);
  }
  if (typeof value === 'object') {
    const result = {};
    Object.entries(value).slice(0, 50).forEach(([key, item]) => {
      const safeKey = cleanText(key, 80);
      const safeValue = sanitizeVariantData(item, depth + 1);
      if (safeKey && safeValue != null) result[safeKey] = safeValue;
    });
    return result;
  }
  return null;
}
`);

// products-store.js: sanitize once at the public data boundary.
{
  const file = 'js/products-store.js';
  let content = read(file);
  content = replaceOnce(
    content,
    "import { sanitizeImageUrl } from './image-utils.js';",
    "import { sanitizeImageUrl, uniqueSafeImageUrls } from './image-utils.js';\nimport { cleanText, cleanMultilineText, sanitizeVariantData } from './security-utils.js';",
    'imports seguros de productos'
  );
  content = replaceRegex(
    content,
    /function mapProduct\(id, d\) \{[\s\S]*?\n\}/,
    `function mapProduct(id, d) {
  const rawCategory = d.category || d.collectionSlug || d.collection || d.cat || d.Type || d.type || d['Product Category'] || d['Category'] || '';
  const category = cleanText(rawCategory, 120);
  const description = cleanMultilineText(d.description || d.desc || d['Body (HTML)'] || '', 4000);
  const rawExtraImages = Array.isArray(d.imagesExtra)
    ? d.imagesExtra
    : Array.isArray(d.images)
      ? d.images
      : [];
  return {
    id: String(id),
    name:           cleanText(d.name || d.title || d.Title || d['Title'] || d.handle || d.Handle || '', 180),
    cat:            category,
    category,
    price:          Number(String(d.price || d.Price || d['Variant Price'] || 0).replace(/\\./g, '').replace(',', '.')),
    priceBefore:    d.priceBefore != null ? Number(d.priceBefore) : null,
    badge:          cleanText(d.badge || (d.oferta ? 'Oferta' : ''), 60) || null,
    desc:           description,
    description,
    imageUrl:       normalizeImageUrl(d),
    imagesExtra:    uniqueSafeImageUrls(rawExtraImages).slice(0, 12),
    stock:          d.stock ?? d['Variant Inventory Qty'] ?? null,
    active:         d.active !== false,
    oferta:         !!d.oferta,
    destacado:      !!d.destacado,
    variants:       sanitizeVariantData(d.variants || null),
    collectionOrder: Number.isFinite(Number(d.collectionOrder)) ? Number(d.collectionOrder) : 9999,
  };
}`,
    'mapProduct seguro'
  );
  write(file, content);
}

// cart-sync.js: remote/local cart metadata must be plain text and safe URLs.
{
  const file = 'js/cart-sync.js';
  let content = read(file);
  content = replaceOnce(
    content,
    "import { auth, db } from './firebase.js';",
    "import { auth, db } from './firebase.js';\nimport { sanitizeImageUrl } from './image-utils.js';",
    'import de URL segura en carrito'
  );
  content = replaceRegex(
    content,
    /  function cleanText\(value, maxLength\) \{[\s\S]*?\n  \}/,
    `  function cleanText(value, maxLength) {
    return String(value == null ? '' : value)
      .replace(/[\\u0000-\\u001f\\u007f]/g, ' ')
      .replace(/[<>]/g, '')
      .replace(/\\s+/g, ' ')
      .trim()
      .slice(0, maxLength);
  }`,
    'cleanText del carrito'
  );
  content = replaceOnce(
    content,
    "    const imageUrl = cleanText(input.imageUrl || input.imgUrl || input.image || '', 1200);",
    "    const imageUrl = sanitizeImageUrl(input.imageUrl || input.imgUrl || input.image || '');",
    'imagen segura del carrito'
  );
  write(file, content);
}

// script.js: sanitize legacy localStorage before any template interpolation.
{
  const file = 'script.js';
  let content = read(file);
  const formatBlock = `function formatPrice(num) {
  return 'Gs. ' + num.toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.');
}`;
  const helperBlock = `${formatBlock}

function sanitizePlainText(value, maxLength = 4000) {
  return String(value == null ? '' : value)
    .replace(/[\\u0000-\\u001f\\u007f]/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function sanitizeClassicImageUrl(value) {
  const raw = String(value || '').trim();
  if (!raw || /['\"<>\\u0000-\\u001f\\u007f]/.test(raw) || raw.length > 2048) return '';
  try {
    const url = new URL(raw, window.location.href);
    if (!['https:', 'http:'].includes(url.protocol)) return '';
    if (location.protocol === 'https:' && url.protocol === 'http:' && url.origin !== location.origin) return '';
    return url.href;
  } catch { return ''; }
}

function normalizeClassicCart(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 100).map(raw => {
    if (!raw || typeof raw !== 'object') return null;
    const id = String(raw.id == null ? '' : raw.id).replace(/['\"<>\\\\`]/g, '').replace(/[\\u0000-\\u001f\\u007f]/g, '').trim().slice(0, 180);
    if (!id) return null;
    const qtyNumber = Number(raw.qty == null ? 1 : raw.qty);
    const priceNumber = Number(raw.price);
    return {
      ...raw,
      id,
      name: sanitizePlainText(raw.name || raw.title || 'Producto', 180),
      cat: sanitizePlainText(raw.cat || raw.category || '', 120),
      variant: sanitizePlainText(raw.variant || '', 120),
      qty: Number.isFinite(qtyNumber) ? Math.max(1, Math.min(99, Math.floor(qtyNumber))) : 1,
      price: Number.isFinite(priceNumber) && priceNumber >= 0 ? priceNumber : 0,
      imageUrl: sanitizeClassicImageUrl(raw.imageUrl || raw.imgUrl || raw.image || ''),
      imgUrl: sanitizeClassicImageUrl(raw.imgUrl || raw.imageUrl || raw.image || ''),
    };
  }).filter(Boolean);
}`;
  content = replaceOnce(content, formatBlock, helperBlock, 'helpers de carrito clásico');
  content = replaceRegex(
    content,
    /function getCart\(\) \{[\s\S]*?\n\}/,
    `function getCart() {
  try {
    const normalized = normalizeClassicCart(JSON.parse(localStorage.getItem(CART_KEY)) || []);
    localStorage.setItem(CART_KEY, JSON.stringify(normalized));
    return normalized;
  } catch (e) {
    return [];
  }
}`,
    'lectura segura de carrito clásico'
  );
  content = replaceOnce(
    content,
    `function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}`,
    `function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(normalizeClassicCart(cart)));
}`,
    'guardado seguro de carrito clásico'
  );
  content = replaceOnce(
    content,
    `    if (hasDesc) {
      // desc may be HTML from Shopify
      if (/<[a-z][\\s\\S]*>/i.test(product.desc)) descEl.innerHTML = product.desc;
      else descEl.textContent = product.desc;
      descEl.style.display = '';
    } else {`,
    `    if (hasDesc) {
      // Las descripciones importadas se muestran como texto plano. Nunca se
      // ejecuta HTML almacenado en Firestore o proveniente de un CSV.
      descEl.textContent = sanitizePlainText(product.desc, 4000);
      descEl.style.display = '';
    } else {`,
    'descripción de producto como texto'
  );
  write(file, content);
}

// checkout.html: sanitize the direct Firestore fallback used by the empty cart.
{
  const file = 'checkout.html';
  let content = read(file);
  content = replaceOnce(
    content,
    `import { isAccessAllowed, renderStoreClosedOverlay, removeStoreClosedOverlay } from "./js/store-gate-core.js";`,
    `import { isAccessAllowed, renderStoreClosedOverlay, removeStoreClosedOverlay } from "./js/store-gate-core.js";\nimport { cleanText } from "./js/security-utils.js";\nimport { sanitizeImageUrl } from "./js/image-utils.js";`,
    'imports seguros en checkout'
  );
  content = replaceOnce(
    content,
    `// ---- CITY DATA — {name, price}[] — overridden by Firestore ----`,
    `function sanitizeCheckoutProduct(id, raw = {}) {
  return {
    id: String(id || '').replace(/['\"<>\\\\`]/g, '').slice(0, 180),
    name: cleanText(raw.name || raw.title || raw.Title || 'Producto', 180),
    cat: cleanText(raw.cat || raw.category || '', 120),
    category: cleanText(raw.category || raw.cat || '', 120),
    price: Number(raw.price || 0),
    imageUrl: sanitizeImageUrl(raw.imageUrl || raw.image || raw.img || ''),
    active: raw.active !== false,
  };
}

// ---- CITY DATA — {name, price}[] — overridden by Firestore ----`,
    'normalización de productos sugeridos'
  );
  content = replaceOnce(
    content,
    `        featured = snap.docs.map(d => ({ id: d.id, ...d.data() }));`,
    `        featured = snap.docs.map(d => sanitizeCheckoutProduct(d.id, d.data()));`,
    'fallback Firestore seguro en checkout'
  );
  content = replaceOnce(
    content,
    `    } catch(e) { console.warn('Suggested products error:', e); }

    container.innerHTML =`,
    `    } catch(e) { console.warn('Suggested products error:', e); }
    featured = featured.map(p => sanitizeCheckoutProduct(p.id, p)).filter(p => p.id && p.name && p.active !== false);

    container.innerHTML =`,
    'sanitización final de sugerencias'
  );
  write(file, content);
}

// perfil.html: role derives from Auth email and old order names are escaped.
{
  const file = 'perfil.html';
  let content = read(file);
  content = replaceOnce(content, '  const role = await getUserRole(user.uid);', '  const role = await getUserRole(user.uid, user.email);', 'rol del perfil por Auth');
  content = replaceOnce(
    content,
    `      const itemsText = (o.items || []).slice(0, 2).map(i => \`${'${i.qty}'}x ${'${i.name}'}\`).join(', ')
        + ((o.items?.length || 0) > 2 ? \` +${'${o.items.length - 2}'} más\` : '');`,
    `      const itemsText = (o.items || []).slice(0, 2).map(i => \`${'${Number(i.qty) || 0}'}x ${'${escapeHtmlPerfil(i.name || "Producto")}'}\`).join(', ')
        + ((o.items?.length || 0) > 2 ? \` +${'${o.items.length - 2}'} más\` : '');`,
    'nombres históricos de pedidos seguros'
  );
  content = replaceOnce(
    content,
    `  return \`<span style="display:inline-block;padding:2px 8px;border-radius:50px;font-size:10px;font-weight:700;background:${'${c}'}20;color:${'${c}'};text-transform:uppercase">${'${status}'}</span>\`;`,
    `  return \`<span style="display:inline-block;padding:2px 8px;border-radius:50px;font-size:10px;font-weight:700;background:${'${c}'}20;color:${'${c}'};text-transform:uppercase">${'${escapeHtmlPerfil(status)}'}</span>\`;`,
    'estado histórico seguro'
  );
  write(file, content);
}

// roles.js: never trust a Firestore email to identify Super Admin.
{
  const file = 'js/roles.js';
  let content = read(file);
  content = replaceOnce(content, 'import { db } from "./firebase.js";', 'import { auth, db } from "./firebase.js";', 'Auth en roles');
  content = replaceRegex(
    content,
    /export async function getUserRole\(uid, email\) \{[\s\S]*?\n\}/,
    `export async function getUserRole(uid, email) {
  // La identidad elevada proviene exclusivamente de Firebase Authentication.
  // El campo email de users/{uid} es informativo y nunca concede permisos.
  const authenticatedEmail = String(email || auth.currentUser?.email || '').trim().toLowerCase();
  if (authenticatedEmail === SUPER_ADMIN) return 'superadmin';
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return 'client';
    const role = snap.data().role || 'client';
    return ['admin', 'agent', 'viewer', 'client'].includes(role) ? role : 'client';
  } catch (e) {
    console.error('Error getting user role:', e);
    return 'client';
  }
}`,
    'getUserRole por Auth'
  );
  content = replaceRegex(
    content,
    /export async function setUserRole\(uid, role\) \{[\s\S]*?\n\}/,
    `export async function setUserRole(uid, role) {
  const allowed = ['admin', 'agent', 'viewer', 'client'];
  if (!allowed.includes(role)) throw new Error('Rol no permitido');
  try {
    await setDoc(doc(db, 'users', uid), {
      role,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.error('Error setting user role:', e);
    throw e;
  }
}`,
    'setUserRole sin superadmin'
  );
  write(file, content);
}

// checkout email status becomes authoritative from Apps Script, not client writable.
{
  const file = 'js/checkout-email-bridge.js';
  let content = read(file);
  content = content.replace(/,\n\s*updateDoc,?/, ',');
  content = replaceOnce(
    content,
    `      await updateDoc(doc(db, 'orders', found.id), {
        notificationStatus: status,
        updatedAt: serverTimestamp()
      });

`,
    `      // Apps Script actualiza notificationStatus usando su identidad de
      // servidor. El navegador solo informa el resultado visualmente.

`,
    'quitar escritura cliente de notificationStatus'
  );
  content = content.replace(/,\n\s*serverTimestamp\n/, '\n');
  write(file, content);
}

// Remove the public shared secret; every action must authenticate with Firebase.
{
  const configFile = 'js/email-config.js';
  let config = read(configFile);
  config = config.replace(/\nexport const EMAIL_SECRET = ['"][^'"]*['"];?\s*$/, '\n');
  config = config.replace(/\n \* y un secreto inventado[\s\S]*?script de Google\.\n/, '\n * La seguridad depende del idToken verificado por Apps Script, no de un secreto público.\n');
  write(configFile, config);

  const notifyFile = 'js/email-notify.js';
  let notify = read(notifyFile);
  notify = replaceOnce(notify, "import { EMAIL_WEBHOOK_URL, EMAIL_SECRET } from './email-config.js';", "import { EMAIL_WEBHOOK_URL } from './email-config.js';", 'import sin secreto');
  notify = notify.replace(/\n\s*secret: EMAIL_SECRET,/g, '');
  notify = replaceOnce(
    notify,
    `    const idToken = await getIdToken_(true);
    const settings = await getEmailSettings_();`,
    `    const idToken = await getIdToken_(true);
    if (!idToken) return { success: false, error: 'missing_id_token' };
    const settings = await getEmailSettings_();`,
    'token obligatorio en prueba'
  );
  notify = notify.replace(
    `    const idToken = await getIdToken_(true);
    return await postWebhook_({`,
    `    const idToken = await getIdToken_(true);
    if (!idToken) return { success: false, error: 'missing_id_token' };
    return await postWebhook_({`
  );
  write(notifyFile, notify);
}

// Apps Script helper: owner-authenticated Firestore update, bypassing client rules.
{
  const file = 'apps-script/Phase3Security.gs';
  let content = read(file);
  if (!content.includes('function phase3UpdateOrderNotificationStatus_')) {
    content += `

/**
 * Actualiza el estado real del correo con la identidad propietaria del Apps
 * Script. El navegador ya no puede marcar un pedido como enviado.
 */
function phase3UpdateOrderNotificationStatus_(orderId, status) {
  var allowed = ['sent', 'partial', 'failed'];
  if (allowed.indexOf(String(status || '')) === -1) {
    return { ok: false, error: 'invalid_notification_status' };
  }
  var normalizedId = String(orderId || '').trim();
  if (!normalizedId || normalizedId.length > 220 || normalizedId.indexOf('/') !== -1) {
    return { ok: false, error: 'invalid_order_id' };
  }
  try {
    var url = FIRESTORE_DOCUMENTS_URL_ + 'orders/' + encodeURIComponent(normalizedId) +
      '?updateMask.fieldPaths=notificationStatus&updateMask.fieldPaths=updatedAt';
    var response = UrlFetchApp.fetch(url, {
      method: 'patch',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      payload: JSON.stringify({
        fields: {
          notificationStatus: { stringValue: String(status) },
          updatedAt: { timestampValue: new Date().toISOString() }
        }
      }),
      muteHttpExceptions: true
    });
    var code = response.getResponseCode();
    return code >= 200 && code < 300
      ? { ok: true }
      : { ok: false, error: 'notification_status_write_failed', status: code };
  } catch (error) {
    return { ok: false, error: 'notification_status_write_failed', detail: String(error) };
  }
}
`;
  }
  write(file, content);
}

// Firestore: strict user creation, immutable identity, no customer order-status write.
{
  const file = 'firestore.rules';
  let content = read(file);
  content = replaceOnce(
    content,
    `        'role', 'blocked', 'blockedAt', 'blockedBy', 'blockReason',`,
    `        'email', 'createdAt', 'provider', 'role', 'blocked', 'blockedAt', 'blockedBy', 'blockReason',`,
    'campos protegidos del usuario'
  );
  if (!content.includes('function userCreateValid(userId)')) {
    content = replaceOnce(
      content,
      `    /* ============================================================
       TINTIN — PEDIDOS SIN BLAZE (SPARK)`,
      `    function userCreateValid(userId) {
      let data = request.resource.data;
      return isSignedIn() &&
        request.auth.uid == userId &&
        request.auth.token.email != null &&
        data.keys().hasOnly([
          'name', 'email', 'phone', 'photoURL', 'role', 'provider',
          'onboardingCompleted', 'welcomeTutorialSeen',
          'welcomeTutorialPending', 'welcomeTutorialVersion', 'blocked',
          'purchaseCount', 'totalSpent', 'orderCount', 'totalOrders',
          'completedOrders', 'pendingOrders', 'cancelledOrders',
          'createdAt', 'updatedAt', 'lastLogin'
        ]) &&
        data.email is string &&
        data.email.lower() == request.auth.token.email.lower() &&
        data.get('blocked', false) == false &&
        (
          (request.auth.token.email == "tintinaccs@gmail.com" && data.get('role', 'superadmin') == 'superadmin') ||
          (request.auth.token.email != "tintinaccs@gmail.com" && data.get('role', 'client') == 'client')
        ) &&
        data.get('purchaseCount', 0) == 0 &&
        data.get('totalSpent', 0) == 0 &&
        data.get('orderCount', 0) == 0 &&
        data.get('totalOrders', 0) == 0 &&
        data.get('completedOrders', 0) == 0 &&
        data.get('pendingOrders', 0) == 0 &&
        data.get('cancelledOrders', 0) == 0 &&
        (!('createdAt' in data) || data.createdAt == request.time) &&
        (!('updatedAt' in data) || data.updatedAt == request.time) &&
        (!('lastLogin' in data) || data.lastLogin == request.time);
    }

    /* ============================================================
       TINTIN — PEDIDOS SIN BLAZE (SPARK)`,
      'validador de creación de usuario'
    );
  }
  content = replaceRegex(
    content,
    /      allow create: if isSignedIn\(\) &&[\s\S]*?\n        \);\n\n      allow update:/,
    `      allow create: if userCreateValid(userId);

      allow update:`,
    'regla de creación de usuario'
  );
  content = replaceOnce(
    content,
    `            ) ||
            (
              isOwnOrderByUidOrEmail() &&
              request.resource.data.diff(resource.data)
                .affectedKeys().hasOnly(['notificationStatus', 'updatedAt'])
            )
          )`,
    `            )
          )`,
    'quitar escritura de estado de correo por cliente'
  );
  write(file, content);
}

// Deployment guide: no public shared secret and authoritative status update.
{
  const file = 'functions/EMAIL_PHASE3_DEPLOY.md';
  let content = read(file);
  content = content.replace(/después de comprobar el secreto, /g, 'después de validar que existe un `idToken`, ');
  content = content.replace(
    '9. Cuando `checkOrderEmailNotDuplicate_` detecte un duplicado, devolver `duplicate: true` y conservar `order.notificationStatus` como `previousStatus`.',
    '9. Después de intentar los envíos, calcular `sent`, `partial` o `failed` y ejecutar `phase3UpdateOrderNotificationStatus_(orderId, status)`.\n10. Cuando `checkOrderEmailNotDuplicate_` detecte un duplicado, devolver `duplicate: true` y conservar `order.notificationStatus` como `previousStatus`.'
  );
  content = content.replace('10. Guardar y editar la implementación activa', '11. Eliminar del `doPost(e)` la exigencia del secreto enviado por el navegador; la autorización real es el `idToken` verificado.\n12. Guardar y editar la implementación activa');
  content += '\n\n## Permiso de Firestore para Apps Script\n\nLa cuenta propietaria del Apps Script debe tener acceso al proyecto `tintin-accesorios`. La función de estado usa `ScriptApp.getOAuthToken()` y la API oficial de Firestore; no usa permisos de la clienta.\n';
  write(file, content);
}

// Dedicated audit.
write('scripts/audit-postphase-security.js', `const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
let failures = 0;
function check(label, ok) {
  if (ok) console.log('OK — ' + label);
  else { failures += 1; console.error('FAIL — ' + label); }
}
const products = read('js/products-store.js');
const script = read('script.js');
const cart = read('js/cart-sync.js');
const roles = read('js/roles.js');
const rules = read('firestore.rules');
const emailConfig = read('js/email-config.js');
const emailNotify = read('js/email-notify.js');
const bridge = read('js/checkout-email-bridge.js');
const apps = read('apps-script/Phase3Security.gs');
check('Productos se normalizan como texto plano', products.includes('cleanMultilineText') && products.includes('sanitizeVariantData'));
check('Carrito local se limpia antes de renderizar', script.includes('normalizeClassicCart') && cart.includes('replace(/[<>]/g'));
check('Descripción de producto no ejecuta HTML', !script.includes('descEl.innerHTML = product.desc'));
check('Super Admin depende de Firebase Auth', roles.includes("auth.currentUser?.email") && !roles.includes('if (data.email === SUPER_ADMIN)'));
check('Email del perfil es campo protegido', rules.includes("'email', 'createdAt', 'provider', 'role'"));
check('Creación de usuario obliga estadísticas en cero', rules.includes('function userCreateValid(userId)') && rules.includes("data.get('totalSpent', 0) == 0"));
check('Cliente no puede escribir notificationStatus', !rules.includes("hasOnly(['notificationStatus', 'updatedAt'])"));
check('Secreto público eliminado', !emailConfig.includes('EMAIL_SECRET') && !emailNotify.includes('secret:'));
check('Apps Script escribe estado autorizado', apps.includes('phase3UpdateOrderNotificationStatus_') && apps.includes('ScriptApp.getOAuthToken()'));
check('Checkout ya no actualiza estado desde cliente', !bridge.includes('await updateDoc(doc(db, \'orders\''));
if (failures) process.exit(1);
console.log('\\nAuditoría post-fases completada correctamente.');
`);

// package.json
{
  const file = 'package.json';
  const pkg = JSON.parse(read(file));
  pkg.scripts['audit:postphase'] = 'node scripts/audit-postphase-security.js';
  if (pkg.scripts['audit:final'] && !pkg.scripts['audit:final'].includes('audit:postphase')) {
    pkg.scripts['audit:final'] += ' && npm run audit:postphase';
  }
  write(file, JSON.stringify(pkg, null, 2) + '\n');
}

console.log(changed.length ? `Archivos modificados: ${changed.join(', ')}` : 'No había cambios pendientes.');
