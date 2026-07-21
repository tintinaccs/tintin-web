from pathlib import Path
import re

path = Path('js/secure-checkout-order.js')
source = path.read_text(encoding='utf-8')

pattern = re.compile(
    r"  async function createOrderWithSparkTransaction\(draft\) \{.*?\n  \}\n\n  function buildWhatsAppMessage",
    re.S,
)
replacement = r'''  async function createPendingOrder(draft) {
    const user = auth.currentUser;
    const uid = user.uid;
    const email = text(user.email).toLowerCase();
    const orderId = `${uid}_${draft.requestId}`;
    const orderRef = doc(db, 'orders', orderId);
    const settingsRef = doc(db, 'settings', 'general');
    const userRef = doc(db, 'users', uid);
    const productRefs = draft.cartLines.map(line => doc(db, 'products', line.id));

    return runTransaction(db, async transaction => {
      const existing = await transaction.get(orderRef);
      if (existing.exists()) {
        const data = existing.data() || {};
        if (data.inventoryState === 'pending' || data.inventoryState === 'reserved') {
          return { ...data, orderId, created: false };
        }
        throw appError('order_state_invalid', 'El pedido existente no puede reanudarse.');
      }

      const settingsSnap = await transaction.get(settingsRef);
      const userSnap = await transaction.get(userRef);
      const productSnaps = [];
      for (const productRef of productRefs) productSnaps.push(await transaction.get(productRef));

      if (!settingsSnap.exists()) throw appError('settings_missing', 'No pudimos comprobar la configuración de la tienda.');
      if (!userSnap.exists()) throw appError('profile_missing', 'No pudimos comprobar tu perfil. Cerrá sesión y volvé a ingresar.');

      const settings = settingsSnap.data() || {};
      const userData = userSnap.data() || {};
      if (email !== SUPER_ADMIN_EMAIL && settings.storeOpen !== true) throw appError('store_closed', 'La tienda está temporalmente cerrada.');
      if (email !== SUPER_ADMIN_EMAIL && userData.blocked === true) throw appError('blocked_account', 'Esta cuenta está bloqueada y no puede realizar pedidos.');
      if ((settings.paymentMethods || {})[draft.paymentMethod] === false) throw appError('payment_unavailable', 'Ese método de pago ya no está disponible.');

      const shipping = resolveShipping(settings, draft.selectedCity, draft.mapLocation);
      const resolvedItems = [];
      let subtotal = 0;

      productSnaps.forEach((snapshot, index) => {
        const requested = draft.cartLines[index];
        if (!snapshot.exists()) throw appError('product_not_found', 'Uno de los productos ya no está disponible.', { productId: requested.id });
        const product = snapshot.data() || {};
        if (product.active === false) throw appError('product_inactive', 'Uno de los productos fue desactivado.', { productId: requested.id });
        const price = parseMoney(product.price);
        if (!Number.isFinite(price) || price < 0) throw appError('invalid_price', 'No pudimos comprobar el precio de uno de los productos.');
        const stock = parseStock(product.stock);
        if (stock !== null && requested.qty > stock) {
          throw appError('insufficient_stock', 'Cambió el stock de uno de los productos.', {
            productId: requested.id, available: stock, requested: requested.qty
          });
        }
        const item = {
          id: requested.id,
          name: text(product.name || product.title || product.Title || 'Producto').slice(0, 180),
          cat: text(product.category || product.collectionSlug || product.collection || product.cat || product.Type || product.type).slice(0, 120),
          price,
          qty: requested.qty,
          variant: requested.variants.join(' / ').slice(0, 120),
          imageUrl: text(product.imageUrl || product.image || product.img).slice(0, 900)
        };
        resolvedItems.push(item);
        subtotal += price * requested.qty;
      });

      const shippingCost = shipping.cost === null ? 0 : shipping.cost;
      const total = subtotal + shippingCost;
      const quote = { items: resolvedItems, subtotal, shippingCost, shippingPending: shipping.pending, total };
      if (
        draft.expectedSubtotal !== subtotal ||
        draft.expectedShippingCost !== shippingCost ||
        draft.expectedShippingPending !== shipping.pending ||
        draft.expectedTotal !== total
      ) {
        throw appError('quote_changed', 'Cambió un precio o el costo de envío. Revisá el resumen actualizado.', { quote });
      }

      const shortId = draft.requestId.replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase();
      const orderData = {
        requestId: draft.requestId,
        source: 'spark-checkout-v1',
        shortId,
        userId: uid,
        userEmail: email,
        contactEmail: draft.contactEmail || email,
        userName: draft.name,
        userPhone: draft.phone,
        items: resolvedItems,
        subtotal,
        shippingCost,
        shippingPending: shipping.pending,
        total,
        storeWhatsapp: text(settings.whatsappNumber || settings.whatsapp || DEFAULT_STORE_WHATSAPP).replace(/\D/g, ''),
        storeInstagram: text(settings.instagram).slice(0, 120),
        shipping: {
          method: shipping.method,
          city: shipping.city,
          rateIndex: shipping.rateIndex,
          address: draft.address,
          referencia: draft.referencia,
          zone: shipping.method === 'encomienda' ? 'interior' : 'central',
          mapLocation: shipping.method === 'delivery' ? shipping.mapLocation : null
        },
        payment: { method: draft.paymentMethod, status: 'pendiente' },
        paymentStatus: 'pendiente',
        status: 'inventory_pending',
        notes: draft.notes,
        notificationStatus: 'pending',
        inventoryState: 'pending',
        inventoryRevision: 0,
        inventoryUpdatedAt: serverTimestamp(),
        inventoryUpdatedBy: email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      transaction.set(orderRef, orderData);
      return { ...orderData, orderId, created: true };
    }, { maxAttempts: 2 });
  }

  async function reserveOrderInventory(orderId) {
    const user = auth.currentUser;
    const email = text(user.email).toLowerCase();
    const orderRef = doc(db, 'orders', orderId);

    const result = await runTransaction(db, async transaction => {
      const orderSnap = await transaction.get(orderRef);
      if (!orderSnap.exists()) throw appError('order_not_found', 'El pedido pendiente ya no existe.');
      const order = orderSnap.data() || {};
      if (order.inventoryState === 'reserved') return { ...order, orderId, success: true, created: false };
      if (order.inventoryState !== 'pending' || order.status !== 'inventory_pending') {
        throw appError('order_state_invalid', 'El pedido no puede reservar inventario.');
      }

      const items = Array.isArray(order.items) ? order.items : [];
      const productRefs = items.map(item => doc(db, 'products', String(item.id)));
      const productSnaps = [];
      for (const productRef of productRefs) productSnaps.push(await transaction.get(productRef));

      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        const snapshot = productSnaps[index];
        if (!snapshot.exists()) {
          transaction.delete(orderRef);
          return { failure: 'product_not_found', productId: item.id };
        }
        const product = snapshot.data() || {};
        const stock = parseStock(product.stock);
        if (product.active === false || parseMoney(product.price) !== Number(item.price)) {
          transaction.delete(orderRef);
          return { failure: 'quote_changed' };
        }
        if (stock !== null && Number(item.qty) > stock) {
          transaction.delete(orderRef);
          return { failure: 'insufficient_stock', productId: item.id, available: stock, requested: Number(item.qty) };
        }
      }

      productSnaps.forEach((snapshot, index) => {
        const stock = parseStock(snapshot.data()?.stock);
        if (stock !== null) {
          transaction.update(productRefs[index], {
            stock: stock - Number(items[index].qty),
            lastStockOrderId: orderId,
            updatedAt: serverTimestamp()
          });
        }
      });

      transaction.update(orderRef, {
        status: 'pendiente',
        inventoryState: 'reserved',
        inventoryRevision: 1,
        inventoryUpdatedAt: serverTimestamp(),
        inventoryUpdatedBy: email,
        updatedAt: serverTimestamp()
      });

      return {
        ...order,
        orderId,
        status: 'pendiente',
        inventoryState: 'reserved',
        inventoryRevision: 1,
        success: true,
        created: true
      };
    }, { maxAttempts: 2 });

    if (result?.failure === 'insufficient_stock') {
      throw appError('insufficient_stock', 'Cambió el stock de uno de los productos.', result);
    }
    if (result?.failure === 'quote_changed') {
      throw appError('quote_changed', 'Cambió un precio. Revisá el carrito y confirmá nuevamente.');
    }
    if (result?.failure === 'product_not_found') {
      throw appError('product_not_found', 'Uno de los productos ya no está disponible.', result);
    }
    return result;
  }

  async function createOrderWithSparkTransaction(draft) {
    const pending = await createPendingOrder(draft);
    return reserveOrderInventory(pending.orderId);
  }

  function buildWhatsAppMessage'''
source, count = pattern.subn(replacement, source, count=1)
if count != 1:
    raise RuntimeError(f'createOrderWithSparkTransaction: coincidencias {count}')

path.write_text(source, encoding='utf-8')
print('[done] checkout dividido en pedido pendiente y reserva atómica')
