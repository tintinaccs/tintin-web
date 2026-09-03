// TINTIN — Centro maestro de Web Push (sólo Super Admin)
import { auth } from '../../core/firebase/firebase.js?v=tintin-20260903-app-check-singleton-3';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { SUPER_ADMIN } from '../../core/auth/roles.js?v=tintin-20260821-accounts-phase-a-1';
import { apiUrl } from '../../core/firebase/origen-funciones.js';

const SOUND_KEY = 'tt_push_foreground_sound';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function movePushModulesToOwnSection() {
  const section = $('section-notificaciones-push');
  if (!section) return;
  for (const id of ['push-card', 'push-master-card']) {
    const card = $(id);
    if (card && card.parentElement !== section) section.appendChild(card);
  }
}

async function call(action, init = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Necesitás iniciar sesión de nuevo.');
  const token = await user.getIdToken();
  const response = await fetch(apiUrl('push-admin'), { ...init, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) throw new Error(data.error || 'No se pudo actualizar el centro push.');
  return data;
}

async function callApi(name, init = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Necesitás iniciar sesión de nuevo.');
  const token = await user.getIdToken();
  const response = await fetch(apiUrl(name), { ...init, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, data };
}

function notice(message, error = false) {
  const node = $('push-master-notice');
  if (!node) return;
  node.textContent = message;
  node.style.display = message ? '' : 'none';
  node.style.color = error ? 'var(--adm-danger,#c62828)' : 'var(--adm-muted)';
}

function renderDevices(devices = []) {
  const body = $('push-master-devices');
  if (!body) return;
  if (!devices.length) {
    body.innerHTML = '<tr><td colspan="5" style="padding:14px;color:var(--adm-muted)">No hay dispositivos registrados.</td></tr>';
    return;
  }
  body.innerHTML = devices.map(device => `<tr><td style="padding:9px"><strong>${esc(device.deviceLabel)}</strong><br><small style="color:var(--adm-muted)">${esc(device.platform)} · ${esc(device.tokenPreview || 'sin token')}</small></td><td style="padding:9px">${esc(device.email || 'Super Admin')}</td><td style="padding:9px">${esc(device.lastSeenAt || device.updatedAt || '—')}</td><td style="padding:9px"><span class="adm-badge">${device.enabled ? 'Activo' : 'Revocado'}</span></td><td style="padding:9px;text-align:right">${device.enabled ? `<button type="button" class="adm-btn adm-btn-danger adm-btn-sm" data-push-revoke="${esc(device.id)}">Revocar</button>` : '—'}</td></tr>`).join('');
  body.querySelectorAll('[data-push-revoke]').forEach(button => button.addEventListener('click', async () => {
    if (!window.confirm('¿Revocar este dispositivo? Dejará de recibir pedidos inmediatamente.')) return;
    button.disabled = true;
    try { await call('revoke', { method: 'POST', body: JSON.stringify({ action: 'revoke', deviceId: button.dataset.pushRevoke }) }); notice('Dispositivo revocado.'); await refresh(); }
    catch (error) { notice(error.message, true); button.disabled = false; }
  }));
}

function renderDiagnostics(devices = [], settings = {}, config = null) {
  const activeCount = devices.filter(device => device.enabled).length;
  const devicesBadge = $('push-diag-devices');
  if (devicesBadge) devicesBadge.textContent = `Dispositivos activos: ${activeCount}`;
  const firebaseBadge = $('push-diag-firebase');
  const vapidBadge = $('push-diag-vapid');
  if (settings.enabled === false) {
    if (firebaseBadge) firebaseBadge.textContent = 'Firebase: pausado por Super Admin';
  } else if (config?.ok) {
    if (firebaseBadge) firebaseBadge.textContent = config.data.enabled ? 'Firebase: activo' : 'Firebase: desactivado (TINTIN_PUSH_ENABLED)';
  } else if (firebaseBadge) {
    firebaseBadge.textContent = `Firebase: error (${esc(config?.data?.error || 'sin respuesta')})`;
  }
  if (vapidBadge) {
    vapidBadge.textContent = config?.ok && config.data.vapidKey !== undefined
      ? 'VAPID: configurada'
      : `VAPID: ${esc(config?.data?.error || 'no configurada')}`;
  }
}

function renderEvents(events = []) {
  const body = $('push-master-events');
  if (!body) return;
  if (!events.length) {
    body.innerHTML = '<tr><td colspan="5" style="padding:14px;color:var(--adm-muted)">Todavía no hay eventos de push registrados.</td></tr>';
    return;
  }
  body.innerHTML = events.map(event => `<tr><td style="padding:9px"><strong>${esc(event.type || '—')}</strong><br><small style="color:var(--adm-muted)">${esc(event.eventId || '')}</small></td><td style="padding:9px"><span class="adm-badge">${esc(event.status || '—')}</span></td><td style="padding:9px">${esc(event.successCount ?? 0)} / ${esc(event.failureCount ?? 0)}</td><td style="padding:9px;max-width:260px;overflow-wrap:anywhere">${esc(event.lastError || '—')}</td><td style="padding:9px">${esc(event.updatedAt || '—')}</td></tr>`).join('');
}

function applySettings(settings = {}) {
  $('push-master-enabled').checked = settings.enabled !== false;
  $('push-master-sound').value = settings.foregroundSound || 'default';
  $('push-master-sound-url').value = settings.foregroundSoundUrl || '';
  $('push-master-sound-url').style.display = settings.foregroundSound === 'custom' ? '' : 'none';
  $('btn-push-master-upload').style.display = settings.foregroundSound === 'custom' ? '' : 'none';
  for (const slot of ['order', 'review', 'like']) {
    const mode = settings[`foregroundSound${slot[0].toUpperCase()}${slot.slice(1)}`] || 'default';
    const url = settings[`foregroundSound${slot[0].toUpperCase()}${slot.slice(1)}Url`] || '';
    const select = $(`push-tone-${slot}`); const input = $(`push-tone-${slot}-url`);
    if (select) select.value = mode;
    if (input) { input.value = url; input.style.display = mode === 'custom' ? '' : 'none'; }
    document.querySelector(`[data-push-tone-upload="${slot}"]`)?.style.setProperty('display', mode === 'custom' ? '' : 'none');
  }
  $('push-master-status').textContent = settings.enabled === false ? 'Pausado' : 'Activo';
  try { localStorage.setItem(SOUND_KEY, JSON.stringify({ mode: settings.foregroundSound || 'default', url: settings.foregroundSoundUrl || '' })); } catch {}
}

async function uploadTone(slot = 'global') {
  const suffix = slot === 'global' ? 'master-sound' : `tone-${slot}`;
  const file = $(`push-${suffix}-file`)?.files?.[0];
  if (!file) throw new Error('Elegí un archivo MP3 antes de subirlo.');
  if (!/^audio\/(mpeg|ogg|wav)$/i.test(file.type) && !/\.(mp3|ogg|wav)$/i.test(file.name)) throw new Error('Sólo se aceptan archivos MP3, OGG o WAV.');
  if (file.size > 1024 * 1024) throw new Error('El tono no puede superar 1 MB.');
  const button = slot === 'global' ? $('btn-push-master-upload') : document.querySelector(`[data-push-tone-upload="${slot}"]`); button.disabled = true; notice('Subiendo el tono…');
  try {
    const user = auth.currentUser;
    const token = await user.getIdToken();
    const signedResponse = await fetch(apiUrl('cloudinary-sign-audio-upload'), { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ slot }) });
    const signed = await signedResponse.json().catch(() => ({}));
    if (!signedResponse.ok || !signed.uploadUrl) throw new Error(signed.error || 'No se pudo preparar la subida.');
    const form = new FormData();
    form.append('file', file);
    form.append('api_key', signed.apiKey);
    form.append('public_id', signed.publicId);
    form.append('timestamp', String(signed.timestamp));
    form.append('signature', signed.signature);
    form.append('type', 'upload');
    // `overwrite` forma parte de la cadena firmada por Cloudinary y también
    // debe viajar en el multipart; si falta, Cloudinary calcula otra firma.
    form.append('overwrite', 'true');
    const uploadResponse = await fetch(signed.uploadUrl, { method: 'POST', body: form });
    const uploaded = await uploadResponse.json().catch(() => ({}));
    if (!uploadResponse.ok || !uploaded.secure_url) throw new Error(uploaded?.error?.message || 'Cloudinary no pudo guardar el tono.');
    $(`push-${suffix}-url`).value = uploaded.secure_url;
    notice('Tono subido. Guardá las preferencias para aplicarlo.');
  } finally { button.disabled = false; }
}

async function refresh() {
  const data = await call('list', { method: 'GET' });
  applySettings(data.settings);
  renderDevices(data.devices);
  renderEvents(data.events);
  const config = await callApi('push-config', { method: 'GET' }).catch(error => ({ ok: false, data: { error: error.message } }));
  renderDiagnostics(data.devices, data.settings, config);
}

async function sendGlobalTest() {
  const button = $('btn-push-master-test'); button.disabled = true;
  notice('Enviando prueba a todos los dispositivos activos...');
  try {
    const { ok, data } = await callApi('push-test', { method: 'POST', body: JSON.stringify({ scope: 'all' }) });
    if (!ok || data.success === false) throw new Error(data.error || 'No se pudo enviar la prueba global.');
    notice(`Prueba global enviada: ${data.successCount} de ${data.attempted} dispositivo(s).`);
    await refresh();
  } catch (error) {
    notice(error.message, true);
  } finally {
    button.disabled = false;
  }
}

async function save() {
  const sound = $('push-master-sound').value;
  const url = $('push-master-sound-url').value.trim();
  if (sound === 'custom' && !/^https:\/\//i.test(url)) throw new Error('El sonido personalizado debe ser una URL HTTPS.');
  const button = $('btn-push-master-save'); button.disabled = true;
  try {
    const payload = { action: 'save-settings', enabled: $('push-master-enabled').checked, foregroundSound: sound, foregroundSoundUrl: url };
    for (const slot of ['order', 'review', 'like']) {
      const key = `foregroundSound${slot[0].toUpperCase()}${slot.slice(1)}`;
      payload[key] = $(`push-tone-${slot}`).value;
      payload[`${key}Url`] = $(`push-tone-${slot}-url`).value.trim();
      if (payload[key] === 'custom' && !/^https:\/\//i.test(payload[`${key}Url`])) throw new Error(`El tono de ${slot} debe ser una URL HTTPS.`);
    }
    const data = await call('save-settings', { method: 'POST', body: JSON.stringify(payload) });
    applySettings(data.settings); notice('Preferencias push guardadas.');
  } finally { button.disabled = false; }
}

function installForegroundSound() {
  window.TintinPushPlayForegroundSound = (mode, eventUrl = '') => {
    let config = {};
    try { config = JSON.parse(localStorage.getItem(SOUND_KEY) || '{}'); } catch {}
    if ((mode || config.mode) === 'none') return;
    const url = mode === 'custom' ? (eventUrl || config.url) : '';
    if (!url) return; // El sonido predeterminado lo decide el sistema operativo.
    const audio = new Audio(url); audio.volume = 0.75; audio.play().catch(() => {});
  };
}

function boot() {
  movePushModulesToOwnSection();
  const card = $('push-master-card');
  if (!card) return;
  installForegroundSound();
  $('push-master-sound')?.addEventListener('change', event => { const custom = event.target.value === 'custom'; $('push-master-sound-url').style.display = custom ? '' : 'none'; $('btn-push-master-upload').style.display = custom ? '' : 'none'; });
  for (const slot of ['order', 'review', 'like']) {
    $(`push-tone-${slot}`)?.addEventListener('change', event => {
      const custom = event.target.value === 'custom';
      $(`push-tone-${slot}-url`).style.display = custom ? '' : 'none';
      document.querySelector(`[data-push-tone-upload="${slot}"]`)?.style.setProperty('display', custom ? '' : 'none');
    });
    document.querySelector(`[data-push-tone-upload="${slot}"]`)?.addEventListener('click', () => $(`push-tone-${slot}-file`)?.click());
    $(`push-tone-${slot}-file`)?.addEventListener('change', () => uploadTone(slot).catch(error => notice(error.message, true)));
  }
  $('btn-push-master-upload')?.addEventListener('click', () => $('push-master-sound-file')?.click());
  $('push-master-sound-file')?.addEventListener('change', () => uploadTone().catch(error => notice(error.message, true)));
  $('btn-push-master-save')?.addEventListener('click', () => save().catch(error => notice(error.message, true)));
  $('btn-push-master-test')?.addEventListener('click', sendGlobalTest);
  $('btn-push-master-revoke-all')?.addEventListener('click', async () => {
    if (!window.confirm('¿Revocar TODOS los dispositivos push? Ninguno recibirá pedidos hasta volver a autorizarlo.')) return;
    const button = $('btn-push-master-revoke-all'); button.disabled = true;
    try { const result = await call('revoke-all', { method: 'POST', body: JSON.stringify({ action: 'revoke-all' }) }); notice(`${result.count || 0} dispositivo(s) revocado(s).`); await refresh(); }
    catch (error) { notice(error.message, true); }
    finally { button.disabled = false; }
  });
  onAuthStateChanged(auth, user => {
    const allowed = user?.email === SUPER_ADMIN;
    card.style.display = allowed ? '' : 'none';
    if (allowed) refresh().catch(error => { $('push-master-status').textContent = 'Error'; notice(error.message, true); });
  });
}

window.TintinPushMasterRefresh = () => refresh().catch(error => notice(error.message, true));

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
