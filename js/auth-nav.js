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
    const ADMIN_EMAILS = ["tintinaccs@gmail.com"];
    import("./roles.js").then(({ getUserRole, ROLES }) => {
      getUserRole(user.uid).then(role => {
        if (role && role !== ROLES.CLIENT) linkAdmin.style.display = "";
      });
    });
  }
});
