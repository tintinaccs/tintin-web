/* =============================================================
   TINTIN — Store Gate global
   =============================================================
   Hace que Super Admin → Configuración → "Tienda activa / abierta"
   sea una barrera real desde el arranque de la app.

   - Estado central: Firestore settings/general.storeOpen.
   - Default seguro: si storeOpen no existe, la tienda queda abierta.
   - Tienda cerrada: visitantes, clientas y roles operativos quedan bloqueados.
   - Super Admin real: únicamente tintinaccs@gmail.com puede entrar igual.
   - Preparado para futuro: settings/general.storeClosedAllowedRoles puede
     habilitar roles puntuales durante cierre, pero por defecto es [].
   ============================================================= */

import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { doc, getDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { SUPER_ADMIN } from './roles.js';

const VERSION = '2026-07-07-global-store-gate-v2';
const pageName = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
const isLoginPage = pageName === 'login.html';
const isAdminPage = pageName === 'admin.html' || pageName === 'admin-images.html' || pageName.startsWith('admin-');
const settingsRef = doc(db, 'settings', 'general');

let currentUser = null;
let authReady = false;
let latestSettings = null;
let settingsUnsub = null;
let applyingAccess = false;
let initialResolve;

export const storeGateReady = new Promise(resolve => { initialResolve = resolve; });
window.TintinStoreGatePromise = storeGateReady;
window.TintinStoreGate = window.TintinStoreGate || {};
Object.assign(window.TintinStoreGate, {
  version: VERSION,
  state: 'booting',
  refresh: () => applyAccess(latestSettings, currentUser, { source: 'manual' })
});

function emitReady(detail) {
  window.TintinStoreGate.state = 'ready';
  document.dispatchEvent(new CustomEvent('tintin:store-gate-ready', { detail }));
  if (initialResolve) {
    initialResolve(detail);
    initialResolve = null;
  }
}

function waitForDomReady() {
  if (document.body) return Promise.resolve();
  return new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[ch]));
}

function getFirst(data, keys, fallback = '') {
  for (const key of keys) {
    const value = data?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return fallback;
}

function normalizeWa(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '595981299331';
  if (digits.startsWith('595')) return digits;
  if (digits.startsWith('0')) return '595' + digits.slice(1);
  return digits;
}

function installPendingHold() {
  if (isLoginPage || window.TT_DISABLE_STORE_GATE) return;
  document.documentElement.classList.add('tt-store-gate-pending');
  if (!document.getElementById('tt-store-gate-pending-style')) {
    const style = document.createElement('style');
    style.id = 'tt-store-gate-pending-style';
    style.textContent = `
      html.tt-store-gate-pending,
      html.tt-store-gate-pending body { overflow:hidden !important; }
      html.tt-store-gate-pending #tt-intro,
      html.tt-store-gate-pending #tt-intro.tt-out {
        opacity:1 !important;
        visibility:visible !important;
        pointer-events:auto !important;
      }
      .tt-store-gate-pending-overlay {
        position:fixed; inset:0; z-index:2147483000;
        display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px;
        background:#ffb6c8; color:#8b2642; font-family:'Poppins',system-ui,sans-serif;
      }
      .tt-store-gate-pending-mark { font-weight:900; letter-spacing:.22em; font-size:clamp(26px,7vw,44px); }
      .tt-store-gate-pending-line { width:clamp(90px,22vw,160px); height:3px; border-radius:99px; background:rgba(139,38,66,.18); overflow:hidden; position:relative; }
      .tt-store-gate-pending-line::after { content:''; position:absolute; inset:0 auto 0 -65%; width:65%; background:linear-gradient(90deg,transparent,rgba(139,38,66,.65),transparent); animation:tt-store-gate-sweep 1.2s ease-in-out infinite; }
      @keyframes tt-store-gate-sweep { to { left:110%; } }
    `;
    document.head.appendChild(style);
  }
  waitForDomReady().then(() => {
    if (document.getElementById('tt-loader') || document.getElementById('tt-intro')) return;
    if (document.getElementById('tt-store-gate-pending-overlay')) return;
    const ov = document.createElement('div');
    ov.id = 'tt-store-gate-pending-overlay';
    ov.className = 'tt-store-gate-pending-overlay';
    ov.setAttribute('aria-hidden', 'true');
    ov.innerHTML = '<div class="tt-store-gate-pending-mark">TINTIN</div><div class="tt-store-gate-pending-line"></div>';
    document.body.prepend(ov);
  });
}

function releasePendingHold() {
  document.documentElement.classList.remove('tt-store-gate-pending');
  const ov = document.getElementById('tt-store-gate-pending-overlay');
  if (ov) ov.remove();
}

function releaseLegacySplash() {
  document.documentElement.classList.remove('tt-splash-lock');
  document.body?.classList?.remove('tt-splash-lock');
  const intro = document.getElementById('tt-intro');
  if (intro) {
    intro.classList.add('tt-out');
    intro.style.pointerEvents = 'none';
  }
}

function installClosedStyles() {
  if (document.getElementById('tt-store-gate-style')) return;
  const style = document.createElement('style');
  style.id = 'tt-store-gate-style';
  style.textContent = `
    html.tt-store-closed-mode,
    html.tt-store-closed-mode body { min-height:100%; margin:0; background:#fff6f9 !important; overflow:auto !important; }
    .tt-store-closed-screen {
      min-height:100vh; min-height:100svh; display:flex; align-items:center; justify-content:center;
      padding:clamp(18px,5vw,52px); box-sizing:border-box;
      font-family:var(--font-body,'Poppins',system-ui,-apple-system,BlinkMacSystemFont,sans-serif); color:#2b1720;
      background:radial-gradient(circle at top left,rgba(255,182,200,.45),transparent 32%),radial-gradient(circle at bottom right,rgba(184,76,114,.22),transparent 34%),#fff6f9;
    }
    .tt-store-closed-card { width:min(100%,520px); background:rgba(255,255,255,.94); border:1px solid rgba(184,76,114,.16); border-radius:28px; padding:clamp(28px,7vw,52px); text-align:center; box-shadow:0 24px 70px rgba(139,38,66,.16); backdrop-filter:blur(12px); }
    .tt-store-closed-logo { width:92px; height:92px; margin:0 auto 18px; border-radius:28px; display:grid; place-items:center; background:linear-gradient(135deg,#ffb6c8,#fff0f5); color:#8b2642; font-size:18px; font-weight:900; letter-spacing:.18em; box-shadow:0 12px 34px rgba(184,76,114,.18); }
    .tt-store-closed-kicker { margin:0 0 10px; color:#b84c72; font-size:11px; font-weight:800; letter-spacing:.16em; text-transform:uppercase; }
    .tt-store-closed-title { margin:0; font-family:var(--font-display,'Playfair Display',Georgia,serif); font-size:clamp(30px,8vw,48px); line-height:1.05; color:#8b2642; }
    .tt-store-closed-text { margin:18px auto 0; max-width:420px; color:#6f5863; font-size:15px; line-height:1.75; }
    .tt-store-closed-actions { display:flex; justify-content:center; gap:10px; flex-wrap:wrap; margin-top:28px; }
    .tt-store-closed-btn { display:inline-flex; align-items:center; justify-content:center; min-height:44px; padding:0 22px; border-radius:999px; text-decoration:none; border:1.5px solid transparent; font-size:13px; font-weight:800; letter-spacing:.03em; box-sizing:border-box; }
    .tt-store-closed-btn.primary { background:#b84c72; color:#fff; }
    .tt-store-closed-btn.secondary { background:#fff; color:#b84c72; border-color:rgba(184,76,114,.22); }
    .tt-store-closed-note { margin-top:20px; color:#a58d98; font-size:12px; line-height:1.55; }
    @media (max-width:520px) { .tt-store-closed-card{border-radius:22px} .tt-store-closed-actions{flex-direction:column} .tt-store-closed-btn{width:100%} }
  `;
  document.head.appendChild(style);
}

async function getUserAccess(user) {
  if (!user) return { email: '', role: null, blocked: false, superAdmin: false };
  const email = user.email || '';
  if (email === SUPER_ADMIN) return { email, role: 'superadmin', blocked: false, superAdmin: true };
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    const data = snap.exists() ? snap.data() : {};
    return { email, role: data.role || 'client', blocked: data.blocked === true, superAdmin: false };
  } catch {
    return { email, role: 'client', blocked: false, superAdmin: false };
  }
}

function isStoreClosed(settings) {
  return settings && settings.storeOpen === false;
}

function canEnterClosedStore(access, settings) {
  if (access.superAdmin) return true;
  const allowedRoles = Array.isArray(settings?.storeClosedAllowedRoles) ? settings.storeClosedAllowedRoles : [];
  return !!(access.role && !access.blocked && allowedRoles.includes(access.role));
}

async function renderClosedScreen(settings) {
  await waitForDomReady();
  const data = settings || {};
  const storeName = escapeHtml(getFirst(data, ['storeName', 'name', 'businessName'], 'Tintin Accesorios'));
  const closedMessage = escapeHtml(getFirst(
    data,
    ['storeClosedMessage', 'closedMessage', 'maintenanceMessage'],
    'Estamos preparando algo especial para vos. En este momento la tienda no está disponible para visitas ni pedidos nuevos.'
  ));
  const wa = normalizeWa(getFirst(data, ['waNumber', 'whatsappNumber', 'whatsapp', 'supportWhatsapp'], '595981299331'));
  const currentUrl = window.location.pathname + window.location.search + window.location.hash;
  const loginHref = `login.html?from=${encodeURIComponent(currentUrl)}`;

  installClosedStyles();
  releaseLegacySplash();
  releasePendingHold();
  document.documentElement.classList.add('tt-store-closed-mode');
  document.title = `${storeName} — Tienda cerrada`;
  document.body.innerHTML = `
    <main class="tt-store-closed-screen" role="main" aria-labelledby="tt-store-closed-title">
      <section class="tt-store-closed-card">
        <div class="tt-store-closed-logo" aria-hidden="true">TT</div>
        <p class="tt-store-closed-kicker">${storeName}</p>
        <h1 class="tt-store-closed-title" id="tt-store-closed-title">Tienda temporalmente desactivada</h1>
        <p class="tt-store-closed-text">${closedMessage}</p>
        <div class="tt-store-closed-actions">
          <a class="tt-store-closed-btn primary" href="https://wa.me/${wa}" target="_blank" rel="noopener">Escribir por WhatsApp</a>
          <a class="tt-store-closed-btn secondary" href="${loginHref}">Ingresar como Super Admin</a>
        </div>
        <p class="tt-store-closed-note">Si sos parte del equipo, solo la cuenta Super Admin puede acceder mientras la tienda está desactivada.</p>
      </section>
    </main>
  `;
  window.TintinLoader?.hide?.();
  window.ttPageReady?.();
}

async function readStoreSettings() {
  const snap = await getDoc(settingsRef);
  return snap.exists() ? snap.data() : {};
}

async function applyAccess(settings, user, meta = {}) {
  if (isLoginPage || window.TT_DISABLE_STORE_GATE) {
    releasePendingHold();
    return { gated: false, reason: 'exempt' };
  }
  if (applyingAccess) return { gated: false, reason: 'busy' };
  applyingAccess = true;
  try {
    const access = await getUserAccess(user);
    if (!isStoreClosed(settings)) {
      if (document.documentElement.classList.contains('tt-store-closed-mode')) {
        window.location.reload();
        return { gated: false, reason: 'store-reopened-reload' };
      }
      releasePendingHold();
      return { gated: false, reason: 'open' };
    }
    if (canEnterClosedStore(access, settings)) {
      document.documentElement.classList.add('tt-store-closed-authorized-preview');
      releasePendingHold();
      if (isAdminPage) bootAdminStoreControl();
      return { gated: false, reason: access.superAdmin ? 'superadmin-bypass' : 'allowed-role-bypass' };
    }
    if (user) {
      try { await signOut(auth); } catch (e) { console.warn('[store-gate] No se pudo cerrar sesión no autorizada:', e); }
    }
    await renderClosedScreen(settings);
    return { gated: true, reason: 'store-closed' };
  } finally {
    applyingAccess = false;
  }
}

function bootAdminStoreControl() {
  if (!isAdminPage || window.TintinAdminStoreControlBooted) return;
  window.TintinAdminStoreControlBooted = true;
  import('./admin-store-control.js').catch(e => console.warn('[store-gate] No se pudo cargar el control de tienda del admin:', e));
}

function startSettingsListener() {
  if (settingsUnsub || isLoginPage || window.TT_DISABLE_STORE_GATE) return;
  settingsUnsub = onSnapshot(settingsRef, snap => {
    latestSettings = snap.exists() ? snap.data() : {};
    applyAccess(latestSettings, currentUser, { source: 'settings-listener' });
  }, e => console.warn('[store-gate] Listener de settings falló:', e));
}

function startAuthListener() {
  onAuthStateChanged(auth, user => {
    currentUser = user || null;
    authReady = true;
    if (latestSettings) applyAccess(latestSettings, currentUser, { source: 'auth-listener' });
  }, () => {
    currentUser = null;
    authReady = true;
    if (latestSettings) applyAccess(latestSettings, null, { source: 'auth-error' });
  });
}

async function runStoreGate() {
  if (isLoginPage || window.TT_DISABLE_STORE_GATE) {
    emitReady({ gated: false, reason: 'exempt' });
    return { gated: false, reason: 'exempt' };
  }
  installPendingHold();
  startAuthListener();
  try {
    latestSettings = await readStoreSettings();
  } catch (e) {
    console.warn('[store-gate] No se pudo leer settings/general. Se deja la página abierta para no romper la tienda:', e);
    releasePendingHold();
    emitReady({ gated: false, reason: 'settings-read-failed' });
    return { gated: false, reason: 'settings-read-failed' };
  }
  if (!authReady) {
    await new Promise(resolve => {
      const t = setInterval(() => { if (authReady) { clearInterval(t); resolve(); } }, 20);
      setTimeout(() => { clearInterval(t); resolve(); }, 2500);
    });
  }
  const decision = await applyAccess(latestSettings, currentUser, { source: 'initial' });
  startSettingsListener();
  if (isAdminPage && (!isStoreClosed(latestSettings) || currentUser?.email === SUPER_ADMIN)) bootAdminStoreControl();
  emitReady(decision);
  return decision;
}

const boot = runStoreGate();
window.TintinStoreGatePromise = boot;
