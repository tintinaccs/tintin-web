import { sanitizeImageUrl } from '../images/utilidades-imagenes.js?v=tintin-20260716-cloudinary-fix-1';

export const WELCOME_VERSION = 'home-welcome-v5-media';

export const DEFAULT_WELCOME_STEPS = Object.freeze([
  Object.freeze({ id: 'welcome-1', icon: '🌸', image: '', title: 'Bienvenida a Tintin', text: 'Te cuento rapidito cómo comprar y encontrar tus accesorios favoritos sin perderte', cta: 'Empezar', active: true }),
  Object.freeze({ id: 'welcome-2', icon: '🛍️', image: '', title: 'Explorá la tienda', text: 'Desde “Tienda” podés ver relojes, aros, collares, bags, pulseras y más', cta: 'Siguiente', active: true }),
  Object.freeze({ id: 'welcome-3', icon: '🛒', image: '', title: 'Agregá al carrito', text: 'Cuando veas algo que te guste, agregalo al carrito. Tu carrito queda separado por cuenta', cta: 'Siguiente', active: true }),
  Object.freeze({ id: 'welcome-4', icon: '✨', image: '', title: 'Finalizá tu pedido', text: 'Completá tus datos de entrega y pago. Si necesitás ayuda, también podés escribirnos por WhatsApp', cta: 'Entendido', active: true })
]);

export function normalizeWelcomeStep(step = {}, index = 0) {
  return {
    id: String(step.id || `welcome-${index + 1}`).slice(0, 80),
    icon: String(step.icon || '🌸').slice(0, 8),
    // Imagen opcional por paso: si está presente, el runtime la muestra en
    // vez del emoji-ícono. Se sanitiza acá (fuente única de verdad para
    // admin y runtime público) para no confiar en lo que venga de Firestore.
    image: sanitizeImageUrl(step.image || ''),
    title: String(step.title || `Mensaje ${index + 1}`).slice(0, 90),
    text: String(step.text || '').slice(0, 420),
    cta: String(step.cta || (index === 0 ? 'Empezar' : 'Siguiente')).slice(0, 40),
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
    title: String(data.title || 'Mensaje de bienvenida').slice(0, 90),
    subtitle: String(data.subtitle || 'Tu primera guía Tintin').slice(0, 90),
    steps
  };
}
