import { auth } from '../core/firebase/firebase.js?v=tintin-20260730-appcheck-stable-4';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { SUPER_ADMIN } from '../core/auth/roles.js?v=tintin-20260716-cloudinary-fix-1';

const $ = id => document.getElementById(id);
let currentProposal = null;
let nextAction = 'propose';
let initialized = false;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

async function api(method = 'GET', body) {
  const user = auth.currentUser;
  if (!user || String(user.email || '').toLowerCase() !== SUPER_ADMIN) throw new Error('Acceso exclusivo de Super Admin.');
  const token = await user.getIdToken();
  const response = await fetch('/api/ai-builder', {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la operación.');
  return data;
}

function say(kind, text) {
  const message = document.createElement('div');
  message.className = `ai-builder-message ${kind}`;
  message.textContent = text;
  $('ai-builder-chat').appendChild(message);
  message.scrollIntoView({ block: 'nearest' });
}

function previewDocument(blocks) {
  const render = blocks.map(block => {
    const button = block.buttonLabel ? `<a href="#" onclick="return false">${escapeHtml(block.buttonLabel)}</a>` : '';
    const products = block.type === 'products' ? `<div class="products">${Array.from({ length: block.count || 3 }, (_, i) => `<article><div class="photo"></div><strong>Producto destacado ${i + 1}</strong><small>Ver en catálogo</small></article>`).join('')}</div>` : '';
    const gallery = block.type === 'gallery' ? `<div class="products">${(block.images || []).map(image => `<article><img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}"></article>`).join('')}</div>` : '';
    return `<section style="background:${escapeHtml(block.background || '#fff8fa')};text-align:${block.align === 'left' ? 'left' : 'center'}"><p class="eyebrow">TINTÍN</p><h2>${escapeHtml(block.title)}</h2><p>${escapeHtml(block.text)}</p>${products}${gallery}${button}</section>`;
  }).join('');
  return `<!doctype html><html lang="es"><meta name="viewport" content="width=device-width"><style>*{box-sizing:border-box}body{margin:0;font-family:Arial;color:#2c2025}.hero{height:130px;background:#2a2427;color:white;display:grid;place-items:center;font-weight:900;letter-spacing:.18em}section{padding:42px 6%}.eyebrow{color:#ad3f67;font-size:11px;font-weight:800;letter-spacing:.18em}h2{font-size:clamp(24px,4vw,42px);margin:8px 0 12px}p{line-height:1.6}a{display:inline-block;margin-top:18px;background:#ad3f67;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:800}.products{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-top:20px}.products article{background:#fff;padding:10px;border-radius:12px;text-align:left}.photo{aspect-ratio:1;background:linear-gradient(135deg,#f8dce7,#fff)}img{width:100%;aspect-ratio:1;object-fit:cover}.products strong,.products small{display:block;margin-top:7px}.products small{color:#777}</style><body><div class="hero">BANNER ACTUAL</div>${render || '<section><h2>La propuesta aparecerá acá</h2><p>Escribí una solicitud para preparar una vista previa segura.</p></section>'}</body></html>`;
}

function renderPreview(blocks) {
  $('ai-builder-preview').srcdoc = previewDocument(blocks || []);
}

function renderProposal(proposal) {
  currentProposal = proposal;
  const result = proposal.result || {};
  $('ai-builder-classification').textContent = ({ content: 'Cambio de contenido', visual: 'Cambio visual / estructura', complex: 'Cambio complejo de código' })[result.type] || 'Propuesta';
  $('ai-builder-summary').textContent = result.summary || '';
  $('ai-builder-actions').hidden = false;
  $('ai-builder-approve').textContent = result.type === 'complex' ? 'Crear rama, PR y preview' : 'Aprobar y publicar';
  $('ai-builder-tech').hidden = result.type !== 'complex';
  if (result.type === 'complex') {
    const tech = result.technicalProposal || {};
    $('ai-builder-tech').innerHTML = `<strong>Propuesta técnica</strong><p>${escapeHtml(tech.objective || proposal.request)}</p><ul>${(tech.scope || []).map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  }
  renderPreview(result.blocks || []);
}

function renderHistory(items) {
  const root = $('ai-builder-history-list');
  root.replaceChildren();
  if (!items.length) { root.innerHTML = '<div class="ai-builder-empty">Todavía no hay versiones.</div>'; return; }
  items.forEach(item => {
    const node = document.createElement('div');
    node.className = 'ai-builder-history-item';
    const canRestore = Array.isArray(item.snapshot) && item.snapshot.length && Number(item.version) > 0;
    node.innerHTML = `<div><strong>v${Number(item.version) || '—'} · ${escapeHtml(item.action)}</strong><small>${escapeHtml(item.actorEmail || '')} · ${new Date(item.createdAt).toLocaleString('es-PY')}</small><div>${escapeHtml(item.request || item.result || '')}</div></div>${canRestore ? `<button type="button" class="adm-btn adm-btn-outline adm-btn-sm" data-restore="${escapeHtml(item.id)}">Restaurar</button>` : ''}`;
    root.appendChild(node);
  });
}

async function load() {
  try {
    const data = await api();
    $('ai-builder-version').textContent = `Versión publicada: ${data.state.version || 0}`;
    renderHistory(data.history || []);
    renderPreview(data.state.blocks || []);
  } catch (error) { say('system', error.message); }
}

function busy(value) {
  ['ai-builder-send', 'ai-builder-approve', 'ai-builder-modify', 'ai-builder-cancel'].forEach(id => { if ($(id)) $(id).disabled = value; });
  $('ai-builder-live').textContent = value ? 'Procesando solicitud' : 'Operación terminada';
}

async function propose(action = 'propose') {
  const request = $('ai-builder-request').value.trim();
  if (!request) return;
  say('owner', request);
  busy(true);
  try {
    const data = await api('POST', { action, request, proposalId: currentProposal?.id || '' });
    renderProposal(data.proposal);
    say('system', `${data.proposal.result.summary}\nRevisá la clasificación y la vista previa. Nada se publicó todavía.${data.providerConfigured ? '' : '\nModo seguro local activo: falta configurar el proveedor IA en Cloudflare.'}`);
    $('ai-builder-request').value = '';
    $('ai-builder-count').textContent = '0/1200';
    nextAction = 'propose';
  } catch (error) { say('system', error.message); }
  finally { busy(false); }
}

async function act(action, extra = {}) {
  busy(true);
  try {
    const data = await api('POST', { action, proposalId: currentProposal?.id || '', ...extra });
    if (action === 'publish') {
      say('system', data.complex ? `PR técnico creado: ${data.github.prUrl}${data.github.previewUrl ? `\nPreview esperado: ${data.github.previewUrl}` : ''}` : `Publicado como versión ${data.version}.`);
      $('ai-builder-actions').hidden = true;
    } else if (action === 'cancel') {
      say('system', 'Propuesta cancelada. No se aplicó ningún cambio.');
      $('ai-builder-actions').hidden = true;
    } else if (action === 'restore') say('system', `Restauración publicada como versión ${data.version}.`);
    await load();
  } catch (error) { say('system', error.message); }
  finally { busy(false); }
}

function init() {
  if (initialized) return;
  initialized = true;
  $('ai-builder-send').addEventListener('click', () => propose(nextAction));
  $('ai-builder-approve').addEventListener('click', () => act('publish'));
  $('ai-builder-cancel').addEventListener('click', () => act('cancel'));
  $('ai-builder-modify').addEventListener('click', () => { nextAction = 'modify'; $('ai-builder-request').focus(); say('system', 'Escribí la modificación y volvé a enviar.'); });
  $('ai-builder-request').addEventListener('input', event => { $('ai-builder-count').textContent = `${event.target.value.length}/1200`; });
  $('ai-builder-request').addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') propose(nextAction); });
  document.querySelectorAll('[data-ai-device]').forEach(button => button.addEventListener('click', () => { $('ai-builder-device').dataset.device = button.dataset.aiDevice; }));
  $('ai-builder-history-list').addEventListener('click', event => { const button = event.target.closest('[data-restore]'); if (button && confirm('¿Restaurar esta versión como una versión nueva?')) act('restore', { historyId: button.dataset.restore }); });
  document.querySelectorAll('[data-section="ai-builder"]').forEach(button => button.addEventListener('click', load));
  say('system', 'Contame qué querés cambiar. Prepararé una propuesta segura y no publicaré nada sin tu aprobación explícita.');
}

onAuthStateChanged(auth, user => {
  const allowed = String(user?.email || '').trim().toLowerCase() === SUPER_ADMIN;
  document.querySelectorAll('[data-section="ai-builder"]').forEach(node => { node.hidden = !allowed; });
  if (allowed) init();
});
