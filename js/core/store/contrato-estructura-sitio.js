/* =============================================================
   TINTIN — Contrato estructural canónico del sitio

   Autoridad de estructura física de las páginas públicas.
   - Describe qué superficies existen, en qué orden y en qué zona segura viven.
   - NO almacena HTML/CSS arbitrario ni datos comerciales.
   - Diferencia contenido editable, superficies dinámicas y flujos protegidos.
   - Superadmin, Visual Builder, runtime público y CI consumen este contrato.
   ============================================================= */

export const SITE_STRUCTURE_VERSION = 2;

export const SITE_PUBLIC_PAGE_IDS = Object.freeze([
  'index', 'nosotros', 'catalogo', 'collections', 'product',
  'checkout', 'login', 'perfil', 'contact', 'envios', 'faq',
  'cambios', 'terminos', 'privacidad', '404',
]);

export const SITE_STRUCTURE_MODES = Object.freeze({
  editable: 'editable',
  controlled: 'controlled',
  protected: 'protected',
});

const section = (id, label, root, options = {}) => Object.freeze({
  id,
  label,
  root,
  kind: options.kind || 'native',
  contentSectionId: options.contentSectionId || id,
  zone: String(options.zone || 'main'),
  movable: options.movable !== false,
  hideable: options.hideable === true,
  visualEditable: options.visualEditable !== false,
  blockAnchor: options.blockAnchor !== false && options.visualEditable !== false,
  operational: options.operational === true,
  reason: options.reason || '',
  legacyContentRoots: Object.freeze(options.legacyContentRoots || []),
});

const page = (label, path, mode, sections, options = {}) => Object.freeze({
  label,
  path,
  mode,
  sections: Object.freeze(sections),
  hasFooter: options.hasFooter !== false,
  allowTopBlocks: options.allowTopBlocks !== false,
  legacyPaths: Object.freeze(options.legacyPaths || []),
});

export const SITE_STRUCTURE_CONTRACT = Object.freeze({
  index: page('Inicio', 'index.html', SITE_STRUCTURE_MODES.editable, [
    section('hero', 'Banner principal', '.tt-hero', { zone: 'home-main', hideable: true }),
    section('trust', 'Beneficios y confianza', '.tt-trust-bar', { zone: 'home-main', hideable: true }),
    section('collections_carousel', 'Carrusel de colecciones', '.tt-collection-carousel', {
      zone: 'home-main', hideable: true, operational: true,
      reason: 'Las tarjetas se resuelven desde las colecciones activas; no se guardan copias manuales en la página.',
    }),
    section('editorial_bag', 'Editorial Bags', '[data-tt-section="editorial_bag"]', { zone: 'home-main', hideable: true }),
    section('look', 'Completá tu look', '.tt-look-section', {
      zone: 'home-main', hideable: true, operational: true,
      reason: 'Los productos mostrados se resuelven desde el catálogo vigente.',
    }),
    section('editorial_relojes', 'Editorial Relojes', '[data-tt-section="editorial_relojes"]', { zone: 'home-main', hideable: true }),
    section('reviews', 'Reseñas', '.tt-reviews-section', {
      zone: 'home-main', hideable: true, operational: true,
      reason: 'La participación/reseñas tiene datos dinámicos y permisos propios aunque la superficie visual sea administrable.',
    }),
  ]),

  nosotros: page('Nosotros', 'about.html', SITE_STRUCTURE_MODES.editable, [
    section('hero', 'Encabezado', '.tt-page-hero', { zone: 'about-main' }),
    section('historia', 'Nuestra historia', '.tt-about-section', { zone: 'about-main', hideable: true }),
    section('mision', 'Nuestra misión', '.tt-about-mission-section', { zone: 'about-main', hideable: true }),
    section('valores', 'Nuestros valores', '.tt-trust-bar', { zone: 'about-main', hideable: true }),
  ], { legacyPaths: ['nosotros.html'] }),

  catalogo: page('Catálogo', 'catalogo.html', SITE_STRUCTURE_MODES.controlled, [
    section('header', 'Encabezado del catálogo', '.cat-hero', {
      zone: 'catalog-intro', hideable: false,
      legacyContentRoots: ['.catalog-header, .tt-page-hero'],
    }),
    section('catalog_runtime', 'Filtros y resultados', '.cat-layout', {
      zone: 'catalog-runtime', kind: 'operational', movable: false, hideable: false, visualEditable: false, blockAnchor: false, operational: true,
      reason: 'La grilla, filtros, stock, búsqueda y paginación dependen del runtime del catálogo.',
    }),
  ]),

  collections: page('Colecciones', 'collections.html', SITE_STRUCTURE_MODES.controlled, [
    section('header', 'Encabezado', '.tt-page-hero', { zone: 'collections-main' }),
    section('collections_grid', 'Grilla de colecciones', '.tt-colls-page-section', {
      zone: 'collections-main', kind: 'operational', hideable: true, operational: true,
      reason: 'Las tarjetas se generan desde las colecciones activas del catálogo.',
    }),
    section('featured_products', 'Productos destacados', '.tt-products-section', {
      zone: 'collections-main', kind: 'operational', hideable: true, operational: true,
      reason: 'Los productos se resuelven desde Firestore; la estructura visual sí puede administrarse.',
    }),
  ]),

  product: page('Producto', 'product.html', SITE_STRUCTURE_MODES.controlled, [
    section('product_detail', 'Detalle del producto', '.tt-product-page', {
      zone: 'product-core', kind: 'operational', movable: false, hideable: false, visualEditable: false, blockAnchor: false, operational: true,
      reason: 'Precio, stock, variantes y acciones comerciales son datos/runtime críticos.',
    }),
    section('benefits', 'Beneficios', '.tinben', { zone: 'product-between', hideable: true }),
    section('selection', 'Tu selección', '.tinsel', {
      zone: 'product-selection', kind: 'operational', movable: false, hideable: false, visualEditable: false, blockAnchor: false, operational: true,
      reason: 'Esta superficie depende del estado de compra y del carrito.',
    }),
    section('related', 'Productos relacionados', '.tt-related-section', {
      zone: 'product-after', kind: 'operational', hideable: true, operational: true,
      reason: 'Los productos se calculan desde el catálogo; no se guardan copias manuales.',
    }),
  ], { allowTopBlocks: false }),

  checkout: page('Checkout', 'checkout.html', SITE_STRUCTURE_MODES.protected, [
    section('steps', 'Indicador de pasos', '.ck-steps', {
      zone: 'checkout', kind: 'transactional', movable: false, hideable: false, visualEditable: false, blockAnchor: false, operational: true,
      reason: 'El orden de pasos forma parte del contrato transaccional del checkout.',
    }),
    section('checkout_flow', 'Flujo de compra', '.ck-body', {
      zone: 'checkout', kind: 'transactional', movable: false, hideable: false, visualEditable: false, blockAnchor: false, operational: true,
      reason: 'Totales, envío, datos, pago y confirmación deben permanecer bajo control del runtime seguro.',
    }),
  ], { hasFooter: false, allowTopBlocks: false }),

  login: page('Acceso', 'login.html', SITE_STRUCTURE_MODES.protected, [
    section('login_flow', 'Acceso y registro', '.login-shell', {
      zone: 'identity', kind: 'identity', movable: false, hideable: false, visualEditable: false, blockAnchor: false, operational: true,
      reason: 'Autenticación, OTP, Google y alta de perfil no son contenido CMS libre.',
    }),
  ], { hasFooter: false, allowTopBlocks: false }),

  perfil: page('Perfil', 'perfil.html', SITE_STRUCTURE_MODES.protected, [
    section('profile_flow', 'Perfil y pedidos', '.perfil-wrap', {
      zone: 'identity', kind: 'identity', movable: false, hideable: false, visualEditable: false, blockAnchor: false, operational: true,
      reason: 'Datos de identidad, direcciones y pedidos requieren flujo controlado.',
    }),
  ], { hasFooter: false, allowTopBlocks: false }),

  contact: page('Contacto', 'contact.html', SITE_STRUCTURE_MODES.editable, [
    section('header', 'Encabezado', '.tt-page-hero', { zone: 'contact-main' }),
    section('form', 'Formulario y contacto directo', '.tt-contact-section', {
      zone: 'contact-main', hideable: true, operational: true,
      reason: 'El contenido visual es administrable, pero el envío y los destinos de contacto vienen de configuración/runtime.',
    }),
  ]),

  envios: page('Envíos', 'envios.html', SITE_STRUCTURE_MODES.controlled, [
    section('header', 'Encabezado', '.tt-page-hero', { zone: 'shipping-main' }),
    section('details', 'Información de envíos', '.tt-page-hero + .section', {
      zone: 'shipping-main', hideable: true, operational: true,
      reason: 'Los textos son editoriales; ciudades/costos siguen viniendo de configuración operativa.',
    }),
  ]),

  faq: page('Preguntas frecuentes', 'preguntas-frecuentes.html', SITE_STRUCTURE_MODES.editable, [
    section('header', 'Encabezado', '.tt-page-hero', { zone: 'faq-main' }),
    section('questions', 'Preguntas y respuestas', '.tt-page-hero + .section', { zone: 'faq-main', hideable: true }),
  ]),

  cambios: page('Cambios y devoluciones', 'cambios-devoluciones.html', SITE_STRUCTURE_MODES.editable, [
    section('header', 'Encabezado', '.tt-page-hero', { zone: 'changes-main' }),
    section('policy', 'Política', '.tt-page-hero + .section', { zone: 'changes-main', hideable: true }),
  ]),

  terminos: page('Términos y condiciones', 'terminos.html', SITE_STRUCTURE_MODES.controlled, [
    section('header', 'Encabezado', '.tt-page-hero', { zone: 'legal-intro' }),
    section('legal_body', 'Contenido legal', '.tt-page-hero + .section', {
      zone: 'legal-body', movable: false, hideable: false, visualEditable: false, blockAnchor: false,
      reason: 'El cuerpo legal se versiona como documento; no se reordena como bloque decorativo.',
    }),
  ]),

  privacidad: page('Privacidad', 'privacidad.html', SITE_STRUCTURE_MODES.controlled, [
    section('header', 'Encabezado', '.tt-page-hero', { zone: 'legal-intro' }),
    section('legal_body', 'Contenido legal', '.tt-page-hero + .section', {
      zone: 'legal-body', movable: false, hideable: false, visualEditable: false, blockAnchor: false,
      reason: 'El cuerpo legal se versiona como documento; no se reordena como bloque decorativo.',
    }),
  ]),

  '404': page('404', '404.html', SITE_STRUCTURE_MODES.controlled, [
    section('not_found', 'Página no encontrada', '.tt-404-wrap', {
      zone: 'recovery', movable: false, hideable: false, blockAnchor: false,
      reason: 'Es una única superficie de recuperación; no necesita reordenamiento.',
    }),
  ], { hasFooter: false, allowTopBlocks: false }),
});

export function getSiteStructurePage(pageId) {
  return SITE_STRUCTURE_CONTRACT[String(pageId || '').trim().toLowerCase()] || null;
}

export function getSiteStructureSection(pageId, sectionId) {
  return getSiteStructurePage(pageId)?.sections?.find(item => item.id === sectionId) || null;
}

export function getSiteSectionZone(pageId, sectionId) {
  return getSiteStructureSection(pageId, sectionId)?.zone || '';
}

export function getMovableSiteSectionIds(pageId, zone = '') {
  return (getSiteStructurePage(pageId)?.sections || [])
    .filter(item => item.movable && (!zone || item.zone === zone))
    .map(item => item.id);
}

export function getProtectedSiteSectionIds(pageId) {
  return (getSiteStructurePage(pageId)?.sections || []).filter(item => !item.movable).map(item => item.id);
}

export function getVisualBlockAnchorIds(pageId) {
  return (getSiteStructurePage(pageId)?.sections || []).filter(item => item.blockAnchor).map(item => item.id);
}

export function isTopVisualAnchorAllowed(pageId) {
  const pageValue = getSiteStructurePage(pageId);
  if (!pageValue || pageValue.mode === SITE_STRUCTURE_MODES.protected || pageValue.allowTopBlocks === false) return false;
  const first = pageValue.sections[0];
  return Boolean(first?.visualEditable);
}

export function sanitizeSiteSectionOrder(pageId, raw = []) {
  const pageValue = getSiteStructurePage(pageId);
  if (!pageValue) return [];
  const canonical = pageValue.sections.map(item => item.id);
  const rawOrder = [];
  const seen = new Set();
  (Array.isArray(raw) ? raw : []).forEach(id => {
    if (canonical.includes(id) && !seen.has(id)) { seen.add(id); rawOrder.push(id); }
  });

  const output = [];
  let cursor = 0;
  while (cursor < pageValue.sections.length) {
    const zone = pageValue.sections[cursor].zone;
    const group = [];
    while (cursor < pageValue.sections.length && pageValue.sections[cursor].zone === zone) {
      group.push(pageValue.sections[cursor]);
      cursor += 1;
    }
    const movableIds = group.filter(item => item.movable).map(item => item.id);
    const orderedMovable = rawOrder.filter(id => movableIds.includes(id));
    movableIds.forEach(id => { if (!orderedMovable.includes(id)) orderedMovable.push(id); });
    let movableIndex = 0;
    group.forEach(item => output.push(item.movable ? orderedMovable[movableIndex++] : item.id));
  }
  return output;
}
