(function(){
'use strict';
if(window.TintinThemeColorSanitizerBooted)return;
window.TintinThemeColorSanitizerBooted=true;
var HARD_COLORS={
 '#2b2b2b':'var(--tt-text)',
 '#7b6f72':'var(--tt-muted)',
 '#d46a8a':'var(--tt-accent)',
 '#f6b7c8':'var(--tt-accent-mid)',
 '#b84c72':'var(--tt-accent)',
 '#4caf50':'var(--tt-accent)',
 '#ffffff':'var(--tt-surface)',
 '#fff':'var(--tt-surface)',
 'rgba(43,43,43,.18)':'var(--tt-border)',
 'rgba(43, 43, 43, .18)':'var(--tt-border)',
 'rgba(255,255,255,.16)':'rgba(255,255,255,.18)'
};
function replaceHardColors(value){
 if(!value)return value;
 var out=String(value);
 Object.keys(HARD_COLORS).forEach(function(k){out=out.replace(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),HARD_COLORS[k]);});
 out=out.replace(/linear-gradient\([^)]*#2b2b2b[^)]*#7b6f72[^)]*\)/gi,'var(--tt-accent)');
 return out;
}
function sanitizeAttrs(root){
 (root||document).querySelectorAll('[stroke],[fill]').forEach(function(el){
  ['stroke','fill'].forEach(function(attr){
   var v=el.getAttribute(attr);
   if(!v||v==='none'||v==='currentColor')return;
   var next=replaceHardColors(v);
   if(next!==v){el.setAttribute(attr,'currentColor');el.classList.add('tt-themed-vector');}
  });
 });
}
function sanitizeStyles(root){
 (root||document).querySelectorAll('[style]').forEach(function(el){
  var v=el.getAttribute('style')||'';
  var next=replaceHardColors(v);
  if(next!==v){el.setAttribute('style',next);el.classList.add('tt-inline-theme-cleaned');}
 });
}
function run(root){sanitizeAttrs(root);sanitizeStyles(root)}
function boot(){
 run(document);
 if('MutationObserver'in window){var t=0;new MutationObserver(function(muts){clearTimeout(t);t=setTimeout(function(){muts.forEach(function(m){m.addedNodes&&m.addedNodes.forEach(function(n){if(n.nodeType===1)run(n);});});run(document);},80);}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['style','stroke','fill']});}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();