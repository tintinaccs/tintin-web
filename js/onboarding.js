// =============================================
// TINTIN ACCESORIOS — Tutorial de bienvenida
// =============================================
// Se muestra solamente a usuarios autenticados, en la home, después del
// splash/loader inicial. Se marca visto en Firestore para no repetirlo en
// otros dispositivos.
// =============================================

import { db } from "./firebase.js";
import {
  doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const WELCOME_VERSION = 'home-welcome-v1';

const STEPS = [
  {
    title: 'Bienvenida a Tintin',
    icon: '🌸',
    text: 'Te cuento rapidito cómo comprar y encontrar tus accesorios favoritos sin perderte.',
    cta: 'Empezar'
  },
  {
    title: 'Explorá la tienda',
    icon: '🛍️',
    text: 'Desde “Tienda” podés ver relojes, aros, collares, bags, pulseras y más. En mobile también tenés accesos rápidos abajo.',
    cta: 'Siguiente'
  },
  {
    title: 'Agregá al carrito',
    icon: '🛒',
    text: 'Cuando veas algo que te guste, agregalo al carrito. Tu carrito se mantiene sincronizado cuando iniciás sesión.',
    cta: 'Siguiente'
  },
  {
    title: 'Finalizá tu pedido',
    icon: '✨',
    text: 'Al finalizar compra, completás entrega, pago y datos. Si necesitás ayuda, también podés escribirnos por WhatsApp.',
    cta: 'Entendido'
  }
];

function isHomePage() {
  const path = (location.pathname || '').replace(/\/+/g, '/').toLowerCase();
  return path.endsWith('/') || path.endsWith('/index.html') || path === '';
}

function isProfilePage() {
  const path = (location.pathname || '').toLowerCase();
  return path.endsWith('/perfil.html') || path.endsWith('/perfil');
}

function isAdminLikePage() {
  const path = (location.pathname || '').toLowerCase();
  return path.includes('/admin') || path.endsWith('/login.html') || path.endsWith('/checkout.html');
}

function toDate(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isRecentlyCreated(user, data) {
  const now = Date.now();
  const limitMs = 24 * 60 * 60 * 1000;
  const candidates = [
    toDate(user?.metadata?.creationTime),
    toDate(data?.createdAt)
  ].filter(Boolean);
  return candidates.some(d => Math.abs(now - d.getTime()) <= limitMs);
}

function hasSeenWelcome(data) {
  return !!(
    data?.welcomeTutorialSeen ||
    data?.welcomeTutorialCompletedAt ||
    data?.onboardingCompleted === true
  );
}

function shouldShowWelcome(user, data) {
  if (!user || hasSeenWelcome(data)) return false;
  const params = new URLSearchParams(location.search);
  if (params.get('welcome') === '1') return true;
  if (data?.welcomeTutorialPending === true) return true;
  // Compatibilidad con usuarios creados por el flujo viejo: login guardaba
  // onboardingCompleted:false, pero todavía no existía welcomeTutorialPending.
  // Solo lo tomamos como “nuevo” si Firebase/createdAt indica creación reciente.
  if (data?.onboardingCompleted === false && isRecentlyCreated(user, data)) return true;
  return false;
}

function cleanWelcomeParam() {
  try {
    const url = new URL(location.href);
    if (!url.searchParams.has('welcome')) return;
    url.searchParams.delete('welcome');
    history.replaceState({}, '', url.pathname + url.search + url.hash);
  } catch {}
}

async function readUserData(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : {};
}

async function markCompleted(uid, reason = 'completed') {
  try {
    await setDoc(doc(db, 'users', uid), {
      welcomeTutorialSeen: true,
      welcomeTutorialPending: false,
      welcomeTutorialCompletedAt: serverTimestamp(),
      welcomeTutorialClosedReason: reason,
      welcomeTutorialVersion: WELCOME_VERSION,
      onboardingCompleted: true,
      onboardingCompletedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    try { localStorage.setItem('tt_welcome_tutorial_seen', String(Date.now())); } catch {}
  } catch (e) {
    console.warn('[Onboarding] No se pudo marcar tutorial visto:', e);
  }
}

function waitForSplashDone() {
  return new Promise(resolve => {
    const splash = document.getElementById('tt-intro');
    const loader = document.getElementById('tt-loader');
    const done = () => setTimeout(resolve, 120);

    if ((!splash || splash.classList.contains('tt-out')) && (!loader || loader.classList.contains('tt-out'))) {
      done();
      return;
    }

    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      done();
    };
    const cleanup = () => {
      document.removeEventListener('tintin:splash:done', finish);
      document.removeEventListener('tintin:page-ready', finish);
      if (observer) observer.disconnect();
      clearTimeout(timer);
    };

    document.addEventListener('tintin:splash:done', finish, { once: true });
    document.addEventListener('tintin:page-ready', finish, { once: true });

    const observer = new MutationObserver(() => {
      const s = document.getElementById('tt-intro');
      const l = document.getElementById('tt-loader');
      if ((!s || s.classList.contains('tt-out')) && (!l || l.classList.contains('tt-out'))) finish();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    const timer = setTimeout(finish, 6200);
  });
}

let scrollY = 0;
let bodyStyles = null;
let htmlOverflow = '';
function lockScroll() {
  if (document.documentElement.classList.contains('tt-welcome-scroll-locked')) return;
  scrollY = window.scrollY || document.documentElement.scrollTop || 0;
  htmlOverflow = document.documentElement.style.overflow;
  bodyStyles = document.body ? {
    position: document.body.style.position,
    top: document.body.style.top,
    left: document.body.style.left,
    right: document.body.style.right,
    width: document.body.style.width,
    overflow: document.body.style.overflow,
    touchAction: document.body.style.touchAction
  } : null;
  document.documentElement.classList.add('tt-welcome-scroll-locked');
  document.documentElement.style.overflow = 'hidden';
  if (document.body) {
    document.body.classList.add('tt-welcome-scroll-locked');
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
  }
}

function unlockScroll() {
  document.documentElement.classList.remove('tt-welcome-scroll-locked');
  document.documentElement.style.overflow = htmlOverflow || '';
  if (document.body) {
    document.body.classList.remove('tt-welcome-scroll-locked');
    if (bodyStyles) {
      document.body.style.position = bodyStyles.position;
      document.body.style.top = bodyStyles.top;
      document.body.style.left = bodyStyles.left;
      document.body.style.right = bodyStyles.right;
      document.body.style.width = bodyStyles.width;
      document.body.style.overflow = bodyStyles.overflow;
      document.body.style.touchAction = bodyStyles.touchAction;
    } else {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
  }
  window.scrollTo(0, scrollY || 0);
}

function injectStyles() {
  if (document.getElementById('tt-welcome-style')) return;
  const st = document.createElement('style');
  st.id = 'tt-welcome-style';
  st.textContent = `
    html.tt-welcome-scroll-locked, html.tt-welcome-scroll-locked body { overflow:hidden!important; overscroll-behavior:none!important; touch-action:none!important; }
    .tt-welcome-overlay{position:fixed;inset:0;z-index:2147482500;background:rgba(91,35,57,.42);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:22px;font-family:'Poppins',sans-serif;animation:ttWelcomeFade .24s ease both;}
    .tt-welcome-card{width:min(520px,100%);max-height:min(82vh,720px);overflow:auto;background:#fff;border:1.5px solid rgba(255,182,200,.8);border-radius:28px;box-shadow:0 24px 80px rgba(139,38,66,.30);padding:0;position:relative;animation:ttWelcomeIn .32s cubic-bezier(.34,1.56,.64,1) both;}
    .tt-welcome-top{background:linear-gradient(135deg,#ffb6c8,#fef5f8);padding:24px 24px 18px;text-align:center;position:relative;}
    .tt-welcome-close{position:absolute;top:14px;right:14px;width:34px;height:34px;border:0;border-radius:999px;background:rgba(255,255,255,.76);color:#8b2642;font-size:20px;cursor:pointer;display:grid;place-items:center;}
    .tt-welcome-icon{width:74px;height:74px;border-radius:50%;background:#fff;display:grid;place-items:center;margin:0 auto 12px;font-size:36px;box-shadow:0 10px 30px rgba(184,76,114,.18);}
    .tt-welcome-title{font-family:'Playfair Display',serif;font-size:clamp(26px,5vw,38px);line-height:1.03;margin:0;color:#8b2642;font-weight:800;}
    .tt-welcome-sub{margin:8px auto 0;color:#8b2642;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;}
    .tt-welcome-body{padding:24px;}
    .tt-welcome-step-title{font-size:18px;font-weight:900;color:#2b2b2b;margin:0 0 8px;text-align:center;}
    .tt-welcome-text{font-size:14px;line-height:1.7;color:#666;text-align:center;margin:0 auto;max-width:420px;}
    .tt-welcome-dots{display:flex;justify-content:center;gap:8px;margin:22px 0 0;}
    .tt-welcome-dot{width:8px;height:8px;border-radius:999px;background:#ead0d9;transition:all .2s ease;}
    .tt-welcome-dot.active{width:26px;background:#b84c72;}
    .tt-welcome-actions{display:flex;gap:10px;justify-content:space-between;align-items:center;flex-wrap:wrap;margin-top:24px;}
    .tt-welcome-btn{border:0;border-radius:999px;padding:12px 18px;font-family:'Poppins',sans-serif;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;cursor:pointer;transition:transform .2s ease,opacity .2s ease;background:#f8e8ef;color:#8b2642;}
    .tt-welcome-btn:hover{transform:translateY(-1px);}
    .tt-welcome-btn-primary{background:#b84c72;color:#fff;box-shadow:0 10px 26px rgba(184,76,114,.25);}
    .tt-welcome-btn-ghost{background:transparent;color:#a45a78;}
    @keyframes ttWelcomeFade{from{opacity:0}to{opacity:1}}
    @keyframes ttWelcomeIn{from{opacity:0;transform:translateY(18px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
    @media (max-width:600px){.tt-welcome-overlay{align-items:flex-end;padding:12px}.tt-welcome-card{border-radius:24px 24px 18px 18px;max-height:86vh}.tt-welcome-top{padding:22px 18px 16px}.tt-welcome-body{padding:20px 18px 18px}.tt-welcome-actions{flex-direction:column-reverse;align-items:stretch}.tt-welcome-btn{width:100%;justify-content:center}.tt-welcome-icon{width:64px;height:64px;font-size:32px}}
    @media (prefers-reduced-motion:reduce){.tt-welcome-overlay,.tt-welcome-card{animation:none!important}.tt-welcome-btn{transition:none!important}}
  `;
  document.head.appendChild(st);
}

function showWelcomeTutorial(user) {
  const existing = document.getElementById('tt-welcome-tutorial');
  if (existing) existing.remove();
  injectStyles();
  cleanWelcomeParam();
  lockScroll();

  let index = 0;
  const userName = user.displayName || (user.email || '').split('@')[0] || 'linda';
  const overlay = document.createElement('div');
  overlay.id = 'tt-welcome-tutorial';
  overlay.className = 'tt-welcome-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'tt-welcome-title');

  function render() {
    const step = STEPS[index];
    const isLast = index === STEPS.length - 1;
    overlay.innerHTML = `
      <div class="tt-welcome-card">
        <div class="tt-welcome-top">
          <button type="button" class="tt-welcome-close" id="tt-welcome-close" aria-label="Cerrar tutorial">×</button>
          <div class="tt-welcome-icon">${step.icon}</div>
          <h2 class="tt-welcome-title" id="tt-welcome-title">Hola, ${userName}</h2>
          <div class="tt-welcome-sub">Tu primera guía Tintin</div>
        </div>
        <div class="tt-welcome-body">
          <h3 class="tt-welcome-step-title">${step.title}</h3>
          <p class="tt-welcome-text">${step.text}</p>
          <div class="tt-welcome-dots" aria-hidden="true">
            ${STEPS.map((_, i) => `<span class="tt-welcome-dot ${i === index ? 'active' : ''}"></span>`).join('')}
          </div>
          <div class="tt-welcome-actions">
            <button type="button" class="tt-welcome-btn tt-welcome-btn-ghost" id="tt-welcome-skip">Cerrar</button>
            <div style="display:flex;gap:10px;flex:1;justify-content:flex-end;flex-wrap:wrap">
              ${index > 0 ? '<button type="button" class="tt-welcome-btn" id="tt-welcome-prev">Atrás</button>' : ''}
              <button type="button" class="tt-welcome-btn tt-welcome-btn-primary" id="tt-welcome-next">${isLast ? 'Finalizar' : step.cta}</button>
            </div>
          </div>
        </div>
      </div>`;

    overlay.querySelector('#tt-welcome-close').onclick = () => finish('closed');
    overlay.querySelector('#tt-welcome-skip').onclick = () => finish('closed');
    const prev = overlay.querySelector('#tt-welcome-prev');
    if (prev) prev.onclick = () => { index = Math.max(0, index - 1); render(); };
    overlay.querySelector('#tt-welcome-next').onclick = () => {
      if (isLast) finish('completed');
      else { index += 1; render(); }
    };
    setTimeout(() => overlay.querySelector('#tt-welcome-next')?.focus(), 40);
  }

  async function finish(reason) {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity .22s ease';
    await markCompleted(user.uid, reason);
    setTimeout(() => {
      overlay.remove();
      unlockScroll();
    }, 240);
  }

  overlay.addEventListener('click', e => {
    if (e.target === overlay) finish('closed_outside');
  });
  document.addEventListener('keydown', function onKey(e) {
    if (!document.getElementById('tt-welcome-tutorial')) {
      document.removeEventListener('keydown', onKey);
      return;
    }
    if (e.key === 'Escape') finish('closed_escape');
  });

  render();
  document.body.appendChild(overlay);
}

/**
 * Initialize welcome tutorial for a user. Safe to call from any page:
 * only home can show it; perfil can redirect a first-login user to home.
 */
export async function initOnboarding(user, userRole) {
  try {
    if (!user) return;
    if (isAdminLikePage()) return;

    const settingsSnap = await getDoc(doc(db, 'settings', 'general'));
    const onboardingEnabled = settingsSnap.exists()
      ? settingsSnap.data().onboardingEnabled !== false
      : true;
    if (!onboardingEnabled) return;

    const data = await readUserData(user.uid);
    if (!shouldShowWelcome(user, data)) return;

    if (!isHomePage()) {
      if (isProfilePage()) {
        try { sessionStorage.setItem('tt_welcome_redirected_home', '1'); } catch {}
        window.location.replace('index.html?welcome=1');
      }
      return;
    }

    await waitForSplashDone();
    showWelcomeTutorial(user);
  } catch (e) {
    console.warn('[Onboarding] Tutorial de bienvenida omitido por error:', e);
  }
}
