import test from 'node:test';
import assert from 'node:assert/strict';
import { handleSiteActivity } from '../../functions/api/site-activity.js';
import { encodeFirestoreFields, decodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';

const date = new Date('2026-10-15T12:00:00Z');
const makeRequest = input => new Request('https://shop.test/api/site-activity', {
  method: 'POST', headers: { origin: 'https://shop.test', 'content-type': 'application/json' }, body: JSON.stringify(input),
});
function fixture() {
  const documents = new Map(), policies = []; let revision = 0;
  return { documents, policies, deps: {
    now: () => date,
    ipLimit: async (_request, _env, policy) => policies.push(policy),
    reserve: async (_env, policy) => policies.push(policy),
    get: async (_env, path) => documents.get(path) || null,
    commit: async (_env, writes) => {
      for (const write of writes) {
        const before = documents.get(write.path);
        if (write.currentDocument?.exists === false && before || write.currentDocument?.updateTime && before?.updateTime !== write.currentDocument.updateTime) throw Object.assign(Error('conflict'), { status: 409 });
        documents.set(write.path, { fields: write.fields, updateTime: String(++revision) });
      }
    },
  } };
}
const input = { kind: 'session', visitorId: 'visitor_123', sessionId: 'session_123', consent: true, route: '/catalogo?token=private', email: 'do-not-store@example.test', lat: -25, uid: 'owner' };
test('sesión acotada, sin identidad ni consultas sensibles, y duplicados sin sobrescribir', async () => {
  const state = fixture();
  for (let i = 0; i < 2; i++) assert.equal((await handleSiteActivity({ request: makeRequest(input), env: {} }, state.deps)).status, 202);
  assert.equal(state.documents.size, 1);
  const fields = decodeFirestoreFields([...state.documents.values()][0].fields);
  assert.equal(fields.landingPage, '/catalogo'); assert.equal(fields.userId, '');
  assert.equal(JSON.stringify(fields).includes('private'), false);
  assert.equal('email' in fields || 'lat' in fields || 'uid' in fields, false);
  assert.ok(state.policies.some(p => p.id === 'site-activity-budget' && p.identity === 'all-visitors' && p.limit === 20_000));
});
for (const bad of [{ ...input, consent: false }, { ...input, sessionId: '../users' }, { ...input, visitorId: '__bad__' }, { kind: 'authFailure', reason: 'anything' }, { kind: 'admin' }, { ...input, huge: 'x'.repeat(5000) }]) {
  test(`rechaza evento inválido antes de escribir: ${bad.kind}/${bad.reason || bad.sessionId || ''}/${bad.huge?.length || 0}`, async () => {
    const state = fixture(); assert.equal((await handleSiteActivity({ request: makeRequest(bad), env: {} }, state.deps)).status, 400);
    assert.equal(state.documents.size, 0);
  });
}
test('cambiar IDs no evita el presupuesto global y su fallo no escribe datos', async () => {
  const state = fixture(); state.deps.reserve = async () => { throw Object.assign(Error('limited'), { status: 429, code: 'rate_limited', retryAfter: 60 }); };
  for (const sessionId of ['session_123', 'session_456']) {
    const response = await handleSiteActivity({ request: makeRequest({ ...input, sessionId }), env: {} }, state.deps);
    assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '60');
  }
  assert.equal(state.documents.size, 0);
});
test('la API conserva el contador con conflicto CAS y un heartbeat adelantado no escribe', async () => {
  const state = fixture(); let conflict = true;
  const commit = state.deps.commit;
  state.deps.commit = async (...args) => { if (conflict) { conflict = false; throw Object.assign(Error('conflict'), { status: 409 }); } return commit(...args); };
  assert.equal((await handleSiteActivity({ request: makeRequest({ kind: 'aggregate' }), env: {} }, state.deps)).status, 202);
  assert.equal(decodeFirestoreFields(state.documents.get('siteAggregate/2026-10-15').fields).totalVisits, 1);
  await handleSiteActivity({ request: makeRequest({ ...input, kind: 'presence' }), env: {} }, state.deps);
  const previous = state.documents.get('sitePresence/visitor_123');
  const duplicate = await handleSiteActivity({ request: makeRequest({ ...input, kind: 'presence' }), env: {} }, state.deps);
  assert.equal((await duplicate.json()).duplicate, true);
  assert.equal(state.documents.get('sitePresence/visitor_123').updateTime, previous.updateTime);
});
test('diagnóstico de acceso sigue disponible sin sesión y no guarda userAgent ni query', async () => {
  const state = fixture();
  assert.equal((await handleSiteActivity({ request: makeRequest({ kind: 'authFailure', reason: 'auth-restore-fallback', route: '/admin?code=private', userAgent: 'private' }), env: {} }, state.deps)).status, 202);
  const fields = decodeFirestoreFields([...state.documents.values()][0].fields);
  assert.equal(fields.route, '/admin'); assert.equal(fields.code, 'REDIRECT_LOOP_BROKEN'); assert.equal('userAgent' in fields, false);
});
test('mantenimiento no acepta estadísticas, y un origen ajeno no alcanza las cuotas', async () => {
  const state = fixture(); state.documents.set('settings/storeGate', { fields: encodeFirestoreFields({ storeOpen: false }) });
  assert.equal((await handleSiteActivity({ request: makeRequest({ kind: 'aggregate' }), env: {} }, state.deps)).status, 403);
  const request = new Request('https://shop.test/api/site-activity', { method: 'POST', headers: { origin: 'https://evil.test' }, body: '{}' });
  state.policies.length = 0;
  assert.equal((await handleSiteActivity({ request, env: {} }, state.deps)).status, 403); assert.equal(state.policies.length, 0);
});

test('presencia con sesión guarda solo el uid verificado en el servidor; token inválido queda anónimo', async () => {
  const presence = { kind: 'presence', visitorId: 'visitor_777', sessionId: 'session_777', consent: true, route: '/', uid: 'forged-uid' };
  const withAuth = token => new Request('https://shop.test/api/site-activity', {
    method: 'POST', headers: { origin: 'https://shop.test', 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(presence),
  });
  const verified = fixture(); const seen = [];
  verified.deps.verifyToken = async (token, options) => { seen.push([token, options]); return { uid: 'uid_real_1', email: 'x@example.test' }; };
  assert.equal((await handleSiteActivity({ request: withAuth('good.token.sig'), env: {} }, verified.deps)).status, 202);
  const fields = decodeFirestoreFields(verified.documents.get('sitePresence/visitor_777').fields);
  assert.equal(fields.userId, 'uid_real_1');
  assert.equal('email' in fields || 'uid' in fields, false);
  assert.deepEqual(seen, [['good.token.sig', { requireVerifiedEmail: false }]]);

  const rejected = fixture();
  rejected.deps.verifyToken = async () => { throw Object.assign(Error('bad'), { status: 401 }); };
  assert.equal((await handleSiteActivity({ request: withAuth('bad.token.sig'), env: {} }, rejected.deps)).status, 202);
  assert.equal(decodeFirestoreFields(rejected.documents.get('sitePresence/visitor_777').fields).userId, '');
});

test('contexto preciso e historial diario: deduplica acciones, valida privacidad y conserva CAS',async()=>{
  const state=fixture();let tick=0;state.deps.now=()=>new Date(+date+tick);state.deps.verifyToken=async()=>({uid:'client_verified'});
  const event={id:'event_12345678',at:+date,action:'view',context:{page:'catalogo',category:'relojes',email:'private@example.test'}};
  const body={...input,kind:'presence',context:{page:'checkout',step:3,status:'reviewing'},events:[event]};
  const send=async()=>handleSiteActivity({request:new Request('https://shop.test/api/site-activity',{method:'POST',headers:{origin:'https://shop.test',authorization:'Bearer verified'},body:JSON.stringify(body)}),env:{}},state.deps);
  assert.equal((await send()).status,202);tick=21000;
  body.events.push({id:'event_87654321',at:+date+tick,action:'checkout_error',context:{page:'checkout',step:4,status:'error',reason:'network',password:'secret'}});
  assert.equal((await send()).status,202);
  const data=decodeFirestoreFields(state.documents.get('siteTraffic/2026-10-15/sessions/session_123').fields);
  assert.equal(data.userId,'client_verified');assert.equal(data.timeline.length,2);
  assert.equal(data.timeline[0].context.category,'relojes');assert.equal(data.timeline[1].context.reason,'network');
  assert.equal(JSON.stringify(data).includes('private'),false);assert.equal(JSON.stringify(data).includes('secret'),false);
  assert.equal(decodeFirestoreFields(state.documents.get('sitePresence/visitor_123').fields).context.step,3);
  tick+=21000;state.deps.verifyToken=async()=>({uid:'other_account'});
  assert.equal((await send()).status,400);
  assert.equal(decodeFirestoreFields(state.documents.get('siteTraffic/2026-10-15/sessions/session_123').fields).userId,'client_verified');
});

test('historial supera200: límite explícito sin crecimiento ilimitado del documento',async()=>{
  const state=fixture();state.documents.set('siteTraffic/2026-10-15/sessions/session_123',{updateTime:'seed',fields:encodeFirestoreFields({userId:'',timeline:Array.from({length:200},(_,i)=>({id:`event_old_${i}`,at:+date,action:'view',context:{page:'index'}}))})});
  const event={id:'event_new_123',at:+date,action:'view',context:{page:'checkout',step:2}};
  const response=await handleSiteActivity({request:makeRequest({...input,kind:'presence',events:[event]}),env:{}},state.deps);
  assert.equal(response.status,202);
  const data=decodeFirestoreFields(state.documents.get('siteTraffic/2026-10-15/sessions/session_123').fields);
  assert.equal(data.timeline.length,200);assert.equal(data.timeline.at(-1).id,event.id);assert.equal(data.historyTruncated,true);
});

test('la duración del estado no se reinicia si Firestore devuelve campos en otro orden',async()=>{
 const state=fixture();let tick=0;state.deps.now=()=>new Date(+date+tick);
 const body={...input,kind:'presence',context:{page:'checkout',step:4,status:'confirming'}};
 await handleSiteActivity({request:makeRequest(body),env:{}},state.deps);
 const path='sitePresence/visitor_123';const stored=state.documents.get(path),data=decodeFirestoreFields(stored.fields);
 data.context={status:'confirming',step:4,page:'checkout'};stored.fields=encodeFirestoreFields(data);
 tick=61000;
 await handleSiteActivity({request:makeRequest(body),env:{}},state.deps);
 const next=decodeFirestoreFields(state.documents.get(path).fields);
 assert.equal(new Date(next.contextSince).getTime(),+date);
});

test('presencia antes de sesión conserva la geografía de Cloudflare en estadísticas',async()=>{
 const state=fixture();const request=makeRequest({...input,kind:'presence'});
 Object.defineProperty(request,'cf',{value:{city:'San Lorenzo',region:'Central',country:'PY'}});
 assert.equal((await handleSiteActivity({request,env:{}},state.deps)).status,202);
 assert.equal((await handleSiteActivity({request:makeRequest(input),env:{}},state.deps)).status,202);
 const session=decodeFirestoreFields(state.documents.get('siteTraffic/2026-10-15/sessions/session_123').fields);
 assert.equal(session.city,'San Lorenzo');assert.equal(session.region,'Central');assert.equal(session.country,'PY');assert.equal(session.countryCode,'PY');assert.equal(session.geoSource,'cloudflare');
});

test('aviso de salida: marca leftAt solo desde la misma página, y la siguiente página vuelve a registrar al instante',async()=>{
 const state=fixture();let tick=0;state.deps.now=()=>new Date(+date+tick);
 const path='sitePresence/visitor_123';
 const page=pageId=>({...input,kind:'presence',pageId});
 const leave=pageId=>({...input,kind:'presence',leaving:true,pageId});
 const send=body=>handleSiteActivity({request:makeRequest(body),env:{}},state.deps);
 // Sin presencia previa, la salida no crea documentos.
 assert.equal((await (await send(leave('page_aaaaaaaa'))).json()).duplicate,true);assert.equal(state.documents.has(path),false);
 await send(page('page_aaaaaaaa'));
 const firstSeen=decodeFirestoreFields(state.documents.get(path).fields).lastSeen;
 // Otra pestaña/página no puede desconectar a la que escribió el último latido.
 tick=2000;assert.equal((await (await send(leave('page_bbbbbbbb'))).json()).duplicate,true);
 assert.equal('leftAt' in decodeFirestoreFields(state.documents.get(path).fields),false);
 // Salida válida conserva lastSeen (timestamp) y agrega leftAt.
 tick=3000;assert.equal((await (await send(leave('page_aaaaaaaa'))).json()).recorded,true);
 const left=decodeFirestoreFields(state.documents.get(path).fields);
 assert.equal(new Date(left.leftAt).getTime(),+date+3000);assert.equal(left.lastSeen,firstSeen);
 assert.ok(state.documents.get(path).fields.lastSeen.timestampValue);
 // Una salida repetida no reescribe.
 const stored=state.documents.get(path).updateTime;
 tick=3500;assert.equal((await (await send(leave('page_aaaaaaaa'))).json()).duplicate,true);assert.equal(state.documents.get(path).updateTime,stored);
 // La página siguiente registra presencia aunque no pasaron 20 s, y borra leftAt.
 tick=4000;assert.equal((await (await send(page('page_cccccccc'))).json()).recorded,true);
 const back=decodeFirestoreFields(state.documents.get(path).fields);
 assert.equal('leftAt' in back,false);assert.equal(back.pageId,'page_cccccccc');
 // La misma página dentro de 20 s sigue sin escribir.
 tick=5000;assert.equal((await (await send(page('page_cccccccc'))).json()).duplicate,true);
 // Un pageId inválido se rechaza antes de escribir.
 assert.equal((await send(page('../x'))).status,400);
});

test('aviso de salida de otra sesión no desconecta al visitante',async()=>{
 const state=fixture();
 await handleSiteActivity({request:makeRequest({...input,kind:'presence',pageId:'page_aaaaaaaa'}),env:{}},state.deps);
 const response=await handleSiteActivity({request:makeRequest({...input,kind:'presence',leaving:true,pageId:'page_aaaaaaaa',sessionId:'session_999'}),env:{}},state.deps);
 assert.equal((await response.json()).duplicate,true);
 assert.equal('leftAt' in decodeFirestoreFields(state.documents.get('sitePresence/visitor_123').fields),false);
});
