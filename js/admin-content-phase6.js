/* =============================================================
   TINTIN — Fase 6: editor seguro de contenido

   Crea la sección que faltaba en admin.html y edita únicamente los campos
   incluidos en content-schema.js. No acepta HTML ni selectores desde Firestore.
   ============================================================= */

import { auth, db } from './firebase.js?v=tintin-20260716-cloudinary-fix-1';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
  increment,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { SUPER_ADMIN, getUserRole } from './roles.js?v=tintin-20260716-cloudinary-fix-1';
import { loadRolePermissions, canDo } from './role-permissions.js?v=tintin-20260716-cloudinary-fix-1';
import {
  CONTENT_PAGE_IDS,
  SITE_CONTENT_SCHEMA,
  getPageSchema,
  getSectionSchema,
  getPageDefaults,
  getSectionDefaults,
  getNested,
  setNested,
  mergeContent,
  sanitizeSection,
  sanitizeContentHref,
  normalizeContentValue,
} from './content-schema.js?v=tintin-20260716-cloudinary-fix-1';

if (!window.TintinAdminContentPhase6Booted) {
  window.TintinAdminContentPhase6Booted = true;

  const params = new URLSearchParams(window.location.search);
  let currentPageId = CONTENT_PAGE_IDS.includes(params.get('page')) ? params.get('page') : 'index';
  let currentSectionId = params.get('section') || '';
  let currentPageData = {};
  let currentUser = null;
  let currentRole = 'client';
  let pageUnsubscribe = null;
  let dirty = false;
  let remotePending = false;
  let permissions = { view: false, edit: false, toggle: false, restore: false };
  let ui = null;

  function effectiveFields(sectionSchema) {
    const targets = new Map();
    sectionSchema.fields.forEach(item => {
      const mode = item.type === 'href' ? 'href' : 'text';
      const key = `${item.selector}::${item.index == null ? 0 : item.index}::${mode}`;
      targets.set(key, item);
    });
    return [...targets.values()];
  }

  function create(tag, className = '', text = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== '') node.textContent = text;
    return node;
  }

  function toast(message, error = false) {
    let node = document.getElementById('content-phase6-toast');
    if (!node) {
      node = create('div', 'content-phase6-toast');
      node.id = 'content-phase6-toast';
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.classList.toggle('is-error', error);
    node.classList.add('show');
    window.setTimeout(() => node.classList.remove('show'), 3000);
  }

  function updateQuery() {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'contenido');
    url.searchParams.set('page', currentPageId);
    url.searchParams.set('section', currentSectionId);
    window.history.replaceState(null, '', url.href);
  }

  function setNotice(message = '', kind = '') {
    if (!ui?.notice) return;
    ui.notice.textContent = message;
    ui.notice.className = `content-phase6-notice${kind ? ` is-${kind}` : ''}`;
    ui.notice.hidden = !message;
  }

  function confirmDiscard() {
    if (!dirty) return true;
    return window.confirm('Hay cambios sin guardar. ¿Querés descartarlos y continuar?');
  }

  function sectionIdsForPage(pageId) {
    return Object.keys(getPageSchema(pageId)?.sections || {});
  }

  function normalizeCurrentSection() {
    const ids = sectionIdsForPage(currentPageId);
    if (!ids.includes(currentSectionId)) currentSectionId = ids[0] || '';
  }

  function mergedCurrentSection() {
    const defaults = getSectionDefaults(currentPageId, currentSectionId);
    const saved = currentPageData?.[currentSectionId] || {};
    return mergeContent(defaults, saved);
  }

  function renderPageButtons() {
    ui.pages.replaceChildren();
    CONTENT_PAGE_IDS.forEach(pageId => {
      const schema = getPageSchema(pageId);
      const button = create('button', `content-phase6-page${pageId === currentPageId ? ' active' : ''}`, schema.label);
      button.type = 'button';
      button.addEventListener('click', () => selectPage(pageId));
      ui.pages.appendChild(button);
    });
  }

  function renderSectionSelect() {
    ui.sectionSelect.replaceChildren();
    Object.entries(getPageSchema(currentPageId)?.sections || {}).forEach(([sectionId, schema]) => {
      const option = create('option', '', schema.label);
      option.value = sectionId;
      ui.sectionSelect.appendChild(option);
    });
    ui.sectionSelect.value = currentSectionId;
  }

  function createField(item, value) {
    const wrap = create('div', 'content-phase6-field');
    const label = create('label', 'content-phase6-label', item.label);
    label.htmlFor = `content-field-${currentPageId}-${currentSectionId}-${item.key.replace(/[^a-z0-9_-]/gi, '-')}`;

    const control = item.type === 'multiline' ? document.createElement('textarea') : document.createElement('input');
    control.id = label.htmlFor;
    control.className = 'adm-input content-phase6-input';
    control.dataset.contentKey = item.key;
    control.dataset.contentType = item.type;
    control.maxLength = item.maxLength;
    control.value = value == null ? '' : String(value);
    control.disabled = !permissions.edit;
    if (control instanceof HTMLTextAreaElement) {
      control.rows = item.rows || 4;
      control.style.resize = 'vertical';
    } else {
      control.type = item.type === 'href' ? 'url' : 'text';
    }

    const meta = create('div', 'content-phase6-field-meta');
    const help = create('small', '', item.help || (item.type === 'href'
      ? 'Podés usar una página del sitio o una dirección https:// completa.'
      : `Máximo ${item.maxLength} caracteres.`));
    const counter = create('small', 'content-phase6-counter', `${control.value.length}/${item.maxLength}`);
    meta.append(help, counter);

    control.addEventListener('input', () => {
      counter.textContent = `${control.value.length}/${item.maxLength}`;
      control.classList.toggle(
        'content-phase6-invalid',
        item.type === 'href' && Boolean(control.value.trim() && !sanitizeContentHref(control.value, ''))
      );
      dirty = true;
      remotePending = false;
      setNotice('Tenés cambios sin guardar.', 'warning');
    });

    wrap.append(label, control, meta);
    return wrap;
  }

  function renderForm() {
    normalizeCurrentSection();
    updateQuery();
    renderPageButtons();
    renderSectionSelect();

    const pageSchema = getPageSchema(currentPageId);
    const sectionSchema = getSectionSchema(currentPageId, currentSectionId);
    const values = mergedCurrentSection();
    ui.pageTitle.textContent = pageSchema?.label || currentPageId;
    ui.sectionTitle.textContent = sectionSchema?.label || currentSectionId;
    ui.preview.href = pageSchema?.path || 'index.html';
    ui.preview.textContent = `Ver ${pageSchema?.label || 'página'} →`;
    ui.fields.replaceChildren();

    if (sectionSchema?.allowVisibility) {
      const visibility = create('label', 'content-phase6-visibility');
      const checkbox = document.createElement('input');
      const text = create('span', '', 'Mostrar esta sección en el sitio público');
      checkbox.type = 'checkbox';
      checkbox.id = 'content-phase6-visible';
      checkbox.checked = values.visible !== false;
      checkbox.disabled = !permissions.toggle;
      checkbox.addEventListener('change', () => {
        dirty = true;
        setNotice('Tenés cambios sin guardar.', 'warning');
      });
      visibility.append(checkbox, text);
      ui.fields.appendChild(visibility);
    }

    effectiveFields(sectionSchema).forEach(item => {
      ui.fields.appendChild(createField(
        item,
        normalizeContentValue(currentPageId, currentSectionId, item.key, getNested(values, item.key))
      ));
    });

    ui.save.hidden = !permissions.edit;
    ui.restore.hidden = !permissions.restore;
    ui.readOnly.hidden = permissions.edit;
    ui.save.disabled = !permissions.edit;
    dirty = false;
    remotePending = false;
    setNotice('Los cambios se sincronizan en tiempo real después de guardar.', 'info');
  }

  function collectFormValues() {
    const sectionSchema = getSectionSchema(currentPageId, currentSectionId);
    const values = {};
    if (sectionSchema.allowVisibility) {
      values.visible = document.getElementById('content-phase6-visible')?.checked !== false;
    }
    ui.fields.querySelectorAll('[data-content-key]').forEach(control => {
      setNested(values, control.dataset.contentKey, control.value);
    });
    return sanitizeSection(currentPageId, currentSectionId, values);
  }

  async function saveSection(values, successMessage) {
    if (!permissions.edit || !currentUser) return;
    ui.save.disabled = true;
    ui.restore.disabled = true;
    setNotice('Guardando…', 'info');
    try {
      await setDoc(doc(db, 'site_content', currentPageId), {
        [currentSectionId]: values,
        _meta: {
          revision: increment(1),
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.email || '',
          lastSection: currentSectionId,
        },
      }, { merge: true });
      dirty = false;
      remotePending = false;
      setNotice('Guardado y sincronizado.', 'success');
      toast(successMessage);
    } catch (error) {
      console.error('[admin-content-phase6] save failed:', error);
      setNotice('No se pudo guardar. Revisá tus permisos o la conexión.', 'error');
      toast('No se pudo guardar el contenido.', true);
    } finally {
      ui.save.disabled = false;
      ui.restore.disabled = false;
    }
  }

  async function handleSave() {
    const invalid = ui.fields.querySelector('.content-phase6-invalid');
    if (invalid) {
      invalid.focus();
      toast('Corregí el enlace marcado antes de guardar.', true);
      return;
    }
    await saveSection(collectFormValues(), '✅ Contenido guardado');
  }

  async function handleRestore() {
    if (!permissions.restore) return;
    if (!window.confirm('¿Restaurar esta sección al contenido original? No se eliminan otras secciones.')) return;
    await saveSection(getSectionDefaults(currentPageId, currentSectionId), '✅ Sección restaurada');
  }

  function subscribePage(pageId) {
    pageUnsubscribe?.();
    pageUnsubscribe = onSnapshot(
      doc(db, 'site_content', pageId),
      snapshot => {
        const next = snapshot.exists() ? snapshot.data() || {} : {};
        if (dirty) {
          currentPageData = next;
          remotePending = true;
          setNotice('Esta página cambió desde otra pestaña. Guardá tus cambios o cambiá de sección para cargar la versión nueva.', 'warning');
          return;
        }
        currentPageData = next;
        renderForm();
      },
      error => {
        console.error('[admin-content-phase6] listener failed:', error);
        setNotice('No se pudo cargar el contenido de esta página.', 'error');
      }
    );
  }

  function selectPage(pageId) {
    if (pageId === currentPageId || !confirmDiscard()) return;
    currentPageId = pageId;
    currentSectionId = sectionIdsForPage(pageId)[0] || '';
    currentPageData = {};
    dirty = false;
    subscribePage(pageId);
    renderForm();
  }

  function selectSection(sectionId) {
    if (sectionId === currentSectionId || !confirmDiscard()) {
      ui.sectionSelect.value = currentSectionId;
      return;
    }
    currentSectionId = sectionId;
    dirty = false;
    renderForm();
  }

  function activateContentSection() {
    if (!ui?.section) return;
    document.querySelectorAll('.adm-section').forEach(section => section.classList.remove('active'));
    ui.section.classList.add('active');
    document.querySelectorAll('[data-section]').forEach(button => {
      button.classList.toggle('active', button.dataset.section === 'contenido');
    });
    const topbar = document.getElementById('adm-topbar-title');
    if (topbar) topbar.textContent = 'Contenido';
  }

  function buildUI() {
    if (document.getElementById('section-contenido')) return;
    const host = document.querySelector('.adm-content');
    if (!host) return;

    const section = create('div', 'adm-section content-phase6-section');
    section.id = 'section-contenido';

    const card = create('div', 'adm-card');
    const head = create('div', 'adm-card-head content-phase6-head');
    const titleWrap = create('div');
    const title = create('div', 'adm-card-title', 'Contenido del sitio');
    const subtitle = create('p', 'content-phase6-subtitle', 'Editá textos y secciones sin tocar código. Firestore es la única fuente publicada.');
    titleWrap.append(title, subtitle);
    const preview = create('a', 'adm-btn adm-btn-outline adm-btn-sm', 'Ver página →');
    preview.target = '_blank';
    preview.rel = 'noopener';
    head.append(titleWrap, preview);

    const body = create('div', 'adm-card-body');
    const notice = create('div', 'content-phase6-notice');
    notice.hidden = true;
    const readOnly = create('div', 'content-phase6-readonly', 'Tenés acceso de lectura. Los campos están bloqueados por tus permisos.');
    readOnly.hidden = true;
    const pages = create('div', 'content-phase6-pages');

    const toolbar = create('div', 'content-phase6-toolbar');
    const pageTitle = create('strong', '', '');
    const sectionSelect = document.createElement('select');
    sectionSelect.className = 'adm-select';
    sectionSelect.addEventListener('change', () => selectSection(sectionSelect.value));
    toolbar.append(pageTitle, sectionSelect);

    const sectionTitle = create('h3', 'content-phase6-section-title');
    const fields = create('div', 'content-phase6-fields');
    const actions = create('div', 'content-phase6-actions');
    const save = create('button', 'adm-btn adm-btn-primary', 'Guardar cambios');
    const restore = create('button', 'adm-btn adm-btn-outline', 'Restaurar sección original');
    save.type = restore.type = 'button';
    save.addEventListener('click', handleSave);
    restore.addEventListener('click', handleRestore);
    actions.append(save, restore);

    body.append(notice, readOnly, pages, toolbar, sectionTitle, fields, actions);
    card.append(head, body);
    section.appendChild(card);
    host.appendChild(section);

    ui = { section, preview, notice, readOnly, pages, pageTitle, sectionSelect, sectionTitle, fields, save, restore };

    document.querySelectorAll('[data-section="contenido"]').forEach(button => {
      button.addEventListener('click', activateContentSection);
    });
    window.addEventListener('beforeunload', event => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    });
  }

  function injectStyles() {
    if (document.getElementById('content-phase6-styles')) return;
    const style = document.createElement('style');
    style.id = 'content-phase6-styles';
    style.textContent = `
      .content-phase6-head{align-items:flex-start;gap:16px}.content-phase6-subtitle{font-size:12px;color:var(--adm-muted);margin-top:5px;line-height:1.5}
      .content-phase6-pages{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}.content-phase6-page{border:1px solid var(--adm-border);background:#fff;border-radius:999px;padding:8px 13px;font:600 12px Montserrat;cursor:pointer}.content-phase6-page.active{background:var(--adm-primary);border-color:var(--adm-primary);color:#fff}
      .content-phase6-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px;background:#fafafa;border:1px solid var(--adm-border);border-radius:10px;margin-bottom:18px}.content-phase6-toolbar select{max-width:320px}
      .content-phase6-section-title{font-size:16px;margin:4px 0 16px}.content-phase6-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.content-phase6-field{display:flex;flex-direction:column;gap:6px}.content-phase6-field:has(textarea){grid-column:1/-1}.content-phase6-label{font-size:12px;font-weight:700}.content-phase6-field-meta{display:flex;justify-content:space-between;gap:8px;color:var(--adm-muted);font-size:10px}.content-phase6-counter{white-space:nowrap}.content-phase6-invalid{border-color:#c0392b!important;background:#fff5f5!important}
      .content-phase6-visibility{grid-column:1/-1;display:flex;align-items:center;gap:9px;padding:12px 14px;background:#fff7fa;border:1px solid #f1c8d7;border-radius:10px;font-size:13px;font-weight:600}.content-phase6-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}.content-phase6-notice,.content-phase6-readonly{padding:11px 13px;border-radius:9px;font-size:12px;margin-bottom:12px}.content-phase6-notice.is-info{background:#eef6ff;color:#275b86}.content-phase6-notice.is-warning{background:#fff7df;color:#805f00}.content-phase6-notice.is-success{background:#eaf8ee;color:#28743c}.content-phase6-notice.is-error,.content-phase6-readonly{background:#fff0f0;color:#9c2e2e}
      .content-phase6-toast{position:fixed;right:20px;bottom:24px;z-index:5000;background:#1a1a1a;color:#fff;padding:12px 17px;border-radius:10px;font:600 12px Montserrat;opacity:0;transform:translateY(8px);pointer-events:none;transition:.2s}.content-phase6-toast.show{opacity:1;transform:none}.content-phase6-toast.is-error{background:#b3261e}
      @media(max-width:720px){.content-phase6-fields{grid-template-columns:1fr}.content-phase6-field{grid-column:1/-1}.content-phase6-toolbar{align-items:stretch;flex-direction:column}.content-phase6-toolbar select{max-width:none;width:100%}.content-phase6-head{flex-direction:column}}
    `;
    document.head.appendChild(style);
  }

  async function resolvePermissions(user) {
    currentRole = await getUserRole(user.uid, user.email);
    const isSuperAdmin = user.email === SUPER_ADMIN;
    if (!isSuperAdmin) await loadRolePermissions(true);
    permissions = {
      view: isSuperAdmin || canDo(currentRole, 'contenido', 'ver'),
      edit: isSuperAdmin || canDo(currentRole, 'contenido', 'editarTextos'),
      toggle: isSuperAdmin || canDo(currentRole, 'contenido', 'activarDesactivarSecciones'),
      restore: isSuperAdmin || canDo(currentRole, 'contenido', 'restaurar'),
    };
  }

  async function startForUser(user) {
    currentUser = user;
    await resolvePermissions(user);
    const navs = document.querySelectorAll('[data-section="contenido"]');
    navs.forEach(nav => { nav.style.display = permissions.view ? '' : 'none'; });
    if (!permissions.view) return;

    buildUI();
    if (!ui) return;
    normalizeCurrentSection();
    subscribePage(currentPageId);

    if (params.get('tab') === 'contenido') {
      window.setTimeout(activateContentSection, 0);
    }
  }

  function boot() {
    injectStyles();
    onAuthStateChanged(auth, user => {
      pageUnsubscribe?.();
      pageUnsubscribe = null;
      if (!user || user.isAnonymous) return;
      startForUser(user).catch(error => {
        console.error('[admin-content-phase6] boot failed:', error);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
}
