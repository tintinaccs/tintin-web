// =============================================
// TINTIN — Auth-aware navigation
// Updates the account dropdown (desktop), mobile tabbar link and mobile
// slide-out user panel on every page based on Firebase auth state.
// Also boots public global guards/fixes for pages that do not use page-loader.js.
// =============================================

import './store-gate.js';
import './header-dropdown-fix.js';
import { auth } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const PERSON_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

function doLogout() {
  signOut(auth).then(() => { window.location.href = "index.html"; });
}

// El ícono genérico del botón de cuenta (#btn-cuenta) se guarda tal cual
// está en el HTML de cada página, para poder volver a él al cerrar sesión —
// mientras hay sesión iniciada, ese botón muestra la foto de Google en su
// lugar, en todas las páginas del sitio.
const accountBtnDefaults = new Map();

onAuthStateChanged(auth, user => {
  // Mobile tabbar account icon — simple link, no dropdown at that breakpoint
  document.querySelectorAll("#tabbar-cuenta, [data-auth-link='cuenta']").forEach(el => {
    el.href = user ? "perfil.html" : "login.html";
  });

  renderAccountButtonPhoto(user);
  renderAccountPanel(user);
  renderMobileUserPanel(user);
});

// ---- Ícono de cuenta en el header (#btn-cuenta) — foto de Google en vez
// del ícono genérico apenas hay sesión, en cualquier página. El tamaño se
// fija en línea (no solo por clase CSS) y el botón tiene overflow:hidden en
// styles.css, para que la foto NUNCA se vea estirada/rota sin importar el
// orden o la caché con que cargue el resto del CSS. Si la foto no carga
// (red, bloqueo, etc.), vuelve sola al ícono genérico.
function renderAccountButtonPhoto(user) {
  const btn = document.getElementById("btn-cuenta");
  if (!btn) return;
  if (!accountBtnDefaults.has(btn)) accountBtnDefaults.set(btn, btn.innerHTML);

  if (user && user.photoURL) {
    const name = user.displayName || user.email || "Mi cuenta";
    const img = document.createElement("img");
    img.className = "tt-account-avatar-btn";
    img.src = user.photoURL;
    img.alt = name;
    img.referrerPolicy = "no-referrer";
    img.width = 26;
    img.height = 26;
    img.style.cssText = "width:26px;height:26px;max-width:none;max-height:none;flex-shrink:0;border-radius:50%;object-fit:cover;display:block";
    img.onerror = () => { btn.innerHTML = accountBtnDefaults.get(btn); };
    btn.innerHTML = "";
    btn.appendChild(img);
  } else {
    btn.innerHTML = accountBtnDefaults.get(btn);
  }
}

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
  const photo = user.photoURL || "";
  panel.innerHTML = `
    <div class="tt-account-header" style="display:flex;align-items:center;gap:10px">
      ${photo ? `<img src="${photo}" alt="${escapeHtmlNav(name)}" referrerpolicy="no-referrer" width="32" height="32" style="width:32px;height:32px;max-width:none;max-height:none;border-radius:50%;object-fit:cover;flex-shrink:0;display:block" onerror="this.style.display='none'">` : ''}
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtmlNav(name)}</span>
    </div>
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
            ? `<img src="${photo}" alt="${firstName}" referrerpolicy="no-referrer" width="40" height="40" style="width:100%;height:100%;max-width:none;max-height:none;object-fit:cover;display:block;flex-shrink:0" onerror="this.style.display='none'">`
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
