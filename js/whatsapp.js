import { onPublicSettings } from './public-settings-store.js?v=tintin-20260720-read-budget-1';

function safeUrl(value) {
  try {
    const url = new URL(String(value || ''), location.href);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function applyWaNumber(rawNumber) {
  const digits = String(rawNumber || '').replace(/\D/g, '');
  if (!digits) return;
  document.querySelectorAll('a[href*="wa.me/"]').forEach(anchor => {
    anchor.href = anchor.href.replace(/wa\.me\/\d+/, `wa.me/${digits}`);
  });
  document.querySelectorAll('a.tt-contact-phone').forEach(anchor => {
    anchor.href = `tel:+${digits}`;
  });
}

function applyEmail(email) {
  const value = String(email || '').trim();
  if (!value) return;
  document.querySelectorAll('a.tt-contact-email').forEach(anchor => {
    anchor.href = `mailto:${value}`;
    anchor.textContent = value;
  });
}

function applyInstagram(value) {
  const url = safeUrl(value);
  if (!url) return;
  document.querySelectorAll('a[href*="instagram.com"]').forEach(anchor => {
    anchor.href = url;
  });
}

function applyAddress(address) {
  const value = String(address || '').trim();
  if (!value) return;
  document.querySelectorAll('.tt-contact-addr').forEach(element => {
    element.textContent = value;
  });
}

function ensureSocialLink(list, className, label, value) {
  const url = safeUrl(value);
  const existing = list.querySelector(`.${className}`)?.closest('li');
  if (!url) {
    existing?.remove();
    return;
  }
  if (existing) {
    const anchor = existing.querySelector('a');
    anchor.href = url;
    return;
  }
  const item = document.createElement('li');
  const anchor = document.createElement('a');
  anchor.className = className;
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener';
  anchor.textContent = label;
  item.appendChild(anchor);
  list.appendChild(item);
}

function applySocialExtra(config) {
  document.querySelectorAll('.tt-footer-col').forEach(column => {
    const title = column.querySelector('.tt-footer-col-title');
    if (!title || title.textContent.trim() !== 'Contacto') return;
    const list = column.querySelector('ul');
    if (!list) return;
    ensureSocialLink(list, 'tt-contact-fb', 'Facebook', config.facebook);
    ensureSocialLink(list, 'tt-contact-tt', 'TikTok', config.tiktok);
  });
}

const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
const pageOwnsSettings = new Set([
  'contact.html',
  'terminos.html',
  'privacidad.html',
  'envios.html',
  'cambios-devoluciones.html',
  'preguntas-frecuentes.html'
]);

if (!pageOwnsSettings.has(page)) {
  onPublicSettings(config => {
    applyWaNumber(config.whatsappNumber);
    applyEmail(config.contactEmail);
    applyInstagram(config.instagram);
    applyAddress(config.storeAddress);
    applySocialExtra(config);
  });
}
