/* =============================================================
   TINTIN — Store Gate global
   =============================================================
   Hace que Super Admin → Configuración → "Tienda activa / abierta"
   sea una barrera real para la web pública completa, no solo checkout.

   - Si settings/general.storeOpen === false:
     • tintinaccs@gmail.com puede seguir entrando y revisando la web/panel.
     • cualquier visitante sin sesión o cuenta no Super Admin ve pantalla cerrada.
   - Login queda fuera del bloqueo para que Super Admin pueda entrar y volver
     a abrir la tienda. El panel admin NO queda exento: si una cuenta no Super
     Admin intenta entrar con la tienda cerrada, también se tapa y se cierra sesión.
   - Si Firestore falla, abre por seguridad operativa: nunca rompe la web por
     un error de lectura temporal.
   ============================================================= */

import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { SUPER_ADMIN } from './roles.js';

const VERSION = '2026-07-07-global-store-gate';
const pageName = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
const EXEMPT_PAGES = new Set(['login.html']);
const isExemptPage = EXEMPT_PAGES.has(pageName);

if (!window.TintinStoreGate) {
  window.TintinStoreGate = { version: VERSION, state: 'booting', refresh: runStoreGate };
} else if (window.TintinStoreGate.state === 'booting' || window.TintinStoreGate.state === 'ready') {
  // Módulo importado dos veces (page-loader + load-images-init). ES modules
  // normalmente cachean, pero este guard evita dobles overlays si un bundler
  // o navegador viejo re-ejecuta algo raro.
  window.TintinStoreGate.refresh = runStoreGate;
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

function waitForAuthReady() {
  return new Promise(resolve => {
    const unsub = onAuthStateChanged(auth, user => {
      unsub();
      resolve(user || null);
    }, () => resolve(null));
  });
}

function releaseLegacySplash() {
  document.documentElement.classList.remove('tt-splash-lock');
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
    html.tt-store-closed-mode body {
      min-height: 100%;
      margin: 0;
      background: #fff6f9 !important;
      overflow: auto !important;
    }
    .tt-store-closed-screen {
      min-height: 100vh;
      min-height: 100svh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: clamp(18px, 5vw, 52px);
      box-sizing: border-box;
      font-family: var(--font-body, 'Poppins', system-ui, -apple-system, BlinkMacSystemFont, sans-serif);
      color: #2b1720;
      background:
        radial-gradient(circle at top left, rgba(255,182,200,.45), transparent 32%),
        radial-gradient(circle at bottom right, rgba(184,76,114,.22), transparent 34%),
        #fff6f9;
    }
    .tt-store-closed-card {
      width: min(100%, 520px);
      background: rgba(255,255,255,.92);
      border: 1px solid rgba(184,76,114,.16);
      border-radius: 28px;
      padding: clamp(28px, 7vw, 52px);
      text-align: center;
      box-shadow: 0 24px 70px rgba(139,38,66,.16);
      backdrop-filter: blur(12px);
    }
    .tt-store-closed-logo {
      width: 92px;
      height: 92px;
      margin: 0 auto 18px;
      border-radius: 28px;
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, #ffb6c8, #fff0f5);
      color: #8b2642;
      font-size: 18px;
      font-weight: 900;
      letter-spacing: .18em;
      box-shadow: 0 12px 34px rgba(184,76,114,.18);
    }
    .tt-store-closed-kicker {
      margin: 0 0 10px;
      color: #b84c72;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .16em;
      text-transform: uppercase;
    }
    .tt-store-closed-title {
      margin: 0;
      font-family: var(--font-display, 'Playfair Display', Georgia, serif);
      font-size: clamp(30px, 8vw, 48px);
      line-height: 1.05;
      color: #8b2642;
    }
    .tt-store-closed-text {
      margin: 18px auto 0;
      max-width: 420px;
      color: #6f5863;
      font-size: 15px;
      line-height: 1.75;
    }
    .tt-store-closed-actions {
      display: flex;
      justify-content: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 28px;
    }
    .tt-store-closed-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 0 22px;
      border-radius: 999px;
      text-decoration: none;
      border: 1.5px solid transparent;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: .03em;
      box-sizing: border-box;
    }
    .tt-store-closed-btn.primary { background: #b84c72; color: #fff; }
    .tt-store-closed-btn.secondary { background: #fff; color: #b84c72; border-color: rgba(184,76,114,.22); }
    .tt-store-closed-note {
      margin-top: 20px;
      color: #a58d98;
      font-size: 12px;
      line-height: 1.55;
    }
    @media (max-width: 520px) {
      .tt-store-closed-card { border-radius: 22px; }
      .tt-store-closed-actions { flex-direction: column; }
      .tt-store-closed-btn { width: 100%; }
    }
  `;
  document.head.appendChild(style);
}

function renderClosedScreen(settings) {
  const data = settings || {};
  const storeName = getFirst(data, ['storeName', 'name', 'businessName'], 'Tintin Accesorios');
  const closedMessage = getFirst(
    data,
    ['storeClosedMessage', 'closedMessage', 'maintenanceMessage'],
    'Estamos preparando algo especial para vos. En este momento la tienda no está disponible para visitas ni pedidos nuevos.'
  );
  const wa = normalizeWa(getFirst(data, ['waNumber', 'whatsapp', 'whatsappNumber', 'supportWhatsapp'], '595981299331'));
  const currentUrl = window.location.pathname + window.location.search + window.location.hash;
  const loginHref = `login.html?from=${encodeURIComponent(currentUrl)}`;

  installClosedStyles();
  releaseLegacySplash();
  document.documentElement.classList.add('tt-store-closed-mode');
  document.title = `${storeName} — Tienda cerrada`;
  document.body.innerHTML = `
    <main class="tt-store-closed-screen" role="main" aria-labelledby="tt-store-closed-title">
      <section class="tt-store-closed-card">
        <div class="tt-store-closed-logo" aria-hidden="true">TT</div>
        <p class="tt-store-closed-kicker">${storeName}</p>
        <h1 class="tt-store-closed-title" id="tt-store-closed-title">Tienda cerrada por el momento</h1>
        <p class="tt-store-closed-text">${closedMessage}</p>
        <div class="tt-store-closed-actions">
          <a class="tt-store-closed-btn primary" href="https://wa.me/${wa}" target="_blank" rel="noopener">Escribir por WhatsApp</a>
          <a class="tt-store-closed-btn secondary" href="${loginHref}">Ingresar como Super Admin</a>
        </div>
        <p class="tt-store-closed-note">Si sos parte del equipo, ingresá con la cuenta autorizada para administrar la tienda.</p>
      </section>
    </main>
  `;
  window.TintinLoader?.hide?.();
  window.ttPageReady?.();
}

async function readStoreSettings() {
  const snap = await getDoc(doc(db, 'settings', 'general'));
  return snap.exists() ? snap.data() : {};
}

async function runStoreGate() {
  if (isExemptPage || window.TT_DISABLE_STORE_GATE) {
    window.TintinStoreGate.state = 'ready';
    return { gated: false, reason: 'exempt' };
  }

  let settings;
  try {
    settings = await readStoreSettings();
  } catch (e) {
    console.warn('[store-gate] No se pudo leer settings/general. Se deja la página abierta para no romper la tienda:', e);
    window.TintinStoreGate.state = 'ready';
    return { gated: false, reason: 'settings-read-failed' };
  }

  // Compatibilidad: si el campo todavía no existe, la tienda queda abierta.
  const isClosed = settings && settings.storeOpen === false;
  if (!isClosed) {
    window.TintinStoreGate.state = 'ready';
    return { gated: false, reason: 'open' };
  }

  const user = await waitForAuthReady();
  if (user?.email === SUPER_ADMIN) {
    document.documentElement.classList.add('tt-store-closed-superadmin-preview');
    window.TintinStoreGate.state = 'ready';
    return { gated: false, reason: 'superadmin-bypass' };
  }

  if (user) {
    try { await signOut(auth); } catch (e) { console.warn('[store-gate] No se pudo cerrar sesión no autorizada:', e); }
  }

  renderClosedScreen(settings);
  window.TintinStoreGate.state = 'ready';
  return { gated: true, reason: 'store-closed' };
}

runStoreGate();
