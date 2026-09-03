import { auth } from '../../core/firebase/firebase.js?v=tintin-20260903-auth-persistence-1';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { SUPER_ADMIN } from '../../core/auth/roles.js?v=tintin-20260821-accounts-phase-a-1';

const clone = value => JSON.parse(JSON.stringify(value));
const PAGE_OPTIONS = [
  ['index','Inicio'],['nosotros','Nosotros'],['catalogo','Catálogo'],['collections','Colecciones'],['product','Producto'],['checkout','Checkout'],
  ['login','Login'],['perfil','Perfil'],['contact','Contacto'],['envios','Envíos'],['faq','Preguntas frecuentes'],['cambios','Cambios y devoluciones'],
  ['terminos','Términos'],['privacidad','Privacidad'],['404','404'],
];
const DEVICE_OPTIONS = [['desktop','Escritorio'],['tablet','Tablet'],['mobile','Celular']];
const CAMPAIGN_PRESETS = [
  { name:'San Valentín', announcement:'Un detalle especial para regalar o regalarte 💗', effect:'hearts', background:'#f7d9e5', textColor:'#5b2339', accentColor:'#ad3f67' },
  { name:'Día de la Amistad', announcement:'Regalitos para celebrar a tu persona favorita ✨', effect:'sparkles', background:'#fbe9f0', textColor:'#5b2339', accentColor:'#ad3f67' },
  { name:'Navidad', announcement:'La temporada más linda para regalar 🎁', effect:'snow', background:'#234d3b', textColor:'#ffffff', accentColor:'#c7a24d' },
  { name:'Black Friday', announcement:'Promos especiales por tiempo limitado', effect:'confetti', background:'#161216', textColor:'#ffffff', accentColor:'#e65c95' },
  { name:'Aniversario Tintin', announcement:'Estamos de festejo ✨ Gracias por ser parte de Tintin', effect:'sparkles', background:'#ad3f67', textColor:'#ffffff', accentColor:'#f7d9e5' },
];

let config = { campaigns: [], popups: [] };
let version = 0;
let history = [];
let dirty = false;
let tab = 'campaigns';
let selectedId = '';
let installed = false;
let loading = false;

function $(id) { return document.getElementById(id); }
function make(tag, className = '', text = '') { const node=document.createElement(tag); if(className)node.className=className; if(text!=='')node.textContent=text; return node; }
function ensureCss() {
  if (document.getElementById('visual-studio-global-admin-css')) return;
  const link=document.createElement('link'); link.id='visual-studio-global-admin-css'; link.rel='stylesheet'; link.href='css/admin/visual-studio-global-admin.css?v=tintin-20260810-global-studio-3'; document.head.appendChild(link);
}
function setStatus(message, kind='') { const node=$('visual-global-status'); if(!node)return; node.textContent=message; node.className=`visual-global-status${kind?` is-${kind}`:''}`; }
function setDirty(value=true) { dirty=Boolean(value); updateActions(); window.AdminUnsaved?.notify?.(); }
function updateActions() { ['visual-global-save','visual-global-publish','visual-global-cancel'].forEach(id=>{const node=$(id);if(node)node.disabled=loading||(id!=='visual-global-cancel'&&!dirty);}); }
function isAllowedUser() { return String(auth.currentUser?.email||'').trim().toLowerCase()===SUPER_ADMIN; }
async function api(method='GET', body) {
  if (!isAllowedUser()) throw new Error('Acceso exclusivo de Super Admin.');
  const token=await auth.currentUser.getIdToken(); const response=await fetch('/api/visual-studio-global',{method,headers:{authorization:`Bearer ${token}`,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  const data=await response.json().catch(()=>({})); if(!response.ok)throw new Error(data.error||'No se pudo completar la operación.'); return data;
}
function toLocal(value) { if(!value)return''; const date=new Date(value); if(!Number.isFinite(date.getTime()))return''; return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16); }
function toIso(value) { if(!value)return''; const date=new Date(value); return Number.isFinite(date.getTime())?date.toISOString():''; }
function input(value='', type='text') { const node=document.createElement('input'); node.className='adm-input'; node.type=type; node.value=value??''; return node; }
function textarea(value='') { const node=document.createElement('textarea'); node.className='adm-input'; node.value=value??''; return node; }
function select(value, options) { const node=make('select','adm-select'); options.forEach(([key,label])=>{const opt=make('option','',label);opt.value=key;node.appendChild(opt);});node.value=value;return node; }
function field(label, control, full=false, help='') { const wrap=make('div',`visual-global-field${full?' full':''}`);wrap.append(make('label','',label),control);if(help)wrap.appendChild(make('small','',help));return wrap; }
function bind(control, setter, eventName='input') { control.addEventListener(eventName,()=>{setter(control.type==='checkbox'?control.checked:control.value);setDirty();renderSidebarList();});return control; }
function colorField(label, object, key) { const row=make('div','visual-global-color');const picker=input(object[key]||'#ffffff','color');const text=input(object[key]||'');text.placeholder='Color original';picker.addEventListener('input',()=>{object[key]=picker.value;text.value=picker.value;setDirty();});text.addEventListener('change',()=>{object[key]=text.value.trim();if(/^#[0-9a-f]{6}$/i.test(object[key]))picker.value=object[key];setDirty();});row.append(picker,text);return field(label,row); }
function checksField(label, options, selected, onChange, allLabel='Todo el sitio') {
  const wrap=make('div','visual-global-checks');
  if(allLabel){const chip=make('label','visual-global-check');const box=input('','checkbox');box.checked=selected.includes('*');box.addEventListener('change',()=>{onChange(box.checked?['*']:[]);setDirty();renderEditor();});chip.append(box,document.createTextNode(allLabel));wrap.appendChild(chip);}
  options.forEach(([key,text])=>{const chip=make('label','visual-global-check');const box=input('','checkbox');box.checked=selected.includes('*')||selected.includes(key);box.disabled=selected.includes('*');box.addEventListener('change',()=>{const next=new Set((selected.includes('*')?[]:selected));box.checked?next.add(key):next.delete(key);onChange([...next]);setDirty();});chip.append(box,document.createTextNode(text));wrap.appendChild(chip);});
  return field(label,wrap,true);
}

function defaultCampaign(preset={}) { return { id:`campaign-${crypto.randomUUID().slice(0,8)}`,name:preset.name||'Nueva campaña',enabled:false,priority:50,startAt:'',endAt:'',effect:preset.effect||'none',intensity:'medium',announcement:preset.announcement||'',href:'',closable:true,background:preset.background||'',textColor:preset.textColor||'',accentColor:preset.accentColor||'' }; }
function defaultPopup() { return { id:`popup-${crypto.randomUUID().slice(0,8)}`,name:'Nuevo pop-up',enabled:false,priority:50,kind:'center',title:'',text:'',image:'',imageAlt:'',buttonLabel:'Ver más',href:'catalogo.html',trigger:'delay',triggerValue:3,frequency:'session',pages:['*'],devices:['desktop','tablet','mobile'],productIds:[],categories:[],startAt:'',endAt:'',background:'',textColor:'',accentColor:'',animation:'fade' }; }
function currentList() { return tab==='campaigns'?config.campaigns:tab==='popups'?config.popups:[]; }
function selectedItem() { return currentList().find(item=>item.id===selectedId)||null; }

function installLauncher() {
  if(installed)return true; const brand=document.querySelector('#visual-editor .visual-studio-brand'); if(!brand)return false; ensureCss(); installed=true;
  const button=make('button','visual-global-launcher');button.type='button';const icon=make('span','');icon.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z"/></svg>';const text=make('span');text.append(make('strong','','Campañas y pop-ups'),make('small','','Temporadas, efectos y avisos globales'));button.append(icon,text);button.addEventListener('click',openStudio);brand.after(button);
  buildOverlay(); window.AdminUnsaved?.register?.('visual-studio-global',{hasChanges:()=>dirty,message:'CAMBIOS SIN PUBLICAR en campañas y pop-ups.'}); return true;
}
function buildOverlay() {
  if($('visual-global-overlay'))return; const overlay=make('div','visual-global-overlay');overlay.id='visual-global-overlay';overlay.hidden=true;
  const top=make('div','visual-global-topbar');const back=make('button','adm-btn adm-btn-outline adm-btn-sm','← Volver a páginas');back.type='button';back.addEventListener('click',closeStudio);const title=make('div','visual-global-topbar-title');title.append(make('strong','','Centro de campañas'),make('small','','Cambios temporales globales sin tocar el diseño base'));const status=make('div','visual-global-status','');status.id='visual-global-status';const save=make('button','adm-btn adm-btn-outline adm-btn-sm','Guardar borrador');save.id='visual-global-save';save.type='button';save.addEventListener('click',saveDraft);const cancel=make('button','adm-btn adm-btn-outline adm-btn-sm','Descartar');cancel.id='visual-global-cancel';cancel.type='button';cancel.addEventListener('click',cancelDraft);const publish=make('button','adm-btn adm-btn-primary adm-btn-sm','Publicar');publish.id='visual-global-publish';publish.type='button';publish.addEventListener('click',publishConfig);top.append(back,title,status,save,cancel,publish);
  const body=make('div','visual-global-body');const side=make('aside','visual-global-sidebar');const tabs=make('div','visual-global-tabs');[['campaigns','Campañas'],['popups','Pop-ups'],['history','Historial']].forEach(([id,label])=>{const b=make('button','visual-global-tab',label);b.type='button';b.dataset.globalTab=id;b.addEventListener('click',()=>{tab=id;selectedId='';renderAll();});tabs.appendChild(b);});const list=make('div','visual-global-list');list.id='visual-global-list';side.append(tabs,list);const main=make('main','visual-global-main');const panel=make('div','visual-global-panel');panel.id='visual-global-panel';main.appendChild(panel);body.append(side,main);overlay.append(top,body);document.body.appendChild(overlay);updateActions();
}
async function openStudio() { if(!isAllowedUser())return; $('visual-global-overlay').hidden=false;document.documentElement.style.overflow='hidden';await load(); }
function closeStudio() { $('visual-global-overlay').hidden=true;document.documentElement.style.overflow=''; }
async function load() { loading=true;updateActions();setStatus('Cargando…');try{const data=await api();version=Number(data.state?.version||0);history=data.history||[];config=clone(data.draft?.config||data.state?.config||{campaigns:[],popups:[]});config.campaigns=Array.isArray(config.campaigns)?config.campaigns:[];config.popups=Array.isArray(config.popups)?config.popups:[];dirty=Boolean(data.draft);selectedId=currentList()[0]?.id||'';renderAll();setStatus(data.draft?'Borrador recuperado. La tienda pública sigue igual.':`Versión ${version} lista.`,'saved');}catch(error){setStatus(error.message,'error');}finally{loading=false;updateActions();}}
function renderAll() { document.querySelectorAll('[data-global-tab]').forEach(node=>node.classList.toggle('active',node.dataset.globalTab===tab));renderSidebarList();renderEditor();updateActions(); }
function renderSidebarList() { const root=$('visual-global-list');if(!root)return;root.replaceChildren();if(tab==='history'){root.appendChild(make('div','visual-global-empty','Las versiones publicadas aparecen a la derecha.'));return;}currentList().forEach(item=>{const b=make('button',`visual-global-item${item.id===selectedId?' active':''}`);b.type='button';b.append(make('strong','',item.name||item.id),make('small','',`${item.enabled?'Activo':'Inactivo'} · prioridad ${item.priority??50}`));b.addEventListener('click',()=>{selectedId=item.id;renderAll();});root.appendChild(b);});const add=make('button','visual-global-add',tab==='campaigns'?'+ Nueva campaña':'+ Nuevo pop-up');add.type='button';add.addEventListener('click',()=>{const item=tab==='campaigns'?defaultCampaign():defaultPopup();currentList().push(item);selectedId=item.id;setDirty();renderAll();});root.appendChild(add); }
function panelHead(title,desc) { const head=make('div','visual-global-panel-head');const text=make('div');text.append(make('h2','',title),make('p','',desc));head.appendChild(text);return head; }
function renderEditor() { const root=$('visual-global-panel');if(!root)return;root.replaceChildren();if(tab==='history'){renderHistory(root);return;}if(tab==='campaigns')renderCampaignEditor(root);else renderPopupEditor(root); }
function renderCampaignEditor(root) {
  root.appendChild(panelHead('Campañas','Controlá temporadas, barras de anuncio y efectos decorativos. Si coinciden varias campañas activas, gana la de mayor prioridad.'));
  const presets=make('div','visual-global-presets');CAMPAIGN_PRESETS.forEach(preset=>{const b=make('button','visual-global-preset');b.type='button';b.append(make('strong','',preset.name),make('small','','Crear una base editable'));b.addEventListener('click',()=>{const item=defaultCampaign(preset);config.campaigns.push(item);selectedId=item.id;setDirty();renderAll();});presets.appendChild(b);});root.appendChild(presets);
  const item=selectedItem();if(!item){root.appendChild(make('div','visual-global-empty','Creá una campaña o elegí una existente.'));return;}const form=make('div','visual-global-form');
  const enabled=input('','checkbox');enabled.checked=Boolean(item.enabled);bind(enabled,v=>item.enabled=v,'change');form.append(field('Campaña activa',enabled));
  form.append(field('Nombre interno',bind(input(item.name),v=>item.name=v),true),field('Prioridad',bind(input(item.priority??50,'number'),v=>item.priority=Math.max(0,Math.min(100,Number(v)||0)),'change'),false,'0 a 100. Si dos campañas coinciden, gana la más alta.'));
  const start=input(toLocal(item.startAt),'datetime-local');bind(start,v=>item.startAt=toIso(v),'change');const end=input(toLocal(item.endAt),'datetime-local');bind(end,v=>item.endAt=toIso(v),'change');form.append(field('Empieza',start),field('Termina',end));
  form.append(field('Barra de anuncio',bind(textarea(item.announcement),v=>item.announcement=v),true),field('Enlace',bind(input(item.href,'url'),v=>item.href=v),true,'Opcional. Si lo dejás vacío, el aviso se muestra sin enlace.'));
  const closable=input('','checkbox');closable.checked=item.closable!==false;bind(closable,v=>item.closable=v,'change');form.append(field('La clienta puede cerrar la barra',closable));
  form.append(field('Efecto',bind(select(item.effect,[['none','Sin efecto'],['hearts','Corazones'],['snow','Nieve'],['sparkles','Destellos'],['confetti','Confetti']]),v=>item.effect=v,'change')),field('Intensidad',bind(select(item.intensity,[['low','Baja'],['medium','Media'],['high','Alta']]),v=>item.intensity=v,'change')));
  form.append(colorField('Fondo',item,'background'),colorField('Texto',item,'textColor'),colorField('Acento',item,'accentColor'));root.appendChild(form);appendDelete(root,'campaigns',item.id);
}
function renderPopupEditor(root) {
  root.appendChild(panelHead('Pop-ups','Los pop-ups se pueden segmentar por página, dispositivo, producto y categoría. En una visita se muestra solamente el elegible de mayor prioridad para evitar apilar avisos.'));
  const item=selectedItem();if(!item){root.appendChild(make('div','visual-global-empty','Creá un pop-up o elegí uno existente.'));return;}const form=make('div','visual-global-form');
  const enabled=input('','checkbox');enabled.checked=Boolean(item.enabled);bind(enabled,v=>item.enabled=v,'change');form.append(field('Pop-up activo',enabled));form.append(field('Nombre interno',bind(input(item.name),v=>item.name=v),true),field('Prioridad',bind(input(item.priority??50,'number'),v=>item.priority=Math.max(0,Math.min(100,Number(v)||0)),'change')));
  form.append(field('Formato',bind(select(item.kind,[['center','Modal central'],['bottom-sheet','Bottom sheet'],['top-bar','Barra superior'],['bottom-bar','Barra inferior'],['floating','Tarjeta flotante']]),v=>item.kind=v,'change')),field('Animación',bind(select(item.animation,[['fade','Fade'],['slide-up','Subir'],['slide-down','Bajar'],['zoom','Zoom'],['pop','Pop']]),v=>item.animation=v,'change')));
  form.append(field('Título',bind(input(item.title),v=>item.title=v),true),field('Texto',bind(textarea(item.text),v=>item.text=v),true),field('Imagen',bind(input(item.image,'url'),v=>item.image=v),true),field('Descripción de imagen',bind(input(item.imageAlt),v=>item.imageAlt=v),true),field('Texto del botón',bind(input(item.buttonLabel),v=>item.buttonLabel=v)),field('Destino',bind(input(item.href,'url'),v=>item.href=v)));
  form.append(field('Activación',bind(select(item.trigger,[['immediate','Al entrar'],['delay','Después de unos segundos'],['scroll','Al avanzar en la página'],['exit','Intención de salida en escritorio']]),v=>{item.trigger=v;renderEditor();},'change')));
  if(['delay','scroll'].includes(item.trigger)){const type=item.trigger==='delay'?'number':'number';form.append(field(item.trigger==='delay'?'Segundos':'Porcentaje de scroll',bind(input(item.triggerValue??(item.trigger==='delay'?3:40),type),v=>item.triggerValue=Number(v)||0,'change')));}
  form.append(field('Frecuencia',bind(select(item.frequency,[['always','Siempre'],['session','Una vez por sesión'],['daily','Una vez por día'],['once','Una sola vez']]),v=>item.frequency=v,'change')));
  form.append(checksField('Páginas',PAGE_OPTIONS,item.pages||['*'],value=>item.pages=value));form.append(checksField('Dispositivos',DEVICE_OPTIONS,item.devices||['desktop','tablet','mobile'],value=>item.devices=value,''));
  form.append(field('IDs de producto específicos',bind(input((item.productIds||[]).join(', ')),v=>item.productIds=v.split(',').map(x=>x.trim()).filter(Boolean)),true,'Opcional. Solo se usa en página de producto.'),field('Categorías específicas',bind(input((item.categories||[]).join(', ')),v=>item.categories=v.split(',').map(x=>x.trim()).filter(Boolean)),true,'Opcional. Sirve para catálogo o colecciones filtradas.'));
  const start=input(toLocal(item.startAt),'datetime-local');bind(start,v=>item.startAt=toIso(v),'change');const end=input(toLocal(item.endAt),'datetime-local');bind(end,v=>item.endAt=toIso(v),'change');form.append(field('Empieza',start),field('Termina',end));form.append(colorField('Fondo',item,'background'),colorField('Texto',item,'textColor'),colorField('Acento',item,'accentColor'));root.appendChild(form);appendDelete(root,'popups',item.id);
}
function appendDelete(root,kind,id){const zone=make('div','visual-global-danger');const b=make('button','adm-btn adm-btn-danger adm-btn-sm',kind==='campaigns'?'Eliminar campaña':'Eliminar pop-up');b.type='button';b.addEventListener('click',()=>{if(!confirm('¿Eliminar este elemento del borrador?'))return;config[kind]=config[kind].filter(item=>item.id!==id);selectedId=config[kind][0]?.id||'';setDirty();renderAll();});zone.appendChild(b);root.appendChild(zone);}
function renderHistory(root){root.appendChild(panelHead('Historial','Cada publicación y restauración conserva una versión recuperable.'));const list=make('div','visual-global-history');if(!history.length){list.appendChild(make('div','visual-global-empty','Todavía no hay versiones globales publicadas.'));root.appendChild(list);return;}history.forEach(item=>{const row=make('div','visual-global-history-row');const info=make('div');info.append(make('strong','',`Versión ${item.version} · ${item.action==='restore'?'restauración':'publicación'}`),make('small','',`${item.actorEmail||''} · ${new Date(item.createdAt).toLocaleString('es-PY')}`));row.appendChild(info);if(['publish','restore'].includes(item.action)){const b=make('button','adm-btn adm-btn-outline adm-btn-sm','Restaurar');b.type='button';b.addEventListener('click',()=>restoreVersion(item.id));row.appendChild(b);}list.appendChild(row);});root.appendChild(list);}
async function saveDraft(){loading=true;updateActions();try{const data=await api('POST',{action:'save',config});config=clone(data.draft?.config||config);dirty=false;setStatus('Borrador guardado. No se publicó nada.','saved');renderAll();return true;}catch(error){setStatus(error.message,'error');return false;}finally{loading=false;updateActions();}}
async function publishConfig(){if(!confirm(`Se publicarán ${config.campaigns.length} campañas y ${config.popups.length} pop-ups como una nueva versión global. ¿Continuar?`))return;loading=true;updateActions();try{const data=await api('POST',{action:'publish',config,expectedVersion:version});version=Number(data.version||version+1);dirty=false;await load();setStatus(`Versión ${version} publicada correctamente.`,'saved');}catch(error){setStatus(error.message,'error');}finally{loading=false;updateActions();}}
async function cancelDraft(){if(dirty&&!confirm('¿Descartar los cambios globales y volver a la última versión publicada?'))return;loading=true;updateActions();try{await api('POST',{action:'cancel'});dirty=false;await load();setStatus('Borrador descartado.','saved');}catch(error){setStatus(error.message,'error');}finally{loading=false;updateActions();}}
async function restoreVersion(historyId){if(!confirm('Esta versión se publicará de nuevo como una versión nueva. ¿Restaurar?'))return;loading=true;updateActions();try{await api('POST',{action:'restore',historyId,expectedVersion:version});dirty=false;await load();setStatus('Versión restaurada.','saved');}catch(error){setStatus(error.message,'error');}finally{loading=false;updateActions();}}

function waitForStudio(){if(installLauncher())return;const observer=new MutationObserver(()=>{if(installLauncher())observer.disconnect();});observer.observe(document.documentElement,{subtree:true,childList:true});}
onAuthStateChanged(auth,user=>{if(String(user?.email||'').trim().toLowerCase()===SUPER_ADMIN)waitForStudio();});
