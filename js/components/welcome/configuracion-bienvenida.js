import { sanitizeImageUrl } from '../images/utilidades-imagenes.js?v=tintin-20261030-home-history-5';

// Cambiar la presentación no debe reactivar una guía que la cuenta ya completó.
export const WELCOME_VERSION = 'home-welcome-v5-media';

export const DEFAULT_WELCOME_STEPS = Object.freeze([
  Object.freeze({ id: 'welcome-1', icon: 'inicio', image: '', title: 'Bienvenida a Tintin', text: 'Conocé el catálogo, elegí tus accesorios y revisá cómo completar tu pedido.', cta: 'Comenzar', active: true }),
  Object.freeze({ id: 'welcome-2', icon: 'catalogo', image: '', title: 'Explorá el catálogo', text: 'Buscá por categoría y abrí un producto para ver sus fotos, precio y opciones disponibles.', cta: 'Siguiente', active: true }),
  Object.freeze({ id: 'welcome-3', icon: 'carrito', image: '', title: 'Revisá tu carrito', text: 'Agregá los productos que elegiste y revisá sus cantidades. Desde el carrito podés continuar con tu pedido.', cta: 'Siguiente', active: true }),
  Object.freeze({ id: 'welcome-4', icon: 'pedido', image: '', title: 'Completá tu pedido', text: 'Indicá cómo querés recibirlo, completá los datos y elegí un medio de pago disponible. Revisá el total antes de confirmar.', cta: 'Entendido', active: true })
]);

const ICON_PATHS = Object.freeze({
  inicio: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z"/>',
  catalogo: '<rect x="3" y="3" width="7" height="7" rx="1.8"/><rect x="14" y="3" width="7" height="7" rx="1.8"/><rect x="3" y="14" width="7" height="7" rx="1.8"/><rect x="14" y="14" width="7" height="7" rx="1.8"/>',
  carrito: '<path d="M3 4h2l2.2 11h11.6l2-8H5.6M8 11h11.8"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
  pedido: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z"/><path d="m9 10 2 2 4-4M9 16h6"/>'
});

// Sólo paths propios y constantes generan SVG; un emoji personalizado sigue siendo texto.
export function welcomeIconSvg(icon) {
  const paths = Object.hasOwn(ICON_PATHS, icon) ? ICON_PATHS[icon] : '';
  return paths ? `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>` : '';
}

// Compatibilidad sólo para las frases base publicadas; nunca sobrescribir texto personalizado.
const LEGACY_STEPS = Object.freeze([
  { titles: ['Bienvenida a Tintin'], texts: ['Te cuento rapidito cómo comprar y encontrar tus accesorios favoritos sin perderte.'], icons: ['🌸'], ctas: ['Empezar'] },
  { titles: ['Explorá la tienda', 'Explorá el catálogo'], texts: ['Desde “Tienda” podés ver relojes, aros, collares, bags, pulseras y más.', 'Desde “Catálogo” podés ver relojes, aros, collares, bags, pulseras y más.', 'Desde “Catálogo” podés explorar las categorías disponibles y elegir tus accesorios.'], icons: ['🛍️'], ctas: [] },
  { titles: ['Agregá al carrito'], texts: ['Cuando veas algo que te guste, agregalo al carrito. Tu carrito queda separado por cuenta.', 'Cuando veas algo que te guste, agregalo al carrito. Tu carrito se mantiene sincronizado al iniciar sesión.'], icons: ['🛒'], ctas: [] },
  { titles: ['Finalizá tu pedido'], texts: ['Completá tus datos de entrega y pago. Si necesitás ayuda, también podés escribirnos por WhatsApp.'], icons: ['✨'], ctas: ['Finalizar'] }
]);

export function normalizeWelcomeStep(step = {}, index = 0) {
  const title = String(step.title || `Mensaje ${index + 1}`);
  const text = String(step.text || '');
  const legacyIndex = LEGACY_STEPS.findIndex(item => item.titles.includes(title) && item.texts.includes(text));
  const base = DEFAULT_WELCOME_STEPS[legacyIndex];
  const legacy = LEGACY_STEPS[legacyIndex];
  const icon = String(step.icon || base?.icon || 'inicio');
  const cta = String(step.cta || base?.cta || (index === 0 ? 'Comenzar' : 'Siguiente'));
  return {
    id: String(step.id || `welcome-${index + 1}`).slice(0, 80),
    icon: (legacy?.icons.includes(icon) ? base.icon : icon).slice(0, 8),
    image: sanitizeImageUrl(step.image || ''),
    title: (base?.title || title.replace(/^Explorá la tienda$/i, 'Explorá el catálogo')).slice(0, 90),
    text: (base?.text || text.replace(/^Desde “Tienda”/, 'Desde “Catálogo”')).slice(0, 420),
    cta: (legacy?.ctas.includes(cta) ? base.cta : cta).slice(0, 40),
    active: step.active !== false
  };
}

export function defaultWelcomeSteps() {
  return DEFAULT_WELCOME_STEPS.map((step, index) => normalizeWelcomeStep(step, index));
}

export function normalizeWelcomeConfig(data = {}) {
  const steps = Array.isArray(data.steps) && data.steps.length
    ? data.steps.map(normalizeWelcomeStep)
    : defaultWelcomeSteps();
  return {
    enabled: data.enabled !== false,
    previewEnabled: data.previewEnabled !== false,
    title: String(!data.title || data.title === 'Mensaje de bienvenida' ? 'Tintin' : data.title).slice(0, 90),
    subtitle: String(!data.subtitle || data.subtitle === 'Tu primera guía Tintin' ? 'Cómo comprar' : data.subtitle).slice(0, 90),
    steps
  };
}
