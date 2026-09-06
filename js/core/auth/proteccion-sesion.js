// =============================================
// TINTIN ACCESORIOS — Arranque global de sesión
// =============================================
// Firebase Auth conserva la sesión local del navegador. Navegar, recargar,
// cambiar de pestaña o permanecer inactiva nunca debe cerrar una cuenta: el
// único cierre ordinario es la acción explícita «Cerrar sesión» de la persona.
//
// El archivo conserva su nombre e import público porque está incluido en las
// páginas de la tienda. Su única responsabilidad restante es arrancar el
// control de perfil global, sin alterar Firebase Auth.

import { startProfileGate } from "../../pages/profile/control-acceso-perfil.js?v=tintin-20260901-username-visible-2";

startProfileGate();
