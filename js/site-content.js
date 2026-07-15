/* =============================================================
   TINTIN — Fase 6: contenido público seguro y sincronizado

   Firestore guarda solamente valores. Los selectores, tipos de campo y
   límites están definidos en content-schema.js. Este renderer nunca inserta
   HTML recibido desde la base.
   ============================================================= */

import { db } from './firebase.js';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  getPageSchema,
  getNested,
  sanitizeContentText,
  sanitizeContentHref,
  normalizeContentValue,
  detectContentPageId,
} from './content-schema.js';

const subscriptions = new Map();
const latestData = new Map();

function fieldRenderKey(item) {
  return `${item.selector}::${item.index == null ? 'first' : item.index}::${item.type === 'href' ? 'href' : 'text'}`;
}

function effectiveFields(sectionSchema) {
  const byTarget = new Map();
  sectionSchema.fields.forEach(item => byTarget.set(fieldRenderKey(item), item));
  return [...byTarget.values()];
}

function findRoots(sectionSchema) {
  try {
    return [...document.querySelectorAll(sectionSchema.root)];
  } catch (error) {
    console.warn('[site-content] selector de sección inválido:', sectionSchema.root, error);
    return [];
  }
}

function findTarget(root, item) {
  let matches = [];
  try {
    if (root.matches?.(item.selector)) matches.push(root);
    matches.push(...root.querySelectorAll(item.selector));
  } catch (error) {
    console.warn('[site-content] selector de campo inválido:', item.selector, error);
    return null;
  }
  const index = item.index == null ? 0 : item.index;
  return matches[index] || null;
}

function appendPlainLines(element, value) {
  const lines = String(value).split('\n');
  const nodes = [];
  lines.forEach((line, index) => {
    if (index) nodes.push(document.createElement('br'));
    nodes.push(document.createTextNode(line));
  });
  element.replaceChildren(...nodes);
}

function replaceLabelPreservingChildren(element, value) {
  const label = document.createElement('span');
  label.dataset.ttContentLabel = '1';
  label.textContent = value;

  [...element.childNodes].forEach(node => {
    if (node.nodeType === Node.TEXT_NODE || node.dataset?.ttContentLabel === '1') node.remove();
  });
  element.insertBefore(label, element.firstChild);
}

function applyText(element, value, item) {
  const safe = sanitizeContentText(value, item.maxLength);
  const preserveChildren =
    element.id === 'form-success' ||
    element.classList.contains('tt-contact-wa-link');

  if (preserveChildren) {
    replaceLabelPreservingChildren(element, safe);
    return;
  }
  appendPlainLines(element, safe);
}

function applyHref(element, value, item) {
  if (!(element instanceof HTMLAnchorElement)) return;
  const safe = sanitizeContentHref(value, item.default || '');
  if (!safe) {
    element.removeAttribute('href');
    return;
  }
  element.setAttribute('href', safe);
  try {
    const parsed = new URL(safe, window.location.href);
    if (parsed.origin !== window.location.origin) {
      element.target = '_blank';
      element.rel = 'noopener noreferrer';
    }
  } catch {}
}

function markEditableRoot(root, pageId, sectionId) {
  if (!root.dataset.ttEditable) root.dataset.ttEditable = pageId;
  if (!root.dataset.ttSection) root.dataset.ttSection = sectionId;
}

function applyVisibility(roots, visible) {
  if (visible === undefined) return;
  roots.forEach(root => {
    root.hidden = visible === false;
    root.dataset.ttContentVisibility = visible === false ? 'hidden' : 'visible';
  });
}

function applySection(pageId, sectionId, sectionSchema, sectionData) {
  if (!sectionData || typeof sectionData !== 'object') return;
  const roots = findRoots(sectionSchema);
  roots.forEach(root => markEditableRoot(root, pageId, sectionId));
  if (sectionSchema.allowVisibility && Object.prototype.hasOwnProperty.call(sectionData, 'visible')) {
    applyVisibility(roots, sectionData.visible !== false);
  }

  effectiveFields(sectionSchema).forEach(item => {
    const raw = getNested(sectionData, item.key);
    if (raw === undefined || raw === null) return;
    roots.forEach(root => {
      const target = findTarget(root, item);
      if (!target) return;
      if (item.type === 'href') applyHref(target, raw, item);
      else applyText(target, normalizeContentValue(pageId, sectionId, item.key, raw), item);
    });
  });
}

function applyPage(pageId, data, onlySectionId = null) {
  const page = getPageSchema(pageId);
  if (!page) return;
  Object.entries(page.sections).forEach(([sectionId, sectionSchema]) => {
    if (onlySectionId && sectionId !== onlySectionId) return;
    applySection(pageId, sectionId, sectionSchema, data?.[sectionId]);
  });
  document.documentElement.dataset.ttContentState = 'ready';
  window.dispatchEvent(new CustomEvent('tintin:content-phase6-ready', {
    detail: { pageId, sectionId: onlySectionId || null }
  }));
}

function startSubscription(key, pageId, callback) {
  if (subscriptions.has(key)) return subscriptions.get(key);
  const unsubscribe = onSnapshot(
    doc(db, 'site_content', pageId),
    snapshot => {
      const data = snapshot.exists() ? snapshot.data() || {} : {};
      latestData.set(pageId, data);
      callback(data, snapshot.exists());
    },
    error => {
      console.warn(`[site-content] no se pudo leer ${pageId}:`, error);
      document.documentElement.dataset.ttContentState = 'error';
      window.dispatchEvent(new CustomEvent('tintin:content-phase6-error', {
        detail: { pageId, error }
      }));
      // El HTML publicado queda visible como respaldo. Nunca se reemplaza por
      // texto viejo de otra página ni por contenido local no confirmado.
    }
  );
  subscriptions.set(key, unsubscribe);
  return unsubscribe;
}

function initGlobalFooter(currentPageId) {
  if (currentPageId === 'index') return;
  startSubscription('global:index:footer', 'index', data => {
    applyPage('index', data, 'footer');
  });
}

export function initSiteContent(pageId) {
  const page = getPageSchema(pageId);
  if (!page) return () => {};

  // Marca todas las secciones aunque todavía no exista un documento en
  // Firestore, para que el lápiz de edición pueda abrir el formulario correcto.
  Object.entries(page.sections).forEach(([sectionId, sectionSchema]) => {
    findRoots(sectionSchema).forEach(root => markEditableRoot(root, pageId, sectionId));
  });

  initGlobalFooter(pageId);
  return startSubscription(`page:${pageId}`, pageId, data => applyPage(pageId, data));
}

export function autoInitSiteContent() {
  const pageId = detectContentPageId();
  if (!pageId) return null;
  initSiteContent(pageId);
  return pageId;
}

export function getLatestSiteContent(pageId) {
  return latestData.get(pageId) || null;
}
