'use strict';

const crypto = require('crypto');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

if (!getApps().length) initializeApp();

const SUPER_ADMIN_EMAIL = 'tintinaccs@gmail.com';
const DEFAULT_STORE_WHATSAPP = '595981299331';
const MAX_ITEMS = 50;
const MAX_QTY_PER_LINE = 99;

function cleanText(value, maxLength = 300) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function cleanMultiline(value, maxLength = 1000) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
    .slice(0, maxLength);
}

function parseMoney(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : NaN;
  const raw = String(value == null ? '' : value)
    .replace(/gs\.?/gi, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.round(parsed) : NaN;
}

function parseStock(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : null;
}

function fail(code, message, details = {}) {
  throw new HttpsError('failed-precondition', message, { code, ...details });
}

function normalizeEmail(value) {
  return cleanText(value, 254).toLowerCase();
}

function validEmail(value) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

function normalizeCities(list, defaultCost) {
  return (Array.isArray(list) ? list : [])
    .map(item => {
      if (typeof item === 'string') {
        return { name: cleanText(item, 120), price: parseMoney(defaultCost) };
      }
      if (!item || typeof item !== 'object') return null;
      const name = cleanText(item.name, 120);
      if (!name) return null;
      if (item.price === null) return { name, price: null };
      const ownPrice = item.price === undefined ? parseMoney(defaultCost) : parseMoney(item.price);
      return { name, price: Number.isFinite(ownPrice) ? ownPrice : null };
    })
    .filter(Boolean);
}

function findCity(list, city) {
  const wanted = cleanText(city, 120).toLocaleLowerCase('es');
  return list.find(item => item.name.toLocaleLowerCase('es') === wanted) || null;
}

function normalizeMapLocation(value) {
  if (!value || typeof value !== 'object') return null;
  const lat = Number(value.lat);
  const lng = Number(value.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    name: cleanText(value.name, 120),
    ...(cleanText(value.address, 240) ? { address: cleanText(value.address, 240) } : {})
  };
}

function normalizeRequestedItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    fail('empty_cart', 'Tu carrito está vacío.');
  }
  if (rawItems.length > MAX_ITEMS) {
    fail('too_many_items', 'El carrito tiene demasiados productos.');
  }

  const lines = [];
  const quantityByProduct = new Map();

  for (const raw of rawItems) {
    const id = cleanText(raw && raw.id, 180);
    const variant = cleanText(raw && raw.variant, 120);
    const qty = Number(raw && raw.qty);

    if (!id) fail('invalid_item', 'Encontramos un producto sin identificar.');
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) {
      fail('invalid_quantity', 'Una de las cantidades del carrito no es válida.', { productId: id });
    }

    const key = `${id}::${variant}`;
    const existing = lines.find(line => line.key === key);
    if (existing) existing.qty += qty;
    else lines.push({ key, id, variant, qty });

    quantityByProduct.set(id, (quantityByProduct.get(id) || 0) + qty);
  }

  for (const [id, qty] of quantityByProduct.entries()) {
    if (qty > MAX_QTY_PER_LINE) {
      fail('invalid_quantity', 'La cantidad solicitada de un producto es demasiado alta.', { productId: id });
    }
  }

  return { lines, quantityByProduct };
}

function buildOrderId(uid, requestId) {
  return crypto
    .createHash('sha256')
    .update(`${uid}:${requestId}`)
    .digest('hex')
    .slice(0, 40);
}

function validateRequestId(value) {
  const id = cleanText(value, 120);
  if (!/^[A-Za-z0-9_-]{12,120}$/.test(id)) {
    throw new HttpsError('invalid-argument', 'No pudimos identificar este intento de pedido. Recargá la página e intentá nuevamente.');
  }
  return id;
}

function publicOrderResult(orderId, data, created) {
  return {
    success: true,
    created,
    orderId,
    shortId: data.shortId,
    subtotal: data.subtotal,
    shippingCost: data.shippingCost,
    shippingPending: data.shippingPending === true,
    total: data.total,
    storeWhatsapp: data.storeWhatsapp || DEFAULT_STORE_WHATSAPP,
    storeInstagram: data.storeInstagram || '',
    items: Array.isArray(data.items) ? data.items : [],
    shipping: data.shipping || {},
    payment: data.payment || {},
    notificationStatus: data.notificationStatus || 'pending'
  };
}

exports.createOrder = onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 45,
    memory: '256MiB',
    maxInstances: 20
  },
  async request => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Necesitás iniciar sesión para confirmar el pedido.');
    }

    const token = request.auth.token || {};
    const uid = request.auth.uid;
    const authEmail = normalizeEmail(token.email);

    if (!authEmail || token.email_verified !== true) {
      throw new HttpsError('failed-precondition', 'Tu correo debe estar verificado antes de confirmar el pedido.', {
        code: 'email_not_verified'
      });
    }

    const data = request.data || {};
    const requestId = validateRequestId(data.requestId);
    const { lines, quantityByProduct } = normalizeRequestedItems(data.items);

    const name = cleanText(data.name, 120);
    const phone = cleanText(data.phone, 40);
    const contactEmail = normalizeEmail(data.contactEmail);
    const notes = cleanMultiline(data.notes, 1000);
    const address = cleanText(data.address, 300);
    const referencia = cleanText(data.referencia, 300);
    const paymentMethod = cleanText(data.paymentMethod, 40);
    const shippingMethod = cleanText(data.shippingMethod, 40);
    const requestedCity = cleanText(data.city, 120);
    const mapLocation = normalizeMapLocation(data.mapLocation);

    if (name.length < 2) fail('invalid_name', 'Ingresá tu nombre completo.');
    if (!validPhone(phone)) fail('invalid_phone', 'Ingresá un teléfono o WhatsApp válido.');
    if (!validEmail(contactEmail)) fail('invalid_contact_email', 'El correo de contacto no tiene un formato válido.');
    if (!['efectivo', 'transferencia'].includes(paymentMethod)) {
      fail('invalid_payment_method', 'Seleccioná un método de pago disponible.');
    }
    if (!['delivery', 'encomienda', 'retiro'].includes(shippingMethod)) {
      fail('invalid_shipping_method', 'Seleccioná un método de entrega válido.');
    }

    const db = getFirestore();
    const orderId = buildOrderId(uid, requestId);
    const orderRef = db.collection('orders').doc(orderId);
    const userRef = db.collection('users').doc(uid);
    const gateRef = db.collection('settings').doc('storeGate');
    const settingsRef = db.collection('settings').doc('general');
    const uniqueProductIds = [...quantityByProduct.keys()];
    const productRefs = uniqueProductIds.map(id => db.collection('products').doc(id));

    try {
      return await db.runTransaction(async transaction => {
        const existing = await transaction.get(orderRef);
        if (existing.exists) {
          const existingData = existing.data();
          if (existingData.userId !== uid) {
            throw new HttpsError('permission-denied', 'No tenés permiso para usar este pedido.');
          }
          return publicOrderResult(orderId, existingData, false);
        }

        const [userSnap, gateSnap, settingsSnap, ...productSnaps] = await Promise.all([
          transaction.get(userRef),
          transaction.get(gateRef),
          transaction.get(settingsRef),
          ...productRefs.map(ref => transaction.get(ref))
        ]);

        const userData = userSnap.exists ? userSnap.data() : {};
        const role = cleanText(userData.role || 'client', 40) || 'client';
        const isSuperAdmin = authEmail === SUPER_ADMIN_EMAIL;

        if (!isSuperAdmin && userData.blocked === true) {
          fail('blocked_account', 'Esta cuenta está bloqueada y no puede realizar pedidos.');
        }

        const gate = gateSnap.exists ? gateSnap.data() : null;
        const maintenanceAccess = gate && gate.maintenanceAccess && typeof gate.maintenanceAccess === 'object'
          ? gate.maintenanceAccess
          : {};
        const storeAllowed = isSuperAdmin || !!(
          gate && (gate.storeOpen === true || maintenanceAccess[role] === true)
        );

        if (!storeAllowed) {
          fail('store_closed', 'La tienda está temporalmente cerrada.');
        }

        if (!settingsSnap.exists) {
          fail('store_config_unavailable', 'No pudimos comprobar los precios y métodos de entrega. Intentá nuevamente.');
        }
        const settings = settingsSnap.data() || {};

        const paymentMethods = settings.paymentMethods || {};
        if (paymentMethod === 'efectivo' && paymentMethods.efectivo === false) {
          fail('payment_unavailable', 'El pago en efectivo ya no está disponible. Elegí otro método.');
        }
        if (paymentMethod === 'transferencia' && paymentMethods.transferencia === false) {
          fail('payment_unavailable', 'La transferencia ya no está disponible. Elegí otro método.');
        }

        let city = requestedCity;
        let shippingCost = null;
        let shippingPending = false;
        let zone = 'interior';

        if (shippingMethod === 'retiro') {
          city = 'San Lorenzo (retiro)';
          shippingCost = 0;
          zone = 'central';
        } else if (shippingMethod === 'delivery') {
          const cities = normalizeCities(settings.deliveryCities, settings.deliveryCost);
          const match = findCity(cities, requestedCity);
          if (!match) fail('shipping_city_unavailable', 'La ciudad elegida ya no está disponible para delivery.');
          if (!mapLocation || !mapLocation.name) {
            fail('map_location_required', 'Marcá y nombrá tu ubicación en el mapa para continuar.');
          }
          city = match.name;
          shippingCost = match.price;
          shippingPending = match.price === null;
          zone = 'central';
        } else {
          const cities = normalizeCities(settings.encomiendaCities, settings.encomiendaCost);
          const match = findCity(cities, requestedCity);
          if (!match) fail('shipping_city_unavailable', 'La ciudad elegida ya no está disponible para encomienda.');
          if (address.length < 5) {
            fail('address_required', 'Ingresá la dirección para el envío por encomienda.');
          }
          city = match.name;
          shippingCost = match.price;
          shippingPending = match.price === null;
          zone = 'interior';
        }

        const productById = new Map();
        productSnaps.forEach(snap => {
          if (snap.exists) productById.set(snap.id, snap.data());
        });

        const resolvedItems = [];
        let subtotal = 0;

        for (const line of lines) {
          const product = productById.get(line.id);
          if (!product) {
            fail('product_not_found', 'Uno de los productos ya no está disponible.', { productId: line.id });
          }
          if (product.active === false) {
            fail('product_inactive', 'Uno de los productos fue desactivado.', {
              productId: line.id,
              productName: cleanText(product.name || product.title, 160)
            });
          }

          const price = parseMoney(product.price);
          if (!Number.isFinite(price) || price < 0) {
            fail('invalid_product_price', 'No pudimos comprobar el precio de un producto.', { productId: line.id });
          }

          const nameFromProduct = cleanText(product.name || product.title || product.Title || 'Producto', 180);
          const category = cleanText(
            product.category || product.collectionSlug || product.collection || product.cat || product.Type || product.type,
            120
          );

          resolvedItems.push({
            id: line.id,
            name: nameFromProduct,
            cat: category,
            price,
            qty: line.qty,
            variant: line.variant,
            imageUrl: cleanText(product.imageUrl || product.image || product.img || '', 900)
          });
          subtotal += price * line.qty;
        }

        for (const [productId, wantedQty] of quantityByProduct.entries()) {
          const product = productById.get(productId);
          const stock = parseStock(product && product.stock);
          if (stock !== null && wantedQty > stock) {
            fail('insufficient_stock', 'Cambió el stock de uno de los productos.', {
              productId,
              productName: cleanText(product && (product.name || product.title), 180),
              available: stock,
              requested: wantedQty
            });
          }
        }

        const total = subtotal + (shippingCost || 0);
        const expectedSubtotal = parseMoney(data.expectedSubtotal);
        const expectedShippingCost = data.expectedShippingCost === null
          ? null
          : parseMoney(data.expectedShippingCost);
        const expectedTotal = parseMoney(data.expectedTotal);

        const quoteChanged =
          !Number.isFinite(expectedSubtotal) ||
          expectedSubtotal !== subtotal ||
          expectedShippingCost !== shippingCost ||
          !Number.isFinite(expectedTotal) ||
          expectedTotal !== total;

        if (quoteChanged) {
          fail('quote_changed', 'Actualizamos el precio o el costo de envío. Revisá el resumen antes de confirmar nuevamente.', {
            quote: {
              items: resolvedItems,
              subtotal,
              shippingCost,
              shippingPending,
              total
            }
          });
        }

        const shortId = orderId.slice(0, 8).toUpperCase();
        const now = FieldValue.serverTimestamp();
        const orderData = {
          requestId,
          source: 'secure-checkout-v1',
          shortId,
          userId: uid,
          userEmail: authEmail,
          contactEmail: contactEmail || authEmail,
          userName: name,
          userPhone: phone,
          items: resolvedItems,
          subtotal,
          shippingCost,
          shippingPending,
          total,
          storeWhatsapp: cleanText(settings.whatsappNumber || settings.whatsapp || DEFAULT_STORE_WHATSAPP, 40).replace(/\D/g, ''),
          storeInstagram: cleanText(settings.instagram, 120),
          shipping: {
            method: shippingMethod,
            city,
            address,
            referencia,
            zone,
            mapLocation: shippingMethod === 'delivery' ? mapLocation : null
          },
          payment: {
            method: paymentMethod,
            status: 'pendiente'
          },
          paymentStatus: 'pendiente',
          status: 'pendiente',
          notes,
          notificationStatus: 'pending',
          createdAt: now,
          updatedAt: now
        };

        for (const [productId, wantedQty] of quantityByProduct.entries()) {
          const product = productById.get(productId);
          const stock = parseStock(product && product.stock);
          if (stock !== null) {
            const productRef = db.collection('products').doc(productId);
            transaction.update(productRef, {
              stock: stock - wantedQty,
              updatedAt: now
            });
          }
        }

        transaction.create(orderRef, orderData);
        transaction.set(userRef, {
          purchaseCount: FieldValue.increment(1),
          orderCount: FieldValue.increment(1),
          totalOrders: FieldValue.increment(1),
          totalSpent: FieldValue.increment(total),
          pendingOrders: FieldValue.increment(1),
          lastOrderAt: now,
          lastOrderId: orderId,
          lastPurchaseAt: now,
          lastPurchaseOrderId: orderId,
          profileStatsUpdatedAt: now,
          updatedAt: now
        }, { merge: true });

        return publicOrderResult(orderId, orderData, true);
      });
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error('[createOrder] unexpected error:', error);
      throw new HttpsError('internal', 'No pudimos confirmar el pedido. Intentá nuevamente.');
    }
  }
);
