// =============================================
// TINTIN ACCESORIOS — Cart Sync
// localStorage for guests, Firestore for logged-in users
// localStorage key: 'tt_cart' → [{id, name, cat, price, qty, imgUrl?}]
// Firestore: users/{uid}/cart (collection, one doc per product id)
// =============================================

import { auth, db } from "./firebase.js";
import {
  collection, doc, getDocs, setDoc, deleteDoc, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ---- Local helpers ----

export function getCartLocal() {
  try {
    return JSON.parse(localStorage.getItem('tt_cart') || '[]');
  } catch {
    return [];
  }
}

export function setCartLocal(items) {
  localStorage.setItem('tt_cart', JSON.stringify(items));
  // Dispatch storage event so other tabs/scripts update
  window.dispatchEvent(new Event('tt_cart_updated'));
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

/**
 * Get cart — merges localStorage + Firestore if logged in.
 *
 * IMPORTANT: this does a Firestore round-trip, so the user can add/remove
 * items locally (via addToCart/removeFromCart, both synchronous on
 * localStorage) *while this is in flight*. To never lose that work, this
 * re-reads localStorage right before writing and only ever ADDS remote-only
 * items on top of whatever is currently local — it must never treat the
 * remote copy as the source of truth and overwrite local with it.
 * @returns {Promise<Array>}
 */
export async function getCart() {
  const uid = currentUid();
  if (!uid) return getCartLocal();

  try {
    const remote = await getCartFromFirestore(uid);
    const localNow = getCartLocal(); // fresh read, not the snapshot from before the await
    const merged = [...localNow];
    let addedFromRemote = false;

    for (const remoteItem of remote) {
      if (!merged.find(l => String(l.id) === String(remoteItem.id))) {
        merged.push(remoteItem);
        addedFromRemote = true;
      }
    }
    // Push anything local-only up to Firestore too, so both sides end up in sync
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

// null/undefined stock (not tracked by Super Admin) means unlimited.
// window.PRODUCTS is populated by products-store.js and kept live via
// onSnapshot, so this always reflects the latest stock count.
function getStockLimit(id) {
  const pool = window.PRODUCTS;
  if (!Array.isArray(pool)) return Infinity;
  const p = pool.find(x => String(x.id) === String(id));
  if (!p || p.stock === null || p.stock === undefined) return Infinity;
  return Math.max(Number(p.stock), 0);
}

/**
 * Add item to cart. Clamps to available stock when Super Admin tracks it —
 * returns { item, capped } so callers can show a "limit reached" message.
 * @param {{id, name, cat, price, qty, imgUrl?}} item
 */
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
  if (uid) {
    await saveItemToFirestore(uid, updatedItem);
  }
  return { item: updatedItem, capped };
}

/**
 * Remove item from cart by id
 * @param {string|number} id
 */
export async function removeFromCart(id) {
  const items = getCartLocal().filter(i => String(i.id) !== String(id));
  setCartLocal(items);

  const uid = currentUid();
  if (uid) {
    await deleteItemFromFirestore(uid, id);
  }
}

/**
 * Update item quantity by delta. Clamps to available stock on increments —
 * returns { capped } so callers can show a "limit reached" message.
 * @param {string|number} id
 * @param {number} delta - positive or negative
 */
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
  if (uid) {
    await saveItemToFirestore(uid, items[idx]);
  }
  return { capped };
}

/**
 * Clear entire cart
 */
export async function clearCart() {
  setCartLocal([]);

  const uid = currentUid();
  if (uid) {
    await clearCartFromFirestore(uid);
  }
}

/**
 * On login: push localStorage cart to Firestore, then clear local
 * @param {string} uid
 */
export async function syncCartToFirestore(uid) {
  const local = getCartLocal();
  if (!local.length) return;

  try {
    const remote = await getCartFromFirestore(uid);
    for (const localItem of local) {
      const exists = remote.find(r => String(r.id) === String(localItem.id));
      if (!exists) {
        await saveItemToFirestore(uid, localItem);
      }
    }
  } catch (e) {
    console.error('Error syncing cart to Firestore:', e);
  }
}

// ---- Bridge for classic (non-module) scripts ----
// script.js is loaded as a plain <script>, so it can't `import` this module.
// It writes to the same localStorage key directly, and calls this bridge
// (if present on the page) to also push the change to Firestore when logged in.
window.CartFirestoreSync = {
  saveItem: (item) => {
    const uid = currentUid();
    if (uid) saveItemToFirestore(uid, item);
  },
  removeItem: (id) => {
    const uid = currentUid();
    if (uid) deleteItemFromFirestore(uid, id);
  },
};

// When a user logs in on a page that only knows the synchronous, localStorage-only
// cart (product/catalog listings via script.js), pull in whatever they already had
// saved in Firestore from another device/session, so it's not silently missing.
onAuthStateChanged(auth, user => {
  if (user) getCart();
});
