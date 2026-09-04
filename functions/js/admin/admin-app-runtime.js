const ADMIN_APP_SOURCE = '/js/admin/admin-app.js?v=tintin-20260904-appcheck-guard-1';
const FIREBASE_IMPORT_BEFORE = 'import { auth, db, appCheckReady } from "../core/firebase/firebase.js?v=tintin-20260904-auth-runtime-cache-reset-1";';
const FIREBASE_IMPORT_AFTER = 'import { auth, db, appCheckReady, authPersistenceReady } from "../core/firebase/firebase.js?v=tintin-20260904-auth-runtime-cache-reset-1";';
const HIDE_OVERLAY_NEEDLE = 'function hideOverlay() { window.ttPageReady && window.ttPageReady(); }';
const AUTH_GUARD_NEEDLE = 'onAuthStateChanged(auth, async user => {';
const AUTH_INIT_ERROR_MARKER = "console.error('[Admin] Auth init error:', e);";
const LOGIN_REDIRECT_NEEDLE = "window.location.href = 'login.html';";

function adminInitErrorHelperSource() {
  return `${HIDE_OVERLAY_NEEDLE}\n\nfunction showAdminInitializationError(error) {\n  console.error('[Admin] Inicialización bloqueada; la sesión autenticada se conserva.', error);\n  let overlay = document.getElementById('adm-init-error');\n  if (overlay) return;\n\n  hideOverlay();\n  overlay = document.createElement('div');\n  overlay.id = 'adm-init-error';\n  overlay.setAttribute('role', 'alert');\n  Object.assign(overlay.style, {\n    position: 'fixed', inset: '0', zIndex: '10000', display: 'grid', placeItems: 'center',\n    padding: '24px', background: '#fff7fa', color: '#392a30', fontFamily: 'Montserrat, system-ui, sans-serif'\n  });\n\n  const card = document.createElement('div');\n  Object.assign(card.style, {\n    width: 'min(520px, 100%)', padding: '28px', borderRadius: '20px', background: '#fff',\n    border: '1px solid #efd3dd', boxShadow: '0 20px 60px rgba(84, 28, 49, .16)', textAlign: 'center'\n  });\n\n  const title = document.createElement('h1');\n  title.textContent = 'No se pudo terminar de cargar el panel';\n  Object.assign(title.style, { margin: '0 0 10px', fontSize: '20px', color: '#9b294e' });\n\n  const detail = document.createElement('p');\n  detail.textContent = 'Tu sesión sigue iniciada. Reintentá la carga; si el problema continúa, revisá la consola para ver el error real.';\n  Object.assign(detail.style, { margin: '0 0 20px', lineHeight: '1.55', fontSize: '14px' });\n\n  const actions = document.createElement('div');\n  Object.assign(actions.style, { display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' });\n\n  const retry = document.createElement('button');\n  retry.type = 'button';\n  retry.textContent = 'Reintentar';\n  retry.onclick = () => window.location.reload();\n  Object.assign(retry.style, { border: '0', borderRadius: '999px', padding: '11px 18px', background: '#ad3f67', color: '#fff', font: 'inherit', fontWeight: '700', cursor: 'pointer' });\n\n  const login = document.createElement('button');\n  login.type = 'button';\n  login.textContent = 'Volver al login';\n  login.onclick = () => { window.location.href = '/login'; };\n  Object.assign(login.style, { border: '1px solid #e3c4cf', borderRadius: '999px', padding: '11px 18px', background: '#fff', color: '#9b294e', font: 'inherit', fontWeight: '700', cursor: 'pointer' });\n\n  actions.append(retry, login);\n  card.append(title, detail, actions);\n  overlay.append(card);\n  document.body.append(overlay);\n}\n\nasync function waitForAdminAuthBootstrap() {\n  await authPersistenceReady;\n  if (typeof auth.authStateReady === 'function') await auth.authStateReady();\n}\n\nawait waitForAdminAuthBootstrap();`;
}

export function patchAdminApp(source) {
  let output = String(source || '');

  if (!output.includes(FIREBASE_IMPORT_BEFORE)) {
    throw new Error('admin-app.js cambió: no se encontró el import esperado de Firebase.');
  }
  output = output.replace(FIREBASE_IMPORT_BEFORE, FIREBASE_IMPORT_AFTER);

  if (!output.includes(HIDE_OVERLAY_NEEDLE)) {
    throw new Error('admin-app.js cambió: no se encontró hideOverlay().');
  }
  output = output.replace(HIDE_OVERLAY_NEEDLE, adminInitErrorHelperSource());

  const guardIndex = output.indexOf(AUTH_GUARD_NEEDLE);
  if (guardIndex < 0) {
    throw new Error('admin-app.js cambió: no se encontró el auth guard.');
  }

  const errorIndex = output.indexOf(AUTH_INIT_ERROR_MARKER, guardIndex);
  if (errorIndex < 0) {
    throw new Error('admin-app.js cambió: no se encontró el catch de inicialización.');
  }

  const redirectIndex = output.indexOf(LOGIN_REDIRECT_NEEDLE, errorIndex);
  if (redirectIndex < 0 || redirectIndex - errorIndex > 700) {
    throw new Error('admin-app.js cambió: no se encontró el redirect del catch esperado.');
  }

  const replacement = `if (!auth.currentUser) {\n      ${LOGIN_REDIRECT_NEEDLE}\n      return;\n    }\n    showAdminInitializationError(e);`;
  return `${output.slice(0, redirectIndex)}${replacement}${output.slice(redirectIndex + LOGIN_REDIRECT_NEEDLE.length)}`;
}

export async function onRequest({ request, env }) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } });
  }

  if (request.method === 'HEAD') {
    return new Response(null, {
      status: 200,
      headers: {
        'content-type': 'text/javascript; charset=utf-8',
        'cache-control': 'no-store',
        'x-tintin-admin-auth-guard': 'edge-patched-v1'
      }
    });
  }

  const assetUrl = new URL(ADMIN_APP_SOURCE, request.url);
  const asset = await env.ASSETS.fetch(new Request(assetUrl.toString(), { method: 'GET' }));
  if (!asset.ok) return asset;

  try {
    const source = patchAdminApp(await asset.text());
    return new Response(source, {
      status: 200,
      headers: {
        'content-type': 'text/javascript; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'x-tintin-admin-auth-guard': 'edge-patched-v1'
      }
    });
  } catch (error) {
    console.error('[admin-auth-guard] No se pudo preparar admin-app.js de forma segura:', error);
    return new Response('throw new Error("Admin auth runtime unavailable");', {
      status: 503,
      headers: {
        'content-type': 'text/javascript; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'x-tintin-admin-auth-guard': 'patch-failed'
      }
    });
  }
}
