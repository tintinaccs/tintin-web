from pathlib import Path
import re


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: bloque esperado aparece {count} veces')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


def regex_once(path, pattern, replacement, flags=0):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f'{path}: patrón no encontrado: {pattern[:100]}')
    p.write_text(updated, encoding='utf-8')


replace_once(
    'js/core/store/estado-productos.js',
    "  if (/(^|\\/)(?:catalogo|collections)(?:\\.html)?$/.test(path)) {\n    return loadAllProducts();\n  }",
    "  if (/(^|\\/)(?:catalogo|collections)(?:\\.html)?$/.test(path)) {\n    return startPublicProductsRealtime();\n  }"
)

regex_once(
    'catalogo.html',
    r"function _showCatalogLoadError\(\) \{.*?\n\}\n\n// Array\.isArray",
    '''function _showCatalogLoadError() {
  if (_catalogInitialized || _catalogErrorTimer) return;
  _catalogErrorTimer = window.setTimeout(() => {
    _catalogErrorTimer = 0;
    if (_catalogInitialized) return;
    const grid = document.getElementById('cat-grid');
    if (!grid) return;
    grid.setAttribute('aria-busy', 'false');
    document.getElementById('cat-count').textContent = 'Catálogo no disponible';
    grid.innerHTML = `
      <div class="tt-catalog-runtime-state" data-state="error" role="alert">
        <div>
          <strong>No pudimos actualizar el catálogo</strong>
          <span>Revisá tu conexión e intentá nuevamente. No mostraremos un catálogo vacío si la fuente real falló.</span>
          <button type="button" class="tt-btn" id="cat-retry">Reintentar</button>
        </div>
      </div>`;
    document.getElementById('cat-retry')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = 'Reintentando…';
      try {
        await window.TintinProductsStore?.loadAll?.({ force: true });
      } catch (error) {
        console.error('[catalogo] Reintento falló:', error);
        button.disabled = false;
        button.textContent = 'Reintentar';
      }
    });
    window.ttPageReady && window.ttPageReady();
  }, 10000);
}

// Array.isArray''',
    re.S
)

p = Path('js/pages/catalog/mantenimiento-catalogo.js')
text = p.read_text(encoding='utf-8')
if "  let lastGridSignature = '';" not in text:
    raise SystemExit('No se encontró estado base del catálogo')
text = text.replace("  let lastGridSignature = '';", "  let lastGridSignature = '';\n  let lastSyncAt = 0;", 1)
marker = "  function installObservers() {"
if marker not in text:
    raise SystemExit('No se encontró installObservers del catálogo')
helpers = '''  function formatLastSync(timestamp) {
    if (!timestamp) return '';
    try {
      return new Intl.DateTimeFormat('es-PY', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(timestamp));
    } catch {
      return '';
    }
  }

  function markCatalogSynced() {
    lastSyncAt = Date.now();
    const formatted = formatLastSync(lastSyncAt);
    const node = ensureSyncNode();
    if (node) node.dataset.lastSyncAt = new Date(lastSyncAt).toISOString();
    setSync('synced', formatted ? `Catálogo actualizado · Última sincronización ${formatted}` : 'Catálogo actualizado');
  }

  function showCatalogError(error) {
    clearTimeout(loadingTimer);
    console.error('[catalogo] Fuente canónica no disponible:', error?.message || error || 'error');
    if (hasRealCards()) {
      setSync('error', 'No se pudo actualizar · mostrando la última versión disponible');
      setReady();
      return;
    }
    renderState('error', 'No pudimos actualizar el catálogo', 'Revisá tu conexión e intentá nuevamente.');
    setSync('error');
    setReady();
  }

  async function refreshCatalog() {
    setSync('loading');
    const load = window.TintinProductsStore?.loadAll;
    if (typeof load !== 'function') {
      setTimeout(guardCatalogSurface, 250);
      return;
    }
    try {
      await load({ force: true });
      guardCatalogSurface();
    } catch (error) {
      showCatalogError(error);
    }
  }

'''
text = text.replace(marker, helpers + marker, 1)
p.write_text(text, encoding='utf-8')

regex_once(
    'js/pages/catalog/mantenimiento-catalogo.js',
    r"  function installObservers\(\) \{.*?\n  \}\n\n  function boot\(\)",
    '''  function installObservers() {
    if (grid) {
      new MutationObserver(guardCatalogSurface).observe(grid, { childList: true, subtree: true, characterData: true });
    }
    window.addEventListener('tintin:products-loaded', () => {
      markCatalogSynced();
      setTimeout(guardCatalogSurface, 0);
    });
    window.addEventListener('tintin:products-error', event => showCatalogError(event.detail?.error));
    ['tintin:collections-updated', 'tt_cart_updated', 'tintin:cart-sync-status', 'tintin:color-scheme-applied'].forEach(name => {
      window.addEventListener(name, () => setTimeout(guardCatalogSurface, 0));
    });
    window.addEventListener('online', () => {
      setSync('loading', 'Conexión recuperada · actualizando catálogo…');
      refreshCatalog();
    });
    window.addEventListener('offline', () => setSync('offline'));
    window.addEventListener('popstate', replayUrlState);
    window.addEventListener('pageshow', event => {
      if (event.persisted) {
        replayUrlState();
        refreshCatalog();
      } else {
        guardCatalogSurface();
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        if (navigator.onLine === false) setSync('offline');
        else refreshCatalog();
      }
    });
  }

  function boot()''',
    re.S
)

replace_once(
    'js/pages/catalog/mantenimiento-catalogo.js',
    "    document.getElementById('tt-catalog-retry')?.addEventListener('click', () => {\n      setSync('loading');\n      location.reload();\n    });",
    "    document.getElementById('tt-catalog-retry')?.addEventListener('click', refreshCatalog);"
)

replace_once(
    'js/pages/collections/presentacion-colecciones.js',
    "    return products.filter(product =>\n      normalizeSlug(product?.category || product?.cat) === normalized &&\n      clean(product?.name)\n    ).length;",
    "    return products.filter(product =>\n      product?.active !== false &&\n      normalizeSlug(product?.category || product?.cat) === normalized &&\n      clean(product?.name)\n    ).length;"
)

replace_once(
    'js/pages/collections/presentacion-colecciones.js',
    "        'No hay colecciones disponibles todavía.',\n        true\n      ),",
    "        'No hay colecciones disponibles todavía.',\n        false\n      ),"
)

p = Path('js/pages/collections/estado-colecciones.js')
text = p.read_text(encoding='utf-8')
marker = "function sortCols(list) {\n  return list.slice().sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'es'));\n}\n"
if marker not in text:
    raise SystemExit('No se encontró sortCols de colecciones')
policy = marker + '''
function canonicalCollectionSlug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^bags?$/, 'bolsos')
    .replace(/^ear-cuffs?$/, 'earcuff')
    .replace(/^arm-cuffs?$/, 'armcuff')
    .replace(/^jewelry-box$/, 'joyeros');
}

function uniquePublishedCollections(list) {
  const seen = new Set();
  return sortCols((Array.isArray(list) ? list : []).filter(item => item?.visible !== false))
    .filter(item => {
      const key = canonicalCollectionSlug(item?.slug);
      if (!key || seen.has(key)) {
        if (key) console.warn('[collections-store] Slug publicado duplicado ignorado:', item?.slug, '→', key);
        return false;
      }
      seen.add(key);
      return true;
    });
}
'''
text = text.replace(marker, policy, 1)
old = "  latestVisibleCollections = collections.filter(item => item.visible !== false);"
if text.count(old) != 1:
    raise SystemExit('No se encontró publishPublic de colecciones')
text = text.replace(old, "  latestVisibleCollections = uniquePublishedCollections(collections);", 1)
p.write_text(text, encoding='utf-8')
