from pathlib import Path

admin_path = Path('js/admin/admin-app.js')
html_path = Path('admin.html')
admin_fn_path = Path('functions/admin.js')
runtime_path = Path('functions/js/admin/admin-app-runtime.js')
workflow_path = Path('.github/workflows/one-time-admin-auth-canonicalize.yml')
script_path = Path('scripts/one-time-admin-auth-canonicalize.py')

# Keep the existing Firebase module cache tag globally consistent. The module
# already exports authPersistenceReady; only admin-app.js needs to import it.
src = admin_path.read_text(encoding='utf-8')
old = 'import { auth, db, appCheckReady, authPersistenceReady } from "../core/firebase/firebase.js?v=tintin-20260904-admin-auth-guard-2";'
new = 'import { auth, db, appCheckReady, authPersistenceReady } from "../core/firebase/firebase.js?v=tintin-20260904-auth-runtime-cache-reset-1";'
if src.count(old) != 1:
    raise SystemExit(f'Expected one hardened Firebase import, found {src.count(old)}')
src = src.replace(old, new, 1)

# Normalize owner comparisons inside the new guard so casing/whitespace in an
# authenticated provider email cannot accidentally send the owner through the
# regular blocked-user path.
src = src.replace(
    "if (user.email !== SUPER_ADMIN) {\n        const selfSnap = await getDoc(doc(db, 'users', user.uid));",
    "if (String(user.email || '').trim().toLowerCase() !== SUPER_ADMIN.toLowerCase()) {\n        const selfSnap = await getDoc(doc(db, 'users', user.uid));",
    1,
)
src = src.replace(
    "if (role === 'superadmin' && user.email === SUPER_ADMIN) {\n        initSiteDiagnostics({ role });",
    "if (role === 'superadmin' && String(user.email || '').trim().toLowerCase() === SUPER_ADMIN.toLowerCase()) {\n        initSiteDiagnostics({ role });",
    1,
)
admin_path.write_text(src, encoding='utf-8')

html = html_path.read_text(encoding='utf-8')
old_preload = 'js/core/firebase/firebase.js?v=tintin-20260904-admin-auth-guard-2'
new_preload = 'js/core/firebase/firebase.js?v=tintin-20260904-auth-runtime-cache-reset-1'
if html.count(old_preload) != 1:
    raise SystemExit(f'Expected one hardened Firebase preload, found {html.count(old_preload)}')
html = html.replace(old_preload, new_preload, 1)
html_path.write_text(html, encoding='utf-8')

# The edge source-rewriter was a temporary hot-patch layer. Now that the
# canonical admin-app.js contains the fix itself, keeping the rewriter would
# duplicate auth boot logic and make production depend on two implementations.
fn = admin_fn_path.read_text(encoding='utf-8')
block_start = fn.find("const ADMIN_APP_RUNTIME = '/js/admin/admin-app-runtime?v=")
export_start = fn.find('export async function onRequest(context) {', block_start)
if block_start < 0 or export_start < 0:
    raise SystemExit('Could not locate the temporary admin auth runtime injector')
fn = fn[:block_start] + fn[export_start:]
old_return = '  return injectAdminAuthRuntime(withCodeStudio, context.request.method);'
new_return = '  return withCodeStudio;'
if fn.count(old_return) != 1:
    raise SystemExit(f'Expected one runtime-injected return, found {fn.count(old_return)}')
fn = fn.replace(old_return, new_return, 1)
admin_fn_path.write_text(fn, encoding='utf-8')

if not runtime_path.exists():
    raise SystemExit('Expected temporary admin-app-runtime.js to exist')
runtime_path.unlink()

# Remove the one-time machinery before generated manifests are rebuilt, so
# diagnostics describe the final repository rather than this patch vehicle.
for temp in (workflow_path, script_path):
    if temp.exists():
        temp.unlink()
