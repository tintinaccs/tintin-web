(function () {
  'use strict';

  if (window.AdminUnsaved) return;

  const scopes = new Map();
  let activePrompt = null;
  let lastFocused = null;

  function text(value) {
    return String(value == null ? '' : value);
  }

  function resolveRoot(root) {
    if (typeof root === 'string') return document.querySelector(root);
    return root || null;
  }

  function controlKey(control, index) {
    return control.id || control.name || control.dataset?.fkey || control.dataset?.unsavedKey || `${control.tagName}:${index}`;
  }

  function serializeRoot(root) {
    if (!root) return '';
    const controls = [...root.querySelectorAll('input, textarea, select, [contenteditable="true"]')];
    const values = controls
      .filter(control => !control.disabled && control.type !== 'button' && control.type !== 'submit')
      .map((control, index) => {
        const key = controlKey(control, index);
        if (control.type === 'file') {
          const files = [...(control.files || [])].map(file => [file.name, file.size, file.lastModified, file.type]);
          return [key, 'file', files];
        }
        if (control.type === 'checkbox' || control.type === 'radio') return [key, control.type, control.checked];
        if (control.isContentEditable) return [key, 'contenteditable', control.innerHTML];
        if (control.tagName === 'SELECT' && control.multiple) {
          return [key, 'select-multiple', [...control.selectedOptions].map(option => option.value)];
        }
        return [key, control.tagName, control.value];
      });
    const structural = [...root.querySelectorAll('[data-unsaved-value]')]
      .map((node, index) => [node.dataset.unsavedKey || node.id || `node:${index}`, node.dataset.unsavedValue || node.textContent]);
    return JSON.stringify({ values, structural });
  }

  function currentValue(scope) {
    try {
      return text(scope.serialize ? scope.serialize() : serializeRoot(resolveRoot(scope.root)));
    } catch (error) {
      console.warn('[admin-unsaved] No se pudo leer el formulario:', scope.id, error);
      return scope.baseline;
    }
  }

  function isScopeActive(scope) {
    const root = resolveRoot(scope.root);
    if (!root || !root.isConnected) return false;
    if (typeof scope.active === 'function') return Boolean(scope.active());
    return scope.active !== false;
  }

  function isDirty(id) {
    const scope = scopes.get(id);
    return Boolean(scope && isScopeActive(scope) && currentValue(scope) !== scope.baseline);
  }

  function dirtyScopes(ids) {
    const allowed = ids ? new Set(Array.isArray(ids) ? ids : [ids]) : null;
    return [...scopes.values()].filter(scope => (!allowed || allowed.has(scope.id)) && isDirty(scope.id));
  }

  function updateState() {
    const dirty = dirtyScopes();
    document.documentElement.classList.toggle('adm-has-unsaved', dirty.length > 0);
    window.dispatchEvent(new CustomEvent('tintin:admin-unsaved-state', {
      detail: { dirty: dirty.map(scope => scope.id) }
    }));
  }

  function register(id, options = {}) {
    if (!id) return null;
    const previous = scopes.get(id);
    const scope = {
      id,
      root: options.root || previous?.root || null,
      serialize: options.serialize || previous?.serialize || null,
      save: options.save || previous?.save || null,
      active: options.active ?? previous?.active ?? true,
      label: options.label || previous?.label || id,
      baseline: '',
    };
    scope.baseline = options.baseline ?? currentValue(scope);
    scopes.set(id, scope);
    updateState();
    return scope;
  }

  function unregister(id) {
    scopes.delete(id);
    updateState();
  }

  function markClean(id) {
    const scope = scopes.get(id);
    if (!scope) return;
    scope.baseline = currentValue(scope);
    updateState();
  }

  function markAllClean(ids) {
    (ids ? (Array.isArray(ids) ? ids : [ids]) : [...scopes.keys()]).forEach(markClean);
  }

  function modalElements() {
    if (!document.getElementById('unsaved-modal') && document.body) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = `
        <div id="unsaved-modal" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="unsaved-modal-title" aria-describedby="unsaved-modal-detail" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:4000;align-items:center;justify-content:center;padding:16px">
          <div style="background:#fff;border-radius:16px;max-width:460px;width:100%;padding:28px;box-shadow:0 18px 60px rgba(0,0,0,.24);text-align:center">
            <div style="font-size:32px;margin-bottom:10px" aria-hidden="true">⚠️</div>
            <div id="unsaved-modal-title" style="font-size:17px;font-weight:800;margin-bottom:8px;color:#2b2b2b">Tenés cambios sin guardar</div>
            <div id="unsaved-modal-detail" style="font-size:13px;color:#685b60;margin-bottom:22px">Si salís ahora vas a perder lo que modificaste.</div>
            <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
              <button type="button" id="unsaved-modal-save" style="border:0;border-radius:999px;background:#ad3f67;color:#fff;padding:11px 18px;font:inherit;font-weight:700;cursor:pointer">Guardar cambios</button>
              <button type="button" id="unsaved-modal-discard" style="border:1px solid #c6284c;border-radius:999px;background:#fff;color:#a11f40;padding:11px 18px;font:inherit;font-weight:700;cursor:pointer">Salir sin guardar</button>
              <button type="button" id="unsaved-modal-stay" style="border:1px solid #d7c7cd;border-radius:999px;background:#fff;color:#493c41;padding:11px 18px;font:inherit;font-weight:700;cursor:pointer">Seguir editando</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(wrapper.firstElementChild);
    }
    return {
      modal: document.getElementById('unsaved-modal'),
      title: document.getElementById('unsaved-modal-title'),
      detail: document.getElementById('unsaved-modal-detail'),
      save: document.getElementById('unsaved-modal-save'),
      discard: document.getElementById('unsaved-modal-discard'),
      stay: document.getElementById('unsaved-modal-stay'),
    };
  }

  function closePrompt() {
    const { modal, save, discard, stay } = modalElements();
    if (modal) {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }
    [save, discard, stay].forEach(button => {
      if (button) {
        button.onclick = null;
        button.disabled = false;
        button.removeAttribute('aria-busy');
      }
    });
    activePrompt = null;
    lastFocused?.focus?.();
    lastFocused = null;
  }

  function requestNavigation(proceed, options = {}) {
    const pending = dirtyScopes(options.scopeIds);
    if (!pending.length) {
      proceed?.();
      return Promise.resolve(true);
    }
    if (activePrompt) return activePrompt;

    const { modal, detail, save, discard, stay } = modalElements();
    if (!modal || !discard || !stay) {
      if (window.confirm('Tenés cambios sin guardar. ¿Deseás salir sin guardarlos?')) {
        pending.forEach(scope => { scope.baseline = currentValue(scope); });
        proceed?.();
        return Promise.resolve(true);
      }
      return Promise.resolve(false);
    }

    const canSaveAll = pending.every(scope => typeof scope.save === 'function');
    if (save) save.hidden = !canSaveAll;
    if (detail) {
      const labels = pending.map(scope => scope.label).filter(Boolean);
      detail.textContent = labels.length === 1
        ? `Hay cambios pendientes en ${labels[0]}.`
        : `Hay cambios pendientes en ${labels.length} formularios.`;
    }

    lastFocused = document.activeElement;
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    stay.focus();

    activePrompt = new Promise(resolve => {
      stay.onclick = () => {
        closePrompt();
        resolve(false);
      };
      discard.onclick = () => {
        pending.forEach(scope => { scope.baseline = currentValue(scope); });
        closePrompt();
        proceed?.();
        resolve(true);
      };
      if (save && canSaveAll) {
        save.onclick = async () => {
          save.disabled = true;
          save.setAttribute('aria-busy', 'true');
          const original = save.textContent;
          save.textContent = 'Guardando…';
          try {
            for (const scope of pending) {
              const result = await scope.save();
              if (result === false) {
                save.textContent = original;
                save.disabled = false;
                save.removeAttribute('aria-busy');
                return;
              }
              scope.baseline = currentValue(scope);
            }
            closePrompt();
            proceed?.();
            resolve(true);
          } catch (error) {
            console.error('[admin-unsaved] No se pudieron guardar los cambios:', error);
            save.textContent = original;
            save.disabled = false;
            save.removeAttribute('aria-busy');
          }
        };
      }
    });
    return activePrompt;
  }

  function waitForEvent(name, failureName, timeout = 20000) {
    return new Promise(resolve => {
      let timer = 0;
      const cleanup = () => {
        window.clearTimeout(timer);
        window.removeEventListener(name, onSuccess);
        if (failureName) window.removeEventListener(failureName, onFailure);
      };
      const onSuccess = () => { cleanup(); resolve(true); };
      const onFailure = () => { cleanup(); resolve(false); };
      window.addEventListener(name, onSuccess, { once: true });
      if (failureName) window.addEventListener(failureName, onFailure, { once: true });
      timer = window.setTimeout(() => { cleanup(); resolve(false); }, timeout);
    });
  }

  function interceptLinks(event) {
    const anchor = event.target?.closest?.('a[href]');
    if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
    const raw = anchor.getAttribute('href') || '';
    if (!raw || raw.startsWith('#') || raw.startsWith('javascript:')) return;
    if (!dirtyScopes().length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const destination = anchor.href;
    requestNavigation(() => window.location.assign(destination));
  }

  window.addEventListener('beforeunload', event => {
    if (!dirtyScopes().length) return;
    event.preventDefault();
    event.returnValue = '';
  });
  document.addEventListener('click', interceptLinks, true);
  document.addEventListener('input', updateState, true);
  document.addEventListener('change', updateState, true);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && activePrompt) {
      event.preventDefault();
      modalElements().stay?.click();
    }
  }, true);

  window.AdminUnsaved = Object.freeze({
    register,
    has: id => scopes.has(id),
    unregister,
    markClean,
    markAllClean,
    isDirty,
    dirtyScopes: ids => dirtyScopes(ids).map(scope => scope.id),
    requestNavigation,
    serializeRoot,
    waitForEvent,
    updateState,
  });
})();
