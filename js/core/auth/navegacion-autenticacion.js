// cargador-pagina.js es el único responsable de iniciar los módulos globales de
// interfaz. auth-nav solo administra sesión y navegación de la cuenta.
import { auth, db } from '../firebase/firebase.js?v=tintin-20260924-auth-popup-resolver-1-launch-20260926-1';
import { logoutSession } from './salida-sesion.js?v=tintin-20261005-auth-loader-1';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { AUTH_STATES, subscribeSession, getSessionUser, createAuthHandoff, readAuthHandoff, clearAuthHandoff } from './coordinador-sesion.js?v=tintin-20260924-auth-state-authority-1-auth-popup-resolver-1-launch-20260926-1';
import { recordAuthDiagnostic } from './diagnostico-sesion.js?v=tintin-20260918-auth-diagnostics-1';
import { ROLES, can, SUPER_ADMIN } from './roles.js?v=tintin-20260916-final-polish-2-auth-persistence-20260919-1-auth-popup-resolver-1-launch-20260926-1';
import { sanitizeImageUrl } from '../../components/images/utilidades-imagenes.js?v=tintin-20260716-cloudinary-fix-1';
import { readAccountIdentity } from '../../pages/profile/estado-canonico-perfil.mjs?v=tintin-20261003-profile-avatar-identity-1';

const IS_LOGIN_PAGE = /(^|\/)login(?:\.html)?\/?$/i.test(window.location.pathname || '');
// La vista previa embebida es sólo visual: no debe suscribirse a Auth ni leer
// perfiles. Así no agrega listeners de Firestore ni disputa la persistencia de
// la pestaña administrativa que la contiene.
const IS_VISUAL_PREVIEW_FRAME = new URLSearchParams(window.location.search).get('ttVisualPreview') === '1'
  && window.parent !== window;
let silentLogoutStarted = false;
let authRenderGeneration = 0;
let authReadyDiagnosticRecorded = false;
let coordinatorReadyDiagnosticRecorded = false;
const PROFILE_READ_TIMEOUT_MS = 5000;
const initialAuthHandoff = readAuthHandoff();
let stopNavigationProfile = null;
let navigationUid;
let navigationProfile = {};

if (!IS_LOGIN_PAGE && !IS_VISUAL_PREVIEW_FRAME) document.documentElement.classList.add('tt-auth-restoring');
if (!IS_LOGIN_PAGE && !IS_VISUAL_PREVIEW_FRAME) recordAuthDiagnostic('AUTH_RESTORE_START', { source: 'public-auth-navigation' });

function escapeHtmlNav(s){const d=document.createElement('div');d.textContent=s||'';return d.innerHTML.replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function loginHrefForCurrentLocation(){
 const path=`${window.location.pathname||'/'}${window.location.search||''}${window.location.hash||''}`;
 const onHome=/^\/(?:index(?:\.html)?)?\/?$/i.test(window.location.pathname||'/');
 if(onHome||IS_LOGIN_PAGE)return '/login';
 return `/login?from=${encodeURIComponent(path)}`;
}
function beginSilentAuthTransition(){
 document.documentElement.classList.add('tt-auth-silent-transition');
 window.TintinLoader?.show?.();
}
function endSilentAuthTransition(){
 document.documentElement.classList.remove('tt-auth-silent-transition');
 window.TintinLoader?.hide?.();
}
function doLogout(){
 if(silentLogoutStarted)return;
 silentLogoutStarted=true;
 recordAuthDiagnostic('EXPLICIT_LOGOUT', { source: 'public-account-menu' });
 beginSilentAuthTransition();
 logoutSession()
  .then(()=>window.location.replace('/'))
  .catch(error=>{
   console.error('[auth-nav] No se pudo cerrar sesión:',error);
   silentLogoutStarted=false;
   endSilentAuthTransition();
   const panel=document.getElementById('account-panel');
   if(panel){
    let notice=panel.querySelector('[data-logout-error]');
    if(!notice){notice=document.createElement('p');notice.dataset.logoutError='';notice.className='tt-account-help';notice.setAttribute('role','alert');panel.appendChild(notice);}
    notice.textContent='No pudimos cerrar tu sesión. Volvé a intentarlo.';
   }
  });
}
function hasAdminAccess(user,role){if(!user)return false;if(String(user.email||'').trim().toLowerCase()===SUPER_ADMIN)return true;return can(role,'viewDashboard')===true;}
function publishStaffVisibility(user,role){
 const staff=hasAdminAccess(user,role);
 document.documentElement.classList.toggle('tt-staff-session',staff);
 window.dispatchEvent(new CustomEvent('tintin:staff-visibility-ready',{detail:{staff}}));
}
function roleLabel(role){if(role===ROLES.SUPERADMIN)return 'Panel Super Admin';if(role===ROLES.ADMIN)return 'Panel Admin';if(role===ROLES.AGENT)return 'Panel Agente';if(role===ROLES.VIEWER)return 'Panel Viewer';return 'Panel interno';}
function initials(value){return String(value||'?').trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'?';}
function roleFromProfile(user,profile={}){
 const authenticatedEmail=String(user?.email||'').trim().toLowerCase();
 if(authenticatedEmail===SUPER_ADMIN)return ROLES.SUPERADMIN;
 const role=String(profile?.role||ROLES.CLIENT).trim().toLowerCase();
 return [ROLES.ADMIN,ROLES.AGENT,ROLES.VIEWER,ROLES.CLIENT].includes(role)?role:ROLES.CLIENT;
}

function watchNavigationProfile(user, generation){
 let firstPaint = false;
 const publish = profile => {
  if(generation!==authRenderGeneration || getSessionUser()?.uid!==user.uid)return;
  firstPaint = true;
  clearTimeout(timer);
  navigationProfile=profile;
  document.documentElement.dataset.ttWholesaleApproved=String(profile.wholesaleStatus==='aprobado');
  const role=roleFromProfile(user,profile);
  publishStaffVisibility(user,role);
  renderAccountButtonPhoto(user,profile);
  renderMobileTabbarPhoto(user,profile);
  renderAccountPanel(user,role,profile);
  renderProfileIdentity(user,profile);
  const visual=readAccountIdentity(profile,user);
  createAuthHandoff(user.uid,{photoURL:visual.photoURL,displayName:visual.name});
  window.dispatchEvent(new CustomEvent('tintin:auth-nav-updated',{
   detail:{authenticated:true,role,wholesaleApproved:profile.wholesaleStatus==='aprobado'}
  }));
 };
 // Nunca pintar primero la foto del proveedor encima de una foto elegida.
 // El handoff es sólo visual; el listener confirma perfil y permisos.
 const timer=window.setTimeout(()=>{if(!firstPaint)publish({});},PROFILE_READ_TIMEOUT_MS);
 const unsubscribe=onSnapshot(doc(db,'users',user.uid),snap=>publish(snap.exists()?snap.data():{}),error=>{
  console.warn('[auth-nav] No se pudo leer el perfil de la cuenta:',error?.code||error);
  if(!firstPaint)publish({});
 });
 return ()=>{clearTimeout(timer);unsubscribe();};
}

const accountBtnDefaults=new Map();

// La identidad ya restaurada en la página anterior se usa sólo como pintura
// provisional. Así el header no salta a "visitante" mientras Firebase y
// Firestore terminan de confirmar la sesión en el documento nuevo.
if(initialAuthHandoff?.uid){
 queueMicrotask(()=>renderAccountButtonPhoto({
  uid:initialAuthHandoff.uid,
  photoURL:initialAuthHandoff.photoURL,
  displayName:initialAuthHandoff.displayName
 },{}));
 queueMicrotask(()=>window.dispatchEvent(new CustomEvent('tintin:auth-nav-updated',{
  detail:{authenticated:true,role:ROLES.CLIENT,provisional:true}
 })));
}

function captureNavigationHandoff(anchor){
 const user=getSessionUser();
 if(!user?.uid||!anchor||anchor.target&&anchor.target!=='_self')return;
 if(anchor.hasAttribute('download'))return;
 const href=anchor.getAttribute('href');
 if(!href||href.startsWith('#'))return;
 let url;
 try{url=new URL(href,window.location.href);}catch{return;}
 if(url.origin!==window.location.origin)return;
 if(url.href===window.location.href)return;
 const currentButton=document.querySelector('[data-auth-account-button]');
 const currentAvatar=currentButton?.querySelector('img');
 createAuthHandoff(user.uid,{
  photoURL:currentAvatar?.currentSrc||currentAvatar?.src||user.photoURL||'',
  displayName:currentAvatar?.alt||user.displayName||''
 });
}

// Login administra su propio intento y loader; el menú público sólo administra
// navegación y salida de la cuenta, sin capturar el clic de Google.
document.addEventListener('click',event=>{
 const adminLink=event.target.closest?.('a[data-internal-admin-link],a[href="/admin"]');
 if(adminLink){
  const user=getSessionUser();
  if(user?.uid){
   createAuthHandoff(user.uid);
   recordAuthDiagnostic('HANDOFF_FOUND',{source:'public-account-menu',state:'created-for-admin-navigation'});
  }
 }
 captureNavigationHandoff(event.target.closest?.('a[href]'));
 // El perfil tiene su propio botón de cierre explícito. No lo capture el
 // listener global: dos handlers sobre el mismo control podían ejecutar
 // signOut en paralelo y hacer que la navegación pareciera un deslogueo
 // provocado por el icono de cuenta.
 const logoutButton=event.target.closest?.('#account-logout-btn,#tablet-user-logout-btn');
 if(logoutButton){
  event.preventDefault();
  event.stopImmediatePropagation();
  doLogout();
 }
},{capture:true});

window.addEventListener('tintin:login-cancelled',endSilentAuthTransition);
window.addEventListener('tintin:login-failed',endSilentAuthTransition);

// El coordinador es la única fuente del estado Auth. Mientras restaura la
// sesión, el drawer conserva un estado de carga y nunca pinta "visitante" de
// forma provisional. Además, cada render lleva generación para impedir que
// una lectura lenta de rol/perfil de una sesión anterior pise un logout o un
// cambio de cuenta más reciente.
subscribeSession(async snapshot=>{
 if(IS_LOGIN_PAGE||IS_VISUAL_PREVIEW_FRAME)return;
 if(snapshot.status!==AUTH_STATES.RESTORING&&!authReadyDiagnosticRecorded){
  authReadyDiagnosticRecorded=true;
  recordAuthDiagnostic('AUTH_STATE_READY',{source:'public-auth-navigation',authState:snapshot.status,reason:snapshot.reason||'coordinator-resolution'});
 }
 if(snapshot.status!==AUTH_STATES.RESTORING&&!coordinatorReadyDiagnosticRecorded){
  coordinatorReadyDiagnosticRecorded=true;
  recordAuthDiagnostic('COORDINATOR_READY',{source:'public-auth-navigation',sessionCoordinatorState:snapshot.status});
 }
 if(snapshot.status===AUTH_STATES.RESTORING||snapshot.status===AUTH_STATES.UNKNOWN){
  document.documentElement.classList.add('tt-auth-restoring');
  return;
 }
 document.documentElement.classList.remove('tt-auth-restoring');
 const user=snapshot.user;
 if(user) recordAuthDiagnostic('AUTH_USER_AVAILABLE',{source:'public-auth-navigation',authState:snapshot.status});
 if(navigationUid===(user?.uid||null) && (stopNavigationProfile || !user))return;
 window.dispatchEvent(new CustomEvent('tintin:auth-nav-updated',{
  detail:{authenticated:Boolean(user),role:ROLES.CLIENT,provisional:Boolean(user)}
 }));
 stopNavigationProfile?.();
 stopNavigationProfile=null;
 navigationUid=user?.uid||null;
 navigationProfile={};
 const generation=++authRenderGeneration;
 if(!user){
  clearAuthHandoff();
  delete document.documentElement.dataset.ttWholesaleApproved;
  publishStaffVisibility(null,ROLES.CLIENT);
  renderAccountButtonPhoto(null,{});
  renderMobileTabbarPhoto(null,{});
  renderAccountPanel(null);
  window.dispatchEvent(new CustomEvent('tintin:auth-nav-updated',{detail:{authenticated:false,role:ROLES.CLIENT}}));
  return;
 }
 if(initialAuthHandoff?.uid!==user.uid){
  // No reutilizar la identidad de una cuenta anterior.
  renderAccountButtonPhoto(null,{});
  renderMobileTabbarPhoto(null,{});
 }
 if(initialAuthHandoff?.uid===user.uid){
  renderAccountPanel(user,ROLES.CLIENT,{avatarURL:initialAuthHandoff.photoURL,name:initialAuthHandoff.displayName});
 }else{
  const panel=document.getElementById('account-panel');
  if(panel)panel.innerHTML='<p class="tt-account-help" role="status">Cargando tu cuenta…</p>';
 }
 stopNavigationProfile=watchNavigationProfile(user,generation);
});

function renderAccountButtonPhoto(user,profile={}){
 const identity=readAccountIdentity(profile,user||{});
 document.querySelectorAll('[data-auth-account-button]').forEach(btn=>{
  if(!accountBtnDefaults.has(btn))accountBtnDefaults.set(btn,btn.innerHTML);
  const photoUrl=sanitizeImageUrl(identity.photoURL||user?.photoURL||'');
  if(user&&photoUrl){
   const name=identity.name||identity.username||user.displayName||user.email||'Mi cuenta';
   const current=btn.querySelector('img.tt-account-avatar-btn');
   if(current?.getAttribute('src')===photoUrl){current.alt=name;return;}
   const img=document.createElement('img');
   img.className='tt-account-avatar-btn';img.src=photoUrl;img.alt=name;img.referrerPolicy='no-referrer';img.width=48;img.height=48;
   img.style.cssText='width:100%;height:100%;max-width:none;max-height:none;flex-shrink:0;border-radius:inherit;object-fit:cover;display:block';
   btn.dataset.ttAccountAvatar='true';
   img.onerror=()=>{delete btn.dataset.ttAccountAvatar;btn.innerHTML=accountBtnDefaults.get(btn);};
   btn.innerHTML='';btn.appendChild(img);
  }else { delete btn.dataset.ttAccountAvatar;btn.innerHTML=accountBtnDefaults.get(btn); }
 });
}

function renderMobileTabbarPhoto(user,profile={}){
 const tab=document.getElementById('tabbar-cuenta');
 if(!tab)return;
 if(!tab.dataset.ttDefaultHtml)tab.dataset.ttDefaultHtml=tab.innerHTML;
 const identity=readAccountIdentity(profile,user||{});
 const photoUrl=sanitizeImageUrl(identity.photoURL||user?.photoURL||'');
 if(user&&photoUrl){
  const name=escapeHtmlNav(identity.name||identity.username||user.displayName||user.email||'Mi cuenta');
  tab.innerHTML=`<img class="tt-tabbar-avatar" src="${photoUrl}" alt="${name}" referrerpolicy="no-referrer" width="24" height="24"><span>Cuenta</span>`;
  const img=tab.querySelector('img');
  if(img)img.onerror=()=>{tab.innerHTML=tab.dataset.ttDefaultHtml;};
 }else tab.innerHTML=tab.dataset.ttDefaultHtml;
}

function renderAccountPanel(user,role=ROLES.CLIENT,profile={}){
 const panel=document.getElementById('account-panel');
 if(!panel)return;
 if(!user){
  const loginHref=loginHrefForCurrentLocation();
  panel.innerHTML=`<div class="tt-account-guest"><p class="tt-account-guest-title">Tu cuenta Tintin</p><p class="tt-account-guest-copy">Ingresá para guardar favoritos, ver pedidos y comprar más rápido.</p></div><a class="tt-account-item tt-account-primary" href="${loginHref}">Iniciar sesión</a><a class="tt-account-item" href="${loginHref}">Crear una cuenta</a>`;
  return;
 }
 const identity=readAccountIdentity(profile,user);
 const rawName=identity.name||identity.username||user.displayName||user.email||'Mi cuenta';
 const name=escapeHtmlNav(rawName);
 const secondaryRaw=identity.username?`@${identity.username}`:(identity.email||user.email||'');
 const secondary=escapeHtmlNav(secondaryRaw);
 const photoUrl=sanitizeImageUrl(identity.photoURL||user.photoURL||'');
 const photo=photoUrl?`<img class="tt-account-panel-avatar" src="${photoUrl}" alt="${name}" referrerpolicy="no-referrer" width="44" height="44">`:`<span class="tt-account-panel-avatar tt-account-panel-initials">${initials(rawName)}</span>`;
 const adminLink=hasAdminAccess(user,role)?`<a class="tt-account-item tt-account-internal" href="/admin" data-internal-admin-link="true" data-account-role="${escapeHtmlNav(role)}">${roleLabel(role)}</a>`:'';
 panel.innerHTML=`<div class="tt-account-header">${photo}<div class="tt-account-identity"><strong>${name}</strong>${secondary?`<span>${secondary}</span>`:''}</div></div><nav class="tt-account-links" aria-label="Opciones de la cuenta">${adminLink}<a class="tt-account-item" href="/perfil">Mi cuenta</a><a class="tt-account-item" href="/perfil#mis-pedidos">Mis pedidos</a></nav><button type="button" class="tt-account-item tt-account-logout" id="account-logout-btn">Cerrar sesión</button>`;
 wireLogout(panel);
}

function wireLogout(panel){const btn=panel.querySelector('#account-logout-btn');if(btn)btn.onclick=doLogout;}

function renderProfileIdentity(user,profile){
 const avatar=document.getElementById('perfil-avatar');
 if(!avatar)return;
 const identity=readAccountIdentity(profile,user);
 const url=sanitizeImageUrl(identity.photoURL||'');
 const name=document.getElementById('perfil-nombre-display');
 if(name)name.textContent=identity.name||identity.email||'Cuenta Tintin';
 if(!url){avatar.textContent=initials(identity.name||identity.email);return;}
 if(avatar.querySelector('img')?.getAttribute('src')===url)return;
 const image=document.createElement('img');
 image.src=url;image.alt='Foto de perfil';image.referrerPolicy='no-referrer';
 image.addEventListener('error',()=>{if(image.isConnected)avatar.textContent=initials(identity.name||identity.email);},{once:true});
 avatar.replaceChildren(image);
}

// La subida propia ya fue guardada: actualiza el menú en este mismo documento.
document.addEventListener('tintin:profile-photo-updated',event=>{
 const user=getSessionUser();
 if(!user || navigationUid!==user.uid || !event.detail?.photoURL)return;
 navigationProfile={...navigationProfile,avatarURL:event.detail.photoURL};
 renderAccountButtonPhoto(user,navigationProfile);
 renderMobileTabbarPhoto(user,navigationProfile);
 renderAccountPanel(user,roleFromProfile(user,navigationProfile),navigationProfile);
 renderProfileIdentity(user,navigationProfile);
 const visual=readAccountIdentity(navigationProfile,user);
 createAuthHandoff(user.uid,{photoURL:visual.photoURL,displayName:visual.name});
});
