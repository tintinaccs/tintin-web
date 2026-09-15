Frontend Visual Audit

Resumen
Auditoria visual sobre build en produccion (tintinaccesorios.pages.dev), 8 rutas x 3 breakpoints (375/768/1440) via Playwright/Chromium headless. Sin overflow horizontal en ningun caso. La sesion automatizada fue bloqueada por Firebase App Check (403 en exchangeRecaptchaEnterpriseToken), lo que impidio la carga de datos dinamicos de Firestore (productos, config de tienda, tarifas de envio) en home/catalogo/collections/checkout. Esto es una proteccion anti-bot esperada, no un bug de produccion, pero limita la verificacion visual de contenido dinamico: los hallazgos sobre esas zonas quedan marcados como NO VERIFICABLE. El sistema de design tokens (tokens-tintin.css, tokens-color.css) es maduro y consistente. El fallback "store-gate" degradado en checkout (aviso "Conexion inestable" + CTA de compra deshabilitado) es UX intencional y correctamente implementada, no un defecto.

Problemas sistemicos
1. Verificacion bloqueada por App Check: no se pudo confirmar visualmente el render real de grids de productos, precios, imagenes ni estados de carga en home/catalogo/collections/product/checkout, porque Firestore no respondio datos a la sesion automatizada. Cualquier "vacio visual" en esas paginas no debe tomarse como defecto confirmado.
2. Design tokens: arquitectura centralizada y coherente (colores, radios, sombras, tipografia) en dos archivos core; no se detecto duplicacion ni valores sueltos fuera de esos tokens en las paginas inspeccionadas.

Hallazgos

[LOW] CSP report-only bloqueada en frame de Google
Ruta: /perfil.html, /contact.html
Viewport: mobile (375px)
Componente: embed externo (probable reCAPTCHA/Maps)
Problema: consola registra "[Report Only] Refused to frame 'https://www.google.com/'" por directiva frame-ancestors 'self'.
Causa probable: CSP en modo report-only aun no ajustada para el iframe que intenta cargar Google en esas paginas.
Corrección esperada: confirmar que el embed no dependa de ese frame o ajustar la directiva CSP si el embed es necesario.

[LOW] Errores de permisos Firestore visibles en consola en checkout
Ruta: /checkout.html
Viewport: 768px (reproducido tambien en otros breakpoints via App Check)
Componente: store-gate / config de tienda y tarifas de envio
Problema: "Missing or insufficient permissions" al leer settings/storeGate y tarifas de envio; dispara correctamente el modo degradado (aviso + CTA deshabilitado).
Causa probable: bloqueo de App Check en la sesion de auditoria (no atribuible a bug de UI). El fallback en si (nucleo-control-tienda.js) funciona como esta disenado.
Corrección esperada: ninguna en frontend; verificar en entorno real (sesion de usuario legitima) que esto no ocurra fuera de condiciones de bot-protection.

Responsive
Sin overflow horizontal detectado en ninguna de las 24 combinaciones pagina/breakpoint (scrollWidth <= clientWidth en todos los casos). No se detectaron problemas de layout roto atribuibles al CSS propio en los breakpoints probados.
Breakpoints de header (escritorio >=1025px, tableta 768-1024px, movil <=767px) revisados en encabezado-escritorio.css / encabezado-tableta.css / encabezado-movil.css: rangos contiguos, sin solapamiento ni hueco.

Sistema visual
Tokens de color y espaciado (tokens-tintin.css, tokens-color.css) cubren botones, campos, cards, badges, modales, estados y feedback de forma granular y consistente; no requieren unificacion adicional segun lo revisado.

Revisión estática complementaria

[MEDIUM] Arquitectura CSS por capas de parches con alta densidad de !important
Área: sistema de estilos global (home, header, todas las páginas)
Archivos: css/core/tema-unificado-tintin.css (183), css/theme/superficies-solidas-interfaz.css (115), css/theme/superficies-marca-responsive-tintin.css (102), css/theme/paridad-segura-tintin.css (86), css/components/navigation/compartido/paneles.css (97), css/pages/home/hero-bienvenida-inicio.css (141), css/pages/login/login-onboarding-flow.css (127)
Evidencia: 1824 declaraciones !important en css/, concentradas en archivos nombrados como "parche"/"ajuste"/"paridad"/"seguridad" que se cargan después de los core y de los de página en el mismo <link> order (index.html, catalogo.html, etc.), lo que indica que fueron añadidos para sobrescribir reglas previas en lugar de corregirlas en origen.
Impacto visual: cada nuevo componente que reutilice clases existentes corre riesgo de quedar sobrescrito por una capa de "parche" no relacionada; el orden de carga se vuelve una dependencia frágil.
Tipo: CONFIRMADO POR CÓDIGO
Corrección esperada: consolidar las reglas de las capas de parche dentro de los archivos de componente/página que corrigen, reduciendo el uso de !important a casos de utilidades explícitas.

[MEDIUM] Posicionamiento del CTA del hero acoplado a coordenadas fijas por breakpoint
Área: hero home (desktop/tablet landscape/tablet portrait/mobile)
Archivos: index.html líneas 89-99 (bloque <style id="tt-hero-first-paint">)
Evidencia: el botón ".tt-hero-cta" y el link secundario se posicionan con left/top/width/height en % y clamp() calibrados a mano para 4 composiciones de imagen distintas (desktop, landscape <=1120px, portrait <=1120px, mobile <=767px), todos con !important; los valores (7.1%, 55.1%, 36.5%, 7.2%, etc.) coinciden con la posición de una "pastilla" dibujada dentro de la propia imagen del hero.
Impacto visual: cualquier reemplazo del asset del hero (nuevo recorte, nueva campaña, copy más largo) desalinea el botón/link sin que el HTML/CSS lo detecte; requiere recalibrar 4 breakpoints a mano cada vez.
Tipo: CONFIRMADO POR CÓDIGO (patrón estructural); el efecto visual de desalineación es RIESGO NO REPRODUCIDO porque depende de un cambio de asset que no ocurrió durante esta auditoría.
Corrección esperada: mover el CTA fuera de la imagen (overlay con texto propio, no dependiente de arte incrustado) o, si se mantiene el enfoque actual, documentar el acoplamiento imagen-coordenadas para que no se reemplace la imagen sin recalibrar.

[LOW] Ausencia de escala centralizada de z-index
Área: navegación, paneles/drawers, notificaciones, editor visual (transversal)
Archivos: css/components/navigation/compartido/paneles.css, css/components/notifications/*, css/components/editor-visual-runtime.css, entre otros (42 reglas z-index en total)
Evidencia: valores dispersos sin token asociado: 0, 1, 2, 3, 5, 20, 30, 35, 40, 70, 500, 1460 (!important), 4500, 4501, 5000, 6000, 9999, 30000 (!important).
Impacto visual: riesgo de conflictos de apilamiento entre modales/dropdowns/drawers al agregar nuevos componentes, sin una capa/token que garantice el orden.
Tipo: CONFIRMADO POR CÓDIGO (patrón); ningún conflicto de stacking concreto fue reproducido → RIESGO NO REPRODUCIDO en cuanto a bug puntual.
Corrección esperada: definir una escala de z-index como tokens (--z-header, --z-drawer, --z-modal, --z-toast, etc.) y migrar los valores dispersos.

Área no verificable por bloqueo de App Check
Render final de grids de productos, precios, imágenes de catálogo/producto y estados de carga con datos reales de Firestore en home/catálogo/collections/product/checkout — no se pudo reproducir en esta sesión (ver Resumen).

No tocar
- Sistema de design tokens (tokens-tintin.css, tokens-color.css): completo, consistente, con correcciones de contraste ya documentadas inline.
- Modo degradado de store-gate (js/core/store-gate/nucleo-control-tienda.js): overlay de bloqueo, aviso "Conexion inestable" y deshabilitado de checkout ante fallo de Firestore estan bien implementados; no reportar como bug.
- Paginas login, perfil, contact: layout limpio y consistente en los tres breakpoints revisados.
- Mecanismo de señal de "página lista" en index.html (window.ttPageReady, cargador-pagina.js): el comentario en el <head> documenta que fue ajustado deliberadamente para evitar disparos prematuros de FOUC/layout shift; no requiere cambios.
- Breakpoints de header desktop/tablet/mobile: contiguos y sin solapamiento.

Resumen numerico
CRITICAL: 0
HIGH: 0
MEDIUM: 2
LOW: 3
TOTAL: 5
