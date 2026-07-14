/* =============================================================
   TINTIN — Fase 5: administración segura de imágenes
   ============================================================= */

import {
  IMAGE_SLOTS,
  HERO_SIZE_VALUES,
  HERO_POSITION_VALUES,
  saveImages,
} from './images.js';
import { sanitizeImageUrl } from './image-utils.js';

if (!window.TintinAdminImagesPhase5Booted) {
  window.TintinAdminImagesPhase5Booted = true;

  const path = (window.location.pathname || '').toLowerCase();
  const isImageAdmin = path.endsWith('/admin-images.html') || path.endsWith('/admin-images');

  if (isImageAdmin) {
    const supportedSections = new Set(IMAGE_SLOTS.map(slot => slot.section));

    function toast(message, isError = false) {
      const node = document.getElementById('adm-toast');
      if (!node) {
        window.alert(message);
        return;
      }
      node.textContent = message;
      node.style.background = isError ? '#c0392b' : '#1a1a1a';
      node.classList.add('show');
      window.setTimeout(() => node.classList.remove('show'), 3000);
    }

    function slotById(slotId) {
      return IMAGE_SLOTS.find(slot => slot.id === slotId) || null;
    }

    function emptyPreview(slot) {
      const empty = document.createElement('div');
      const emoji = document.createElement('span');
      const label = document.createElement('span');
      empty.className = 'adm-preview-empty';
      emoji.className = 'emoji';
      emoji.textContent = slot?.emoji || '🖼️';
      label.className = 'label';
      label.textContent = 'Sin imagen';
      empty.append(emoji, label);
      return empty;
    }

    function configuredPreview(slot, url) {
      const image = document.createElement('img');
      const fallback = document.createElement('div');
      const emoji = document.createElement('span');
      const label = document.createElement('span');

      image.src = url;
      image.alt = slot?.label || '';
      image.loading = 'lazy';
      fallback.className = 'adm-preview-empty';
      fallback.style.display = 'none';
      emoji.className = 'emoji';
      emoji.textContent = slot?.emoji || '🖼️';
      label.className = 'label';
      label.textContent = 'Error cargando imagen';
      fallback.append(emoji, label);
      image.addEventListener('error', () => {
        image.style.display = 'none';
        fallback.style.display = 'flex';
      });
      return [image, fallback];
    }

    function updateCard(slotId, url) {
      const slot = slotById(slotId);
      const preview = document.getElementById(`preview-${slotId}`);
      const status = document.getElementById(`status-${slotId}`);
      const input = document.getElementById(`input-${slotId}`);
      if (input) input.value = url || '';

      if (preview) {
        preview.replaceChildren(...(url ? configuredPreview(slot, url) : [emptyPreview(slot)]));
      }
      if (status) {
        const dot = document.createElement('div');
        const text = document.createElement('span');
        dot.className = `adm-status-dot ${url ? 'on' : 'off'}`;
        text.textContent = url ? 'Configurada' : 'Sin configurar';
        status.replaceChildren(dot, text);
      }
    }

    function heroPatch(slotId) {
      if (!slotId.startsWith('hero_bg_')) return {};
      const size = document.getElementById(`size-${slotId}`)?.value || 'cover';
      const pos = document.getElementById(`pos-${slotId}`)?.value || 'center center';
      return {
        [`${slotId}_size`]: HERO_SIZE_VALUES.includes(size) ? size : 'cover',
        [`${slotId}_pos`]: HERO_POSITION_VALUES.includes(pos) ? pos : 'center center',
      };
    }

    async function saveSlotSecure(slotId, button) {
      if (!slotById(slotId)) {
        toast('Ese espacio de imagen ya no está activo.', true);
        return;
      }

      const input = document.getElementById(`input-${slotId}`);
      const raw = String(input?.value || '').trim();
      const safe = raw ? sanitizeImageUrl(raw) : '';
      if (raw && !safe) {
        input?.classList.add('tt-image-url-invalid');
        toast('La URL no es válida. Usá una dirección http o https sin comillas.', true);
        return;
      }
      input?.classList.remove('tt-image-url-invalid');

      const previousText = button?.textContent;
      if (button) {
        button.disabled = true;
        button.textContent = 'Guardando…';
      }
      try {
        await saveImages({ [slotId]: safe || null, ...heroPatch(slotId) });
        updateCard(slotId, safe);
        toast(safe ? '✅ Imagen guardada' : '✅ Imagen quitada');
      } catch (error) {
        console.error('[admin-images-phase5] save failed:', error);
        toast(error?.message || 'No se pudo guardar la imagen.', true);
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = previousText || 'Guardar';
        }
      }
    }

    async function clearSlotSecure(slotId, button) {
      if (!slotById(slotId)) return;
      const previousText = button?.textContent;
      if (button) {
        button.disabled = true;
        button.textContent = 'Quitando…';
      }
      try {
        const patch = { [slotId]: null };
        if (slotId.startsWith('hero_bg_')) {
          patch[`${slotId}_size`] = null;
          patch[`${slotId}_pos`] = null;
        }
        await saveImages(patch);
        updateCard(slotId, '');
        toast('✅ Imagen quitada');
      } catch (error) {
        console.error('[admin-images-phase5] clear failed:', error);
        toast('No se pudo quitar la imagen.', true);
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = previousText || 'Quitar';
        }
      }
    }

    async function clearSelectedSecure(button) {
      const selected = [...document.querySelectorAll('.img-slot-check:checked')]
        .map(input => input.dataset.slotId)
        .filter(slotId => Boolean(slotById(slotId)));
      if (!selected.length) return;
      if (!window.confirm(`¿Quitar la imagen de ${selected.length} espacio(s) seleccionado(s)?`)) return;

      const patch = {};
      selected.forEach(slotId => {
        patch[slotId] = null;
        if (slotId.startsWith('hero_bg_')) {
          patch[`${slotId}_size`] = null;
          patch[`${slotId}_pos`] = null;
        }
      });

      const previousText = button.textContent;
      button.disabled = true;
      button.textContent = 'Quitando…';
      try {
        await saveImages(patch);
        selected.forEach(slotId => updateCard(slotId, ''));
        document.querySelectorAll('.img-slot-check:checked').forEach(input => {
          input.checked = false;
        });
        document.getElementById('img-bulk-toolbar')?.classList.remove('show');
        toast(`✅ ${selected.length} imagen(es) quitadas`);
      } catch (error) {
        console.error('[admin-images-phase5] bulk clear failed:', error);
        toast('No se pudieron quitar las imágenes seleccionadas.', true);
      } finally {
        button.disabled = false;
        button.textContent = previousText;
      }
    }

    function simplifyNavigation() {
      document.querySelectorAll('[data-section]').forEach(button => {
        const section = button.dataset.section;
        if (!supportedSections.has(section)) button.style.display = 'none';
      });

      if (document.getElementById('tt-image-source-note')) return;
      const header = document.querySelector('.adm-section-header');
      if (!header) return;
      const note = document.createElement('div');
      note.id = 'tt-image-source-note';
      note.style.cssText =
        'margin-top:12px;padding:12px 14px;border:1px solid #f0c8d6;background:#fff3f7;border-radius:10px;font-size:12px;line-height:1.55;color:#666;';
      note.textContent =
        'Fotos de productos: se cambian desde Productos. Portadas de colecciones: desde Colecciones. Este panel administra solamente Hero, editoriales, Nosotros y el logo.';
      header.appendChild(note);
    }

    function ensureStyles() {
      if (document.getElementById('tt-admin-images-phase5-style')) return;
      const style = document.createElement('style');
      style.id = 'tt-admin-images-phase5-style';
      style.textContent = `
        .adm-url-input.tt-image-url-invalid{border-color:#c0392b!important;background:#fff4f4!important}
        .adm-btn-save:disabled,.adm-btn-clear:disabled,.adm-bulk-btn:disabled{opacity:.55;cursor:wait}
      `;
      document.head.appendChild(style);
    }

    function boot() {
      ensureStyles();
      simplifyNavigation();

      document.addEventListener('input', event => {
        const input = event.target.closest?.('.adm-url-input');
        if (!input) return;
        const raw = input.value.trim();
        input.classList.toggle('tt-image-url-invalid', Boolean(raw && !sanitizeImageUrl(raw)));
      }, true);

      document.addEventListener('click', event => {
        const saveButton = event.target.closest?.('[data-save]');
        const clearButton = event.target.closest?.('[data-clear]');
        const bulkClear = event.target.closest?.('#btn-img-bulk-clear');
        if (!saveButton && !clearButton && !bulkClear) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        if (saveButton) saveSlotSecure(saveButton.dataset.save, saveButton);
        else if (clearButton) clearSlotSecure(clearButton.dataset.clear, clearButton);
        else clearSelectedSecure(bulkClear);
      }, true);

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
