import { auth, db } from './firebase.js?v=tintin-20260716-cloudinary-fix-1';
import { SUPER_ADMIN as SUPER_ADMIN_EMAIL } from './roles.js?v=tintin-20260716-cloudinary-fix-1';
import { apiUrl } from './function-origin.js?v=tintin-20260716-cloudinary-fix-1';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

if (!window.TintinAdminEmailGateSyncBooted) {
  window.TintinAdminEmailGateSyncBooted = true;

  const SENDER_EMAIL = 'pedidos@tintinaccs.com';
  const TEST_ENDPOINT = apiUrl('test-email');
  const PRIVATE_REF = doc(db, 'emailSettings', 'main');
  // Se reutiliza el documento público mínimo que ya existe y ya tiene reglas.
  // Solo se agrega emailAccess; no se exponen destinatarios ni credenciales.
  const PUBLIC_REF = doc(db, 'settings', 'storeGate');

  let privateState = { exists: false, data: {} };
  let publicState = { exists: false, data: {} };
  let unsubPrivate = null;
  let unsubPublic = null;
  let syncing = false;
  let queued = false;
  let currentUser = null;
  let uiObserver = null;
  let uiPatchQueued = false;

  function normalized(data) {
    return {
      orderEmailsEnabled: data?.orderEmailsEnabled !== false,
      internalEmailEnabled: data?.internalEmailEnabled !== false,
      customerEmailEnabled: data?.customerEmailEnabled !== false
    };
  }

  function desired() {
    return normalized(privateState.exists ? privateState.data : {});
  }

  function matches() {
    return publicState.exists &&
      JSON.stringify(normalized(publicState.data?.emailAccess)) ===
        JSON.stringify(desired());
  }

  function badge(label, enabled) {
    return `<div><strong>${label}:</strong> <span class="adm-badge ${enabled ? 'badge-entregado' : 'badge-cancelado'}">${enabled ? 'Activado' : 'Desactivado'}</span></div>`;
  }

  function setTextIfChanged(element, text) {
    if (element && element.textContent !== text) element.textContent = text;
  }

  function patchEmailUi() {
    uiPatchQueued = false;
    const data = privateState.exists ? privateState.data || {} : {};

    const status = document.getElementById('correos-system-status');
    if (status) {
      const html =
        `<div><strong>Remitente actual:</strong> ${SENDER_EMAIL}</div>` +
        `<div><strong>Servicio:</strong> <span class="adm-badge badge-entregado">Resend + Cloudflare</span></div>` +
        badge('Envío de pedidos', data.orderEmailsEnabled !== false) +
        badge('Envío de pruebas', data.testEmailsEnabled !== false) +
        badge('Envío promocional', false);
      if (status.innerHTML !== html) status.innerHTML = html;
    }

    const senderInput = document.getElementById('cec-sender-email');
    if (senderInput) {
      senderInput.value = SENDER_EMAIL;
      const label = senderInput.closest('.adm-field')?.querySelector('.adm-label');
      setTextIfChanged(label, 'Email remitente actual (fijo por Resend)');
    }

    const senderName = document.getElementById('cec-sender-name');
    if (senderName && (!senderName.value || /tintin accesorios/i.test(senderName.value))) {
      senderName.value = 'Tintin Pedidos';
    }

    const configPromo = document.getElementById('cec-promo-enabled');
    if (configPromo) {
      configPromo.checked = false;
      configPromo.disabled = true;
    }
    const promoToggle = document.getElementById('promo-enabled-toggle');
    if (promoToggle) {
      promoToggle.checked = false;
      promoToggle.disabled = true;
    }

    const configAlert = document.getElementById('cec-gmail-sender-alert');
    if (configAlert) {
      configAlert.style.display = '';
      const html =
        'ℹ️ Los correos de pedidos y las pruebas ya usan Resend con <strong>pedidos@tintinaccs.com</strong>.' +
        '<div style="margin-top:4px;font-size:12px">Promociones permanece desactivado hasta migrar ese envío por separado; esto no afecta los correos automáticos de pedidos.</div>';
      if (configAlert.innerHTML !== html) configAlert.innerHTML = html;
    }

    const promoBanner = document.getElementById('promo-gmail-lock-banner');
    if (promoBanner) {
      promoBanner.style.display = '';
      const html =
        'ℹ️ Promociones todavía no fue migrado a Resend.' +
        '<div style="margin-top:4px;font-size:12px">Queda bloqueado para evitar que el sistema anterior de Gmail intente enviar campañas. Los pedidos y las pruebas funcionan con Resend.</div>';
      if (promoBanner.innerHTML !== html) promoBanner.innerHTML = html;
    }
    ['promo-template-select', 'promo-add-email', 'promo-add-email-btn', 'promo-preview-btn', 'promo-open-confirm-btn'].forEach(id => {
      const element = document.getElementById(id);
      if (element) element.disabled = true;
    });

    const testTemplate = document.getElementById('prueba-template-select');
    if (testTemplate) {
      const defaultOption = [...testTemplate.options].find(option => option.value === 'pedido_recibido_clienta');
      if (defaultOption) testTemplate.value = defaultOption.value;
      testTemplate.disabled = true;
      testTemplate.title = 'La prueba de lanzamiento usa un diseño seguro fijo enviado por Resend.';
      const field = testTemplate.closest('.adm-field');
      if (field && !field.querySelector('#resend-test-design-note')) {
        const note = document.createElement('div');
        note.id = 'resend-test-design-note';
        note.style.cssText = 'font-size:11px;color:var(--adm-muted);margin-top:6px';
        note.textContent = 'La prueba de lanzamiento usa un diseño fijo de confirmación y no crea pedidos ni modifica stock.';
        field.appendChild(note);
      }
    }

    const configPanel = document.getElementById('correos-panel-config');
    const limitParagraph = configPanel
      ? [...configPanel.querySelectorAll('p')].find(item => /Una cuenta de Gmail gratuita/i.test(item.textContent || ''))
      : null;
    if (limitParagraph) {
      limitParagraph.textContent = 'Los pedidos y las pruebas se envían mediante Resend desde pedidos@tintinaccs.com. El correo de prueba mantiene un intervalo de seguridad para evitar clics repetidos. Promociones seguirá desactivado hasta su migración independiente.';
    }
  }

  function queueUiPatch() {
    if (uiPatchQueued) return;
    uiPatchQueued = true;
    window.requestAnimationFrame(patchEmailUi);
  }

  async function syncProviderSettings() {
    if (!currentUser || currentUser.email?.trim().toLowerCase() !== SUPER_ADMIN_EMAIL) return;
    const data = privateState.exists ? privateState.data || {} : {};
    const patch = {};
    if (data.senderEmail !== SENDER_EMAIL) patch.senderEmail = SENDER_EMAIL;
    if (data.emailProvider !== 'resend') patch.emailProvider = 'resend';
    if (data.replyTo !== SUPER_ADMIN_EMAIL) patch.replyTo = SUPER_ADMIN_EMAIL;
    if (data.promoEnabled !== false) patch.promoEnabled = false;
    if (!Object.keys(patch).length) return;
    try {
      await setDoc(PRIVATE_REF, {
        ...patch,
        updatedAt: serverTimestamp(),
        updatedBy: SUPER_ADMIN_EMAIL
      }, { merge: true });
    } catch (error) {
      console.error('[admin-email-gate-sync] No se pudo actualizar la configuración de Resend:', error);
    }
  }

  async function sync() {
    if (syncing || matches()) {
      if (syncing) queued = true;
      return;
    }

    syncing = true;
    queued = false;
    try {
      await setDoc(PUBLIC_REF, {
        emailAccess: desired(),
        emailUpdatedAt: serverTimestamp()
      }, { merge: true });
      window.dispatchEvent(new CustomEvent('tintin:email-gate-synced'));
    } catch (error) {
      console.error('[admin-email-gate-sync] No se pudo sincronizar storeGate.emailAccess:', error);
    } finally {
      syncing = false;
      if (queued) sync();
    }
  }

  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(value || '').trim());
  }

  function resolveTestTarget() {
    const activeMode = document.querySelector('[data-prueba-mode].active')?.dataset?.pruebaMode || 'manual';
    if (activeMode === 'cliente') {
      return String(document.getElementById('prueba-cliente-select')?.value || '').trim();
    }
    return String(document.getElementById('test-email-input')?.value || '').trim();
  }

  async function logTest(email, success, error = '') {
    try {
      await addDoc(collection(db, 'emailLogs'), {
        category: 'prueba',
        type: 'pedido_recibido_clienta',
        recipient: email,
        status: success ? 'sent' : 'failed',
        templateKey: 'pedido_recibido_clienta',
        isAutomatic: false,
        sentBy: currentUser?.email || '',
        error: String(error || '').slice(0, 500),
        sentAt: serverTimestamp()
      });
    } catch (logError) {
      console.error('[admin-email-gate-sync] No se pudo registrar la prueba:', logError);
    }
  }

  async function sendResendTest(button) {
    const result = document.getElementById('test-email-result');
    const email = resolveTestTarget();

    if (privateState.data?.testEmailsEnabled === false) {
      if (result) {
        result.style.color = '#c0392b';
        result.textContent = 'Los envíos de prueba están desactivados en Correos → Configuración.';
      }
      return;
    }
    if (!validEmail(email)) {
      if (result) {
        result.style.color = '#c0392b';
        result.textContent = 'Escribí o elegí un correo válido.';
      }
      return;
    }

    const lastAttempt = Number(sessionStorage.getItem('tt_resend_test_last') || 0);
    const remaining = Math.ceil((120000 - (Date.now() - lastAttempt)) / 1000);
    if (lastAttempt && remaining > 0) {
      if (result) {
        result.style.color = '#c0392b';
        result.textContent = `Esperá ${remaining}s antes de enviar otra prueba.`;
      }
      return;
    }

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Enviando…';
    if (result) {
      result.style.color = 'var(--adm-muted)';
      result.textContent = 'Enviando prueba mediante Resend…';
    }

    try {
      const token = await currentUser.getIdToken(true);
      const response = await fetch(TEST_ENDPOINT, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({ toEmail: email })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.success !== true) {
        throw new Error(body.error || `Error HTTP ${response.status}`);
      }

      sessionStorage.setItem('tt_resend_test_last', String(Date.now()));
      await logTest(email, true);
      if (result) {
        result.style.color = '#065f46';
        result.textContent = `Correo de prueba enviado desde ${SENDER_EMAIL}.`;
      }
    } catch (error) {
      await logTest(email, false, error?.message || error);
      if (result) {
        result.style.color = '#c0392b';
        result.textContent = `No se pudo enviar la prueba: ${error?.message || error}`;
      }
    } finally {
      button.disabled = false;
      button.textContent = originalText || 'Enviar prueba';
      queueUiPatch();
    }
  }

  function installTestInterceptor() {
    document.addEventListener('click', event => {
      const button = event.target?.closest?.('#btn-test-email');
      if (!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      sendResendTest(button);
    }, true);
  }

  function startUiObserver() {
    if (uiObserver) return;
    const root = document.getElementById('section-correos') || document.body;
    uiObserver = new MutationObserver(queueUiPatch);
    uiObserver.observe(root, { childList: true, subtree: true, characterData: true });
    queueUiPatch();
  }

  function stop() {
    unsubPrivate?.();
    unsubPublic?.();
    unsubPrivate = null;
    unsubPublic = null;
    uiObserver?.disconnect();
    uiObserver = null;
  }

  function start() {
    if (unsubPrivate || unsubPublic) return;

    unsubPrivate = onSnapshot(
      PRIVATE_REF,
      snapshot => {
        privateState = {
          exists: snapshot.exists(),
          data: snapshot.exists() ? snapshot.data() || {} : {}
        };
        syncProviderSettings();
        sync();
        queueUiPatch();
      },
      error => console.error('[admin-email-gate-sync] No se pudo leer emailSettings/main:', error)
    );

    unsubPublic = onSnapshot(
      PUBLIC_REF,
      snapshot => {
        publicState = {
          exists: snapshot.exists(),
          data: snapshot.exists() ? snapshot.data() || {} : {}
        };
        sync();
      },
      error => console.error('[admin-email-gate-sync] No se pudo leer settings/storeGate:', error)
    );

    startUiObserver();
  }

  installTestInterceptor();

  onAuthStateChanged(auth, user => {
    currentUser = user || null;
    if ((user?.email || '').trim().toLowerCase() === SUPER_ADMIN_EMAIL) start();
    else stop();
  });
}
