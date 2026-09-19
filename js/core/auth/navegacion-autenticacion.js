// cargador-pagina.js es el único responsable de iniciar los módulos globales de
// interfaz. auth-nav solo administra sesión y navegación de la cuenta.
import { auth, db } from '../firebase/firebase.js?v=tintin-20260919-auth-persistence-authoritative-restore-1';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { AUTH_STATES, subscribeSession, getSessionUser, markExplicitLogout } from './coordinador-sesion.js?v=tintin-20260919-auth-persistence-authoritative-restore-1';
import { recordAuthDiagnostic } from './diagnostico-sesion.js?v=tintin-20260918-auth-diagnostics-1';
import { ROLES, can, SUPER_ADMIN } from './roles.js?v=tintin-20260916-final-polish-2-auth-persistence-20260919-1';
import { sanitizeImageUrl } from '../../components/images/utilidades-imagenes.js?v=tintin-20260716-cloudinary-fix-1';
import { readAccountIdentity } from '../../pages/profile/estado-canonico-perfil.mjs';

const IS_LOGIN_PAGE = /(^|\/)login(?:\.html)?\/?$/i.test(window.location.pathname || '');
let silentLogoutStarted = false;
let authRenderGeneration = 0;
let authReadyDiagnosticRecorded = false;
let coordinatorReadyDiagnosticRecorded = false;

if (!IS_LOGIN_PAGE) document.documentElement.classList.add('tt-auth-restoring');
if (!IS_LOGIN_PAGE) recordAuthDiagnostic('AUTH_RESTORE_START', { source: 'public-auth-navigation' });

function escapeHtmlNav(s){const d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}
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
 markExplicitLogout();
 beginSilentAuthTransition();
 signOut(auth)
  .then(()=>window.location.replace('/'))
  .catch(error=>{
   console.error('[auth-nav] No se pudo cerrar sesión:',error);
   silentLogoutStarted=false;
   endSilentAuthTransition();
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

async function readNavigationProfile(user){
 if(!user?.uid)return {};
 try{
  const snap=await getDoc(doc(db,'users',user.uid));
  return snap.exists()?snap.data():{};
 }catch(error){
  console.warn('[auth-nav] No se pudo leer el perfil de la cuenta:',error?.code||error);
  return {};
 }
}

const accountBtnDefaults=new Map();

/* Apenas se toca Google, la página de Login desaparece debajo de una superficie
   sólida. Solo vuelve a mostrarse si el popup se cierra o el ingreso falla. */
document.addEventListener('click',event=>{
 const googleButton=event.target.closest?.('#btn-google');
 if(googleButton)beginSilentAuthTransition();
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
 if(IS_LOGIN_PAGE)return;
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
 const generation=++authRenderGeneration;
 let role=ROLES.CLIENT;
 let profile={};
 try{
  if(user){
   // Una sola lectura de users/{uid} resuelve simultáneamente identidad y rol.
   // El correo autenticado sigue siendo la única elevación a Super Admin.
   profile=await readNavigationProfile(user);
   role=roleFromProfile(user,profile);
  }
 }catch(error){
  console.warn('[auth-nav] No se pudo resolver la cuenta completa:',error);
 }
 if(generation!==authRenderGeneration)return;
 const activeUid=getSessionUser()?.uid||null;
 if(activeUid!==(user?.uid||null))return;
 publishStaffVisibility(user,role);
 renderAccountButtonPhoto(user,profile);
 renderMobileTabbarPhoto(user,profile);
 renderAccountPanel(user,role,profile);
 window.dispatchEvent(new CustomEvent('tintin:auth-nav-updated',{
  detail:{authenticated:Boolean(user),role}
 }));
});

function renderAccountButtonPhoto(user,profile={}){
 const identity=readAccountIdentity(profile,user||{});
 document.querySelectorAll('[data-auth-account-button]').forEach(btn=>{
  if(!accountBtnDefaults.has(btn))accountBtnDefaults.set(btn,btn.innerHTML);
  const photoUrl=sanitizeImageUrl(identity.photoURL||user?.photoURL||'');
  if(user&&photoUrl){
   const name=identity.name||identity.username||user.displayName||user.email||'Mi cuenta';
   const img=document.createElement('img');
   img.className='tt-account-avatar-btn';img.src=photoUrl;img.alt=name;img.referrerPolicy='no-referrer';img.width=26;img.height=26;
   img.style.cssText='width:26px;height:26px;max-width:none;max-height:none;flex-shrink:0;border-radius:50%;object-fit:cover;display:block';
   img.onerror=()=>{btn.innerHTML=accountBtnDefaults.get(btn);};
   btn.innerHTML='';btn.appendChild(img);
  }else btn.innerHTML=accountBtnDefaults.get(btn);
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
