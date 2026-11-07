const fs = require('node:fs'); const path = require('node:path');
const ROOT = path.resolve(__dirname, '../../..');
const stubs = {
  '/js/core/firebase/firebase.js': 'export const db = {}; export const auth = {}; export const appCheckReady = Promise.resolve();',
  '/js/core/auth/roles.js': "export const SUPER_ADMIN = 'admin@tintin.test';",
  '/js/core/auth/coordinador-sesion.js': "export function subscribeAuthState(cb){ setTimeout(() => cb({ uid: 'u1', email: 'admin@tintin.test' })); return () => {}; }",
  '/js/components/images/biblioteca-multimedia.js': `const items = [1,2,3].map(i => ({ id: 'm' + i, url: 'https://tintin.test/assets/fake-' + i + '.png', name: 'foto-' + i + '.png', createdAt: Date.now(), usedIn: [], width: 800, height: 800, bytes: 120000 }));
    export function onMediaLibraryUpdate(cb){ setTimeout(() => cb(items)); return () => {}; }
    const no = async () => { throw new Error('sin escritura'); };
    export const uploadImageToLibrary = no, deleteMediaItem = no, deleteMediaByUrlIfUnused = no, updateMediaMetadata = no;
    export async function findOrphanedMedia(){ return []; }`,
};
const firestore = `export const doc=()=>({}); export const getDoc=async()=>({ exists:()=>false, data:()=>({}) }); export const setDoc=async()=>{throw new Error('sin escritura')};
  export const onSnapshot=()=>()=>{}; export const serverTimestamp=()=>null;`;
async function respond(route, url) {
  if (url.hostname === 'www.gstatic.com') { await route.fulfill({ contentType: 'text/javascript', body: firestore }); return true; }
  if (url.hostname !== 'tintin.test') return false;
  if (stubs[url.pathname]) { await route.fulfill({ contentType: 'text/javascript', body: stubs[url.pathname] }); return true; }
  if (/^\/js\/(components\/images|admin\/products|admin\/datos|core\/store|admin\/maestro)\/[\w-]+\.m?js$/.test(url.pathname) && fs.existsSync(path.join(ROOT, url.pathname))) {
    await route.fulfill({ path: path.join(ROOT, url.pathname), contentType: 'text/javascript' }); return true;
  }
  return false;
}
const html = fs.readFileSync(path.join(ROOT, 'admin-images.html'), 'utf8');
const start = html.indexOf('<script type="module">') + '<script type="module">'.length;
const inline = html.slice(start, html.indexOf('</script>', start)).replaceAll('"./js/', '"/js/');
async function boot(page) {
  await page.evaluate(code => { const s = document.createElement('script'); s.type = 'module'; s.nonce = 'dGludGluLWZpeHR1cmU='; s.textContent = code; document.body.append(s);
    const e = document.createElement('script'); e.type = 'module'; e.nonce = s.nonce; e.src = '/js/admin/maestro/espacio-modulos-admin.js'; document.body.append(e); }, inline);
}
module.exports = { respond, boot };
