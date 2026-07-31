from pathlib import Path


def replace_once(path, old, new):
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: se esperaba 1 coincidencia y se encontraron {count}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')


replace_once(
    'js/phase8-ui-ux.js',
    """const STATE_SELECTOR = [
  '[data-tt-state]',
  '.tt-loading', '.tt-loading-state', '.loading-state',
  '.tt-error', '.tt-error-state', '.error-state',
  '.tt-empty', '.tt-empty-state', '.empty-state',
  '[aria-busy="true"]'
].join(',');
""",
    """// aria-busy describe actividad, no convierte por sí solo un contenedor
// estructural en una tarjeta de estado. Incluirlo acá achicaba grillas completas
// (por ejemplo #cat-grid) al ancho máximo de .tt-state-surface durante cada
// actualización en tiempo real.
const STATE_SELECTOR = [
  '[data-tt-state]',
  '.tt-loading', '.tt-loading-state', '.loading-state',
  '.tt-error', '.tt-error-state', '.error-state',
  '.tt-empty', '.tt-empty-state', '.empty-state'
].join(',');
"""
)

replace_once(
    'js/site-activity.js',
    """  let sessionId = '';
  let geoPromise = null;

  function randomId(prefix) {
""",
    """  let sessionId = '';
  let geoPromise = null;
  const PERMANENT_WRITE_ERROR_CODES = new Set([
    'permission-denied',
    'unauthenticated',
    'failed-precondition'
  ]);
  let permanentWriteErrorCode = '';

  function firestoreErrorCode(error) {
    return String(error?.code || '').replace(/^firestore\\//, '');
  }

  function stopAfterPermanentWriteError(error, operation) {
    const code = firestoreErrorCode(error);
    if (!PERMANENT_WRITE_ERROR_CODES.has(code)) return false;
    if (permanentWriteErrorCode) return true;
    permanentWriteErrorCode = code;
    analyticsWritable = false;
    stopActivity();
    document.documentElement.dataset.ttActivityState = `blocked-${code}`;
    window.TintinSiteActivity = Object.freeze({ status: `blocked-${code}` });
    console.warn(`[SiteActivity] Analítica desactivada: Firestore rechazó ${operation} (${code}).`);
    return true;
  }

  function randomId(prefix) {
"""
)

replace_once(
    'js/site-activity.js',
    """      const geo = await getGeo();
      if (!activityEnabled || !hasConsent()) return;
      await setDoc(doc(db, 'siteTraffic', dayKey, 'sessions', sessionId), {
""",
    """      const geo = await getGeo();
      if (!analyticsWritable || !activityEnabled || !hasConsent()) return;
      await setDoc(doc(db, 'siteTraffic', dayKey, 'sessions', sessionId), {
"""
)

replace_once(
    'js/site-activity.js',
    """    } catch (error) {
      console.warn('[SiteActivity] No se pudo registrar la sesión:', error?.code || error);
    }
  }

  async function sendHeartbeat() {
""",
    """    } catch (error) {
      if (!stopAfterPermanentWriteError(error, 'registrar la sesión')) {
        console.warn('[SiteActivity] No se pudo registrar la sesión:', error?.code || error);
      }
    }
  }

  async function sendHeartbeat() {
"""
)

replace_once(
    'js/site-activity.js',
    """      const geo = await getGeo();
      if (!activityEnabled || !hasConsent()) return;
      await setDoc(doc(db, 'sitePresence', visitorId), {
""",
    """      const geo = await getGeo();
      if (!analyticsWritable || !activityEnabled || !hasConsent()) return;
      await setDoc(doc(db, 'sitePresence', visitorId), {
"""
)

replace_once(
    'js/site-activity.js',
    """    } catch (error) {
      console.warn('[SiteActivity] No se pudo actualizar la presencia:', error?.code || error);
    }
  }

  function scheduleHeartbeat() {
    window.clearInterval(heartbeatTimer);
    if (!activityEnabled || !hasConsent()) return;
""",
    """    } catch (error) {
      if (!stopAfterPermanentWriteError(error, 'actualizar la presencia')) {
        console.warn('[SiteActivity] No se pudo actualizar la presencia:', error?.code || error);
      }
    }
  }

  function scheduleHeartbeat() {
    window.clearInterval(heartbeatTimer);
    if (!analyticsWritable || !activityEnabled || !hasConsent()) return;
"""
)

replace_once(
    'js/site-activity.js',
    """  async function recordAggregateVisitOnce() {
    const dayKey = paraguayDayKey();
""",
    """  async function recordAggregateVisitOnce() {
    if (!analyticsWritable) return;
    const dayKey = paraguayDayKey();
"""
)

replace_once(
    'js/site-activity.js',
    """    } catch (error) {
      console.warn('[SiteActivity] No se pudo registrar la visita agregada:', error?.code || error);
    }
  }

  function clearLocalAnalyticsIds() {
""",
    """    } catch (error) {
      if (!stopAfterPermanentWriteError(error, 'registrar la visita agregada')) {
        console.warn('[SiteActivity] No se pudo registrar la visita agregada:', error?.code || error);
      }
    }
  }

  function clearLocalAnalyticsIds() {
"""
)

replace_once(
    'scripts/audit-phase8-ui-ux.js',
    """check(
  'Los estados dinámicos existentes se mejoran sin reemplazar su contenido',
  /MutationObserver/.test(runtime) &&
    /STATE_SELECTOR/.test(runtime) &&
    /classList\\.add\\('tt-state-surface'/.test(runtime) &&
    /querySelectorAll\\('button,a'\\)/.test(runtime),
  'La capa debe ser progresiva y compatible con estados ya renderizados por cada módulo.'
);

check(
  'Los estados visuales siguen la identidad de Tintin',
""",
    """check(
  'Los estados dinámicos existentes se mejoran sin reemplazar su contenido',
  /MutationObserver/.test(runtime) &&
    /STATE_SELECTOR/.test(runtime) &&
    /classList\\.add\\('tt-state-surface'/.test(runtime) &&
    /querySelectorAll\\('button,a'\\)/.test(runtime),
  'La capa debe ser progresiva y compatible con estados ya renderizados por cada módulo.'
);

check(
  'Las grillas ocupadas no se convierten en superficies angostas de estado',
  /aria-busy describe actividad/.test(runtime) &&
    !/const STATE_SELECTOR = \\[[\\s\\S]*?\\[aria-busy/.test(runtime),
  'aria-busy puede marcar una grilla durante una actualización, pero no debe imponerle el ancho de .tt-state-surface.'
);

check(
  'Los estados visuales siguen la identidad de Tintin',
"""
)

replace_once(
    'scripts/audit-app-check-bootstrap.js',
    """  [
    'La presencia no escribe sin App Check',
    activity.includes('const appCheckAvailable = await appCheckReady') &&
      (
        activity.includes('window.TINTIN_ENABLE_PUBLIC_ACTIVITY === true &&\\n  appCheckAvailable') ||
        activity.includes('window.TINTIN_ENABLE_PUBLIC_ACTIVITY !== true || !appCheckAvailable')
      )
  ],
  [
    'Los lectores públicos no encadenan errores si App Check falla',
""",
    """  [
    'La presencia no escribe sin App Check',
    activity.includes('const appCheckAvailable = await appCheckReady') &&
      (
        activity.includes('window.TINTIN_ENABLE_PUBLIC_ACTIVITY === true &&\\n  appCheckAvailable') ||
        activity.includes('window.TINTIN_ENABLE_PUBLIC_ACTIVITY !== true || !appCheckAvailable')
      )
  ],
  [
    'La presencia corta los reintentos ante rechazos permanentes',
    activity.includes('PERMANENT_WRITE_ERROR_CODES') &&
      activity.includes('stopAfterPermanentWriteError') &&
      activity.includes("stopAfterPermanentWriteError(error, 'actualizar la presencia')") &&
      activity.includes('analyticsWritable = false') &&
      activity.includes('stopActivity();')
  ],
  [
    'Los lectores públicos no encadenan errores si App Check falla',
"""
)

old_version = 'tintin-20260730-phase8-ui-1'
new_version = 'tintin-20260731-runtime-stability-1'
changed = 0
for file in Path('.').rglob('*'):
    if not file.is_file() or '.git' in file.parts or file.name == 'package-lock.json':
        continue
    if file.suffix.lower() not in {'.html', '.js', '.mjs', '.md', '.txt', '.json'}:
        continue
    try:
        text = file.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        continue
    if old_version in text:
        file.write_text(text.replace(old_version, new_version), encoding='utf-8')
        changed += 1
if changed == 0:
    raise SystemExit('No se encontró la versión de caché anterior para reemplazar')

print(f'Corrección aplicada. Archivos con versión actualizada: {changed}')
