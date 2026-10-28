// Progreso editorial privado. La publicación continúa en prodGuardar/CAS.
export function mountProductWorkspace({card,uid,key,productId,source,request,serialize,flushMedia,restore,commit,close,privateAllowed=false,debounceMs=1800}){
  let destroyed=false,loading=true,revision=0,baseExpected='',conflict=false,lastSaved='',pending=null,operation=null,timer=null,retries=0,applying=false,missingUploads=false,mediaProblem=false,hasWork=false,publishing=false,openedSignature='',exitAction=null,failedSignature=null,retryPublish=false;
  const signal=new AbortController();const storageKey='tt-product-work:'+uid+':'+key;
  // Evita pisar lo tecleado mientras llega una recuperación remota.
  const locked=[...card.querySelectorAll('input,textarea,select,button')].filter(input=>!input.disabled);
  for(const input of locked)input.disabled=true;
  function unlock(){for(const input of locked)if(input.isConnected)input.disabled=false;}
  const pendingFiles=value=>Array.isArray(value)?value.some(pendingFiles):typeof value==='string'?Boolean(value):typeof value==='number' && value>0;
  const clone=()=>{const value=JSON.parse(JSON.stringify(serialize()));if(!privateAllowed)for(const key of ['costUnit','purchased','stockMinimum','internalNotes'])delete value[key];value.pendingUploads=missingUploads || mediaProblem || value.pendingPhotos?.some(([,signature])=>pendingFiles(signature)) || pendingFiles(value.pendingColorPhotos);if(value.commercialDraft)value.commercialDraft=Object.fromEntries(['variantCommerceVersion','variants','variantInventory','stock','price','priceBefore'].filter(key=>value.commercialDraft[key]!==undefined).map(key=>[key,value.commercialDraft[key]]));return value;};
  const signature=()=>JSON.stringify(clone());
  const node=(tag,text)=>{const element=document.createElement(tag);if(text)element.textContent=text;return element;};
  const head=card.querySelector('.adm-card-head');
  const originalCancel=card.querySelector('button[onclick="prodCancelForm()"]'),cancelWasHidden=originalCancel?.hidden;if(originalCancel)originalCancel.hidden=true;
  const back=node('button','Cancelar');back.type='button';back.className='adm-btn adm-btn-outline tt-work-back';head.prepend(back);
  const feedback=node('div');feedback.className='tt-work-feedback';head.append(feedback);
  const status=node('p');status.id='tt-product-work-status';status.className='tt-work-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');feedback.append(status);
  const retry=node('button','Reintentar');retry.type='button';retry.className='adm-btn adm-btn-outline';retry.hidden=true;retry.setAttribute('aria-describedby',status.id);feedback.append(retry);
  const errors=node('div');errors.className='tt-work-exit-error';errors.hidden=true;
  const explanation=node('p','No se pudo guardar todo el progreso. Podés reintentar, permanecer o descartar sólo los cambios pendientes. El último progreso del servidor se conserva.');
  const stay=node('button','Permanecer'),discardPending=node('button','Descartar cambios pendientes y volver');
  for(const button of [stay,discardPending]){button.type='button';button.className='adm-btn adm-btn-outline';}errors.append(explanation,stay,discardPending);card.querySelector('.adm-card-body').prepend(errors);
  const secondary=node('details');secondary.className='tt-work-secondary';secondary.append(node('summary','Más acciones del borrador'));
  const discard=node('button','Descartar progreso guardado');discard.type='button';discard.className='adm-btn adm-btn-outline';secondary.append(discard);errors.after(secondary);
  const acknowledge=node('button','Continuar sin las fotos pendientes');acknowledge.type='button';acknowledge.className='adm-btn adm-btn-outline';acknowledge.hidden=true;errors.append(acknowledge);
  const actual=source?.active===false && (!source.publicationStatus || source.publicationStatus==='active')?'inactive':source?.publicationStatus || (source?'active':'draft');
  card.dataset.productPublicState=actual;card.classList.add('tt-editor-workspace');document.documentElement.classList.add('tt-product-workspace-active');
  const message=(text,error=false,state='idle')=>{if(destroyed)return;if(status.textContent!==text)status.textContent=text;feedback.dataset.state=error?'error':state;status.dataset.error=String(error);status.dataset.state=error?'error':state;retry.hidden=!error;};
  function label(){
    const selected=card.querySelector('#prod-publicationStatus')?.value;
    const save=card.querySelector('#prod-save-btn');if(!save)return;
    const text=selected==='archived'?'Archivar':'Guardar cambios';
    if(!applying && save.textContent!==text)save.textContent=text;
  }
  function backup(){try{sessionStorage.setItem(storageKey,JSON.stringify({snapshot:clone(),revision,baseExpected,time:Date.now()}));}catch{} }
  function clearBackup(){try{sessionStorage.removeItem(storageKey);}catch{}}
  function reportError(error){if(destroyed)return;failedSignature=signature();message(error.name==='TimeoutError' || error.name==='AbortError'?'El servidor tardó demasiado. No se confirmó el guardado; reintentá sin cerrar el editor.':error.message,true);backup();}
  function dirty(){return signature()!==lastSaved;}
  function schedule(){if(destroyed || loading || applying)return;if(status.dataset.state==='error' && signature()===failedSignature)return;label();if(!dirty() && !operation && !pending)return;backup();message('Cambios pendientes · la versión pública no se modifica.',false,'pending');clearTimeout(timer);timer=setTimeout(()=>void save().catch(()=>{}),debounceMs);}
  async function send(body){const response=await request(body);if(!response.ok || !response.result){const error=Object.assign(new Error(response.error || 'No se pudo guardar el progreso.'),{status:response.status});throw error;}return response.result;}
  let ready=(async()=>{
    try{
      const result=await send({action:'readProductWork',key});if(destroyed)return;
      revision=result.revision;baseExpected=result.work?.baseExpected || result.sourceExpected;conflict=result.conflict;hasWork=Boolean(result.work);
      if(result.work){await restore(result.work.snapshot,{conflict,key});missingUploads=result.work.snapshot.pendingUploads===true;acknowledge.hidden=!missingUploads;}
      lastSaved=signature();
      let local=null;try{local=JSON.parse(sessionStorage.getItem(storageKey));}catch{}
      if(local && local.revision===revision && local.baseExpected===baseExpected && local.time>Date.parse(result.work?.updatedAt || 0)){await restore(local.snapshot,{conflict,key});missingUploads=local.snapshot.pendingUploads===true;acknowledge.hidden=!missingUploads;}
      openedSignature=signature();loading=false;unlock();label();
      if(missingUploads){message('Texto recuperado; faltan archivos que no terminaron de subir. Volvé a elegirlos o confirmá continuar sin esas fotos.',true);errors.hidden=false;}
      else if(dirty())schedule();else {window.AdminUnsaved?.markClean('primary-editor');message(conflict?'Progreso privado recuperado. La versión publicada cambió: conciliá antes de aplicar.':result.work?'Progreso privado recuperado del servidor.':actual==='active'?'Versión pública activa. El progreso se guarda por separado.':'Nuevo trabajo privado · todavía no publicado.');}
    }catch(error){loading=false;unlock();message('No se pudo recuperar el progreso: '+error.message,true);throw error;}
  })();
  void ready.catch(()=>{});
  async function save(){
    clearTimeout(timer);
    try{await ready;}catch(error){const result=await send({action:'readProductWork',key});if(result.work)throw Object.assign(new Error('Hay progreso guardado. Reabrí el editor para recuperarlo sin sobrescribirlo.'),{status:409});revision=result.revision;baseExpected=result.sourceExpected;ready=Promise.resolve();}
    if(destroyed)throw Error('El editor cambió.');
    if(operation)return operation;
    operation=(async()=>{
      let mediaError=null;try{await flushMedia();mediaProblem=false;}catch(error){mediaError=error;mediaProblem=true;}
      if(missingUploads)mediaError=new Error('Volvé a elegir las fotos pendientes o confirmá continuar sin ellas.');
      if(destroyed)throw Error('El editor cambió durante la carga.');
      for(let attempt=0;attempt<3;attempt++){
        const snapshot=clone(),current=JSON.stringify(snapshot);backup();
        if(!pending && current===lastSaved && hasWork)break;
        if(!pending)pending={action:'saveProductWork',key,expectedRevision:revision,baseExpected,changeId:crypto.randomUUID(),snapshot,signature:current};
        message('Guardando borrador…',false,'saving');
        const {signature:sent,...body}=pending;const result=await send(body);
        if(destroyed)return;revision=result.revision;conflict=result.conflict;lastSaved=sent;pending=null;retries=0;hasWork=true;
        if(signature()===sent)break;
      }
      if(mediaError)throw Object.assign(new Error('Texto guardado en servidor; quedan fotos pendientes: '+mediaError.message),{status:mediaError.status});
      if(!dirty()){clearBackup();window.AdminUnsaved?.markClean('primary-editor');message(conflict?'Progreso guardado. La versión pública cambió; reabrí y conciliá antes de aplicar.':'Borrador guardado en servidor · '+new Date().toLocaleTimeString(),false,'saved');window.dispatchEvent(new CustomEvent('tintin:product-work-saved'));}
      else {message('Hay cambios nuevos pendientes.');schedule();}
      return !dirty();
    })().catch(error=>{reportError(error);if(!destroyed && ![403,409,422].includes(error.status) && retries<3){timer=setTimeout(()=>void save().catch(()=>{}),[2000,5000,15000][retries++]);}throw error;}).finally(()=>{operation=null;});
    return operation;
  }
  let exitBusy=false;
  const exit=node('dialog');exit.className='tt-work-exit-dialog';
  const exitTitle=node('h3','¿Salir del editor?');exitTitle.id='tt-work-exit-title';exit.setAttribute('aria-labelledby',exitTitle.id);
  const exitHint=node('p','Hay cambios en esta edición. Podés conservarlos como borrador privado antes de salir.');
  const exitError=node('p');exitError.setAttribute('role','alert');
  const exitButtons=node('div');exitButtons.className='tt-work-exit-actions';
  const saveExit=node('button','Guardar borrador y salir'),keepEditing=node('button','Seguir editando'),discardExit=node('button','Descartar cambios y salir');
  for(const control of [saveExit,keepEditing,discardExit]){control.type='button';control.className='adm-btn adm-btn-outline';exitButtons.append(control);}
  discardExit.classList.add('tt-work-discard');exit.append(exitTitle,exitHint,exitError,exitButtons);card.append(exit);
  function finishExit(){const next=exitAction;exitAction=null;exit.close();close();if(typeof next==='function')next();}
  async function leave(next){
    if(publishing){message('Terminando el guardado. Esperá su confirmación.');return;}
    try{await ready;}catch{errors.hidden=false;return;}
    if(destroyed)return;
    if(signature()===openedSignature && !dirty() && !pending && !operation && !missingUploads){close();if(typeof next==='function')next();return;}
    exitAction=next;exitError.textContent='';if(!exit.open)exit.showModal();keepEditing.focus();
  }
  keepEditing.addEventListener('click',()=>{if(exitBusy)return;exitAction=null;exit.close();back.focus();});
  exit.addEventListener('cancel',event=>{if(exitBusy){event.preventDefault();return;}exitAction=null;});
  saveExit.addEventListener('click',async()=>{
    if(exitBusy)return;exitBusy=true;saveExit.disabled=keepEditing.disabled=discardExit.disabled=true;
    try{if(!await save())throw Error('Quedan cambios pendientes.');finishExit();}
    catch(error){exitError.textContent='No se confirmó el borrador completo: '+error.message;errors.hidden=false;}
    finally{exitBusy=false;saveExit.disabled=keepEditing.disabled=discardExit.disabled=false;}
  });
  discardExit.addEventListener('click',async()=>{
    if(exitBusy)return;exitBusy=true;saveExit.disabled=keepEditing.disabled=discardExit.disabled=true;clearTimeout(timer);
    try{if(operation)await operation;if(hasWork)await send({action:'discardProductWork',key,expectedRevision:revision,baseExpected,changeId:crypto.randomUUID()});clearBackup();window.AdminUnsaved?.markClean('primary-editor');window.dispatchEvent(new CustomEvent('tintin:product-work-saved'));finishExit();}
    catch(error){exitError.textContent='No se pudo descartar el borrador: '+error.message;}
    finally{exitBusy=false;saveExit.disabled=keepEditing.disabled=discardExit.disabled=false;}
  });
  async function publish(){
    if(publishing || destroyed)return false;
    publishing=true;retryPublish=false;back.disabled=true;discard.disabled=true;
    let frozen=[];
    try{
      await ready;await save();if(conflict) {message('La versión pública cambió. Reabrí y conciliá el progreso antes de aplicar.',true);return false;}
      if(dirty() || destroyed)return false;
      const select=card.querySelector('#prod-publicationStatus');
      if(select?.value==='draft'){close();return true;}
      if(dirty() || destroyed)return false;
      applying=true;clearTimeout(timer);
      frozen=[...card.querySelectorAll('input,textarea,select,button')].filter(control=>!control.disabled && control.id!=='prod-save-btn');
      for(const control of frozen)control.disabled=true;
      retryPublish=true;
      const result=await commit();
      if(result===false){
        const error=card.querySelector('#prod-form-error');
        const contextual=error?.textContent && error.dataset.errorScope!=='operation';
        reportError(new Error(contextual?'No se aplicaron los cambios. Revisá el campo indicado.':error?.textContent || 'No se confirmó el guardado oficial. Reintentá sin cerrar el editor.'));
        // Las validaciones conservan su campo; los fallos de operación usan el estado/reintento del workspace.
        if(error && !contextual){error.textContent='';error.style.display='none';}
      }else retryPublish=false;
      return result;
    }finally{
      for(const control of frozen)if(control.isConnected)control.disabled=false;
      publishing=false;applying=false;back.disabled=false;discard.disabled=false;if(!destroyed)label();
    }
  }
  back.addEventListener('click',()=>void leave());retry.addEventListener('click',()=>void (retryPublish?publish():save()).catch(reportError));
  stay.addEventListener('click',()=>{errors.hidden=true;});discardPending.addEventListener('click',()=>{clearBackup();window.AdminUnsaved?.markClean('primary-editor');close();});
  acknowledge.addEventListener('click',()=>{missingUploads=false;mediaProblem=false;acknowledge.hidden=true;errors.hidden=true;schedule();});
  card.addEventListener('tintin:image-pending',()=>{missingUploads=false;acknowledge.hidden=true;},{signal:signal.signal});
  discard.addEventListener('click',async()=>{try{await ready;await send({action:'discardProductWork',key,expectedRevision:revision,baseExpected,changeId:crypto.randomUUID()});clearBackup();window.dispatchEvent(new CustomEvent('tintin:product-work-saved'));close();}catch(error){message(error.message,true);}});
  for(const event of ['input','change','tintin:image-pending','tintin:image-preview','tintin:commercial-draft'])card.addEventListener(event,schedule,{signal:signal.signal});
  window.addEventListener('online',()=>{if(dirty())void save().catch(()=>{});},{signal:signal.signal});
  return {key,ready,save,leave,publish,reportError,get revision(){return revision;},get applying(){return applying;},get reference(){return {key,revision};},destroy(){destroyed=true;unlock();clearTimeout(timer);signal.abort();back.remove();if(originalCancel)originalCancel.hidden=cancelWasHidden;exit.remove();secondary.remove();feedback.remove();errors.remove();card.classList.remove('tt-editor-workspace');delete card.dataset.productPublicState;document.documentElement.classList.remove('tt-product-workspace-active');}};
}
