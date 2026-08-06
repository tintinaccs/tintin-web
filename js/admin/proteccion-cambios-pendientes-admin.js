(function () {
  'use strict';

  if (window.AdminUnsaved) return;

  const scopes = new Map();
  let activePrompt = null;
  let lastFocused = null;
  let tabSyncQueued = false;
  let scrollActiveTabIntoView = false;

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
    if (!scope || !isScopeActive(scope) || !scope.touched) return false;
    return currentValue(scope) !== scope.baseline;
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

  function settleUntouchedScope(id) {
    const scope = scopes.get(id);
    if (!scope || scope.touched || !isScopeActive(scope)) return;
    scope.baseline = currentValue(scope);
    updateState();
  }

  function scheduleSettle(id) {
    Promise.resolve().then(() => settleUntouchedScope(id));
    window.requestAnimationFrame(() => settleUntouchedScope(id));
    window.setTimeout(() => settleUntouchedScope(id), 250);
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
      touched: options.touched === true,
      lastUserActionAt: 0,
    };
    scope.baseline = options.baseline ?? currentValue(scope);
    scopes.set(id, scope);
    scheduleSettle(id);
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
    scope.touched = false;
    scope.lastUserActionAt = 0;
    updateState();
  }

  function markDirty(id) {
    const scope = scopes.get(id);
    if (!scope) return;
    scope.touched = true;
    scope.lastUserActionAt = Date.now();
    updateState();
  }

  function markAllClean(ids) {
    (ids ? (Array.isArray(ids) ? ids : [ids]) : [...scopes.keys()]).forEach(markClean);
  }

  function scopesForTarget(target) {
    if (!(target instanceof Node)) return [];
    return [...scopes.values()].filter(scope => {
      if (!isScopeActive(scope)) return false;
      const root = resolveRoot(scope.root);
      return root && (root === target || root.contains(target));
    });
  }

  function noteTrustedInteraction(event) {
    if (!event.isTrusted) return;
    const related = scopesForTarget(event.target);
    if (!related.length) return;
    related.forEach(scope => {
      scope.touched = true;
      scope.lastUserActionAt = Date.now();
    });
    Promise.resolve().then(updateState);
    window.requestAnimationFrame(updateState);
  }

  function injectQualityStyles() {
    if (document.getElementById('tt-admin-quality-guard-style')) return;
    const style = document.createElement('style');
    style.id = 'tt-admin-quality-guard-style';
    style.textContent = `
      #unsaved-modal{backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);background:rgba(45,22,31,.42)!important}
      #unsaved-modal>div{border:1px solid rgba(173,63,103,.12);border-radius:22px!important;box-shadow:0 24px 80px rgba(86,28,49,.22)!important;padding:30px!important}
      #unsaved-modal-title{font-size:18px!important;letter-spacing:-.015em}
      #unsaved-modal-detail{line-height:1.55;max-width:360px;margin-left:auto!important;margin-right:auto!important}
      #unsaved-modal button{min-height:44px;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease,background .16s ease}
      #unsaved-modal button:hover:not(:disabled){transform:translateY(-1px)}
      #unsaved-modal button:focus-visible{outline:3px solid rgba(212,106,138,.28);outline-offset:3px}
      #unsaved-modal-save{box-shadow:0 10px 24px rgba(173,63,103,.2)}
      #unsaved-modal-save:disabled,#unsaved-modal-discard:disabled,#unsaved-modal-stay:disabled{opacity:.58;cursor:wait}
      .correos-tabs,.ship-tabs,.user-tabs{align-items:center;background:rgba(255,255,255,.82);border:1px solid rgba(173,63,103,.10)!important;border-radius:18px;padding:8px!important;box-shadow:0 8px 24px rgba(91,29,51,.045);flex-wrap:nowrap!important;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}
      .correos-tabs::-webkit-scrollbar,.ship-tabs::-webkit-scrollbar,.user-tabs::-webkit-scrollbar{display:none}
      .correos-tab-btn,.ship-tab-btn,.user-tab-btn{min-height:42px;display:inline-flex!important;align-items:center;justify-content:center;flex:0 0 auto;border-color:rgba(173,63,103,.14)!important;color:#4b3b41!important;background:#fff!important;box-shadow:none!important}
      .correos-tab-btn:hover,.ship-tab-btn:hover,.user-tab-btn:hover{border-color:rgba(173,63,103,.42)!important;color:#AD3F67!important;background:#fff9fb!important}
      .correos-tab-btn.active,.ship-tab-btn.active,.user-tab-btn.active{background:#AD3F67!important;color:#fff!important;border-color:#AD3F67!important;box-shadow:0 8px 20px rgba(173,63,103,.18)!important}
      .correos-tab-btn:focus-visible,.ship-tab-btn:focus-visible,.user-tab-btn:focus-visible{outline:3px solid rgba(212,106,138,.28);outline-offset:2px}
      @media(max-width:640px){#unsaved-modal>div{padding:24px 18px!important;border-radius:20px!important}#unsaved-modal>div>div:last-child{flex-direction:column}#unsaved-modal button{width:100%}.correos-tabs,.ship-tabs,.user-tabs{border-radius:15px;padding:6px!important}.correos-tab-btn,.ship-tab-btn,.user-tab-btn{min-height:40px;padding:8px 15px!important}}
    `;
    document.head.appendChild(style);
  }

  function modalElements() {
    if (!document.getElementById('unsaved-modal') && document.body) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = `
        <div id="unsaved-modal" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="unsaved-modal-title" aria-describedby="unsaved-modal-detail" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:4000;align-items:center;justify-content:center;padding:16px">
          <div style="background:#fff;border-radius:16px;max-width:480px;width:100%;padding:28px;box-shadow:0 18px 60px rgba(0,0,0,.24);text-align:center">
            <div style="width:48px;height:48px;border-radius:50%;display:grid;place-items:center;margin:0 auto 12px;background:#fff4e8;color:#b15f00;font-size:24px;font-weight:900" aria-hidden="true">!</div>
            <div id="unsaved-modal-title" style="font-size:17px;font-weight:800;margin-bottom:8px;color:#2b2b2b">Tenés cambios sin guardar</div>
            <div id="unsaved-modal-detail" style="font-size:13px;color:#685b60;margin-bottom:22px">Si salís ahora vas a perder lo que modificaste.</div>
            <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
              <button type="button" id="unsaved-modal-save" style="border:0;border-radius:999px;background:#ad3f67;color:#fff;padding:11px 18px;font:inherit;font-weight:700;cursor:pointer">Guardar y continuar</button>
              <button type="button" id="unsaved-modal-discard" style="border:1px solid #e3c4cf;border-radius:999px;background:#fff;color:#9b294e;padding:11px 18px;font:inherit;font-weight:700;cursor:pointer">Descartar cambios</button>
              <button type="button" id="unsaved-modal-stay" style="border:1px solid #d7c7cd;border-radius:999px;background:#fff;color:#493c41;padding:11px 18px;font:inherit;font-weight:700;cursor:pointer">Seguir editando</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(wrapper.firstElementChild);
    }
    const elements = {
      modal: document.getElementById('unsaved-modal'),
      title: document.getElementById('unsaved-modal-title'),
      detail: document.getElementById('unsaved-modal-detail'),
      save: document.getElementById('unsaved-modal-save'),
      discard: document.getElementById('unsaved-modal-discard'),
      stay: document.getElementById('unsaved-modal-stay'),
    };
    if (elements.save && !elements.save.hasAttribute('aria-busy')) elements.save.textContent = 'Guardar y continuar';
    if (elements.discard) elements.discard.textContent = 'Descartar cambios';
    if (elements.stay) elements.stay.textContent = 'Seguir editando';
    return elements;
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
    if (save) save.textContent = 'Guardar y continuar';
    activePrompt = null;
    lastFocused?.focus?.();
    lastFocused = null;
  }

  function withTimeout(promise, timeout = 24000) {
    return Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => window.setTimeout(() => reject(new Error('El guardado tardó demasiado. Revisá la conexión y volvé a intentar.')), timeout))
    ]);
  }

  function requestNavigation(proceed, options = {}) {
    const candidateIds = options.scopeIds ? (Array.isArray(options.scopeIds) ? options.scopeIds : [options.scopeIds]) : [...scopes.keys()];
    candidateIds.forEach(settleUntouchedScope);
    const pending = dirtyScopes(options.scopeIds);
    if (!pending.length) {
      proceed?.();
      return Promise.resolve(true);
    }
    if (activePrompt) return activePrompt;

    const { modal, detail, save, discard, stay } = modalElements();
    if (!modal || !discard || !stay) {
      if (window.confirm('Tenés cambios sin guardar. ¿Deseás descartarlos y continuar?')) {
        pending.forEach(scope => {
          scope.baseline = currentValue(scope);
          scope.touched = false;
        });
        proceed?.();
        return Promise.resolve(true);
      }
      return Promise.resolve(false);
    }

    const canSaveAll = pending.every(scope => typeof scope.save === 'function');
    if (save) {
      save.hidden = !canSaveAll;
      save.textContent = 'Guardar y continuar';
    }
    if (detail) {
      const labels = pending.map(scope => scope.label).filter(Boolean);
      detail.textContent = labels.length === 1
        ? `Hay cambios reales pendientes en ${labels[0]}.`
        : `Hay cambios reales pendientes en ${labels.length} apartados.`;
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
        pending.forEach(scope => {
          scope.baseline = currentValue(scope);
          scope.touched = false;
          scope.lastUserActionAt = 0;
        });
        closePrompt();
        updateState();
        proceed?.();
        resolve(true);
      };
      if (save && canSaveAll) {
        save.onclick = async () => {
          const stillPending = pending.filter(scope => isDirty(scope.id));
          if (!stillPending.length) {
            closePrompt();
            proceed?.();
            resolve(true);
            return;
          }

          save.disabled = true;
          discard.disabled = true;
          stay.disabled = true;
          save.setAttribute('aria-busy', 'true');
          save.textContent = 'Guardando…';
          if (detail) detail.textContent = 'Guardando los cambios. Esperá un momento…';

          try {
            for (const scope of stillPending) {
              const result = await withTimeout(scope.save());
              if (result === false) throw new Error(`No se pudo guardar ${scope.label}.`);
              scope.baseline = currentValue(scope);
              scope.touched = false;
              scope.lastUserActionAt = 0;
            }
            closePrompt();
            updateState();
            proceed?.();
            resolve(true);
          } catch (error) {
            console.error('[admin-unsaved] No se pudieron guardar los cambios:', error);
            save.textContent = 'Volver a intentar';
            save.disabled = false;
            discard.disabled = false;
            stay.disabled = false;
            save.removeAttribute('aria-busy');
            if (detail) detail.textContent = error?.message || 'No se pudo guardar. Revisá la conexión y volvé a intentar.';
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

  function tabPanelId(button) {
    if (button.dataset.correosTab) return `correos-panel-${button.dataset.correosTab}`;
    if (button.dataset.pruebaMode) return `prueba-mode-${button.dataset.pruebaMode}`;
    if (button.dataset.shipTab) return `ship-panel-${button.dataset.shipTab}`;
    if (button.dataset.userTab) return `user-panel-${button.dataset.userTab}`;
    return '';
  }

  function syncTabSemantics() {
    tabSyncQueued = false;
    // Solo se hace scroll cuando queueTabSync(true) lo pidió explícitamente
    // (un clic o una flecha de teclado sobre una pestaña real) — nunca en una
    // pasada disparada por el MutationObserver, o cualquier actualización en
    // tiempo real en cualquier parte del panel (Pedidos, Usuarios, Clientas)
    // termina arrastrando el scroll de vuelta hacia la pestaña activa.
    const shouldScroll = scrollActiveTabIntoView;
    scrollActiveTabIntoView = false;
    document.querySelectorAll('.correos-tabs,.ship-tabs,.user-tabs').forEach((list, listIndex) => {
      list.setAttribute('role', 'tablist');
      const buttons = [...list.querySelectorAll(':scope > .correos-tab-btn,:scope > .ship-tab-btn,:scope > .user-tab-btn')];
      buttons.forEach((button, index) => {
        const active = button.classList.contains('active');
        const panelId = tabPanelId(button);
        if (!button.id) button.id = `adm-tab-${listIndex}-${index}`;
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', active ? 'true' : 'false');
        button.tabIndex = active ? 0 : -1;
        if (panelId) {
          button.setAttribute('aria-controls', panelId);
          const panel = document.getElementById(panelId);
          if (panel) {
            panel.setAttribute('role', 'tabpanel');
            panel.setAttribute('aria-labelledby', button.id);
            panel.setAttribute('aria-hidden', active ? 'false' : 'true');
          }
        }
        if (active && shouldScroll) button.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
    });
  }

  function queueTabSync(scrollIntoView) {
    if (scrollIntoView) scrollActiveTabIntoView = true;
    if (tabSyncQueued) return;
    tabSyncQueued = true;
    window.requestAnimationFrame(syncTabSemantics);
  }

  function handleTabKeyboard(event) {
    const current = event.target?.closest?.('[role="tab"]');
    if (!current) return;
    const list = current.closest('[role="tablist"]');
    if (!list) return;
    const tabs = [...list.querySelectorAll(':scope > [role="tab"]')].filter(tab => !tab.disabled);
    const index = tabs.indexOf(current);
    if (index < 0) return;
    let next = null;
    if (event.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length];
    if (event.key === 'ArrowLeft') next = tabs[(index - 1 + tabs.length) % tabs.length];
    if (event.key === 'Home') next = tabs[0];
    if (event.key === 'End') next = tabs[tabs.length - 1];
    if (!next) return;
    event.preventDefault();
    next.focus();
    next.click();
  }

  injectQualityStyles();
  modalElements();
  queueTabSync();

  window.addEventListener('beforeunload', event => {
    if (!dirtyScopes().length) return;
    event.preventDefault();
    event.returnValue = '';
  });
  document.addEventListener('click', interceptLinks, true);
  document.addEventListener('input', noteTrustedInteraction, true);
  document.addEventListener('change', noteTrustedInteraction, true);
  document.addEventListener('click', event => {
    noteTrustedInteraction(event);
    const tabClicked = Boolean(event.target?.closest?.('.correos-tab-btn,.ship-tab-btn,.user-tab-btn'));
    queueTabSync(tabClicked);
  }, true);
  document.addEventListener('keydown', event => {
    handleTabKeyboard(event);
    if (event.key === 'Escape' && activePrompt) {
      event.preventDefault();
      modalElements().stay?.click();
    }
  }, true);

  // Sin el wrapper, el propio MutationObserver pasaría su lista de mutaciones
  // (un array, siempre truthy) como primer argumento de queueTabSync — que es
  // exactamente el flag que decide si hay que hacer scroll. Eso reactivaría
  // el scroll en cada mutación y anularía todo el arreglo de arriba.
  const tabObserver = new MutationObserver(() => queueTabSync(false));
  if (document.body) tabObserver.observe(document.body, { childList: true, subtree: true });
  else window.addEventListener('DOMContentLoaded', () => tabObserver.observe(document.body, { childList: true, subtree: true }), { once: true });

  window.AdminUnsaved = Object.freeze({
    register,
    has: id => scopes.has(id),
    unregister,
    markClean,
    markDirty,
    markAllClean,
    isDirty,
    dirtyScopes: ids => dirtyScopes(ids).map(scope => scope.id),
    requestNavigation,
    serializeRoot,
    waitForEvent,
    updateState,
  });
})();
