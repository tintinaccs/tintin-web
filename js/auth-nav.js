// =============================================
// TINTIN — Auth-aware navigation
// Updates the account dropdown (desktop), mobile tabbar link and mobile
// slide-out user panel on every page based on Firebase auth state.
// =============================================

import { auth } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const PERSON_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

function doLogout() {
  signOut(auth).then(() => { window.location.href = "index.html"; });
}

onAuthStateChanged(auth, user => {
  // Mobile tabbar account icon — simple link, no dropdown at that breakpoint
  document.querySelectorAll("#tabbar-cuenta, [data-auth-link='cuenta']").forEach(el => {
    el.href = user ? "perfil.html" : "login.html";
  });

  renderAccountPanel(user);
  renderMobileUserPanel(user);
});

// ---- Desktop header dropdown (#account-panel, inside #account-dropdown) ----
function renderAccountPanel(user) {
  const panel = document.getElementById("account-panel");
  if (!panel) return;

  if (!user) {
    panel.innerHTML = `
      <a class="tt-account-item" href="login.html">Ingresar con Google</a>
    `;
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

function wireMobileLogout(panel) {
  const btn = panel.querySelector("#mobile-user-logout-btn");
  if (btn) btn.onclick = doLogout;
}

function escapeHtmlNav(s) {
  const div = document.createElement('div');
  div.textContent = s || '';
  return div.innerHTML;
}

// ---- Mobile slide-out menu user panel (#tt-mobile-user) ----
function renderMobileUserPanel(user) {
  const panel = document.getElementById("tt-mobile-user");
  if (!panel) return;

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
      </a>
      <button type="button" class="tt-mobile-user-logout" id="mobile-user-logout-btn">Cerrar sesión</button>`;
    wireMobileLogout(panel);
  } else {
    panel.innerHTML = `
      <a href="login.html" class="tt-mobile-user-login">
        <div class="tt-mobile-user-avatar">${PERSON_ICON}</div>
        <div>
          <div class="tt-mobile-user-name">Iniciar sesión</div>
          <div class="tt-mobile-user-sub">Ingresá con Google, es gratis!</div>
        </div>
      </a>`;
  }
}
