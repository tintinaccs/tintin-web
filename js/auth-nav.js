import './ui-quality.js?v=tintin-20260709-1';
import './store-gate.js?v=tintin-20260709-1';
import './header-dropdown-fix.js?v=tintin-20260709-1';
import './header-account-mobile-fix.js?v=tintin-20260709-1';
import './header-scroll-hide.js?v=tintin-20260709-1';
import './scroll-reveal-global.js?v=tintin-20260709-1';
import { auth } from './firebase.js?v=tintin-20260709-1';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getUserRole, can, SUPER_ADMIN } from './roles.js?v=tintin-20260709-1';

const PERSON_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
const ADMIN_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 4v5c0 5-3.4 8.7-8 9-4.6-.3-8-4-8-9V7l8-4z"/><path d="M9 12l2 2 4-4"/></svg>`;
const ORDER_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h12l2 4v16H4V6l2-4z"/><path d="M4 6h16"/><path d="M9 11h6"/><path d="M9 15h6"/></svg>`;

function escapeHtmlNav(s){const d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}
function doLogout(){signOut(auth).then(()=>{window.location.href='index.html';});}
function hasAdminAccess(user,role){if(!user)return false;if(user.email===SUPER_ADMIN)return true;return can(role,'viewDashboard')===true;}
function roleLabel(role){if(role==='superadmin')return 'Panel Super Admin';if(role==='admin')return 'Panel Admin';if(role==='agent')return 'Panel Agente';if(role==='viewer')return 'Panel Viewer';return 'Panel interno';}

const accountBtnDefaults=new Map();

onAuthStateChanged(auth,async user=>{
 document.querySelectorAll("#tabbar-cuenta,[data-auth-link='cuenta']").forEach(el=>{el.href=user?'perfil.html':'login.html';});
 let role='client';
 try{if(user)role=await getUserRole(user.uid,user.email);}catch(e){console.warn('[auth-nav] No se pudo leer rol:',e);}
 renderAccountButtonPhoto(user);
 renderMobileTabbarPhoto(user);
 renderAccountPanel(user,role);
 renderMobileUserPanel(user,role);
});

function renderAccountButtonPhoto(user){
 const btn=document.getElementById('btn-cuenta');
 if(!btn)return;
 if(!accountBtnDefaults.has(btn))accountBtnDefaults.set(btn,btn.innerHTML);
 if(user&&user.photoURL){
  const name=user.displayName||user.email||'Mi cuenta';
  const img=document.createElement('img');
  img.className='tt-account-avatar-btn';img.src=user.photoURL;img.alt=name;img.referrerPolicy='no-referrer';img.width=26;img.height=26;
  img.style.cssText='width:26px;height:26px;max-width:none;max-height:none;flex-shrink:0;border-radius:50%;object-fit:cover;display:block';
  img.onerror=()=>{btn.innerHTML=accountBtnDefaults.get(btn);};
  btn.innerHTML='';btn.appendChild(img);
 }else btn.innerHTML=accountBtnDefaults.get(btn);
}

function renderMobileTabbarPhoto(user){
 const tab=document.getElementById('tabbar-cuenta');
 if(!tab)return;
 if(!tab.dataset.ttDefaultHtml)tab.dataset.ttDefaultHtml=tab.innerHTML;
 tab.href=user?'perfil.html':'login.html';
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
 if(!user){panel.innerHTML=`<a class="tt-account-item" href="login.html">Ingresar con Google</a>`;return;}
 const name=escapeHtmlNav(user.displayName||user.email||'Mi cuenta');
 const photo=user.photoURL?`<img class="tt-account-panel-avatar" src="${user.photoURL}" alt="${name}" referrerpolicy="no-referrer" width="32" height="32">`:'';
 const adminLink=hasAdminAccess(user,role)?`<a class="tt-account-item" href="admin.html" data-internal-admin-link="true">${roleLabel(role)}</a>`:'';
 panel.innerHTML=`<div class="tt-account-header">${photo}<span>${name}</span></div>${adminLink}<a class="tt-account-item" href="perfil.html">Mi cuenta</a><a class="tt-account-item" href="perfil.html#mis-pedidos">Mis pedidos</a><div class="tt-account-divider"></div><button class="tt-account-item tt-account-logout" id="account-logout-btn">Cerrar sesión</button>`;
 wireLogout(panel);
}

function wireLogout(panel){const btn=panel.querySelector('#account-logout-btn');if(btn)btn.onclick=doLogout;}
function wireMobileLogout(panel){const btn=panel.querySelector('#mobile-user-logout-btn');if(btn)btn.onclick=doLogout;}

function renderMobileUserPanel(user,role='client'){
 const panel=document.getElementById('tt-mobile-user');
 if(!panel)return;
 if(!user){panel.innerHTML=`<a href="login.html" class="tt-mobile-user-login"><div class="tt-mobile-user-avatar">${PERSON_ICON}</div><div><div class="tt-mobile-user-name">Iniciar sesión</div><div class="tt-mobile-user-sub">Ingresá con Google, es gratis!</div></div></a>`;return;}
 const name=user.displayName||user.email||'Mi perfil';
 const firstName=escapeHtmlNav(name.split(' ')[0]);
 const avatar=user.photoURL?`<img class="tt-mobile-user-photo" src="${user.photoURL}" alt="${firstName}" referrerpolicy="no-referrer" width="40" height="40">`:PERSON_ICON;
 const adminMobile=hasAdminAccess(user,role)?`<a href="admin.html" class="tt-mobile-user-action tt-mobile-user-admin" data-internal-admin-link="true"><span class="tt-mobile-user-admin-icon">${ADMIN_ICON}</span><span>${escapeHtmlNav(roleLabel(role))}</span></a>`:'';
 panel.innerHTML=`<div class="tt-mobile-user-profile tt-mobile-user-profile-static"><div class="tt-mobile-user-avatar">${avatar}</div><div><div class="tt-mobile-user-name">${firstName}</div><div class="tt-mobile-user-sub">Cuenta activa</div></div></div><div class="tt-mobile-user-actions">${adminMobile}<a href="perfil.html" class="tt-mobile-user-action">${PERSON_ICON}<span>Mi cuenta</span></a><a href="perfil.html#mis-pedidos" class="tt-mobile-user-action">${ORDER_ICON}<span>Mis pedidos</span></a><button type="button" class="tt-mobile-user-logout" id="mobile-user-logout-btn">Cerrar sesión</button></div>`;
 wireMobileLogout(panel);
}
