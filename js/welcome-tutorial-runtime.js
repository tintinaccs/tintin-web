import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getUserRole, SUPER_ADMIN } from './roles.js';

const VERSION = 'home-welcome-v3-reliable';
const DEFAULT_STEPS = [
  { icon:'🌸', title:'Bienvenida a Tintin', text:'Te cuento rapidito cómo comprar y encontrar tus accesorios favoritos sin perderte.', cta:'Empezar', active:true },
  { icon:'🛍️', title:'Explorá la tienda', text:'Desde “Tienda” podés ver relojes, aros, collares, bags, pulseras y más.', cta:'Siguiente', active:true },
  { icon:'🛒', title:'Agregá al carrito', text:'Cuando veas algo que te guste, agregalo al carrito. Tu carrito queda separado por cuenta.', cta:'Siguiente', active:true },
  { icon:'✨', title:'Finalizá tu pedido', text:'Completá tus datos de entrega y pago. Si necesitás ayuda, podés escribirnos por WhatsApp.', cta:'Entendido', active:true }
];

(function(){
  'use strict';
  if (window.TintinWelcomeRuntimeBooted) return;
  window.TintinWelcomeRuntimeBooted = true;
  window.TintinWelcomeTutorialInitBooted = true;

  function isHome(){
    const p = (location.pathname || '').replace(/\/+/g,'/').toLowerCase();
    return p.endsWith('/') || p.endsWith('/index.html') || p === '';
  }
  if (!isHome()) return;

  function previewMode(){
    const p = new URLSearchParams(location.search);
    if (p.get('welcomePreview') === '1') return true;
    try { return sessionStorage.getItem('tt_welcome_preview_superadmin') === '1' || localStorage.getItem('tt_welcome_preview_superadmin') === '1'; } catch { return false; }
  }

  function toDate(v){
    if (!v) return null;
    if (v.toDate) return v.toDate();
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function recentlyCreated(user, data){
    const now = Date.now();
    const limit = 72 * 60 * 60 * 1000;
    return [toDate(user?.metadata?.creationTime), toDate(data?.createdAt)].filter(Boolean).some(d => Math.abs(now - d.getTime()) <= limit);
  }

  function seen(data){
    return !!(data?.welcomeTutorialSeen || data?.welcomeTutorialCompletedAt || data?.onboardingCompleted === true);
  }

  function shouldShow(user, data, preview){
    if (!user) return false;
    if (preview) return true;
    if (seen(data)) return false;
    const p = new URLSearchParams(location.search);
    return p.get('welcome') === '1' || data?.welcomeTutorialPending === true || data?.onboardingCompleted === false || recentlyCreated(user, data);
  }

  function esc(v){
    const d = document.createElement('div');
    d.textContent = String(v ?? '');
    return d.innerHTML;
  }

  async function readConfig(){
    try {
      const snap = await getDoc(doc(db, 'settings', 'welcomeTutorial'));
      const data = snap.exists() ? snap.data() : {};
      const steps = Array.isArray(data.steps) ? data.steps.filter(s => s && s.active !== false) : [];
      return {
        enabled: data.enabled !== false,
        title: data.title || 'Mensaje de bienvenida',
        subtitle: data.subtitle || 'Tu primera guía Tintin',
        steps: steps.length ? steps : DEFAULT_STEPS
      };
    } catch (e) {
      console.warn('[welcome-runtime] configuración base usada:', e);
      return { enabled:true, title:'Mensaje de bienvenida', subtitle:'Tu primera guía Tintin', steps:DEFAULT_STEPS };
    }
  }

  async function readUser(uid){
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      return snap.exists() ? snap.data() : {};
    } catch (e) {
      console.warn('[welcome-runtime] usuario no leído:', e);
      return {};
    }
  }

  async function markSeen(uid, reason){
    await setDoc(doc(db, 'users', uid), {
      welcomeTutorialSeen: true,
      welcomeTutorialPending: false,
      welcomeTutorialCompletedAt: serverTimestamp(),
      welcomeTutorialClosedReason: reason,
      welcomeTutorialVersion: VERSION,
      onboardingCompleted: true,
      onboardingCompletedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge:true });
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
      document.body.style.position='fixed'; document.body.style.top='-'+y+'px'; document.body.style.left='0'; document.body.style.right='0'; document.body.style.width='100%'; document.body.style.overflow='hidden'; document.body.style.touchAction='none';
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
    st.textContent = `html.tt-welcome-scroll-locked,html.tt-welcome-scroll-locked body{overflow:hidden!important;overscroll-behavior:none!important;touch-action:none!important}.tt-welcome-overlay{position:fixed;inset:0;z-index:2147482500;background:rgba(91,35,57,.42);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:22px;font-family:'Poppins',sans-serif;animation:ttWelcomeFade .24s ease both}.tt-welcome-card{width:min(520px,100%);max-height:min(82vh,720px);overflow:auto;background:#fff;border:1.5px solid rgba(255,182,200,.8);border-radius:28px;box-shadow:0 24px 80px rgba(139,38,66,.30);animation:ttWelcomeIn .32s cubic-bezier(.34,1.56,.64,1) both}.tt-welcome-top{background:linear-gradient(135deg,#F6B7C8,#FDECF2);padding:24px 24px 18px;text-align:center;position:relative}.tt-welcome-close{position:absolute;top:14px;right:14px;width:34px;height:34px;border:0;border-radius:999px;background:rgba(255,255,255,.76);color:#2B2B2B;font-size:20px;cursor:pointer}.tt-welcome-icon{width:74px;height:74px;border-radius:50%;background:#fff;display:grid;place-items:center;margin:0 auto 12px;font-size:36px;box-shadow:0 10px 30px rgba(212,106,138,.18)}.tt-welcome-title{font-family:'Playfair Display',serif;font-size:clamp(26px,5vw,38px);line-height:1.03;margin:0;color:#2B2B2B;font-weight:800}.tt-welcome-sub{margin:8px auto 0;color:#2B2B2B;font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.tt-welcome-body{padding:24px}.tt-welcome-step-title{font-size:18px;font-weight:900;color:#2B2B2B;margin:0 0 8px;text-align:center}.tt-welcome-text{font-size:14px;line-height:1.7;color:#7B6F72;text-align:center;margin:0 auto;max-width:420px}.tt-welcome-dots{display:flex;justify-content:center;gap:8px;margin:22px 0 0}.tt-welcome-dot{width:8px;height:8px;border-radius:999px;background:#FAD6DF;transition:all .2s ease}.tt-welcome-dot.active{width:26px;background:#AD3F67}.tt-welcome-actions{display:flex;gap:10px;justify-content:space-between;align-items:center;flex-wrap:wrap;margin-top:24px}.tt-welcome-btn{border:0;border-radius:999px;padding:12px 18px;font-family:'Poppins',sans-serif;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;cursor:pointer;background:#FDECF2;color:#2B2B2B}.tt-welcome-btn-primary{background:#AD3F67;color:#fff;box-shadow:0 10px 26px rgba(212,106,138,.25)}.tt-welcome-btn-ghost{background:transparent;color:#2B2B2B}@keyframes ttWelcomeFade{from{opacity:0}to{opacity:1}}@keyframes ttWelcomeIn{from{opacity:0;transform:translateY(18px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}@media(max-width:600px){.tt-welcome-overlay{align-items:flex-end;padding:12px}.tt-welcome-card{border-radius:24px 24px 18px 18px;max-height:86vh}.tt-welcome-top{padding:22px 18px 16px}.tt-welcome-body{padding:20px 18px 18px}.tt-welcome-actions{flex-direction:column-reverse;align-items:stretch}.tt-welcome-btn{width:100%}.tt-welcome-icon{width:64px;height:64px;font-size:32px}}`;
    document.head.appendChild(st);
  }

  function show(user, config, preview){
    document.getElementById('tt-welcome-tutorial')?.remove();
    cleanUrl(); styles();
    let i = 0;
    const steps = (config.steps || DEFAULT_STEPS).filter(s => s && s.active !== false);
    const ov = document.createElement('div');
    ov.id = 'tt-welcome-tutorial';
    ov.className = 'tt-welcome-overlay';
    ov.setAttribute('role','dialog');
    ov.setAttribute('aria-modal','true');

    const finish = async reason => {
      ov.style.opacity = '0'; ov.style.transition = 'opacity .22s ease';
      if (preview) { try { sessionStorage.removeItem('tt_welcome_preview_superadmin'); localStorage.removeItem('tt_welcome_preview_superadmin'); } catch {} }
      else await markSeen(user.uid, reason).catch(e => console.warn('[welcome-runtime] no se pudo marcar visto', e));
      setTimeout(() => { ov.remove(); unlock(); }, 240);
    };

    const render = () => {
      const step = steps[i] || DEFAULT_STEPS[0];
      const last = i === steps.length - 1;
      ov.innerHTML = `<div class="tt-welcome-card"><div class="tt-welcome-top"><button type="button" class="tt-welcome-close" id="tt-welcome-close" aria-label="Cerrar">×</button><div class="tt-welcome-icon">${esc(step.icon || '🌸')}</div><h2 class="tt-welcome-title">${esc(config.title || 'Mensaje de bienvenida')}</h2><div class="tt-welcome-sub">${esc(config.subtitle || 'Tu primera guía Tintin')}</div></div><div class="tt-welcome-body"><h3 class="tt-welcome-step-title">${esc(step.title || '')}</h3><p class="tt-welcome-text">${esc(step.text || '')}</p><div class="tt-welcome-dots" aria-hidden="true">${steps.map((_,idx)=>`<span class="tt-welcome-dot ${idx===i?'active':''}"></span>`).join('')}</div><div class="tt-welcome-actions"><button type="button" class="tt-welcome-btn tt-welcome-btn-ghost" id="tt-welcome-skip">Cerrar</button><div style="display:flex;gap:10px;flex:1;justify-content:flex-end;flex-wrap:wrap">${i>0?'<button type="button" class="tt-welcome-btn" id="tt-welcome-prev">Atrás</button>':''}<button type="button" class="tt-welcome-btn tt-welcome-btn-primary" id="tt-welcome-next">${esc(last?'Finalizar':(step.cta || 'Siguiente'))}</button></div></div></div></div>`;
      ov.querySelector('#tt-welcome-close').onclick = () => finish('closed');
      ov.querySelector('#tt-welcome-skip').onclick = () => finish('closed');
      ov.querySelector('#tt-welcome-prev')?.addEventListener('click', () => { i = Math.max(0, i - 1); render(); });
      ov.querySelector('#tt-welcome-next').onclick = () => { if (last) finish('completed'); else { i++; render(); } };
      setTimeout(() => ov.querySelector('#tt-welcome-next')?.focus(), 40);
    };

    ov.addEventListener('click', e => { if (e.target === ov) finish('closed_outside'); });
    document.addEventListener('keydown', function onKey(e){ if (!document.getElementById('tt-welcome-tutorial')) return document.removeEventListener('keydown', onKey); if (e.key === 'Escape') finish('closed_escape'); });
    render();
    document.body.appendChild(ov);
    lock();
  }

  onAuthStateChanged(auth, async user => {
    if (!user) return;
    try {
      const preview = previewMode() && user.email === SUPER_ADMIN;
      const role = await getUserRole(user.uid, user.email);
      if (!preview && role !== 'client') return;
      const [data, config] = await Promise.all([readUser(user.uid), readConfig()]);
      if (!preview && !config.enabled) return;
      if (!shouldShow(user, data, preview)) return;
      await waitReady();
      show(user, config, preview);
    } catch (e) {
      console.warn('[welcome-runtime] Tutorial omitido:', e);
    }
  });
})();
