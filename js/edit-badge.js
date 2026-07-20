import { auth } from './firebase.js?v=tintin-20260716-cloudinary-fix-1';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { SUPER_ADMIN, getUserRole } from './roles.js?v=tintin-20260716-cloudinary-fix-1';
import { EDITABLE_ROLES, loadRolePermissions, canDo } from './role-permissions.js?v=tintin-20260716-cloudinary-fix-1';

const BADGE_Z = 1250;
const tracked = new Map();
let authorized = false;
let domObserver = null;
let syncScheduled = false;
let globalListenersBound = false;

function injectStyles() {
  if (document.getElementById('tt-edit-badge-style')) return;
  const style = document.createElement('style');
  style.id = 'tt-edit-badge-style';
  style.textContent = [
    `.tt-edit-badge{position:fixed;z-index:${BADGE_Z};width:34px;height:34px;`,
    'border-radius:50%;background:#fff;border:1.5px solid #f0b9cf;color:#b84c72;',
    'display:flex;align-items:center;justify-content:center;font-size:15px;line-height:1;',
    'box-shadow:0 4px 14px rgba(184,76,114,.28);cursor:pointer;text-decoration:none;',
    'opacity:0;transform:scale(.85);transition:opacity .18s ease,transform .18s ease,background .18s ease;',
    'pointer-events:none}',
    '.tt-edit-badge:hover{background:#fce4ec}',
    '.tt-edit-badge.tt-edit-badge-on{opacity:1;transform:scale(1);pointer-events:auto}',
    '@media (hover:none){.tt-edit-badge.tt-edit-badge-in-view{opacity:1;transform:scale(1);pointer-events:auto}}'
  ].join('');
  document.head.appendChild(style);
}

function syncPositions() {
  tracked.forEach((badge, element) => {
    if (!element.isConnected) {
      badge.remove();
      tracked.delete(element);
      return;
    }
    const rect = element.getBoundingClientRect();
    const inView = rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
    badge.classList.toggle('tt-edit-badge-in-view', inView);
    if (!inView) return;
    badge.style.top = `${Math.max(10, rect.top + 10)}px`;
    badge.style.left = `${Math.min(window.innerWidth - 44, rect.right - 44)}px`;
  });
}

function requestSync() {
  if (syncScheduled) return;
  syncScheduled = true;
  requestAnimationFrame(() => {
    syncScheduled = false;
    syncPositions();
  });
}

function createBadge(element) {
  const page = element.dataset.ttEditable;
  const section = element.dataset.ttSection || '';
  if (!page) return null;
  const badge = document.createElement('a');
  badge.className = 'tt-edit-badge';
  badge.href = `admin.html?tab=contenido&page=${encodeURIComponent(page)}&section=${encodeURIComponent(section)}`;
  badge.title = 'Editar esta sección en Super Admin';
  badge.setAttribute('aria-label', 'Editar esta sección');
  badge.textContent = '✏️';
  badge.addEventListener('click', event => event.stopPropagation());
  element.addEventListener('mouseenter', () => badge.classList.add('tt-edit-badge-on'));
  element.addEventListener('mouseleave', () => badge.classList.remove('tt-edit-badge-on'));
  element.addEventListener('focusin', () => badge.classList.add('tt-edit-badge-on'));
  element.addEventListener('focusout', () => badge.classList.remove('tt-edit-badge-on'));
  document.body.appendChild(badge);
  return badge;
}

function placeBadges() {
  if (!authorized || !document.body) return;
  injectStyles();
  document.querySelectorAll('[data-tt-editable][data-tt-section]').forEach(element => {
    if (tracked.has(element)) return;
    const badge = createBadge(element);
    if (badge) tracked.set(element, badge);
  });
  requestSync();
}

function removeBadges() {
  tracked.forEach(badge => badge.remove());
  tracked.clear();
}

function bindGlobalListeners() {
  if (globalListenersBound) return;
  globalListenersBound = true;
  window.addEventListener('scroll', requestSync, { passive: true });
  window.addEventListener('resize', requestSync, { passive: true });
}

function startDomObserver() {
  if (domObserver || !document.body) return;
  domObserver = new MutationObserver(() => {
    placeBadges();
    requestSync();
  });
  domObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-tt-editable', 'data-tt-section', 'hidden']
  });
}

async function canEditContent(user) {
  if (user.email === SUPER_ADMIN) return true;
  const role = await getUserRole(user.uid, user.email);
  if (!EDITABLE_ROLES.includes(role)) return false;
  await loadRolePermissions();
  return (
    canDo(role, 'contenido', 'editarTextos') ||
    canDo(role, 'contenido', 'activarDesactivarSecciones') ||
    canDo(role, 'contenido', 'restaurar')
  );
}

function bootAuthorized() {
  authorized = true;
  bindGlobalListeners();
  startDomObserver();
  placeBadges();
}

onAuthStateChanged(auth, async user => {
  authorized = false;
  removeBadges();
  if (!user || user.isAnonymous) return;
  try {
    if (await canEditContent(user)) bootAuthorized();
  } catch (error) {
    console.warn('[edit-badge] no se pudo comprobar el permiso:', error);
  }
});
