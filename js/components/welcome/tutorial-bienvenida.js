import { auth, db, appCheckReady } from '../../core/firebase/firebase.js?v=tintin-20261017-domain-cutover-1';
import { subscribeAuthState } from '../../core/auth/coordinador-sesion.js?v=tintin-20261022-avatar-inicial-1';
import { doc, getDoc, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getUserRole, SUPER_ADMIN } from '../../core/auth/roles.js?v=tintin-20261017-domain-cutover-1';
import {
  DEFAULT_WELCOME_STEPS,
  WELCOME_VERSION,
  normalizeWelcomeConfig,
  welcomeIconSvg
} from './configuracion-bienvenida.js?v=tintin-20261021-welcome-guide-1';

(function(){
  'use strict';
  if (window.TintinWelcomeRuntimeBooted) return;
  window.TintinWelcomeRuntimeBooted = true;
  window.TintinWelcomeTutorialInitBooted = true;

  const pageName = (location.pathname || '').split('/').pop().replace(/\.html$/i, '').toLowerCase();
  if (pageName === 'login' || pageName.startsWith('admin')) return;
  const checkoutPending = () => pageName === 'checkout' && window.TintinCheckoutOrderCompleted !== true;
  const releaseWelcomeGate = () => document.documentElement.classList.remove('tt-welcome-pending');

  function previewMode(){
    const p = new URLSearchParams(location.search);
    if (p.get('welcomePreview') === '1') return true;
    try { return sessionStorage.getItem('tt_welcome_preview_superadmin') === '1' || localStorage.getItem('tt_welcome_preview_superadmin') === '1'; } catch { return false; }
  }

  function clearPreviewMode(){
    try {
      sessionStorage.removeItem('tt_welcome_preview_superadmin');
      localStorage.removeItem('tt_welcome_preview_superadmin');
    } catch {}
  }

  function seen(data){
    return !!(data?.welcomeTutorialSeen || data?.welcomeTutorialCompletedAt || data?.welcomeTutorialFirstShownAt || data?.onboardingCompleted === true);
  }

  function shouldShow(user, data, preview){
    if (!user) return false;
    if (preview) return true;
    // Sólo el alta canónica pendiente habilita la primera guía. La URL y la
    // fecha de creación no convierten cuentas existentes en altas nuevas.
    return data?.role === 'client' && data?.profileStatus === 'active' &&
      data?.blocked !== true && data?.welcomeTutorialPending === true && !seen(data);
  }

  function bounded(operation){
    let timer;
    return Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('welcome_timeout')), 5000); })
    ]).finally(() => clearTimeout(timer));
  }

  function esc(v){
    const d = document.createElement('div');
    d.textContent = String(v ?? '');
    return d.innerHTML;
  }

  async function readConfig(){
    if (!await bounded(() => appCheckReady)) return normalizeWelcomeConfig();
    try {
      const snap = await bounded(() => getDoc(doc(db, 'settings', 'welcomeTutorial')));
      const data = snap.exists() ? snap.data() : {};
      return normalizeWelcomeConfig(data);
    } catch (e) {
      console.warn('[welcome-runtime] configuración base usada:', e);
      return normalizeWelcomeConfig();
    }
  }

  async function readUser(uid){
    if (!await bounded(() => appCheckReady)) return {};
    try {
      const snap = await bounded(() => getDoc(doc(db, 'users', uid)));
      return snap.exists() ? snap.data() : {};
    } catch (e) {
      console.warn('[welcome-runtime] usuario no leído:', e);
      return {};
    }
  }

  async function claimWelcome(user, reason){
    if (!await bounded(() => appCheckReady)) return false;
    const ref = doc(db, 'users', user.uid);
    // La transacción evita dos primeras guías simultáneas en otros dispositivos.
    // No se muestra si el servidor no confirma el registro de la aparición.
    return bounded(() => runTransaction(db, async transaction => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists() || !shouldShow(user, snapshot.data(), false)) return false;
      transaction.update(ref, {
        welcomeTutorialSeen: true,
        welcomeTutorialPending: false,
        welcomeTutorialCompletedAt: serverTimestamp(),
        welcomeTutorialClosedReason: reason,
        ...(reason === 'shown' ? { welcomeTutorialFirstShownAt: serverTimestamp() } : {}),
        welcomeTutorialVersion: WELCOME_VERSION,
        onboardingCompleted: true,
        onboardingCompletedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return true;
    }));
  }

  function cleanUrl(){
    try {
      const u = new URL(location.href);
      u.searchParams.delete('welcome');
      u.searchParams.delete('welcomePreview');
      u.searchParams.delete('t');
      history.replaceState({}, '', u.pathname + u.search + u.hash);
    } catch {}
  }

  function waitReady(){
    return new Promise(resolve => {
      let done = false;
      let t = null;
      let obs = null;
      const finish = () => { if (done) return; done = true; cleanup(); setTimeout(resolve, 120); };
      const cleanup = () => { document.removeEventListener('tintin:splash:done', finish); document.removeEventListener('tintin:page-ready', finish); if (t) clearTimeout(t); if (obs) { try { obs.disconnect(); } catch {} } };
      const readyNow = () => {
        const s = document.getElementById('tt-intro');
        const l = document.getElementById('tt-loader');
        return (!s || s.classList.contains('tt-out')) && (!l || l.classList.contains('tt-out'));
      };
      if (readyNow()) return finish();
      document.addEventListener('tintin:splash:done', finish, { once:true });
      document.addEventListener('tintin:page-ready', finish, { once:true });
      obs = new MutationObserver(() => { if (readyNow()) finish(); });
      obs.observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
      t = setTimeout(finish, 2600);
    });
  }

  let y = 0, oldBody = null, oldHtml = '';
  function lock(){
    y = scrollY || document.documentElement.scrollTop || 0;
    oldHtml = document.documentElement.style.overflow;
    oldBody = document.body ? {
      position:document.body.style.position, top:document.body.style.top, left:document.body.style.left, right:document.body.style.right, width:document.body.style.width, overflow:document.body.style.overflow, touchAction:document.body.style.touchAction
    } : null;
    document.documentElement.classList.add('tt-welcome-scroll-locked');
    document.documentElement.style.overflow = 'hidden';
    if (document.body) {
      document.body.style.position='fixed'; document.body.style.top='-'+y+'px'; document.body.style.left='0'; document.body.style.right='0'; document.body.style.width='100%'; document.body.style.overflow='hidden'; document.body.style.touchAction='auto';
    }
  }

  function unlock(){
    document.documentElement.classList.remove('tt-welcome-scroll-locked');
    document.documentElement.style.overflow = oldHtml || '';
    if (document.body && oldBody) {
      document.body.style.position=oldBody.position; document.body.style.top=oldBody.top; document.body.style.left=oldBody.left; document.body.style.right=oldBody.right; document.body.style.width=oldBody.width; document.body.style.overflow=oldBody.overflow; document.body.style.touchAction=oldBody.touchAction;
    }
    scrollTo(0, y || 0);
  }

  function styles(){
    if (document.getElementById('tt-welcome-runtime-style')) return;
    const st = document.createElement('style');
    st.id = 'tt-welcome-runtime-style';
    st.textContent = `html.tt-welcome-scroll-locked,html.tt-welcome-scroll-locked body{overflow:hidden!important;overscroll-behavior:none!important}.tt-welcome-overlay{position:fixed;inset:0;z-index:2147482500;background:rgba(91,35,57,.42);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;box-sizing:border-box;padding:22px;font-family:Montserrat;animation:ttWelcomeFade .24s ease both}.tt-welcome-card{touch-action:pan-y;overscroll-behavior:contain;width:min(520px,100%);max-height:min(82vh,720px);max-height:min(82dvh,720px);overflow:auto;background:#fff;border:1.5px solid rgba(255,182,200,.8);border-radius:28px;box-shadow:0 24px 80px rgba(139,38,66,.30);animation:ttWelcomeIn .32s cubic-bezier(.34,1.56,.64,1) both}.tt-welcome-top{background:linear-gradient(135deg,#F6B7C8,#FDECF2);padding:26px 30px 28px;text-align:center;position:relative}.tt-welcome-close{position:absolute;top:10px;right:10px;width:44px;height:44px;border:0;border-radius:999px;background:rgba(255,255,255,.76);color:#713C53;font-size:20px;cursor:pointer}.tt-welcome-icon{width:74px;height:74px;border-radius:50%;background:#fff;display:grid;place-items:center;margin:18px auto 18px;font-size:32px;box-shadow:0 10px 30px rgba(212,106,138,.18);overflow:hidden}.tt-welcome-icon.has-image{font-size:0}.tt-welcome-icon img{width:100%;height:100%;object-fit:cover;border-radius:50%}.tt-welcome-title{font-family:Montserrat;font-size:clamp(25px,4.5vw,32px);line-height:1.18;margin:0;color:#713C53;font-weight:750;text-wrap:balance;overflow-wrap:anywhere}.tt-welcome-sub{margin:0 auto;color:#222222;font-size:11px;font-weight:650;line-height:1.5;letter-spacing:.12em;text-transform:uppercase;max-width:calc(100% - 44px);overflow-wrap:anywhere}.tt-welcome-body{padding:26px 28px 24px}.tt-welcome-step-title{font-size:18px;font-weight:900;color:#713C53;margin:0 0 8px;text-align:center}.tt-welcome-text{overflow-wrap:anywhere;font-weight:450;font-size:15px;line-height:1.65;color:#454545;text-align:center;margin:0 auto;max-width:420px}.tt-welcome-dots{display:flex;justify-content:center;gap:8px;margin:22px 0 0}.tt-welcome-dot{width:8px;height:8px;border-radius:999px;background:#FAD6DF;transition:all .2s ease}.tt-welcome-dot.active{width:26px;background:#F8AACA}.tt-welcome-actions{display:flex;gap:10px;justify-content:space-between;align-items:center;flex-wrap:wrap;margin-top:24px}.tt-welcome-btn{min-height:44px;border:0;border-radius:999px;padding:12px 18px;font-family:Montserrat;font-size:12px;font-weight:700;text-transform:none;letter-spacing:.02em;cursor:pointer;background:#FDECF2;color:#713C53}.tt-welcome-btn-primary{background:#F8AACA;color:#713C53;box-shadow:0 10px 26px rgba(212,106,138,.25)}.tt-welcome-btn-ghost{background:transparent;color:#454545;font-weight:550}.tt-welcome-navigation{display:flex;gap:10px;justify-content:flex-end}.tt-welcome-progress{display:flex;flex-direction:column;align-items:center;gap:10px;margin-top:22px}.tt-welcome-progress .tt-welcome-dots{margin:0}.tt-welcome-count{font-size:11px;line-height:1.5;letter-spacing:.03em;color:#595959}.tt-welcome-icon svg{width:32px;height:32px;flex:none;color:#222222}#tt-welcome-tutorial.tt-welcome-overlay .tt-welcome-card{overflow:auto!important}.tt-welcome-btn:focus-visible,.tt-welcome-close:focus-visible{outline:2px solid #222222;outline-offset:3px}@keyframes ttWelcomeFade{from{opacity:0}to{opacity:1}}@keyframes ttWelcomeIn{from{opacity:0;transform:translateY(18px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}@media(max-width:600px){.tt-welcome-overlay{align-items:center;padding:12px;padding-bottom:max(12px,env(safe-area-inset-bottom))}.tt-welcome-card{border-radius:24px 24px 18px 18px;max-height:86vh;max-height:86dvh}.tt-welcome-top{padding:22px 18px 24px}.tt-welcome-body{padding:20px 18px 18px}.tt-welcome-actions{flex-direction:column-reverse;align-items:stretch}.tt-welcome-navigation{width:100%}.tt-welcome-navigation .tt-welcome-btn{flex:1}.tt-welcome-btn{width:auto}.tt-welcome-btn-ghost{align-self:center}.tt-welcome-actions{gap:8px;margin-top:20px}.tt-welcome-icon{width:64px;height:64px;font-size:32px}}@media(prefers-reduced-motion:reduce){.tt-welcome-overlay,.tt-welcome-card{animation:none}.tt-welcome-dot,.tt-welcome-overlay{transition:none!important}}`;
    document.head.appendChild(st);
  }

  function show(user, config, preview){
    document.getElementById('tt-welcome-tutorial')?.remove();
    cleanUrl(); styles();
    let i = 0;
    const steps = (config.steps || DEFAULT_WELCOME_STEPS).filter(s => s && s.active !== false);
    if (!steps.length) { releaseWelcomeGate(); return; }
    const ov = document.createElement('div');
    ov.id = 'tt-welcome-tutorial';
    ov.className = 'tt-welcome-overlay';
    ov.setAttribute('role','dialog');
    ov.setAttribute('aria-modal','true');
    ov.setAttribute('aria-labelledby','tt-welcome-title');
    let finishing = false;

    const finish = reason => {
      if (finishing) return;
      finishing = true;
      ov.style.opacity = '0'; ov.style.transition = 'opacity .22s ease';
      if (preview) clearPreviewMode();
      setTimeout(() => {
        ov.remove();
        unlock();
        releaseWelcomeGate();
        window.dispatchEvent(new CustomEvent('tintin:welcome:closed', { detail: { reason } }));
      }, 240);
    };

    const render = () => {
      const step = steps[i] || DEFAULT_WELCOME_STEPS[0];
      const last = i === steps.length - 1;
      const hasImage = !!step.image;
      const fallbackIcon = welcomeIconSvg(step.icon) || esc(step.icon || '');
      const iconHtml = hasImage
        ? `<img src="${esc(step.image)}" alt="" loading="eager">`
        : fallbackIcon;
      ov.innerHTML = `<div class="tt-welcome-card"><div class="tt-welcome-top"><button type="button" class="tt-welcome-close" id="tt-welcome-close" aria-label="Cerrar guía">×</button><p class="tt-welcome-sub">${esc(config.title || 'Tintin')}${config.subtitle ? ` · ${esc(config.subtitle)}` : ''}</p><div class="tt-welcome-icon${hasImage?' has-image':''}" id="tt-welcome-icon" aria-hidden="true">${iconHtml}</div><h2 class="tt-welcome-title" id="tt-welcome-title">${esc(step.title || '')}</h2></div><div class="tt-welcome-body"><p class="tt-welcome-text">${esc(step.text || '')}</p><div class="tt-welcome-progress"><div class="tt-welcome-dots" aria-hidden="true">${steps.map((_,idx)=>`<span class="tt-welcome-dot ${idx===i?'active':''}"></span>`).join('')}</div><span class="tt-welcome-count" role="status">Paso ${i + 1} de ${steps.length}</span></div><div class="tt-welcome-actions"><button type="button" class="tt-welcome-btn tt-welcome-btn-ghost" id="tt-welcome-skip">Cerrar guía</button><div class="tt-welcome-navigation">${i>0?'<button type="button" class="tt-welcome-btn" id="tt-welcome-prev">Atrás</button>':''}<button type="button" class="tt-welcome-btn tt-welcome-btn-primary" id="tt-welcome-next">${esc(step.cta || (last?'Entendido':'Siguiente'))}</button></div></div></div></div>`;
      if (hasImage) {
        ov.querySelector('#tt-welcome-icon img')?.addEventListener('error', () => {
          const holder = ov.querySelector('#tt-welcome-icon');
          if (!holder) return;
          holder.classList.remove('has-image');
          holder.innerHTML = fallbackIcon;
        }, { once: true });
      }
      ov.querySelector('#tt-welcome-close').onclick = () => finish('closed');
      ov.querySelector('#tt-welcome-skip').onclick = () => finish('closed');
      ov.querySelector('#tt-welcome-prev')?.addEventListener('click', () => { i = Math.max(0, i - 1); render(); });
      ov.querySelector('#tt-welcome-next').onclick = () => { if (last) finish('completed'); else { i++; render(); } };
      setTimeout(() => ov.querySelector('#tt-welcome-next')?.focus({ preventScroll: true }), 40);
    };

    ov.addEventListener('click', e => { if (e.target === ov) finish('closed_outside'); });
    document.addEventListener('keydown', function onKey(e){ if (!document.getElementById('tt-welcome-tutorial')) return document.removeEventListener('keydown', onKey); if (e.key === 'Escape') finish('closed_escape'); });
    render();
    document.body.appendChild(ov);
    releaseWelcomeGate();
    lock();
    window.dispatchEvent(new CustomEvent('tintin:welcome:opened'));
  }

  // Firebase puede disparar onAuthStateChanged más de una vez para la misma
  // sesión (por ejemplo: una vez con el usuario restaurado de la sesión
  // guardada, y otra vez tras revalidar el token). Sin esta protección, un
  // segundo disparo mientras el mensaje ya estaba abierto volvía a llamar
  // show(), que borra el overlay actual para crear uno nuevo desde el
  // paso 1 — se veía como si "se cerrara solo" sin que nadie lo tocara.
  let handledUid = null;
  let generation = 0;
  let sessionUser = null;
  async function handleWelcome(user) {
    if (user?.uid === handledUid) { releaseWelcomeGate(); return; }
    handledUid = user?.uid || null;
    const currentGeneration = ++generation;
    if (document.getElementById('tt-welcome-tutorial')) {
      document.getElementById('tt-welcome-tutorial').remove();
      unlock();
    }
    releaseWelcomeGate();
    if (!user) return;
    // Entrar directamente a comprar no consume la primera bienvenida. El
    // mismo runtime la reintenta después de una confirmación real del pedido.
    if (checkoutPending()) return;
    try {
      const previewRequested = previewMode() && user.email === SUPER_ADMIN;
      const role = await bounded(() => getUserRole(user.uid, user.email));
      if (!previewRequested && role !== 'client') { releaseWelcomeGate(); return; }
      const [data, config] = await Promise.all([readUser(user.uid), readConfig()]);
      if (currentGeneration !== generation || checkoutPending()) return;
      const preview = previewRequested && config.previewEnabled;
      if (previewRequested && !preview) {
        clearPreviewMode();
        cleanUrl();
        releaseWelcomeGate();
        return;
      }
      if (!preview && !config.enabled) {
        cleanUrl();
        await claimWelcome(user, 'disabled').catch(error => console.warn('[welcome-runtime] no se pudo cerrar bienvenida desactivada', error));
        releaseWelcomeGate();
        return;
      }
      if (!config.steps.some(step => step && step.active !== false)) {
        if (previewRequested) clearPreviewMode();
        else await claimWelcome(user, 'no_active_steps').catch(error => console.warn('[welcome-runtime] no se pudo cerrar bienvenida vacía', error));
        cleanUrl();
        releaseWelcomeGate();
        return;
      }
      if (!shouldShow(user, data, preview)) {
        cleanUrl();
        releaseWelcomeGate();
        return;
      }
      await waitReady();
      if (currentGeneration !== generation) return;
      if (!preview && !await claimWelcome(user, 'shown')) return;
      if (currentGeneration !== generation) return;
      show(user, config, preview);
    } catch (e) {
      console.warn('[welcome-runtime] Tutorial omitido:', e);
      releaseWelcomeGate();
    }
  }
  subscribeAuthState(user => {
    sessionUser = user;
    void handleWelcome(user);
  });
  window.addEventListener('tintin:checkout:completed', () => {
    if (pageName !== 'checkout' || checkoutPending() || !sessionUser) return;
    if (document.getElementById('tt-welcome-tutorial')) return;
    handledUid = null;
    void handleWelcome(sessionUser);
  });
})();
