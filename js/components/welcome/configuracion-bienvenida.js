export const WELCOME_VERSION = 'home-welcome-v4-unified';

export const DEFAULT_WELCOME_STEPS = Object.freeze([
  Object.freeze({ id: 'welcome-1', icon: '🌸', title: 'Bienvenida a Tintin', text: 'Te cuento rapidito cómo comprar y encontrar tus accesorios favoritos sin perderte.', cta: 'Empezar', active: true }),
  Object.freeze({ id: 'welcome-2', icon: '🛍️', title: 'Explorá la tienda', text: 'Desde “Tienda” podés ver relojes, aros, collares, bags, pulseras y más.', cta: 'Siguiente', active: true }),
  Object.freeze({ id: 'welcome-3', icon: '🛒', title: 'Agregá al carrito', text: 'Cuando veas algo que te guste, agregalo al carrito. Tu carrito queda separado por cuenta.', cta: 'Siguiente', active: true }),
  Object.freeze({ id: 'welcome-4', icon: '✨', title: 'Finalizá tu pedido', text: 'Completá tus datos de entrega y pago. Si necesitás ayuda, también podés escribirnos por WhatsApp.', cta: 'Entendido', active: true })
]);

export function normalizeWelcomeStep(step = {}, index = 0) {
  return {
    id: String(step.id || `welcome-${index + 1}`).slice(0, 80),
    icon: String(step.icon || '🌸').slice(0, 8),
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
