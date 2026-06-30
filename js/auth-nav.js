// =============================================
// TINTIN — Auth-aware navigation
// Updates profile icon and login button on every page based on Firebase auth state
// =============================================

import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

onAuthStateChanged(auth, user => {
  // All profile/account icon links
  document.querySelectorAll("#btn-cuenta, #tabbar-cuenta, [data-auth-link='cuenta']").forEach(el => {
    el.href = user ? "perfil.html" : "login.html";
  });

  // "Ingresar" nav link
  const btnLogin = document.getElementById("btn-login");
  if (btnLogin) {
    btnLogin.textContent = user ? (user.displayName?.split(" ")[0] || "Mi perfil") : "Ingresar";
    btnLogin.href = user ? "perfil.html" : "login.html";
  }

  // Admin link visibility
  const linkAdmin = document.getElementById("link-admin");
  if (linkAdmin && user) {
    import("./roles.js").then(({ getUserRole, ROLES }) => {
      getUserRole(user.uid, user.email).then(role => {
        if (role && role !== ROLES.CLIENT) linkAdmin.style.display = "";
      });
    });
  }

  // Mobile menu user panel
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
            : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`
          }
        </div>
        <div>
          <div class="tt-mobile-user-name">${firstName}</div>
          <div class="tt-mobile-user-sub">Ver mi perfil →</div>
        </div>
      </a>`;
  } else {
    panel.innerHTML = `
      <a href="login.html" class="tt-mobile-user-login">
        <div class="tt-mobile-user-avatar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <div>
          <div class="tt-mobile-user-name">Iniciar sesión</div>
          <div class="tt-mobile-user-sub">Registrarse es gratis!</div>
        </div>
      </a>`;
  }
});
