import {activityContextLabel,activityPresenceLabel,ACTIVITY_ACTIONS,activityPeriodDays} from '../../analytics/contexto-actividad.mjs?v=tintin-20261117-activity-2';
const format=value=>new Intl.DateTimeFormat('es-PY',{timeZone:'America/Asuncion',dateStyle:'short',timeStyle:'medium'}).format(new Date(value?.toDate?.()||value));
export function createActivityHistory(doc,{loadPage,loadPresence,isCurrent=()=>true,now=()=>new Date()}) {
  const el=(tag,text='')=>{const node=doc.createElement(tag);node.textContent=text;return node;};
  const root=el('section');root.className='ficha-section';
  const title=el('h3','Historial de navegación');title.className='ficha-section-title';
  const note=el('p','Se registra desde esta actualización y con permiso de estadísticas. No guarda búsquedas ni datos de formularios. La ausencia de actividad no confirma un bloqueo.');
  const current=el('p','Cargando última actividad…');current.setAttribute('aria-live','polite');
  const controls=el('div');controls.className='ficha-activity-controls';
  const period=el('select');period.setAttribute('aria-label','Período de actividad');
  for(const [value,label] of [['day','Día'],['week','Semana'],['month','Mes']]){const option=el('option',label);option.value=value;period.append(option);}
  const anchor=el('input');anchor.type='date';anchor.setAttribute('aria-label','Fecha de actividad');
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Asuncion',year:'numeric',month:'2-digit',day:'2-digit'}).format(now());
  anchor.value=today();anchor.max=anchor.value;
  const refresh=el('button','Actualizar');refresh.type='button';refresh.className='adm-btn adm-btn-sm adm-btn-outline';
  const list=el('div');list.className='ficha-orders-list';list.setAttribute('aria-live','polite');
  const more=el('button','Cargar más sesiones');more.type='button';more.className='adm-btn adm-btn-sm adm-btn-outline';more.hidden=true;
  controls.append(period,anchor,refresh);root.append(title,note,current,controls,list,more);
  let generation=0,days=[],dayIndex=0,cursor=null,rows=0,sessions=[];
  function renderSession(data) {
    const section=el('details');section.open=true;
    const summary=el('summary',`Ingreso ${format(data.startedAt)} · Última señal ${data.lastSeen ? format(data.lastSeen) : 'sin registro'} · ${activityContextLabel(data.context,data.landingPage)}`);
    section.append(summary);
    const timeline=Array.isArray(data.timeline)?data.timeline:[];
    if(!timeline.length)section.append(el('p','Esta sesión no tiene detalle de acciones registrado'));
    for(const event of [...timeline].sort((a,b)=>a.at-b.at))section.append(el('p',`${format(event.at)} · ${ACTIVITY_ACTIONS[event.action]||'Actividad'} · ${activityContextLabel(event.context)}`));
    if(data.historyTruncated)section.append(el('p','Esta sesión superó el límite de 200 acciones. Se muestran las últimas 200'));
    list.append(section);
  }
  async function next(token=generation) {
    more.disabled=true;refresh.disabled=true;
    try {
      let loaded=0;
      while(dayIndex<days.length && loaded<20) {
        const result=await loadPage(days[dayIndex],cursor,20-loaded);
        if(token!==generation || !isCurrent())return;
        for(const item of result.items){sessions.push(item);rows++;loaded++;}
        if(result.cursor)cursor=result.cursor;else {dayIndex++;cursor=null;}
      }
      if(rows){list.replaceChildren();sessions.sort((a,b)=>new Date(b.startedAt?.toDate?.()||b.startedAt)-new Date(a.startedAt?.toDate?.()||a.startedAt)).forEach(renderSession);}
      if(!rows)list.replaceChildren(el('p','Sin actividad registrada para este período. Esto no demuestra que la persona no haya visitado la tienda'));
    }catch {if(token===generation)list.append(el('p','No se pudo cargar el historial. Usá Actualizar para reintentar'));}
    finally {if(token===generation){more.hidden=dayIndex>=days.length;more.disabled=false;refresh.disabled=false;}}
  }
  async function reload() {
    const token=++generation;days=activityPeriodDays(period.value,anchor.value).filter(day=>day<=today());dayIndex=0;cursor=null;rows=0;sessions=[];list.replaceChildren();
    current.textContent='Cargando última actividad…';
    loadPresence().then(items=>{
      if(token!==generation||!isCurrent())return;
      const item=items.sort((a,b)=>new Date(b.lastSeen?.toDate?.()||b.lastSeen)-new Date(a.lastSeen?.toDate?.()||a.lastSeen))[0];
      if(!item){current.textContent='Sin señal actual registrada';return;}
      const seen=new Date(item.lastSeen?.toDate?.()||item.lastSeen);
      // leftAt: avisó salida (pestaña cerrada u oculta) después de su última señal.
      const left=item.leftAt?new Date(item.leftAt?.toDate?.()||item.leftAt):null;
      const online=+now()-+seen<120000 && !(left && +left>=+seen);
      current.textContent=`${online?'En línea según la última señal':'Sin actividad reciente'} · ${activityPresenceLabel(item,+now())} · ${format(seen)}`;
    },()=>{if(token===generation)current.textContent='Última actividad no disponible';});
    await next(token);
  }
  for(const control of [period,anchor])control.addEventListener('change',reload);
  refresh.addEventListener('click',reload);more.addEventListener('click',()=>next());
  queueMicrotask(reload);return root;
}
