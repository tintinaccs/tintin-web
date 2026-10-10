import { isValidCustomerName } from '../profile/configuracion-inicial-perfil.mjs?v=tintin-20261010-registration-name-2';
import { db, appCheckReady } from '../../core/firebase/firebase.js?v=tintin-20260924-auth-popup-resolver-1-launch-20260926-1';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const routePath = (location.pathname || '').toLowerCase().replace(/\/+$/, '');
if (/(?:^|\/)contact(?:\.html)?$/.test(routePath) && !window.TintinContactMaintenanceBooted) {
  window.TintinContactMaintenanceBooted = true;

  const clean = (value, max = 500) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
  const digits = value => String(value || '').replace(/\D/g, '').slice(0, 18);
  const form = document.getElementById('contact-form');
  const success = document.getElementById('form-success');
  const submit = form?.querySelector('[type="submit"]');
  let sending = false;
  let config = {
    whatsapp: '595981299331',
    phoneLabel: '+595 981 299 331',
    instagram: 'tintinaccs',
    email: 'tintinaccs@gmail.com',
    address: 'Paraguay — Zona Central y todo el país',
    schedule: '09:00 a 22:00 hs.',
  };



  function setMeta() {
    const url = new URL('/contact', location.origin);
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', url.href);
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', url.href);
    const image = new URL('/assets/og-cover.jpg', location.origin).href;
    document.querySelector('meta[property="og:image"]')?.setAttribute('content', image);
    document.querySelector('meta[name="twitter:image"]')?.setAttribute('content', image);
  }

  function ensureAccessibility() {
    if (!form) return;
    form.setAttribute('aria-describedby', 'tt-contact-form-status');
    ['f-nombre','f-email','f-tel','f-msg'].forEach(id => {
      const input = document.getElementById(id);
      if (!input) return;
      input.setAttribute('maxlength', id === 'f-msg' ? '1200' : id === 'f-email' ? '180' : '120');
      input.setAttribute('aria-invalid', 'false');
    });
    success?.setAttribute('role','status');
    success?.setAttribute('aria-live','polite');
    submit?.classList.add('tt-contact-submit');
    // Este flujo termina al abrir WhatsApp y administra su propio estado.
    // El busy genérico no debe anunciar una escritura pendiente tras el éxito.
    if (submit) submit.dataset.ttNoBusy = '1';
    const status = document.createElement('div');
    status.id = 'tt-contact-form-status';
    status.className = 'tt-sr-only';
    status.setAttribute('aria-live','polite');
    form.appendChild(status);
  }

  function fieldError(input, message) {
    const id = `${input.id}-error`;
    let node = document.getElementById(id);
    if (!node) {
      node = document.createElement('span');
      node.id = id;
      node.className = 'tt-field-error';
      input.insertAdjacentElement('afterend', node);
    }
    node.textContent = message || '';
    node.hidden = !message;
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (message) input.setAttribute('aria-describedby', id); else input.removeAttribute('aria-describedby');
  }

  function validate() {
    const name = document.getElementById('f-nombre');
    const email = document.getElementById('f-email');
    const phone = document.getElementById('f-tel');
    const message = document.getElementById('f-msg');
    const values = {
      name: clean(name?.value, 120),
      email: clean(email?.value, 180),
      phone: clean(phone?.value, 80),
      message: clean(message?.value, 1200),
    };
    fieldError(name, !isValidCustomerName(values.name) ? 'Escribí tu nombre y apellido (al menos dos palabras).' : '');
    fieldError(message, values.message.length < 5 ? 'Contanos brevemente en qué podemos ayudarte.' : '');
    fieldError(email, values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email) ? 'Revisá el formato del correo.' : '');
    fieldError(phone, values.phone && digits(values.phone).length < 8 ? 'Revisá el número de teléfono.' : '');
    const invalid = form.querySelector('[aria-invalid="true"]');
    invalid?.focus();
    return invalid ? null : values;
  }

  function updatePublicContact(next = {}) {
    const wa = digits(next.whatsappNumber || next.whatsapp || config.whatsapp) || config.whatsapp;
    const phone = clean(next.phone || next.publicPhone || config.phoneLabel, 80) || config.phoneLabel;
    const instagram = clean(next.instagram || config.instagram, 80).replace(/^@/,'') || config.instagram;
    const email = clean(next.email || next.contactEmail || config.email, 180) || config.email;
    const address = clean(next.address || next.location || config.address, 180) || config.address;
    const schedule = '09:00 a 22:00 hs.';
    config = { whatsapp: wa, phoneLabel: phone, instagram, email, address, schedule };

    document.querySelectorAll('a[href*="wa.me/"]').forEach(link => {
      const current = new URL(link.href);
      const text = current.searchParams.get('text');
      link.href = `https://wa.me/${wa}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
    });
    document.querySelectorAll('.tt-contact-phone').forEach(link => { link.textContent = phone; link.href = `tel:+${digits(phone) || wa}`; });
    document.querySelectorAll('.tt-contact-email').forEach(link => { link.textContent = email; link.href = `mailto:${email}`; });
    document.querySelectorAll('.tt-contact-addr').forEach(node => { node.textContent = address; });
    const instagramLink = [...document.querySelectorAll('a[href*="instagram.com"]')].find(a => a.textContent.includes('@'));
    if (instagramLink) { instagramLink.textContent = `@${instagram}`; instagramLink.href = `https://instagram.com/${instagram}`; }
    const scheduleItem = [...document.querySelectorAll('.tt-contact-info-item')].find(item => item.textContent.includes('Horario de atención'));
    if (scheduleItem) {
      const strong = scheduleItem.querySelector('strong');
      const icon = scheduleItem.querySelector('.tt-contact-info-icon') || document.createElement('span');
      icon.className = 'tt-contact-info-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.replaceChildren();
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '20');
      svg.setAttribute('height', '20');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', '#b84c72');
      svg.setAttribute('stroke-width', '1.8');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '12');
      circle.setAttribute('cy', '12');
      circle.setAttribute('r', '10');
      const hands = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      hands.setAttribute('points', '12 6 12 12 16 14');
      svg.append(circle, hands);
      icon.appendChild(svg);
      const content = document.createElement('div');
      const heading = document.createElement('strong');
      heading.textContent = strong?.textContent || 'Horario de atención';
      const value = document.createElement('span');
      value.textContent = schedule;
      content.append(heading, document.createElement('br'), value);
      scheduleItem.replaceChildren(icon, content);
    }
  }

  function networkState() {
    let node = document.getElementById('tt-contact-net-state');
    if (!node && form) {
      node = document.createElement('div');
      node.id = 'tt-contact-net-state';
      node.className = 'tt-contact-net-state';
      node.setAttribute('role','status');
      form.before(node);
    }
    if (!node) return;
    node.hidden = navigator.onLine !== false;
    node.textContent = 'Sin conexión. Podés completar el mensaje, pero necesitás internet para abrir WhatsApp.';
  }

  function bindForm() {
    if (!form) return;
    form.addEventListener('submit', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (sending) return;
      const values = validate();
      if (!values) return;
      if (navigator.onLine === false) { networkState(); document.getElementById('tt-contact-net-state')?.focus?.(); return; }
      sending = true;
      submit.disabled = true;
      submit.textContent = 'Abriendo WhatsApp…';
      const lines = [`¡Hola Tintin! 💕`, `Soy ${values.name}.`];
      if (values.phone) lines.push(`Mi teléfono es ${values.phone}.`);
      if (values.email) lines.push(`Mi correo es ${values.email}.`);
      lines.push(values.message);
      const waUrl = `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(lines.join('\n'))}`;
      const opened = window.open(waUrl, '_blank', 'noopener');
      success.hidden = false;
      success.style.display = 'block';
      form.hidden = true;
      const fallback = document.getElementById('form-wa-fallback');
      if (fallback) { fallback.href = waUrl; fallback.style.display = opened ? 'none' : 'inline-flex'; }
      let again = document.getElementById('tt-contact-new-message');
      if (!again) {
        again = document.createElement('button');
        again.type = 'button'; again.id = 'tt-contact-new-message'; again.className = 'tt-contact-new-message'; again.textContent = 'Escribir otra consulta';
        success.appendChild(again);
        again.addEventListener('click', () => {
          success.hidden = true; success.style.display = 'none'; form.hidden = false; sending = false; submit.disabled = false; submit.textContent = 'Enviar por WhatsApp 💬'; form.reset(); document.getElementById('f-nombre')?.focus();
        });
      }
      success.focus?.();
    }, true);
  }

  // La hoja de estilo forma parte del HTML inicial. setMeta(); ensureAccessibility(); networkState(); bindForm(); updatePublicContact();
  window.addEventListener('online', networkState); window.addEventListener('offline', networkState);
  appCheckReady.then(ready => {
    if (!ready) return;
    onSnapshot(
      doc(db, 'settings', 'general'),
      snap => { if (snap.exists()) updatePublicContact(snap.data()); },
      error => console.warn('[contact-maintenance] configuración no disponible', error)
    );
  });
  const footer = document.querySelector('.tt-footer-bottom');
  if (footer) footer.textContent = `© 2024-${new Date().getFullYear()} TINTIN ACCESORIOS — TODOS LOS DERECHOS RESERVADOS`;
}
