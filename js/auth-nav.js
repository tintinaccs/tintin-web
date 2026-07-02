// =============================================
// TINTIN — Auth-aware navigation
// Updates the account dropdown (desktop), mobile tabbar link and mobile
// slide-out user panel on every page based on Firebase auth state.
// =============================================

import { auth } from "./firebase.js";
import { onAuthStateChanged, signOut, reload } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const PERSON_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

function doLogout() {
  signOut(auth).then(() => { window.location.href = "index.html"; });
}

onAuthStateChanged(auth, async user => {
  if (user) {
    try { await reload(user); } catch {} // emailVerified más reciente del servidor
  }
  const verified = !!user && user.emailVerified;

  // Mobile tabbar account icon — simple link, no dropdown at that breakpoint
  document.querySelectorAll("#tabbar-cuenta, [data-auth-link='cuenta']").forEach(el => {
    el.href = verified ? "perfil.html" : "login.html";
  });

  renderAccountPanel(user, verified);
  renderMobileUserPanel(user, verified);
});

// ---- Desktop header dropdown (#account-panel, inside #account-dropdown) ----
function renderAccountPanel(user, verified) {
  const panel = document.getElementById("account-panel");
  if (!panel) return;

  if (!user) {
    panel.innerHTML = `
      <a class="tt-account-item" href="login.html">Iniciar sesión</a>
      <a class="tt-account-item" href="login.html#registro">Crear cuenta</a>
    `;
    return;
  }

  if (!verified) {
    panel.innerHTML = `
      <div class="tt-account-header">Verificá tu correo</div>
      <a class="tt-account-item" href="login.html">Confirmar mi cuenta</a>
      <div class="tt-account-divider"></div>
      <button class="tt-account-item tt-account-logout" id="account-logout-btn">Cerrar sesión</button>
    `;
    wireLogout(panel);
    return;
  }

  const name = user.displayName || user.email || "Mi cuenta";
  panel.innerHTML = `
    <div class="tt-account-header">${escapeHtmlNav(name)}</div>
    <a class="tt-account-item" href="perfil.html">Mi cuenta</a>
    <a class="tt-account-item" href="perfil.html#mis-pedidos">Mis pedidos</a>
    <div class="tt-account-divider"></div>
    <button class="tt-account-item tt-account-logout" id="account-logout-btn">Cerrar sesión</button>
  `;
  wireLogout(panel);
}

function wireLogout(panel) {
  const btn = panel.querySelector("#account-logout-btn");
  if (btn) btn.onclick = doLogout;
}

function escapeHtmlNav(s) {
  const div = document.createElement('div');
  div.textContent = s || '';
  return div.innerHTML;
}

// ---- Mobile slide-out menu user panel (#tt-mobile-user) ----
function renderMobileUserPanel(user, verified) {
  const panel = document.getElementById("tt-mobile-user");
  if (!panel) return;

  if (user && !verified) {
    panel.innerHTML = `
      <a href="login.html" class="tt-mobile-user-login">
        <div class="tt-mobile-user-avatar">${PERSON_ICON}</div>
        <div>
          <div class="tt-mobile-user-name">Verificá tu correo</div>
          <div class="tt-mobile-user-sub">Confirmá tu cuenta para continuar</div>
        </div>
      </a>`;
    return;
  }

  if (user) {
    const name = user.displayName || "Mi perfil";
    const firstName = name.split(" ")[0];
    const photo = user.photoURL || "";
    panel.innerHTML = `
      <a href="perfil.html" class="tt-mobile-user-profile">
        <div class="tt-mobile-user-avatar">
          ${photo
            ? `<img src="${photo}" alt="${firstName}" referrerpolicy="no-referrer">`
            : PERSON_ICON
          }
        </div>
        <div>
          <div class="tt-mobile-user-name">${escapeHtmlNav(firstName)}</div>
          <div class="tt-mobile-user-sub">Ver mi perfil →</div>
        </div>
      </a>`;
  } else {
    panel.innerHTML = `
      <a href="login.html" class="tt-mobile-user-login">
        <div class="tt-mobile-user-avatar">${PERSON_ICON}</div>
        <div>
          <div class="tt-mobile-user-name">Iniciar sesión</div>
          <div class="tt-mobile-user-sub">Registrarse es gratis!</div>
        </div>
      </a>`;
  }
}
