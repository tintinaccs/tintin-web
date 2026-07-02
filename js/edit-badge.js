/**
 * TINTIN — Super Admin inline "editar" badge
 * Shows a small pencil icon over every editable section of the public site
 * when the signed-in user can manage content (Super Admin/Admin/Agente).
 * Clicking it deep-links straight into Super Admin → Contenido for that
 * page/section. Purely additive — does nothing for anonymous/client visitors.
 */
import { auth } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

function injectStyles() {
  if (document.getElementById('tt-edit-badge-style')) return;
  const s = document.createElement('style');
  s.id = 'tt-edit-badge-style';
  s.textContent = [
    '[data-tt-editable]{position:relative}',
    '.tt-edit-badge{position:absolute;top:10px;right:10px;z-index:60;width:34px;height:34px;',
    'border-radius:50%;background:#fff;border:1.5px solid #f0b9cf;color:#b84c72;',
    'display:flex;align-items:center;justify-content:center;font-size:15px;line-height:1;',
    'box-shadow:0 4px 14px rgba(184,76,114,.28);cursor:pointer;text-decoration:none;',
    'opacity:0;transform:scale(.85);transition:opacity .18s ease,transform .18s ease,background .18s ease}',
    '.tt-edit-badge:hover{background:#fce4ec;transform:scale(1)}',
    '[data-tt-editable]:hover>.tt-edit-badge,[data-tt-editable]:focus-within>.tt-edit-badge{opacity:1;transform:scale(1)}',
    '@media (hover:none){.tt-edit-badge{opacity:1;transform:scale(1)}}',
  ].join('');
  document.head.appendChild(s);
}

function placeBadges() {
  injectStyles();
  document.querySelectorAll('[data-tt-editable]').forEach(el => {
    if (el.querySelector(':scope > .tt-edit-badge')) return;
    const page = el.getAttribute('data-tt-editable');
    const section = el.getAttribute('data-tt-section') || '';
    const a = document.createElement('a');
    a.className = 'tt-edit-badge';
    a.href = `admin.html?tab=contenido&page=${encodeURIComponent(page)}&section=${encodeURIComponent(section)}`;
    a.title = 'Editar esta sección en Super Admin';
    a.setAttribute('aria-label', 'Editar esta sección');
    a.textContent = '✏️';
    a.addEventListener('click', e => e.stopPropagation());
    el.appendChild(a);
  });
}

function removeBadges() {
  document.querySelectorAll('.tt-edit-badge').forEach(b => b.remove());
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
