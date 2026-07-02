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
 * Get cart — merges localStorage + Firestore if logged in
 * @returns {Promise<Array>}
 */
export async function getCart() {
  const uid = currentUid();
  const local = getCartLocal();

  if (!uid) return local;

  try {
    const remote = await getCartFromFirestore(uid);
    // Merge: remote takes priority, but add local items not in remote
    const merged = [...remote];
    for (const localItem of local) {
      const exists = merged.find(r => String(r.id) === String(localItem.id));
      if (!exists) {
        merged.push(localItem);
        await saveItemToFirestore(uid, localItem);
      }
    }
    setCartLocal(merged);
    return merged;
  } catch (e) {
    return local;
  }
}

/**
 * Add item to cart
 * @param {{id, name, cat, price, qty, imgUrl?}} item
 */
export async function addToCart(item) {
  const items = getCartLocal();
  const idx = items.findIndex(i => String(i.id) === String(item.id));
  if (idx >= 0) {
    items[idx].qty = (items[idx].qty || 1) + (item.qty || 1);
  } else {
    items.push({ ...item, qty: item.qty || 1 });
  }
  setCartLocal(items);

  const uid = currentUid();
  if (uid) {
    const updatedItem = idx >= 0 ? items[idx] : items[items.length - 1];
    await saveItemToFirestore(uid, updatedItem);
  }
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
 * Update item quantity by delta
 * @param {string|number} id
 * @param {number} delta - positive or negative
 */
export async function updateQty(id, delta) {
  const items = getCartLocal();
  const idx = items.findIndex(i => String(i.id) === String(id));
  if (idx < 0) return;

  items[idx].qty = Math.max(1, (items[idx].qty || 1) + delta);
  setCartLocal(items);

  const uid = currentUid();
  if (uid) {
    await saveItemToFirestore(uid, items[idx]);
  }
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
