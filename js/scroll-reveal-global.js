(function(){
'use strict';
if(window.TintinGlobalScrollRevealBooted)return;
window.TintinGlobalScrollRevealBooted=true;
const reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fixedExclusions='#tt-loader,#tt-intro,#tt-welcome-tutorial,.tt-header,.tt-header-mobile,.tt-tabbar,.tt-mobile-tabs,.tt-mobile-menu,.tt-cart-drawer,.tt-search-panel,.tt-collections-sheet,.tt-account-panel,.adm-overlay,.modal,.adm-modal';
const selectors=[
 'main>section','.section','.section-sm','.tt-section','.tt-page-hero','.tt-hero','.tt-trust-bar','.tt-editorial','.tt-products-section','.tt-reviews-section','.tt-footer',
 '.tt-card','.tt-product-card','.tt-coll-card','.tt-category-card','.tt-review-card','.tt-trust-item','.tt-info-block','.tt-dropdown-card','.tt-sheet-item',
 '.perfil-card','.perfil-section','.ck-panel','.ck-step','.ck-summary-card','.login-box','.login-brand','.tt-404-wrap',
 '.adm-card','.adm-section.active>.adm-card','.adm-section.active .adm-card','.adm-section.active .adm-table-wrap','.adm-section.active .tt-welcome-admin-card',
 'h1','h2','h3','.tt-section-title','.tt-section-sub','.tt-section-desc','.tt-hero-title','.tt-hero-subtitle','.tt-page-hero-title',
 '.tt-btn','.tt-btn-outline','.ck-btn','.login-google','.adm-btn','.adm-btn-primary','footer .tt-footer-col',
 // Absorbidas de js/scroll-reveal.js (retirado — dos observers separados
 // sobre los mismos elementos duplicaban trabajo y a veces animaban dos
 // veces al hacer scroll).
 '.tt-faq-item','.tt-about-img','.tt-about-content','.tt-about-text','.tt-contact-grid','.tt-page-hero-sub',
 '.tt-editorial-item','.tt-editorial-card','.ck-panel-head','.tt-checkout-suggested-grid','.tt-about-section',
 '.tt-look-card','.tt-coll-page-card','.tt-look-item','.tt-featured-item'
];
function injectStyles(){
 if(document.getElementById('tt-global-reveal-style'))return;
 const st=document.createElement('style');st.id='tt-global-reveal-style';
 st.textContent=`html.tt-reveal-ready .tt-auto-reveal{opacity:0;transform:translate3d(0,24px,0) scale(.985);filter:blur(5px);transition:opacity .72s ease,transform .72s cubic-bezier(.16,1,.3,1),filter .72s ease;transition-delay:var(--tt-r-delay,0ms);will-change:opacity,transform,filter}html.tt-reveal-ready .tt-auto-reveal.tt-visible{opacity:1!important;transform:translate3d(0,0,0) scale(1)!important;filter:blur(0)!important}.tt-auto-reveal.tt-reveal-settled{will-change:auto}.tt-reveal-left{transform:translate3d(-24px,18px,0) scale(.985)!important}.tt-reveal-right{transform:translate3d(24px,18px,0) scale(.985)!important}.tt-reveal-scale{transform:translate3d(0,18px,0) scale(.955)!important}.tt-reveal-soft{transform:translate3d(0,14px,0)!important;filter:blur(3px)!important}.tt-reveal-clip{clip-path:inset(0 0 14% 0 round 18px);transform:translate3d(0,22px,0) scale(1.01)!important}.tt-reveal-clip.tt-visible{clip-path:inset(0 0 0 0 round 0)!important}.tt-reveal-text{letter-spacing:.035em;transform:translate3d(0,18px,0)!important}.tt-reveal-text.tt-visible{letter-spacing:inherit}.tt-reveal-img{transform:translate3d(0,28px,0) scale(1.025)!important}.tt-reveal-img.tt-visible{transform:translate3d(0,0,0) scale(1)!important}.tt-premium-hover{transition:transform .28s cubic-bezier(.16,1,.3,1),box-shadow .28s ease,border-color .28s ease,background .28s ease}.tt-premium-pressed{transform:scale(.985)!important}@media(hover:hover){.tt-premium-hover:hover{transform:translateY(-4px);box-shadow:0 18px 52px rgba(212,106,138,.16)}}@media(max-width:767px){html.tt-reveal-ready .tt-auto-reveal{transform:translate3d(0,16px,0) scale(.99);filter:blur(3px);transition-duration:.56s}.tt-reveal-left,.tt-reveal-right{transform:translate3d(0,16px,0) scale(.99)!important}}@media(prefers-reduced-motion:reduce){html.tt-reveal-ready .tt-auto-reveal,.tt-auto-reveal{opacity:1!important;transform:none!important;filter:none!important;clip-path:none!important;transition:none!important;letter-spacing:inherit!important}.tt-premium-hover,.tt-premium-hover:hover{transition:none!important;transform:none!important}}`;
 document.head.appendChild(st);
}
function isVisible(el){
 if(!el||!el.isConnected)return false;
 if(el.closest(fixedExclusions))return false;
 if(el.closest('[hidden],.tt-no-reveal,.no-reveal,[data-no-reveal="true"]'))return false;
 if(el.matches('script,style,link,meta,option,br,hr,input,textarea,select,label,svg,path'))return false;
 const cs=getComputedStyle(el);
 if(cs.display==='none'||cs.visibility==='hidden')return false;
 const rect=el.getBoundingClientRect();
 if(rect.width<6||rect.height<6)return false;
 return true;
}
function variantFor(el,i){
 if(el.matches('h1,h2,h3,.tt-section-title,.tt-hero-title,.tt-page-hero-title'))return 'tt-reveal-text';
 if(el.matches('img,picture,.tt-editorial-img,.tt-watch-feature-img,.tt-card-img,.tt-coll-card-img,.login-brand'))return 'tt-reveal-img';
 if(el.matches('.tt-card,.tt-product-card,.tt-coll-card,.tt-review-card,.perfil-card,.ck-panel,.adm-card,.tt-welcome-admin-card'))return i%2?'tt-reveal-left':'tt-reveal-right';
 if(el.matches('.tt-btn,.tt-btn-outline,.ck-btn,.login-google,.adm-btn,.adm-btn-primary,.ck-step'))return 'tt-reveal-scale';
 if(el.matches('main>section,.section,.section-sm,.tt-page-hero,.tt-hero'))return 'tt-reveal-soft';
 return ['tt-reveal-soft','tt-reveal-left','tt-reveal-right','tt-reveal-scale'][i%4];
}
function addHover(el){
 if(el.matches('.tt-card,.tt-product-card,.tt-coll-card,.tt-review-card,.perfil-card,.ck-panel,.adm-card,.tt-trust-item,.tt-btn,.ck-btn,.adm-btn,.login-google'))el.classList.add('tt-premium-hover');
}
function collect(){
 const nodes=[...document.querySelectorAll(selectors.join(','))].filter(isVisible);
 nodes.forEach((el,i)=>{
  addHover(el);
  if(el.classList.contains('tt-visible')||el.classList.contains('tt-auto-reveal'))return;
  el.classList.add('tt-auto-reveal',variantFor(el,i));
  el.style.setProperty('--tt-r-delay',`${Math.min(i%7,6)*42}ms`);
 });
 return nodes.filter(el=>!el.classList.contains('tt-visible'));
}
let observer=null;
// will-change se saca recién cuando termina la transición (no apenas se
// agrega .tt-visible) para no perder la promoción a capa GPU justo en medio
// de la animación de entrada.
function revealNow(el){
 el.classList.add('tt-visible');
 el.addEventListener('transitionend',function handler(e){if(e.target===el){el.classList.add('tt-reveal-settled');el.removeEventListener('transitionend',handler);}});
}
function observe(nodes){
 if(!nodes.length)return;
 if(!('IntersectionObserver'in window)){nodes.forEach(revealNow);return;}
 if(!observer){observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(!entry.isIntersecting)return;revealNow(entry.target);observer.unobserve(entry.target);});},{rootMargin:'0px 0px -42px 0px',threshold:.08});}
 nodes.forEach(el=>observer.observe(el));
}
let scanTimer=0;
function scan(){clearTimeout(scanTimer);scanTimer=setTimeout(()=>observe(collect()),70);}
function press(){document.addEventListener('pointerdown',e=>{const b=e.target.closest('.tt-btn,.ck-btn,.adm-btn,.login-google,button,a');if(b&&!b.closest(fixedExclusions))b.classList.add('tt-premium-pressed');},{passive:true});document.addEventListener('pointerup',()=>document.querySelectorAll('.tt-premium-pressed').forEach(b=>b.classList.remove('tt-premium-pressed')),{passive:true});document.addEventListener('pointercancel',()=>document.querySelectorAll('.tt-premium-pressed').forEach(b=>b.classList.remove('tt-premium-pressed')),{passive:true});}
function boot(){
 injectStyles();
 if(reduce){document.documentElement.classList.add('tt-reveal-reduced-motion');return;}
 document.documentElement.classList.add('tt-reveal-ready');
 observe(collect());press();
 document.addEventListener('tintin:products-loaded',scan);
 document.addEventListener('tintin:page-ready',scan);
 document.addEventListener('click',e=>{if(e.target.closest('.adm-nav-item,.adm-mobile-tab,.tt-tabbar-btn,.tt-nav a,.tt-mobile-menu a'))setTimeout(scan,120);},true);
 if('MutationObserver'in window){const mo=new MutationObserver(scan);mo.observe(document.body||document.documentElement,{childList:true,subtree:true});}
 setTimeout(scan,500);setTimeout(scan,1400);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();