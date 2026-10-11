// Test-only host: complete repository pages + real Auth/Firestore emulators.
// OTP and phone handlers are production code; mail delivery is a local sink.
import http from 'node:http';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const {request: playwrightRequest}=createRequire(import.meta.url)('playwright');
const sdkTransport=await playwrightRequest.newContext({...(process.env.HTTPS_PROXY?{proxy:{server:process.env.HTTPS_PROXY}}:{}),timeout:20000});
import { handleEmailOtpSend } from '../functions/api/email-otp-send.js';
import { handleEmailOtpVerify } from '../functions/api/email-otp-verify.js';
import { handlePhoneAvailability } from '../functions/api/phone-availability.js';
import { encodeFirestoreFields, decodeFirestoreFields } from '../cloudflare/firebase-admin-ligero.js';

const root = path.resolve(import.meta.dirname, '..');
const project = 'demo-tintin-interactions';
const origin = 'http://127.0.0.1:4174';
const authOrigin = 'http://127.0.0.1:9099';
const documents = `http://127.0.0.1:8080/v1/projects/${project}/databases/(default)/documents`;
const prefix = `projects/${project}/databases/(default)/documents/`;
const mailbox = new Map();
const seen = [];
const sdkFiles = new Map();
async function sdkSource(name) {
  if (!/^firebase-(?:app|auth|firestore|app-check)\.js$/.test(name)) throw new Error('SDK file not allowed');
  // Optional offline cache of recorded official bytes; mismatched/missing files fail.
  if (process.env.TINTIN_RUNTIME_SDK_CACHE && !sdkFiles.has(name)) {
    const cache=process.env.TINTIN_RUNTIME_SDK_CACHE;
    const manifest=JSON.parse(fs.readFileSync(path.join(cache,'manifest.json'),'utf8'));
    const bytes=fs.readFileSync(path.join(cache,name));
    const entry=manifest.files?.[name];
    if (manifest.version!=='10.14.1' || entry?.url!=='https://www.gstatic.com/firebasejs/10.14.1/'+name || createHash('sha256').update(bytes).digest('hex')!==entry?.sha256) throw new Error('Official SDK cache integrity failed');
    sdkFiles.set(name,Promise.resolve(bytes.toString('utf8')));
  }
  if (!sdkFiles.has(name)) sdkFiles.set(name, sdkTransport.get('https://www.gstatic.com/firebasejs/10.14.1/'+name).then(async response => {
    if (!response.ok() || !response.headers()['content-type']?.includes('javascript')) throw new Error('Firebase SDK download failed: HTTP '+response.status());
    return response.text();
  }));
  return sdkFiles.get(name);
}
const staticHost = spawn(process.execPath, ['scripts/servidor-local-pruebas.mjs', '4175'], { cwd: root, stdio: 'inherit' });
async function rest(url, options = {}, allowMissing = false) {
  const response = await fetch(url, { ...options, headers: { authorization: 'Bearer owner', 'content-type': 'application/json', ...options.headers } });
  if (allowMissing && response.status === 404) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data?.error?.message || `HTTP ${response.status}`), { status: response.status });
  return data;
}
const get = (_env, documentPath) => rest(`${documents}/${documentPath}`, {}, true);
const commit = (_env, writes) => rest(`${documents}:commit`, { method: 'POST', body: JSON.stringify({ writes: writes.map(write => ({ update: { name: prefix + write.path, fields: write.fields }, ...(write.currentDocument ? { currentDocument: write.currentDocument } : {}) })) }) });
const replace = (_env, documentPath, fields) => rest(`${documents}/${documentPath}`, { method: 'PATCH', body: JSON.stringify({ fields }) });
const merge = (_env, documentPath, fields, currentDocument) => rest(`${documents}:commit`, { method: 'POST', body: JSON.stringify({ writes: [{ update: { name: prefix + decodeURIComponent(documentPath), fields }, updateMask: { fieldPaths: Object.keys(fields) }, ...(currentDocument?.updateTime ? { currentDocument } : {}) }] }) });
const remove = (_env, documentPath) => rest(`${documents}/${documentPath}`, { method: 'DELETE' });
const authCall = (action, body) => rest(`${authOrigin}/identitytoolkit.googleapis.com/v1/accounts:${action}?key=demo-key`, { method: 'POST', body: JSON.stringify(body) });
async function lookupUser(_env, { uid, email }) {
  const result = await authCall('lookup', uid ? { localId: [uid] } : { email: [email] });
  const user = result.users?.[0];
  return user ? { uid: user.localId, email: user.email, disabled: user.disabled === true } : null;
}
async function findOrCreateUserByEmail(env, email) {
  const existing = await lookupUser(env, { email });
  if (existing) return { uid: existing.uid, isNewUser: false };
  const created = await authCall('signUp', { email, emailVerified: true });
  return { uid: created.localId, isNewUser: true };
}
const deps = {
  get, commit, replace, merge, remove, lookupUser, findOrCreateUserByEmail,
  async findProfilesByEmail(_env, collection, field, value, limit) {
    const result = await rest(`${documents}:runQuery`, { method: 'POST', body: JSON.stringify({ structuredQuery: { from: [{ collectionId: collection }], where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } } }, limit } }) });
    return result.filter(row => row.document).map(row => row.document);
  },
  async createFirebaseCustomToken(_env, uid) {
    // Only the Auth emulator accepts this unsigned token. Never sent to Google.
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ uid, iss: 'emulator@example.test', sub: 'emulator@example.test', aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+3600 })}.`;
  },
  deleteUser: (_env, uid) => authCall('delete', { localId: uid }),
  async send(_key, email, code) { mailbox.set(email, code); return 'local-mail-sink'; },
  async status() { return 'delivered'; },
  async pause() {},
};
async function requireUser(request) {
  const idToken = request.headers.get('authorization')?.replace(/^Bearer /i, '');
  if (!idToken) throw new Error('No hay sesión');
  const response = await fetch(`${authOrigin}/identitytoolkit.googleapis.com/v1/accounts:lookup?key=demo-key`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({idToken})});
  if (!response.ok) throw new Error('Sesión inválida');
  const result = await response.json();
  const user = result.users?.[0];
  if (!user) throw new Error('Sesión inválida');
  return { uid: user.localId, email: user.email };
}
let firebaseSource = fs.readFileSync(path.join(root, 'js/core/firebase/firebase.js'), 'utf8')
  .replace('import { getFirestore }', 'import { getFirestore, connectFirestoreEmulator }')
  .replace('import { getAuth,', 'import { connectAuthEmulator, getAuth,')
  .replace(/apiKey: "[^"]+"/, 'apiKey: "demo-key"')
  .replace('projectId: "tintin-accesorios"', `projectId: "${project}"`)
  .replace('if (FIREBASE_APP_CHECK_SITE_KEY) {', 'if (false) {')
  .replace('const db = getFirestore(app);', 'const db = getFirestore(app); if (!window.__runtimeDb) { connectFirestoreEmulator(db,"127.0.0.1",8080); window.__runtimeDb = db; }')
  .replace('// La sesión sobrevive', 'if (!window.__runtimeAuth) { connectAuthEmulator(auth,"http://127.0.0.1:9099",{disableWarnings:true}); window.__runtimeAuth = auth; }\n// La sesión sobrevive');
const emailSource = fs.readFileSync(path.join(root, 'js/email/correo-autenticacion.js'), 'utf8')
  .replace('const path = localHost ? `${LOCAL_FUNCTIONS_ORIGIN}/api/${name}` : relativePath;', 'const path = relativePath;');
const env = { RESEND_API_KEY: 'local-mail-sink', OTP_RATE_SALT: 'emulator-only' };
const product = { id: 'runtime-watch', name: 'Reloj Runtime', category: 'relojes', price: 150000, stock: 3, active: true, imageUrl: '/assets-tintin/images/general/logo.png' };
async function reset() {
  await rest(`http://127.0.0.1:8080/emulator/v1/projects/${project}/databases/(default)/documents`, { method: 'DELETE' });
  await rest(`${authOrigin}/emulator/v1/projects/${project}/accounts`, { method: 'DELETE' });
  mailbox.clear(); seen.length = 0;
  await replace(env, 'settings/storeGate', encodeFirestoreFields({ storeOpen: true }));
  await replace(env, 'products/runtime-watch', encodeFirestoreFields(product));
  await replace(env, 'collections/relojes', encodeFirestoreFields({ name: 'Relojes', slug: 'relojes', active: true }));
}
async function readBody(incoming) { const chunks=[]; for await (const chunk of incoming) chunks.push(chunk); return Buffer.concat(chunks).toString('utf8'); }
const server = http.createServer(async (incoming, outgoing) => {
  const url = new URL(incoming.url, origin);
  try {
    if (url.pathname.startsWith('/__test/firebase-sdk/')) { outgoing.setHeader('content-type','text/javascript'); outgoing.end(await sdkSource(url.pathname.split('/').pop())); return; }
    if (url.pathname === '/__test/reset') { await reset(); outgoing.end('{}'); return; }
    if (url.pathname === '/__test/state') {
      const email = url.searchParams.get('email');
      const identity = await lookupUser(env, { email });
      const profile = identity ? await get(env, 'users/' + identity.uid) : null;
      outgoing.setHeader('content-type','application/json'); outgoing.end(JSON.stringify({ uid: identity?.uid, code: mailbox.get(email), profile: profile ? decodeFirestoreFields(profile.fields) : null, requests: seen })); return;
    }
    if (url.pathname === '/__test/seed') {
      const body = JSON.parse(await readBody(incoming));
      const existing=await get(env,body.path);
      if(existing)await merge(env,body.path,encodeFirestoreFields(body.data),{updateTime:existing.updateTime});
      else await replace(env,body.path,encodeFirestoreFields(body.data));
      outgoing.end('{}'); return;
    }
    if (url.pathname === '/js/core/firebase/firebase.js' || url.pathname === '/js/email/correo-autenticacion.js') {
      outgoing.setHeader('content-type','text/javascript'); outgoing.end(url.pathname.includes('/core/') ? firebaseSource : emailSource); return;
    }
    if (url.pathname === '/api/public-catalog') {
      const resource = url.searchParams.get('resource');
      let result;
      if (resource === 'storeGate') { const saved=await get(env,'settings/storeGate'); result={ok:true,resource,data:decodeFirestoreFields(saved?.fields||{})}; }
      else if (['products','collections'].includes(resource)) {
        const id=url.searchParams.get('id');
        if (id) { const saved=await get(env,resource+'/'+encodeURIComponent(id)); result={ok:true,resource,item:saved?{id,data:decodeFirestoreFields(saved.fields)}:null}; }
        else { const saved=await rest(documents+'/'+resource); result={ok:true,resource,items:(saved.documents||[]).map(d=>({id:d.name.split('/').pop(),data:decodeFirestoreFields(d.fields)}))}; }
      } else { outgoing.writeHead(400);outgoing.end('{}');return; }
      outgoing.setHeader('content-type','application/json');outgoing.end(JSON.stringify(result));return;
    }
    const handlers = { '/api/email-otp-send': c => handleEmailOtpSend(c,deps), '/api/email-otp-verify': c => handleEmailOtpVerify(c,deps), '/api/phone-availability': c => handlePhoneAvailability(c,{requireUser,get}) };
    if (handlers[url.pathname]) {
      const headers = new Headers(incoming.headers); headers.set('CF-Connecting-IP', incoming.headers['x-test-ip'] || '192.0.2.1');
      const body = ['GET','HEAD'].includes(incoming.method) ? undefined : await readBody(incoming);
      const request = new Request(url, { method:incoming.method,headers,body });
      const response = await handlers[url.pathname]({request,env});
      seen.push({ path:url.pathname,status:response.status });
      outgoing.writeHead(response.status,Object.fromEntries(response.headers));outgoing.end(await response.text());return;
    }
    // Only the request path is variable. Pin the TCP destination and return
    // redirects to the browser instead of following them on the server.
    const response = await new Promise((resolve, reject) => {
      http.get({ hostname: '127.0.0.1', port: 4175, path: url.pathname + url.search }, upstream => {
        const chunks = [];
        upstream.on('data', chunk => chunks.push(chunk));
        upstream.on('error', reject);
        upstream.on('end', () => resolve({ status: upstream.statusCode, headers: upstream.headers, body: Buffer.concat(chunks) }));
      }).on('error', reject);
    });
    outgoing.writeHead(response.status,response.headers);outgoing.end(response.body);
  } catch(error) { console.error('[runtime-test-server]',error.message);outgoing.writeHead(500,{'content-type':'application/json'});outgoing.end(JSON.stringify({error:error.message})); }
});
server.listen(4174,'127.0.0.1',()=>console.log('Runtime test host: '+origin));
const shutdown=()=>{staticHost.kill('SIGTERM');server.close(async()=>{await sdkTransport.dispose();process.exit(0);});};
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,shutdown);
