/* =============================================================
   TINTIN — Contrato estructural canónico del sitio

   Autoridad de estructura física de las páginas públicas.
   - Describe qué superficies existen y en qué orden.
   - NO almacena HTML/CSS arbitrario ni datos comerciales.
   - Diferencia contenido editable, superficies dinámicas y flujos protegidos.
   - El Visual Builder/Super Admin debe consumir este contrato en la siguiente
     capa de integración; CI lo valida desde ahora para impedir divergencias.
   ============================================================= */

export const SITE_STRUCTURE_VERSION = 1;

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
  movable: options.movable !== false,
  hideable: options.hideable === true,
  visualEditable: options.visualEditable !== false,
  operational: options.operational === true,
  reason: options.reason || '',
});

const page = (label, path, mode, sections, options = {}) => Object.freeze({
  label,
  path,
  mode,
  sections: Object.freeze(sections),
  hasFooter: options.hasFooter !== false,
  legacyPaths: Object.freeze(options.legacyPaths || []),
});

export const SITE_STRUCTURE_CONTRACT = Object.freeze({
  index: page('Inicio', 'index.html', SITE_STRUCTURE_MODES.editable, [
    section('hero', 'Banner principal', '.tt-hero', { hideable: true }),
    section('trust', 'Beneficios y confianza', '.tt-trust-bar', { hideable: true }),
    section('collections_carousel', 'Carrusel de colecciones', '.tt-collection-carousel', { hideable: true, operational: true }),
    section('editorial_bag', 'Editorial Bags', '[data-tt-section="editorial_bag"]', { hideable: true }),
    section('look', 'Completá tu look', '.tt-look-section', { hideable: true, operational: true }),
    section('editorial_relojes', 'Editorial Relojes', '[data-tt-section="editorial_relojes"]', { hideable: true }),
    section('reviews', 'Reseñas', '.tt-reviews-section', { hideable: true, operational: true }),
  ]),

  nosotros: page('Nosotros', 'about.html', SITE_STRUCTURE_MODES.editable, [
    section('hero', 'Encabezado', '.tt-page-hero'),
    section('historia', 'Nuestra historia', '.tt-about-section', { hideable: true }),
    section('mision', 'Nuestra misión', '.tt-about-mission-section', { hideable: true }),
    section('valores', 'Nuestros valores', '.tt-trust-bar', { hideable: true }),
  ], { legacyPaths: ['nosotros.html'] }),

  catalogo: page('Catálogo', 'catalogo.html', SITE_STRUCTURE_MODES.controlled, [
    section('header', 'Encabezado del catálogo', '.cat-hero', { hideable: false }),
    section('catalog_runtime', 'Filtros y resultados', '.cat-layout', {
      kind: 'operational', movable: false, hideable: false, visualEditable: false, operational: true,
      reason: 'La grilla, filtros, stock, búsqueda y paginación dependen del runtime del catálogo.',
    }),
  ]),

  collections: page('Colecciones', 'collections.html', SITE_STRUCTURE_MODES.controlled, [
    section('header', 'Encabezado', '.tt-page-hero'),
    section('collections_grid', 'Grilla de colecciones', '.tt-colls-page-section', {
      kind: 'operational', hideable: true, operational: true,
      reason: 'Las tarjetas se generan desde las colecciones activas del catálogo.',
    }),
    section('featured_products', 'Productos destacados', '.tt-products-section', {
      kind: 'operational', hideable: true, operational: true,
      reason: 'Los productos se resuelven desde Firestore; la estructura visual sí puede administrarse.',
    }),
  ]),

  product: page('Producto', 'product.html', SITE_STRUCTURE_MODES.controlled, [
    section('product_detail', 'Detalle del producto', '.tt-product-page', {
      kind: 'operational', movable: false, hideable: false, visualEditable: false, operational: true,
      reason: 'Precio, stock, variantes y acciones comerciales son datos/runtime críticos.',
    }),
    section('benefits', 'Beneficios', '.tinben', { hideable: true }),
    section('selection', 'Tu selección', '.tinsel', {
      kind: 'operational', movable: false, hideable: false, visualEditable: false, operational: true,
      reason: 'Esta superficie depende del estado de compra y del carrito.',
    }),
    section('related', 'Productos relacionados', '.tt-related-section', {
      kind: 'operational', hideable: true, operational: true,
      reason: 'Los productos se calculan desde el catálogo; no se guardan copias manuales.',
    }),
  ]),

  checkout: page('Checkout', 'checkout.html', SITE_STRUCTURE_MODES.protected, [
    section('steps', 'Indicador de pasos', '.ck-steps', {
      kind: 'transactional', movable: false, hideable: false, visualEditable: false, operational: true,
      reason: 'El orden de pasos forma parte del contrato transaccional del checkout.',
    }),
    section('checkout_flow', 'Flujo de compra', '.ck-body', {
      kind: 'transactional', movable: false, hideable: false, visualEditable: false, operational: true,
      reason: 'Totales, envío, datos, pago y confirmación deben permanecer bajo control del runtime seguro.',
    }),
  ], { hasFooter: false }),

  login: page('Acceso', 'login.html', SITE_STRUCTURE_MODES.protected, [
    section('login_flow', 'Acceso y registro', '.login-shell', {
      kind: 'identity', movable: false, hideable: false, visualEditable: false, operational: true,
      reason: 'Autenticación, OTP, Google y alta de perfil no son contenido CMS libre.',
    }),
  ], { hasFooter: false }),

  perfil: page('Perfil', 'perfil.html', SITE_STRUCTURE_MODES.protected, [
    section('profile_flow', 'Perfil y pedidos', '.perfil-wrap', {
      kind: 'identity', movable: false, hideable: false, visualEditable: false, operational: true,
      reason: 'Datos de identidad, direcciones y pedidos requieren flujo controlado.',
    }),
  ], { hasFooter: false }),

  contact: page('Contacto', 'contact.html', SITE_STRUCTURE_MODES.editable, [
    section('header', 'Encabezado', '.tt-page-hero'),
    section('form', 'Formulario y contacto directo', '.tt-contact-section', { hideable: true, operational: true }),
  ]),

  envios: page('Envíos', 'envios.html', SITE_STRUCTURE_MODES.controlled, [
    section('header', 'Encabezado', '.tt-page-hero'),
    section('details', 'Información de envíos', '.tt-page-hero + .section', {
      hideable: true, operational: true,
      reason: 'Los textos son editoriales; ciudades/costos siguen viniendo de configuración operativa.',
    }),
  ]),

  faq: page('Preguntas frecuentes', 'preguntas-frecuentes.html', SITE_STRUCTURE_MODES.editable, [
    section('header', 'Encabezado', '.tt-page-hero'),
    section('questions', 'Preguntas y respuestas', '.tt-page-hero + .section', { hideable: true }),
  ]),

  cambios: page('Cambios y devoluciones', 'cambios-devoluciones.html', SITE_STRUCTURE_MODES.editable, [
    section('header', 'Encabezado', '.tt-page-hero'),
    section('policy', 'Política', '.tt-page-hero + .section', { hideable: true }),
  ]),

  terminos: page('Términos y condiciones', 'terminos.html', SITE_STRUCTURE_MODES.controlled, [
    section('header', 'Encabezado', '.tt-page-hero'),
    section('legal_body', 'Contenido legal', '.tt-page-hero + .section', {
      movable: false, hideable: false, visualEditable: false,
      reason: 'El cuerpo legal se versiona como documento; no se reordena como bloque decorativo.',
    }),
  ]),

  privacidad: page('Privacidad', 'privacidad.html', SITE_STRUCTURE_MODES.controlled, [
    section('header', 'Encabezado', '.tt-page-hero'),
    section('legal_body', 'Contenido legal', '.tt-page-hero + .section', {
      movable: false, hideable: false, visualEditable: false,
      reason: 'El cuerpo legal se versiona como documento; no se reordena como bloque decorativo.',
    }),
  ]),

  '404': page('404', '404.html', SITE_STRUCTURE_MODES.controlled, [
    section('not_found', 'Página no encontrada', '.tt-404-wrap', {
      movable: false, hideable: false,
      reason: 'Es una única superficie de recuperación; no necesita reordenamiento.',
    }),
  ], { hasFooter: false }),
});

export function getSiteStructurePage(pageId) {
  return SITE_STRUCTURE_CONTRACT[String(pageId || '').trim().toLowerCase()] || null;
}

export function getSiteStructureSection(pageId, sectionId) {
  return getSiteStructurePage(pageId)?.sections?.find(item => item.id === sectionId) || null;
}

export function getMovableSiteSectionIds(pageId) {
  return (getSiteStructurePage(pageId)?.sections || []).filter(item => item.movable).map(item => item.id);
}

export function getProtectedSiteSectionIds(pageId) {
  return (getSiteStructurePage(pageId)?.sections || []).filter(item => !item.movable).map(item => item.id);
}
