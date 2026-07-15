// =============================================================
// TINTIN ACCESORIOS — Fase 7: carrito sincronizado y resistente
//
// Compatibilidad:
// - El código clásico continúa leyendo/escribiendo `tt_cart`.
// - Este módulo lo redirige al carrito de invitada o de la cuenta activa.
// - Firestore usa users/{uid}/cart/{lineId} como fuente entre dispositivos.
//
// Garantías:
// - Una línea se identifica por producto + variante.
// - Las escrituras se agrupan y se ejecutan en orden.
// - Un snapshot remoto nunca pisa una edición local todavía pendiente.
// - El carrito de invitada se combina una sola vez al iniciar sesión.
// - Precio/nombre/imagen son solo datos visuales; checkout vuelve a validarlos.
// =============================================================

import { auth, db } from './firebase.js';
import { sanitizeImageUrl } from './image-utils.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const existingRuntime = window.__TintinCartSyncV2 || null;

function createRuntime() {
  const PUBLIC_CART_KEY = 'tt_cart';
  const GUEST_CART_KEY = 'tt_cart_guest';
  const USER_CART_PREFIX = 'tt_cart_user_';
  const DEVICE_KEY = 'tt_cart_device_v2';
  const MIGRATED_PREFIX = 'tt_cart_v2_migrated_';
  const DIRTY_PREFIX = 'tt_cart_v2_dirty_';
  const MAX_QTY = 99;
  const MAX_CART_LINES = 100;

  // Se capturan una sola vez. Si una versión anterior ya había parcheado
  // Storage, las claves internas usadas abajo no son `tt_cart`, por lo que
  // siguen pasando sin redirección y no se genera recursión.
  const nativeGetItem = Storage.prototype.getItem;
  const nativeSetItem = Storage.prototype.setItem;
  const nativeRemoveItem = Storage.prototype.removeItem;

  let currentUser = null;
  let activeCartKey = GUEST_CART_KEY;
  let remoteUnsubscribe = null;
  let remoteInitialized = false;
  let authGeneration = 0;
  let snapshotChain = Promise.resolve();
  let writeChain = Promise.resolve();
  let syncTimer = 0;
  let desiredCart = [];
  let desiredProjection = '[]';
  let lastRemoteProjection = '[]';
  let pendingRemoteWrite = false;
  let guestAtLogin = [];
  let dispatchScheduled = false;
  let status = 'guest';
  let readyResolve = null;
  let readyPromise = new Promise(resolve => { readyResolve = resolve; });

  function rawString(key) {
    try { return nativeGetItem.call(window.localStorage, key); } catch { return null; }
  }

  function rawStringSet(key, value) {
    try { nativeSetItem.call(window.localStorage, key, String(value)); } catch {}
  }

  function rawRemove(key) {
    try { nativeRemoveItem.call(window.localStorage, key); } catch {}
  }

  function rawGet(key) {
    try {
      const parsed = JSON.parse(nativeGetItem.call(window.localStorage, key) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function rawSet(key, items) {
    try {
      nativeSetItem.call(window.localStorage, key, JSON.stringify(Array.isArray(items) ? items : []));
    } catch {}
  }

  function deviceId() {
    let value = rawString(DEVICE_KEY);
    if (value && /^[A-Za-z0-9_-]{12,100}$/.test(value)) return value;
    value = window.crypto?.randomUUID
      ? `dev_${window.crypto.randomUUID().replace(/-/g, '_')}`
      : `dev_${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
    rawStringSet(DEVICE_KEY, value);
    return value;
  }

  const runtimeDeviceId = deviceId();

  function cleanText(value, maxLength) {
    return String(value == null ? '' : value)
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/[<>]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLength);
  }

  function normalizeVariant(value) {
    return cleanText(value, 120).replace(/\s+/g, ' ');
  }

  function hashLine(value) {
    let hash = 2166136261;
    const input = String(value);
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function lineIdFor(itemOrId, variantValue = '') {
    const item = itemOrId && typeof itemOrId === 'object'
      ? itemOrId
      : { id: itemOrId, variant: variantValue };
    const id = cleanText(item?.id, 180);
    const variant = normalizeVariant(item?.variant);
    const prefix = (id || 'item').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60);
    return `ln_${prefix}_${hashLine(`${id}\u241f${variant}`)}`;
  }

  function normalizeItem(input) {
    if (!input || typeof input !== 'object') return null;
    const id = cleanText(input.id, 180);
    if (!id) return null;
    const variant = normalizeVariant(input.variant);
    const parsedQty = Number(input.qty == null ? 1 : input.qty);
    if (!Number.isFinite(parsedQty)) return null;
    const qty = Math.max(1, Math.min(MAX_QTY, Math.floor(parsedQty)));
    const parsedPrice = Number(input.price);
    const price = Number.isFinite(parsedPrice) && parsedPrice >= 0 ? parsedPrice : 0;
    const imageUrl = sanitizeImageUrl(input.imageUrl || input.imgUrl || input.image || '');
    return {
      lineId: lineIdFor({ id, variant }),
      id,
      variant,
      qty,
      name: cleanText(input.name || input.title || '', 180),
      cat: cleanText(input.cat || input.category || '', 120),
      price,
      imageUrl,
      imgUrl: imageUrl,
    };
  }

  function mergeMetadata(primary, fallback) {
    return normalizeItem({
      ...fallback,
      ...primary,
      name: primary?.name || fallback?.name || '',
      cat: primary?.cat || fallback?.cat || '',
      price: Number(primary?.price) > 0 ? primary.price : fallback?.price,
      imageUrl: primary?.imageUrl || primary?.imgUrl || fallback?.imageUrl || fallback?.imgUrl || '',
    });
  }

  function normalizeCart(items) {
    const map = new Map();
    for (const raw of Array.isArray(items) ? items : []) {
      const item = normalizeItem(raw);
      if (!item) continue;
      const previous = map.get(item.lineId);
      if (!previous) {
        map.set(item.lineId, item);
        continue;
      }
      const merged = mergeMetadata(item, previous);
      merged.qty = Math.min(MAX_QTY, previous.qty + item.qty);
      map.set(item.lineId, merged);
    }
    return [...map.values()].slice(0, MAX_CART_LINES);
  }

  function projection(items) {
    return JSON.stringify(
      normalizeCart(items)
        .map(item => ({ lineId: item.lineId, id: item.id, variant: item.variant, qty: item.qty }))
        .sort((a, b) => a.lineId.localeCompare(b.lineId))
    );
  }

  function cartKeyForUser(user) {
    return user?.uid ? `${USER_CART_PREFIX}${user.uid}` : GUEST_CART_KEY;
  }

  function currentLocalCart() {
    const normalized = normalizeCart(rawGet(activeCartKey));
    const before = rawString(activeCartKey) || '[]';
    const after = JSON.stringify(normalized);
    if (before !== after) rawSet(activeCartKey, normalized);
    return normalized;
  }

  function writeLocal(items, { notify = true } = {}) {
    const normalized = normalizeCart(items);
    rawSet(activeCartKey, normalized);
    if (notify) dispatchCartUpdated();
    return normalized;
  }

  function setStatus(nextStatus) {
    status = nextStatus;
    updateSyncIndicator();
    window.dispatchEvent(new CustomEvent('tintin:cart-sync-status', {
      detail: { status, userId: currentUser?.uid || null }
    }));
  }

  function statusLabel() {
    if (!currentUser) return 'Guardado en este dispositivo';
    if (status === 'loading') return 'Cargando tu carrito…';
    if (status === 'saving') return 'Guardando cambios…';
    if (status === 'offline') return 'Sin conexión · guardado acá';
    if (status === 'error') return 'No se pudo sincronizar';
    return 'Carrito sincronizado';
  }

  function updateSyncIndicator() {
    document.querySelectorAll('.tt-cart-sync-status').forEach(node => {
      node.textContent = statusLabel();
      node.dataset.state = status;
    });
  }

  function ensureSyncIndicator() {
    const header = document.querySelector('.tt-cart-header');
    if (!header || header.querySelector('.tt-cart-sync-status')) return;
    const node = document.createElement('div');
    node.className = 'tt-cart-sync-status';
    node.style.cssText = 'margin-left:auto;margin-right:8px;font-size:10px;line-height:1.3;color:#9a6074;text-align:right;max-width:150px';
    header.insertBefore(node, header.querySelector('.tt-cart-close'));
    updateSyncIndicator();
  }

  function enhanceCartRows() {
    const items = currentLocalCart();
    const drawerRows = [...document.querySelectorAll('.tt-cart-item')];
    drawerRows.forEach((row, index) => {
      const item = items[index];
      if (!item) return;
      row.dataset.lineId = item.lineId;
      const qtyButtons = row.querySelectorAll('.tt-cart-qty-btn');
      if (qtyButtons[0]) qtyButtons[0].dataset.cartAction = 'minus';
      if (qtyButtons[1]) qtyButtons[1].dataset.cartAction = 'plus';
      const remove = row.querySelector('.tt-cart-item-remove');
      if (remove) remove.dataset.cartAction = 'remove';
    });

    const checkoutRows = [...document.querySelectorAll('.ck-item')];
    checkoutRows.forEach((row, index) => {
      const item = items[index];
      if (!item) return;
      row.dataset.lineId = item.lineId;
      row.querySelectorAll('[data-action]').forEach(button => {
        button.dataset.cartAction = button.dataset.action;
      });
    });
    ensureSyncIndicator();
  }

  function refreshVisibleCart() {
    try { window.updateCartBadge?.(); } catch (error) { console.warn('[cart-sync-v2] badge:', error); }
    try {
      const rendered = window.renderCart?.();
      if (rendered?.catch) rendered.catch(error => console.warn('[cart-sync-v2] render:', error));
    } catch (error) {
      console.warn('[cart-sync-v2] render:', error);
    }
    window.setTimeout(enhanceCartRows, 0);
    window.requestAnimationFrame?.(() => enhanceCartRows());
  }

  function dispatchCartUpdated() {
    if (dispatchScheduled) return;
    dispatchScheduled = true;
    queueMicrotask(() => {
      dispatchScheduled = false;
      const items = currentLocalCart();
      window.dispatchEvent(new CustomEvent('tt_cart_updated', {
        detail: { items, status, userId: currentUser?.uid || null }
      }));
      refreshVisibleCart();
    });
  }

  function richerFromCatalog(item) {
    const pool = window.PRODUCTS;
    if (!Array.isArray(pool)) return item;
    const product = pool.find(entry => String(entry.id) === String(item.id));
    if (!product) return item;
    return mergeMetadata({
      ...item,
      name: product.name || item.name,
      cat: product.cat || product.category || item.cat,
      price: product.price,
      imageUrl: product.imageUrl || product.image || item.imageUrl,
    }, item);
  }

  function enrichRemote(remoteItems, localItems) {
    const localByLine = new Map(normalizeCart(localItems).map(item => [item.lineId, item]));
    return normalizeCart(remoteItems.map(item => richerFromCatalog(mergeMetadata(item, localByLine.get(item.lineId)))));
  }

  function mergeMax(...lists) {
    const map = new Map();
    lists.flat().forEach(raw => {
      const item = normalizeItem(raw);
      if (!item) return;
      const previous = map.get(item.lineId);
      if (!previous) {
        map.set(item.lineId, item);
        return;
      }
      const merged = mergeMetadata(item, previous);
      merged.qty = Math.max(previous.qty, item.qty);
      map.set(item.lineId, merged);
    });
    return [...map.values()];
  }

  function addGuestQuantities(baseItems, guestItems) {
    const map = new Map(normalizeCart(baseItems).map(item => [item.lineId, item]));
    normalizeCart(guestItems).forEach(guestItem => {
      const previous = map.get(guestItem.lineId);
      if (!previous) {
        map.set(guestItem.lineId, guestItem);
        return;
      }
      const merged = mergeMetadata(previous, guestItem);
      merged.qty = Math.min(MAX_QTY, previous.qty + guestItem.qty);
      map.set(guestItem.lineId, merged);
    });
    return [...map.values()];
  }

  function remoteItemFromSnapshot(snapshotDoc) {
    const item = normalizeItem(snapshotDoc.data() || {});
    if (!item) return null;
    return { ...item, _remoteDocId: snapshotDoc.id };
  }

  function remotePayload(item) {
    return {
      schemaVersion: 2,
      lineId: item.lineId,
      id: item.id,
      variant: item.variant,
      qty: item.qty,
      name: item.name,
      cat: item.cat,
      price: item.price,
      imageUrl: item.imageUrl,
      updatedAt: serverTimestamp(),
      updatedByDevice: runtimeDeviceId,
    };
  }

  async function replaceRemoteCart(uid, items) {
    const normalized = normalizeCart(items);
    const cartRef = collection(db, 'users', uid, 'cart');
    const snapshot = await getDocs(cartRef);
    const desiredIds = new Set(normalized.map(item => item.lineId));
    const batch = writeBatch(db);
    let writes = 0;

    normalized.forEach(item => {
      batch.set(doc(db, 'users', uid, 'cart', item.lineId), remotePayload(item));
      writes += 1;
    });
    snapshot.docs.forEach(snapshotDoc => {
      if (!desiredIds.has(snapshotDoc.id)) {
        batch.delete(snapshotDoc.ref);
        writes += 1;
      }
    });
    if (writes) await batch.commit();
    return normalized;
  }

  function dirtyKey(uid) {
    return `${DIRTY_PREFIX}${uid}`;
  }

  function migratedKey(uid) {
    return `${MIGRATED_PREFIX}${uid}`;
  }

  function queueRemoteReplace(items) {
    if (!currentUser || !remoteInitialized) return Promise.resolve();
    const uid = currentUser.uid;
    const generation = authGeneration;
    const snapshotItems = normalizeCart(items);
    const snapshotProjection = projection(snapshotItems);

    writeChain = writeChain.then(async () => {
      if (!currentUser || currentUser.uid !== uid || generation !== authGeneration) return;
      await replaceRemoteCart(uid, snapshotItems);
      if (!currentUser || currentUser.uid !== uid || generation !== authGeneration) return;
      lastRemoteProjection = snapshotProjection;
      rawRemove(dirtyKey(uid));
      rawStringSet(migratedKey(uid), '1');
      if (desiredProjection === snapshotProjection) {
        pendingRemoteWrite = false;
        setStatus('synced');
      }
      if (guestAtLogin.length) {
        rawSet(GUEST_CART_KEY, []);
        guestAtLogin = [];
      }
    }).catch(error => {
      console.error('[cart-sync-v2] No se pudo sincronizar:', error);
      if (currentUser?.uid === uid) {
        pendingRemoteWrite = true;
        setStatus(navigator.onLine === false ? 'offline' : 'error');
      }
    });
    return writeChain;
  }

  function flushDebouncedSync() {
    window.clearTimeout(syncTimer);
    syncTimer = 0;
    if (!currentUser || !remoteInitialized || !pendingRemoteWrite) return Promise.resolve();
    return queueRemoteReplace(desiredCart);
  }

  function scheduleRemoteSync(items) {
    if (!currentUser) return;
    desiredCart = normalizeCart(items);
    desiredProjection = projection(desiredCart);
    rawStringSet(dirtyKey(currentUser.uid), '1');
    pendingRemoteWrite = true;
    setStatus(navigator.onLine === false ? 'offline' : 'saving');
    window.clearTimeout(syncTimer);
    if (!remoteInitialized) return;
    syncTimer = window.setTimeout(() => {
      flushDebouncedSync();
    }, 120);
  }

  async function handleInitialRemote(snapshot, generation) {
    if (!currentUser || generation !== authGeneration) return;
    const uid = currentUser.uid;
    const remoteDocs = snapshot.docs.map(remoteItemFromSnapshot).filter(Boolean);
    const remoteItems = remoteDocs.map(({ _remoteDocId, ...item }) => item);
    const localItems = normalizeCart(rawGet(activeCartKey));
    const firstV2Migration = rawString(migratedKey(uid)) !== '1';
    const hasUnsyncedLocal = rawString(dirtyKey(uid)) === '1';

    let base = (firstV2Migration || hasUnsyncedLocal)
      ? mergeMax(remoteItems, localItems)
      : enrichRemote(remoteItems, localItems);
    base = addGuestQuantities(base, guestAtLogin);
    base = normalizeCart(base);

    writeLocal(base, { notify: true });
    desiredCart = base;
    desiredProjection = projection(base);
    lastRemoteProjection = projection(remoteItems);
    remoteInitialized = true;

    const hasLegacyDocIds = remoteDocs.some(item => item._remoteDocId !== item.lineId);
    if (desiredProjection !== lastRemoteProjection || hasLegacyDocIds || firstV2Migration || hasUnsyncedLocal) {
      pendingRemoteWrite = true;
      setStatus(navigator.onLine === false ? 'offline' : 'saving');
      queueRemoteReplace(base);
    } else {
      pendingRemoteWrite = false;
      setStatus('synced');
      rawStringSet(migratedKey(uid), '1');
      if (guestAtLogin.length) {
        rawSet(GUEST_CART_KEY, []);
        guestAtLogin = [];
      }
    }
    readyResolve?.();
  }

  function handleLaterRemote(snapshot, generation) {
    if (!currentUser || generation !== authGeneration) return;
    const remoteItems = snapshot.docs.map(remoteItemFromSnapshot).filter(Boolean).map(({ _remoteDocId, ...item }) => item);
    const remoteProjection = projection(remoteItems);
    lastRemoteProjection = remoteProjection;

    if (pendingRemoteWrite && remoteProjection !== desiredProjection) {
      setStatus(navigator.onLine === false ? 'offline' : 'saving');
      return;
    }

    pendingRemoteWrite = false;
    const enriched = enrichRemote(remoteItems, currentLocalCart());
    writeLocal(enriched, { notify: true });
    desiredCart = enriched;
    desiredProjection = remoteProjection;
    rawRemove(dirtyKey(currentUser.uid));
    setStatus('synced');
  }

  function subscribeToRemote(user, generation) {
    const cartRef = collection(db, 'users', user.uid, 'cart');
    let firstSnapshot = true;
    remoteUnsubscribe = onSnapshot(
      cartRef,
      { includeMetadataChanges: true },
      snapshot => {
        snapshotChain = snapshotChain.then(async () => {
          if (generation !== authGeneration) return;
          if (firstSnapshot) {
            firstSnapshot = false;
            await handleInitialRemote(snapshot, generation);
          } else {
            handleLaterRemote(snapshot, generation);
          }
        }).catch(error => {
          console.error('[cart-sync-v2] snapshot:', error);
          setStatus('error');
          readyResolve?.();
        });
      },
      error => {
        console.error('[cart-sync-v2] listener:', error);
        setStatus(navigator.onLine === false ? 'offline' : 'error');
        readyResolve?.();
      }
    );
  }

  function resetReady() {
    readyPromise = new Promise(resolve => { readyResolve = resolve; });
  }

  function activateIdentity(user) {
    authGeneration += 1;
    const generation = authGeneration;
    remoteUnsubscribe?.();
    remoteUnsubscribe = null;
    window.clearTimeout(syncTimer);
    syncTimer = 0;
    remoteInitialized = false;
    pendingRemoteWrite = false;
    resetReady();

    currentUser = user || null;
    if (!currentUser) {
      activeCartKey = GUEST_CART_KEY;
      guestAtLogin = [];
      desiredCart = currentLocalCart();
      desiredProjection = projection(desiredCart);
      lastRemoteProjection = '[]';
      setStatus('guest');
      dispatchCartUpdated();
      readyResolve?.();
      return;
    }

    guestAtLogin = normalizeCart(rawGet(GUEST_CART_KEY));
    activeCartKey = cartKeyForUser(currentUser);
    desiredCart = currentLocalCart();
    desiredProjection = projection(desiredCart);
    lastRemoteProjection = '[]';
    setStatus('loading');
    dispatchCartUpdated();
    subscribeToRemote(currentUser, generation);
  }

  function migrateLegacyGuestCart() {
    const legacy = rawGet(PUBLIC_CART_KEY);
    const guest = rawGet(GUEST_CART_KEY);
    if (legacy.length && !guest.length) rawSet(GUEST_CART_KEY, normalizeCart(legacy));
    rawRemove(PUBLIC_CART_KEY);
  }

  function patchClassicCartStorage() {
    if (window.TintinScopedCartStoragePatchedV2) return;
    window.TintinScopedCartStoragePatchedV2 = true;

    Storage.prototype.getItem = function getItem(key) {
      if (this === window.localStorage && key === PUBLIC_CART_KEY) {
        return JSON.stringify(currentLocalCart());
      }
      return nativeGetItem.call(this, key);
    };

    Storage.prototype.setItem = function setItem(key, value) {
      if (this === window.localStorage && key === PUBLIC_CART_KEY) {
        let parsed = [];
        try { parsed = JSON.parse(String(value)); } catch {}
        const normalized = normalizeCart(parsed);
        const current = currentLocalCart();

        // Un setItem con el mismo carrito es un no-op real. El código clásico
        // puede normalizar al leer; sin esta comparación cada lectura publicaba
        // tt_cart_updated, el render volvía a leer y se creaba una cola infinita
        // de microtareas que impedía incluso ejecutar el timeout del loader.
        if (JSON.stringify(current) === JSON.stringify(normalized)) return;

        writeLocal(normalized, { notify: true });
        scheduleRemoteSync(normalized);
        return;
      }
      return nativeSetItem.call(this, key, value);
    };

    Storage.prototype.removeItem = function removeItem(key) {
      if (this === window.localStorage && key === PUBLIC_CART_KEY) {
        if (!currentLocalCart().length) return;
        const normalized = writeLocal([], { notify: true });
        scheduleRemoteSync(normalized);
        return;
      }
      return nativeRemoveItem.call(this, key);
    };
  }

  function stockLimit(productId) {
    const pool = window.PRODUCTS;
    if (!Array.isArray(pool)) return MAX_QTY;
    const product = pool.find(entry => String(entry.id) === String(productId));
    if (!product || product.stock === null || product.stock === undefined) return MAX_QTY;
    const parsed = Number(product.stock);
    return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : MAX_QTY;
  }

  function findLine(items, identifier, variantValue = undefined) {
    const wanted = String(identifier == null ? '' : identifier);
    const variant = variantValue === undefined ? undefined : normalizeVariant(variantValue);
    return items.find(item =>
      item.lineId === wanted ||
      (String(item.id) === wanted && (variant === undefined || item.variant === variant))
    );
  }

  async function addToCart(item) {
    const incoming = normalizeItem(item);
    if (!incoming) return { item: null, capped: false };
    const items = currentLocalCart();
    const existing = items.find(entry => entry.lineId === incoming.lineId);
    const limit = stockLimit(incoming.id);
    const currentProductQty = items
      .filter(entry => String(entry.id) === String(incoming.id))
      .reduce((sum, entry) => sum + entry.qty, 0);
    const requested = Math.max(1, Number(incoming.qty || 1));
    const available = Math.max(0, limit - currentProductQty);
    const accepted = Math.min(requested, available);
    const capped = accepted < requested;

    if (existing) {
      const extra = Math.min(requested, Math.max(0, limit - currentProductQty));
      if (extra <= 0) return { item: existing, capped: true };
      existing.qty = Math.min(MAX_QTY, existing.qty + extra);
      Object.assign(existing, mergeMetadata(incoming, existing), { qty: existing.qty });
    } else {
      if (accepted <= 0) return { item: null, capped: true };
      incoming.qty = accepted;
      items.push(incoming);
    }

    const normalized = writeLocal(items, { notify: true });
    scheduleRemoteSync(normalized);
    const saved = normalized.find(entry => entry.lineId === incoming.lineId) || null;
    return { item: saved, capped };
  }

  async function removeFromCart(identifier, variantValue = undefined) {
    const items = currentLocalCart();
    const line = findLine(items, identifier, variantValue);
    if (!line) return false;
    const normalized = writeLocal(items.filter(item => item.lineId !== line.lineId), { notify: true });
    scheduleRemoteSync(normalized);
    return true;
  }

  async function updateQty(identifier, delta, variantValue = undefined) {
    const items = currentLocalCart();
    const line = findLine(items, identifier, variantValue);
    if (!line) return { capped: false, item: null };
    const numericDelta = Math.trunc(Number(delta) || 0);
    if (!numericDelta) return { capped: false, item: line };

    let capped = false;
    if (numericDelta > 0) {
      const limit = stockLimit(line.id);
      const currentProductQty = items
        .filter(item => String(item.id) === String(line.id))
        .reduce((sum, item) => sum + item.qty, 0);
      const allowedDelta = Math.max(0, Math.min(numericDelta, limit - currentProductQty));
      capped = allowedDelta < numericDelta;
      line.qty = Math.min(MAX_QTY, line.qty + allowedDelta);
    } else {
      line.qty = Math.max(1, line.qty + numericDelta);
    }

    const normalized = writeLocal(items, { notify: true });
    scheduleRemoteSync(normalized);
    return { capped, item: normalized.find(item => item.lineId === line.lineId) || null };
  }

  async function clearCart() {
    const normalized = writeLocal([], { notify: true });
    scheduleRemoteSync(normalized);
    await flushCartSync();
  }

  function getCartLocal() {
    return currentLocalCart();
  }

  function setCartLocal(items) {
    const normalized = writeLocal(items, { notify: true });
    scheduleRemoteSync(normalized);
    return normalized;
  }

  async function getCart() {
    await readyPromise;
    return currentLocalCart();
  }

  async function flushCartSync() {
    await flushDebouncedSync();
    await writeChain;
  }

  async function syncCartToFirestore(uid) {
    if (!currentUser || currentUser.uid !== uid) return;
    scheduleRemoteSync(currentLocalCart());
    await flushCartSync();
  }

  function formatPrice(value) {
    const parsed = Number(value);
    const amount = Number.isFinite(parsed) ? Math.round(parsed) : 0;
    return `Gs. ${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  }

  function cartTotal(items) {
    return normalizeCart(items).reduce((sum, item) => sum + Number(item.price || 0) * item.qty, 0);
  }

  function interceptLegacyCartButtons(event) {
    const button = event.target?.closest?.(
      '.tt-cart-qty-btn,.tt-cart-item-remove,.ck-qty-btn,.ck-remove-btn'
    );
    if (!button) return;
    const row = button.closest('.tt-cart-item,.ck-item');
    const lineId = row?.dataset.lineId;
    if (!lineId) return;
    const action = button.dataset.cartAction || button.dataset.action || '';
    if (!['minus', 'plus', 'remove'].includes(action)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (action === 'remove') removeFromCart(lineId);
    else updateQty(lineId, action === 'plus' ? 1 : -1);
  }

  function boot() {
    migrateLegacyGuestCart();
    patchClassicCartStorage();
    document.addEventListener('click', interceptLegacyCartButtons, true);
    document.addEventListener('DOMContentLoaded', () => {
      ensureSyncIndicator();
      dispatchCartUpdated();
    }, { once: true });
    window.addEventListener('storage', event => {
      if (event.storageArea !== window.localStorage) return;
      if (event.key !== activeCartKey && event.key !== null) return;
      const items = currentLocalCart();
      dispatchCartUpdated();
      if (currentUser && projection(items) !== lastRemoteProjection) scheduleRemoteSync(items);
    });
    window.addEventListener('online', () => {
      if (currentUser && pendingRemoteWrite) {
        setStatus('saving');
        flushDebouncedSync();
      }
    });
    window.addEventListener('offline', () => {
      if (currentUser) setStatus('offline');
    });
    window.addEventListener('tintin:products-loaded', () => {
      const enriched = currentLocalCart().map(richerFromCatalog);
      writeLocal(enriched, { notify: true });
    });
    onAuthStateChanged(auth, activateIdentity);
  }

  const api = {
    getCartLocal,
    setCartLocal,
    getCart,
    addToCart,
    removeFromCart,
    updateQty,
    clearCart,
    syncCartToFirestore,
    flushCartSync,
    awaitCartReady: () => readyPromise,
    formatPrice,
    cartTotal,
    lineIdFor,
    getActiveKey: () => activeCartKey,
    getStatus: () => status,
    refreshVisibleCart,
  };

  window.CartFirestoreSync = {
    saveItem: () => scheduleRemoteSync(currentLocalCart()),
    removeItem: () => scheduleRemoteSync(currentLocalCart()),
    getActiveKey: api.getActiveKey,
    lineIdFor,
    updateLine: updateQty,
    removeLine: removeFromCart,
    clear: clearCart,
    flush: flushCartSync,
    ready: api.awaitCartReady,
    getStatus: api.getStatus,
  };

  window.TintinCartSyncV2 = api;
  boot();
  return api;
}

const runtime = existingRuntime || createRuntime();
if (!existingRuntime) window.__TintinCartSyncV2 = runtime;

export const getCartLocal = (...args) => runtime.getCartLocal(...args);
export const setCartLocal = (...args) => runtime.setCartLocal(...args);
export const getCart = (...args) => runtime.getCart(...args);
export const addToCart = (...args) => runtime.addToCart(...args);
export const removeFromCart = (...args) => runtime.removeFromCart(...args);
export const updateQty = (...args) => runtime.updateQty(...args);
export const clearCart = (...args) => runtime.clearCart(...args);
export const syncCartToFirestore = (...args) => runtime.syncCartToFirestore(...args);
export const flushCartSync = (...args) => runtime.flushCartSync(...args);
export const awaitCartReady = (...args) => runtime.awaitCartReady(...args);
export const formatPrice = (...args) => runtime.formatPrice(...args);
export const cartTotal = (...args) => runtime.cartTotal(...args);
export const lineIdFor = (...args) => runtime.lineIdFor(...args);

// checkout.html ya carga este módulo. Desde acá se inicia el guardado seguro
// únicamente en la pantalla de compra, sin afectar catálogo, producto o carrito.
const checkoutPath = (window.location.pathname || '').toLowerCase();
if (
  (checkoutPath.endsWith('/checkout.html') || checkoutPath.endsWith('/checkout')) &&
  !window.TintinSecureCheckoutOrderLoading
) {
  window.TintinSecureCheckoutOrderLoading = true;
  import('./secure-checkout-order.js?v=tintin-20260715-8').catch(error => {
    console.error('[cart-sync-v2] No se pudo cargar el guardado seguro del pedido:', error);
  });
}
