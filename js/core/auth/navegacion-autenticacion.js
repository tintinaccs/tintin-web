// cargador-pagina.js es el único responsable de iniciar los módulos globales de
// interfaz. auth-nav solo administra sesión y navegación de la cuenta.
import { auth } from '../firebase/firebase.js?v=tintin-20260903-app-check-singleton-1';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getUserRole, can, SUPER_ADMIN } from './roles.js?v=tintin-20260821-accounts-phase-a-1';


const IS_LOGIN_PAGE = /(^|\/)login(?:\.html)?\/?$/i.test(window.location.pathname || '');
let silentLogoutStarted = false;

function escapeHtmlNav(s){const d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}
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
 beginSilentAuthTransition();
 signOut(auth)
  .then(()=>window.location.replace('/'))
  .catch(error=>{
   console.error('[auth-nav] No se pudo cerrar sesión:',error);
   silentLogoutStarted=false;
   endSilentAuthTransition();
  });
}
function hasAdminAccess(user,role){if(!user)return false;if(user.email===SUPER_ADMIN)return true;return can(role,'viewDashboard')===true;}
function publishStaffVisibility(user,role){
 const staff=hasAdminAccess(user,role);
 document.documentElement.classList.toggle('tt-staff-session',staff);
 window.dispatchEvent(new CustomEvent('tintin:staff-visibility-ready',{detail:{staff}}));
}
function roleLabel(role){if(role==='superadmin')return 'Panel Super Admin';if(role==='admin')return 'Panel Admin';if(role==='agent')return 'Panel Agente';if(role==='viewer')return 'Panel Viewer';return 'Panel interno';}

const accountBtnDefaults=new Map();

/* Apenas se toca Google, la página de Login desaparece debajo de una superficie
   sólida. Solo vuelve a mostrarse si el popup se cierra o el ingreso falla. */
document.addEventListener('click',event=>{
 const googleButton=event.target.closest?.('#btn-google');
 if(googleButton)beginSilentAuthTransition();
 const logoutButton=event.target.closest?.('#account-logout-btn,#tablet-user-logout-btn,#btn-logout');
 if(logoutButton){
  event.preventDefault();
  event.stopImmediatePropagation();
  doLogout();
 }
},{capture:true});

window.addEventListener('tintin:login-cancelled',endSilentAuthTransition);
window.addEventListener('tintin:login-failed',endSilentAuthTransition);

onAuthStateChanged(auth,async user=>{
 // login.html es el único dueño del alta, bloqueo y destino posterior al
 // acceso. Evita dos redirecciones paralelas compitiendo por la misma sesión.
 if(IS_LOGIN_PAGE)return;
 let role='client';
 try{if(user)role=await getUserRole(user.uid,user.email);}catch(e){console.warn('[auth-nav] No se pudo leer rol:',e);}
 publishStaffVisibility(user,role);
 renderAccountButtonPhoto(user);
 renderMobileTabbarPhoto(user);
 renderAccountPanel(user,role);
 window.dispatchEvent(new CustomEvent('tintin:auth-nav-updated',{
  detail:{authenticated:Boolean(user),role}
 }));
});

function renderAccountButtonPhoto(user){
 document.querySelectorAll('[data-auth-account-button]').forEach(btn=>{
  if(!accountBtnDefaults.has(btn))accountBtnDefaults.set(btn,btn.innerHTML);
  if(user&&user.photoURL){
   const name=user.displayName||user.email||'Mi cuenta';
   const img=document.createElement('img');
   img.className='tt-account-avatar-btn';img.src=user.photoURL;img.alt=name;img.referrerPolicy='no-referrer';img.width=26;img.height=26;
   img.style.cssText='width:26px;height:26px;max-width:none;max-height:none;flex-shrink:0;border-radius:50%;object-fit:cover;display:block';
   img.onerror=()=>{btn.innerHTML=accountBtnDefaults.get(btn);};
   btn.innerHTML='';btn.appendChild(img);
  }else btn.innerHTML=accountBtnDefaults.get(btn);
 });
}

function renderMobileTabbarPhoto(user){
 const tab=document.getElementById('tabbar-cuenta');
 if(!tab)return;
 if(!tab.dataset.ttDefaultHtml)tab.dataset.ttDefaultHtml=tab.innerHTML;
 if(user&&user.photoURL){
  const name=escapeHtmlNav(user.displayName||user.email||'Mi cuenta');
  tab.innerHTML=`<img class="tt-tabbar-avatar" src="${user.photoURL}" alt="${name}" referrerpolicy="no-referrer" width="24" height="24"><span>Cuenta</span>`;
  const img=tab.querySelector('img');
  if(img)img.onerror=()=>{tab.innerHTML=tab.dataset.ttDefaultHtml;};
 }else tab.innerHTML=tab.dataset.ttDefaultHtml;
}

function renderAccountPanel(user,role='client'){
 const panel=document.getElementById('account-panel');
 if(!panel)return;
 if(!user){panel.innerHTML=`<p class="tt-account-guest-copy">Ingresá para guardar favoritos, ver pedidos y comprar más rápido.</p><a class="tt-account-item" href="/login">Iniciar sesión</a><a class="tt-account-item" href="/login">Crear una cuenta</a>`;return;}
 const name=escapeHtmlNav(user.displayName||user.email||'Mi cuenta');
 const photo=user.photoURL?`<img class="tt-account-panel-avatar" src="${user.photoURL}" alt="${name}" referrerpolicy="no-referrer" width="32" height="32">`:'';
 const adminLink=hasAdminAccess(user,role)?`<a class="tt-account-item" href="/admin" data-internal-admin-link="true">${roleLabel(role)}</a>`:'';
 panel.innerHTML=`<div class="tt-account-header">${photo}<span>${name}</span></div>${adminLink}<a class="tt-account-item" href="/perfil">Mi cuenta</a><a class="tt-account-item" href="/perfil#mis-pedidos">Mis pedidos</a><div class="tt-account-divider"></div><button type="button" class="tt-account-item tt-account-logout" id="account-logout-btn">Cerrar sesión</button>`;
 wireLogout(panel);
}

function wireLogout(panel){const btn=panel.querySelector('#account-logout-btn');if(btn)btn.onclick=doLogout;}
