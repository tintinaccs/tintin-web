import { auth, provider } from "./firebase.js";
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const ADMIN_EMAIL = "tintinaccs@gmail.com";

export function loginGoogle() {
  signInWithPopup(auth, provider).catch(err => console.error("Error login:", err));
}

export function logout() {
  signOut(auth);
}

export function onAuthReady(callback) {
  onAuthStateChanged(auth, callback);
}

export function isAdmin(user) {
  return user && user.email === ADMIN_EMAIL;
}