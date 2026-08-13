const STORAGE_KEY = 'tintin:appearance-workspace:v1';
const DEFAULT_LAYOUT = Object.freeze({ previewRatio: 0.56, sidebarWidth: 300 });

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function normalizeWorkspaceLayout(value = {}) {
  const previewRatio = typeof value.previewRatio === 'number' ? value.previewRatio : Number.NaN;
  const sidebarWidth = typeof value.sidebarWidth === 'number' ? value.sidebarWidth : Number.NaN;
  return {
    previewRatio: Number.isFinite(previewRatio) ? clamp(previewRatio, 0.3, 0.72) : DEFAULT_LAYOUT.previewRatio,
    sidebarWidth: Number.isFinite(sidebarWidth) ? clamp(sidebarWidth, 220, 520) : DEFAULT_LAYOUT.sidebarWidth,
  };
}

function readLayout() {
  try { return normalizeWorkspaceLayout(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')); }
  catch { return { ...DEFAULT_LAYOUT }; }
}

function saveLayout(layout) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeWorkspaceLayout(layout))); }
  catch { /* El editor sigue funcionando aunque el almacenamiento esté bloqueado. */ }
}

function separator(className, orientation, label) {
  const node = document.createElement('div');
  node.className = `visual-workspace-splitter ${className}`;
  node.tabIndex = 0;
  node.setAttribute('role', 'separator');
  node.setAttribute('aria-orientation', orientation);
  node.setAttribute('aria-label', label);
  node.title = `${label}. Arrastrá o usá las flechas. Doble clic para restablecer.`;
  const grip = document.createElement('span');
  grip.className = 'visual-workspace-splitter-grip';
  grip.setAttribute('aria-hidden', 'true');
  node.appendChild(grip);
  return node;
}

export function installWorkspaceSplitters(editor) {
  const layout = editor?.querySelector('.visual-editor-layout');
  const preview = layout?.querySelector('.visual-editor-preview');
  const sidebar = layout?.querySelector('.visual-editor-sidebar');
  const properties = layout?.querySelector('.visual-editor-properties');
  if (!layout || !preview || !sidebar || !properties || layout.dataset.splittersReady === '1') return false;

  layout.dataset.splittersReady = '1';
  const horizontal = separator('is-horizontal', 'horizontal', 'Cambiar altura de la vista previa y los editores');
  const vertical = separator('is-vertical', 'vertical', 'Cambiar ancho de la lista y las propiedades');
  const workbench = document.createElement('div');
  workbench.className = 'visual-editor-workbench';
  preview.id ||= 'visual-editor-preview-panel';
  sidebar.id ||= 'visual-editor-sections-panel';
  properties.id ||= 'visual-editor-properties-panel';
  workbench.id = 'visual-editor-workbench';
  horizontal.setAttribute('aria-controls', `${preview.id} ${workbench.id}`);
  vertical.setAttribute('aria-controls', `${sidebar.id} ${properties.id}`);
  workbench.append(sidebar, vertical, properties);
  layout.replaceChildren(preview, horizontal, workbench);

  let state = readLayout();
  const apply = () => {
    state = normalizeWorkspaceLayout(state);
    layout.style.setProperty('--vs-preview-ratio', `${(state.previewRatio * 100).toFixed(2)}%`);
    workbench.style.setProperty('--vs-sidebar-width', `${Math.round(state.sidebarWidth)}px`);
    horizontal.setAttribute('aria-valuemin', '30');
    horizontal.setAttribute('aria-valuemax', '72');
    horizontal.setAttribute('aria-valuenow', String(Math.round(state.previewRatio * 100)));
    vertical.setAttribute('aria-valuemin', '220');
    vertical.setAttribute('aria-valuemax', '520');
    vertical.setAttribute('aria-valuenow', String(Math.round(state.sidebarWidth)));
  };
  const persist = () => saveLayout(state);
  apply();

  const beginDrag = (event, axis) => {
    if (event.button !== 0) return;
    event.preventDefault();
    document.body.classList.add('visual-workspace-resizing', `is-resizing-${axis}`);
    const move = moveEvent => {
      if (axis === 'horizontal') {
        const rect = layout.getBoundingClientRect();
        state.previewRatio = clamp((moveEvent.clientY - rect.top) / Math.max(rect.height, 1), 0.3, 0.72);
      } else {
        const rect = workbench.getBoundingClientRect();
        state.sidebarWidth = clamp(moveEvent.clientX - rect.left, 220, Math.min(520, Math.max(220, rect.width - 300)));
      }
      apply();
    };
    const finish = () => {
      document.body.classList.remove('visual-workspace-resizing', `is-resizing-${axis}`);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      persist();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish, { once: true });
    window.addEventListener('pointercancel', finish, { once: true });
  };

  horizontal.addEventListener('pointerdown', event => beginDrag(event, 'horizontal'));
  vertical.addEventListener('pointerdown', event => beginDrag(event, 'vertical'));
  horizontal.addEventListener('keydown', event => {
    if (!['ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
    event.preventDefault();
    state.previewRatio = event.key === 'Home' ? DEFAULT_LAYOUT.previewRatio : state.previewRatio + (event.key === 'ArrowDown' ? 0.04 : -0.04);
    apply(); persist();
  });
  vertical.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return;
    event.preventDefault();
    state.sidebarWidth = event.key === 'Home' ? DEFAULT_LAYOUT.sidebarWidth : state.sidebarWidth + (event.key === 'ArrowRight' ? 24 : -24);
    apply(); persist();
  });
  horizontal.addEventListener('dblclick', () => { state.previewRatio = DEFAULT_LAYOUT.previewRatio; apply(); persist(); });
  vertical.addEventListener('dblclick', () => { state.sidebarWidth = DEFAULT_LAYOUT.sidebarWidth; apply(); persist(); });
  return true;
}
