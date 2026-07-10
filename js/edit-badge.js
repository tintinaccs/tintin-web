/**
 * TINTIN — Super Admin inline "editar" badge
 * Shows a small pencil icon over every editable section of the public site
 * when the signed-in user can manage content (Super Admin/Admin/Agente).
 * Clicking it deep-links straight into Super Admin → Contenido for that
 * page/section. Purely additive — does nothing for anonymous/client visitors.
 */
import { auth } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

// position:fixed y agregado a <body> (no como hijo de la sección editable) a
// propósito: algunas secciones (ej. .tt-hero) usan isolation:isolate para
// contener sus propias capas de fondo/overlay, lo que atrapa a cualquier
// hijo posicionado dentro de esa stacking context — ningún z-index, por alto
// que sea, lo saca de ahí. Con position:fixed en <body> el badge compite en
// la stacking context raíz contra el header (z-index:1000, o 1200 en el
// header compacto de mobile), así que su posición en pantalla se recalcula
// a mano en cada scroll/resize en vez de heredarla del flujo normal.
const BADGE_Z = 1250;
const tracked = []; // { el, badge }

function injectStyles() {
  if (document.getElementById('tt-edit-badge-style')) return;
  const s = document.createElement('style');
  s.id = 'tt-edit-badge-style';
  s.textContent = [
    `.tt-edit-badge{position:fixed;z-index:${BADGE_Z};width:34px;height:34px;`,
    'border-radius:50%;background:#fff;border:1.5px solid #f0b9cf;color:#b84c72;',
    'display:flex;align-items:center;justify-content:center;font-size:15px;line-height:1;',
    'box-shadow:0 4px 14px rgba(184,76,114,.28);cursor:pointer;text-decoration:none;',
    'opacity:0;transform:scale(.85);transition:opacity .18s ease,transform .18s ease,background .18s ease;',
    'pointer-events:none}',
    '.tt-edit-badge:hover{background:#fce4ec}',
    '.tt-edit-badge.tt-edit-badge-on{opacity:1;transform:scale(1);pointer-events:auto}',
    '@media (hover:none){.tt-edit-badge.tt-edit-badge-in-view{opacity:1;transform:scale(1);pointer-events:auto}}',
  ].join('');
  document.head.appendChild(s);
}

function syncPositions() {
  tracked.forEach(({ el, badge }) => {
    const r = el.getBoundingClientRect();
    const inView = r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
    badge.classList.toggle('tt-edit-badge-in-view', inView);
    if (!inView) return;
    badge.style.top = Math.max(10, r.top + 10) + 'px';
    badge.style.left = Math.min(window.innerWidth - 44, r.right - 44) + 'px';
  });
}

let syncScheduled = false;
function requestSync() {
  if (syncScheduled) return;
  syncScheduled = true;
  requestAnimationFrame(() => { syncScheduled = false; syncPositions(); });
}

function placeBadges() {
  injectStyles();
  document.querySelectorAll('[data-tt-editable]').forEach(el => {
    if (tracked.some(t => t.el === el)) return;
    const page = el.getAttribute('data-tt-editable');
    const section = el.getAttribute('data-tt-section') || '';
    const badge = document.createElement('a');
    badge.className = 'tt-edit-badge';
    badge.href = `admin.html?tab=contenido&page=${encodeURIComponent(page)}&section=${encodeURIComponent(section)}`;
    badge.title = 'Editar esta sección en Super Admin';
    badge.setAttribute('aria-label', 'Editar esta sección');
    badge.textContent = '✏️';
    badge.addEventListener('click', e => e.stopPropagation());
    document.body.appendChild(badge);
    el.addEventListener('mouseenter', () => badge.classList.add('tt-edit-badge-on'));
    el.addEventListener('mouseleave', () => badge.classList.remove('tt-edit-badge-on'));
    el.addEventListener('focusin', () => badge.classList.add('tt-edit-badge-on'));
    el.addEventListener('focusout', () => badge.classList.remove('tt-edit-badge-on'));
    tracked.push({ el, badge });
  });
  syncPositions();
  window.addEventListener('scroll', requestSync, { passive: true });
  window.addEventListener('resize', requestSync, { passive: true });
}

function removeBadges() {
  tracked.forEach(({ badge }) => badge.remove());
  tracked.length = 0;
  window.removeEventListener('scroll', requestSync);
  window.removeEventListener('resize', requestSync);
}

async function start() {
  onAuthStateChanged(auth, async (user) => {
    removeBadges();
    if (!user) return;
    try {
      const { getUserRole, can } = await import('./roles.js');
      const role = await getUserRole(user.uid, user.email);
      if (!can(role, 'manageContent')) return;
      placeBadges();
    } catch (e) {
      console.warn('[edit-badge] role check failed:', e);
    }
  });
}

start();
