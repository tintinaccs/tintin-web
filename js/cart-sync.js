// =============================================
// TINTIN ACCESORIOS — Cart Sync
// Carrito independiente por identidad:
// - visitante sin login: tt_cart_guest
// - cuenta logueada: tt_cart_user_{uid}
// - Firestore: users/{uid}/cart
// =============================================

import { auth, db } from "./firebase.js";
import {
  collection, doc, getDocs, setDoc, deleteDoc, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const PUBLIC_CART_KEY = 'tt_cart';
const GUEST_CART_KEY = 'tt_cart_guest';
const USER_CART_PREFIX = 'tt_cart_user_';
let activeCartKey = GUEST_CART_KEY;

function cartKeyForUser(user) {
  return user?.uid ? `${USER_CART_PREFIX}${user.uid}` : GUEST_CART_KEY;
}

function rawGet(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

function rawSet(key, items) {
  localStorage.setItem(key, JSON.stringify(Array.isArray(items) ? items : []));
}

function dispatchCartUpdated() {
  window.dispatchEvent(new Event('tt_cart_updated'));
}

function migrateLegacyGuestCart() {
  const legacy = rawGet(PUBLIC_CART_KEY);
  const guest = rawGet(GUEST_CART_KEY);
  if (legacy.length && !guest.length) rawSet(GUEST_CART_KEY, legacy);
  try { localStorage.removeItem(PUBLIC_CART_KEY); } catch {}
}

function setActiveCartUser(user) {
  const nextKey = cartKeyForUser(user);
  if (!user) migrateLegacyGuestCart();
  if (activeCartKey !== nextKey) {
    activeCartKey = nextKey;
    dispatchCartUpdated();
  } else {
    activeCartKey = nextKey;
  }
}

setActiveCartUser(auth.currentUser);

// ---- Local helpers ----

export function getCartLocal() {
  return rawGet(activeCartKey);
}

export function setCartLocal(items) {
  rawSet(activeCartKey, items);
  dispatchCartUpdated();
}

export function formatPrice(n) {
  return 'Gs. ' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function cartTotal(items) {
  return items.reduce((s, i) => s + i.price * i.qty, 0);
}

// ---- Firestore helpers ----

function currentUid() {
  return auth.currentUser?.uid || null;
}

async function getCartFromFirestore(uid) {
  try {
    const colRef = collection(db, 'users', uid, 'cart');
    const snap = await getDocs(colRef);
    return snap.docs.map(d => d.data());
  } catch (e) {
    console.error('Error reading cart from Firestore:', e);
    return [];
  }
}

async function saveItemToFirestore(uid, item) {
  try {
    await setDoc(doc(db, 'users', uid, 'cart', String(item.id)), item);
  } catch (e) {
    console.error('Error saving cart item to Firestore:', e);
  }
}

async function deleteItemFromFirestore(uid, id) {
  try {
    await deleteDoc(doc(db, 'users', uid, 'cart', String(id)));
  } catch (e) {
    console.error('Error deleting cart item from Firestore:', e);
  }
}

async function clearCartFromFirestore(uid) {
  try {
    const colRef = collection(db, 'users', uid, 'cart');
    const snap = await getDocs(colRef);
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  } catch (e) {
    console.error('Error clearing cart from Firestore:', e);
  }
}

// ---- Public API ----

export async function getCart() {
  const uid = currentUid();
  if (!uid) return getCartLocal();

  try {
    const remote = await getCartFromFirestore(uid);
    const localNow = getCartLocal();
    const merged = [...localNow];
    let addedFromRemote = false;

    for (const remoteItem of remote) {
      if (!merged.find(l => String(l.id) === String(remoteItem.id))) {
        merged.push(remoteItem);
        addedFromRemote = true;
      }
    }

    for (const localItem of localNow) {
      if (!remote.find(r => String(r.id) === String(localItem.id))) {
        saveItemToFirestore(uid, localItem);
      }
    }

    if (addedFromRemote) setCartLocal(merged);
    return merged;
  } catch (e) {
    return getCartLocal();
  }
}

function getStockLimit(id) {
  const pool = window.PRODUCTS;
  if (!Array.isArray(pool)) return Infinity;
  const p = pool.find(x => String(x.id) === String(id));
  if (!p || p.stock === null || p.stock === undefined) return Infinity;
  return Math.max(Number(p.stock), 0);
}

export async function addToCart(item) {
  const items = getCartLocal();
  const idx = items.findIndex(i => String(i.id) === String(item.id));
  const limit = getStockLimit(item.id);
  let capped = false;

  if (idx >= 0) {
    const wanted = (items[idx].qty || 1) + (item.qty || 1);
    items[idx].qty = Math.min(wanted, limit);
    capped = wanted > limit;
  } else {
    const wanted = item.qty || 1;
    const qty = Math.min(wanted, limit);
    if (qty <= 0) return { item: null, capped: true };
    items.push({ ...item, qty });
    capped = qty < wanted;
  }
  setCartLocal(items);

  const uid = currentUid();
  const updatedItem = idx >= 0 ? items[idx] : items[items.length - 1];
  if (uid) await saveItemToFirestore(uid, updatedItem);
  return { item: updatedItem, capped };
}

export async function removeFromCart(id) {
  const items = getCartLocal().filter(i => String(i.id) !== String(id));
  setCartLocal(items);

  const uid = currentUid();
  if (uid) await deleteItemFromFirestore(uid, id);
}

export async function updateQty(id, delta) {
  const items = getCartLocal();
  const idx = items.findIndex(i => String(i.id) === String(id));
  if (idx < 0) return { capped: false };

  const limit = getStockLimit(id);
  const wanted = (items[idx].qty || 1) + delta;
  const capped = delta > 0 && wanted > limit;
  items[idx].qty = Math.max(1, Math.min(wanted, limit));
  setCartLocal(items);

  const uid = currentUid();
  if (uid) await saveItemToFirestore(uid, items[idx]);
  return { capped };
}

export async function clearCart() {
  setCartLocal([]);

  const uid = currentUid();
  if (uid) await clearCartFromFirestore(uid);
}

export async function syncCartToFirestore(uid) {
  const local = getCartLocal();
  if (!local.length) return;

  try {
    const remote = await getCartFromFirestore(uid);
    for (const localItem of local) {
      const exists = remote.find(r => String(r.id) === String(localItem.id));
      if (!exists) await saveItemToFirestore(uid, localItem);
    }
  } catch (e) {
    console.error('Error syncing cart to Firestore:', e);
  }
}

window.CartFirestoreSync = {
  saveItem: (item) => {
    const uid = currentUid();
    if (uid) saveItemToFirestore(uid, item);
  },
  removeItem: (id) => {
    const uid = currentUid();
    if (uid) deleteItemFromFirestore(uid, id);
  },
  getActiveKey: () => activeCartKey,
};

onAuthStateChanged(auth, user => {
  setActiveCartUser(user);
  if (user) getCart().then(() => dispatchCartUpdated());
  else dispatchCartUpdated();
});
