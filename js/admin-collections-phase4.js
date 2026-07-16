/* =============================================================
   TINTIN — Fase 4: protecciones del administrador de colecciones

   - El slug/documento queda inmutable después de crear la colección.
   - Se elimina el importador legado de 12 categorías fijas.
   - Los selectores de categoría del importador CSV usan las colecciones
     reales de Firestore, incluidas las ocultas para gestión interna.
   ============================================================= */

import { auth } from './firebase.js?v=tintin-20260716-cloudinary-fix-1';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { onAllCollectionsUpdate } from './collections-store.js?v=tintin-20260716-cloudinary-fix-1';

if (!window.TintinAdminCollectionsPhase4Booted) {
  window.TintinAdminCollectionsPhase4Booted = true;

  let collections = [];
  let originalSave = null;
  let saveWrapped = false;
  let defaultsWrapped = false;
  let collectionSubscriptionStarted = false;

  const clean = value => String(value == null ? '' : value).trim();

  function toastMessage(message) {
    if (typeof window.toast === 'function') window.toast(message);
    else window.alert(message);
  }

  function formError(message) {
    const error = document.getElementById('coll-form-error');
    if (!error) return;
    error.textContent = message;
    error.style.display = '';
  }

  function validCollectionImage(value) {
    const candidate = clean(value);
    if (!candidate) return true;
    if (/['"<>\u0000-\u001f\u007f]/.test(candidate)) return false;
    try {
      const parsed = new URL(candidate, window.location.href);
      return ['https:', 'http:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  function ensureSlugNote(slugInput) {
    if (document.getElementById('coll-phase4-slug-note')) return;
    const note = document.createElement('small');
    note.id = 'coll-phase4-slug-note';
    note.style.cssText = 'color:var(--adm-muted);font-size:11px;line-height:1.45;';
    note.textContent =
      'El slug identifica la colección y sus productos. Después de crearla queda bloqueado; podés cambiar el nombre visible sin romper enlaces.';
    slugInput.insertAdjacentElement('afterend', note);
  }

  function enforceImmutableSlug() {
    const originalInput = document.getElementById('coll-original-slug');
    const slugInput = document.getElementById('coll-slug');
    if (!originalInput || !slugInput) return;

    ensureSlugNote(slugInput);
    const originalSlug = clean(originalInput.value);
    const isEditing = Boolean(originalSlug);

    if (isEditing && slugInput.value !== originalSlug) slugInput.value = originalSlug;
    slugInput.readOnly = isEditing;
    slugInput.setAttribute('aria-readonly', isEditing ? 'true' : 'false');
    slugInput.classList.toggle('tt-collection-slug-locked', isEditing);
    slugInput.style.background = isEditing ? '#f5f5f5' : '';
    slugInput.style.cursor = isEditing ? 'not-allowed' : '';
    slugInput.title = isEditing
      ? 'El slug no se modifica después de crear la colección.'
      : 'Se genera desde el nombre y puede ajustarse antes de guardar.';
  }

  function removeLegacyDefaultsAction() {
    const empty = document.getElementById('coll-empty');
    if (!empty) return;
    const legacyButton = [...empty.querySelectorAll('button')].find(button =>
      (button.getAttribute('onclick') || '').includes('collImportarDefaults')
    );
    if (!legacyButton) return;

    empty.replaceChildren();
    const message = document.createElement('div');
    message.textContent =
      'No hay colecciones configuradas todavía. Creá la primera con “+ Nueva colección”; el sitio público mostrará solamente lo que guardes en Firestore.';
    empty.appendChild(message);
  }

  function collectionOption(collection) {
    const option = document.createElement('option');
    option.value = clean(collection.slug);
    option.textContent = clean(collection.name) || clean(collection.slug);
    if (collection.visible === false) option.textContent += ' (oculta)';
    return option;
  }

  function ensureCsvHint(container) {
    if (!container || document.getElementById('csv-phase4-category-hint')) return;
    const tableWrap = container.closest('.adm-table-wrap') || container.parentElement;
    if (!tableWrap?.parentElement) return;

    const hint = document.createElement('div');
    hint.id = 'csv-phase4-category-hint';
    hint.style.cssText =
      'padding:10px 12px;margin:0 0 10px;background:#fef5f8;border:1px solid var(--adm-border);border-radius:10px;color:var(--adm-muted);font-size:11px;line-height:1.5;';
    hint.textContent =
      'Las categorías disponibles se toman de Super Admin → Colecciones. Si el CSV trae otra categoría, elegí una colección real antes de importar.';
    tableWrap.parentElement.insertBefore(hint, tableWrap);
  }

  function syncCsvCategorySelects() {
    const body = document.getElementById('csv-preview-body');
    if (!body) return;
    ensureCsvHint(body);

    body.querySelectorAll('select').forEach(select => {
      const handler = select.getAttribute('onchange') || '';
      if (!handler.includes('csvProductos')) return;

      const previous = clean(select.value);
      const known = collections.some(collection => collection.slug === previous);
      select.replaceChildren();

      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Seleccionar colección…';
      select.appendChild(placeholder);
      collections.forEach(collection => select.appendChild(collectionOption(collection)));

      select.value = known ? previous : '';
      select.dataset.phase4CollectionsSelect = '1';
      if (!known && previous) {
        // Actualiza también csvProductos[index].category mediante el onchange
        // que ya contiene admin.html; no alcanza con cambiar solo lo visual.
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }

  function wrapCollectionActions() {
    if (!saveWrapped && typeof window.collGuardar === 'function') {
      originalSave = window.collGuardar;
      window.collGuardar = async function(...args) {
        enforceImmutableSlug();
        const originalSlug = clean(document.getElementById('coll-original-slug')?.value);
        const slugInput = document.getElementById('coll-slug');
        if (originalSlug && slugInput) slugInput.value = originalSlug;

        const image = clean(document.getElementById('coll-image')?.value);
        if (!validCollectionImage(image)) {
          formError('La imagen debe ser una URL http/https válida y no puede contener comillas ni código.');
          return false;
        }
        return originalSave.apply(this, args);
      };
      saveWrapped = true;
    }

    if (!defaultsWrapped && typeof window.collImportarDefaults === 'function') {
      window.collImportarDefaults = function() {
        toastMessage(
          'El importador fijo fue desactivado. Creá las colecciones reales desde “+ Nueva colección”.'
        );
        return false;
      };
      defaultsWrapped = true;
    }
  }

  function startCollectionSubscription() {
    if (collectionSubscriptionStarted) return;
    collectionSubscriptionStarted = true;
    onAllCollectionsUpdate((nextCollections, error) => {
      if (error) {
        console.error('[admin-collections-phase4] No se pudieron leer las colecciones:', error);
        return;
      }
      collections = nextCollections;
      syncCsvCategorySelects();
    });
  }

  function bootDom() {
    const slugInput = document.getElementById('coll-slug');
    if (slugInput) {
      slugInput.addEventListener('input', enforceImmutableSlug, true);
      slugInput.addEventListener('change', enforceImmutableSlug, true);
    }

    const observer = new MutationObserver(() => {
      enforceImmutableSlug();
      removeLegacyDefaultsAction();
      syncCsvCategorySelects();
      wrapCollectionActions();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'value']
    });

    const timer = window.setInterval(() => {
      wrapCollectionActions();
      enforceImmutableSlug();
      removeLegacyDefaultsAction();
      syncCsvCategorySelects();
      if (saveWrapped && defaultsWrapped) window.clearInterval(timer);
    }, 250);

    enforceImmutableSlug();
    removeLegacyDefaultsAction();
    syncCsvCategorySelects();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootDom, { once: true });
  } else {
    bootDom();
  }

  onAuthStateChanged(auth, user => {
    if (user && !user.isAnonymous) startCollectionSubscription();
  });
}
