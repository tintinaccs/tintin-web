/* =============================================================
   TINTIN — Fase 5: navegación del panel de imágenes

   Las tarjetas de cada slot ahora se renderizan e interceden directamente en
   admin-images.html (widget de carga real, sin URLs pegadas a mano), así que
   este módulo ya solo se encarga de ocultar los botones de sección sin
   contenido real (Productos/Íconos, que se editan desde sus propios paneles)
   y de explicar por qué, igual que antes.
   ============================================================= */

import { IMAGE_SLOTS } from './images.js';

if (!window.TintinAdminImagesPhase5Booted) {
  window.TintinAdminImagesPhase5Booted = true;

  const path = (window.location.pathname || '').toLowerCase();
  const isImageAdmin = path.endsWith('/admin-images.html') || path.endsWith('/admin-images');

  if (isImageAdmin) {
    const supportedSections = new Set([
      ...IMAGE_SLOTS.map(slot => slot.section),
      'biblioteca',
    ]);

    function simplifyNavigation() {
      document.querySelectorAll('[data-section]').forEach(button => {
        const section = button.dataset.section;
        if (!supportedSections.has(section)) button.style.display = 'none';
      });

      if (!document.getElementById('tt-image-source-note')) {
        const header = document.querySelector('.adm-section-header');
        if (header) {
          const note = document.createElement('div');
          note.id = 'tt-image-source-note';
          note.style.cssText =
            'margin-top:12px;padding:12px 14px;border:1px solid #f0c8d6;background:#fff3f7;border-radius:10px;font-size:12px;line-height:1.55;color:#666;';
          note.textContent =
            'Fotos de productos: se cambian desde Productos. Portadas de colecciones: desde Colecciones. Este panel administra Hero, editoriales, Nosotros, el logo y la biblioteca multimedia compartida.';
          header.appendChild(note);
        }
      }
    }

    function boot() {
      simplifyNavigation();
      const observer = new MutationObserver(simplifyNavigation);
      observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
      boot();
    }
  }
}
