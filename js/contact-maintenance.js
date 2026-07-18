import { db } from './firebase.js?v=tintin-20260716-cloudinary-fix-1';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const file = (location.pathname.split('/').pop() || '').toLowerCase();
if (file === 'contact.html' && !window.TintinContactMaintenanceBooted) {
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
    schedule: 'Consultá nuestros horarios actuales por WhatsApp',
  };

  function injectCss() {
    if (document.getElementById('tt-contact-maintenance-css')) return;
    const style = document.createElement('style');
    style.id = 'tt-contact-maintenance-css';
    style.textContent = `
      body{background:var(--surface-soft,var(--pink-pale,#fff6fa));}
      .tt-contact-section,.tt-contact-grid>div,.tt-contact-alt,#contact-form{background:transparent;}
      .tt-contact-grid{align-items:start;gap:clamp(24px,4vw,64px);}
      .tt-contact-grid>div{min-width:0;}
      #contact-form,.tt-contact-alt{background:var(--surface,#fff);border:1px solid var(--border,#efd6df);border-radius:24px;padding:clamp(18px,3vw,32px);box-shadow:0 12px 36px rgba(87,42,59,.08);}
      .tt-form-input,.tt-form-textarea{background:var(--surface,#fff)!important;color:var(--text,#2b2b2b)!important;border:1.5px solid var(--border,#efd6df)!important;min-height:46px;}
      .tt-form-textarea{min-height:150px;resize:vertical;}
      .tt-form-input:focus,.tt-form-textarea:focus{outline:0;border-color:var(--pink-dark,#ad3f67)!important;box-shadow:0 0 0 3px color-mix(in srgb,var(--pink-dark,#ad3f67) 14%,transparent)!important;}
      .tt-field-error{display:block;margin-top:6px;color:#a32727;font-size:12px;font-weight:700;line-height:1.4;}
      .tt-form-input[aria-invalid="true"],.tt-form-textarea[aria-invalid="true"]{border-color:#b42318!important;}
      #form-success{background:#eef8f1!important;border:1px solid #86c99b!important;color:#235d35!important;border-radius:16px!important;padding:16px!important;}
      #form-success[hidden]{display:none!important;}
      .tt-contact-info-list{display:grid;gap:10px;}
      .tt-contact-info-item{background:var(--surface-soft,#fff6fa);border:1px solid var(--border,#efd6df);border-radius:14px;padding:12px;min-width:0;}
      .tt-contact-info-item a,.tt-contact-info-item span{overflow-wrap:anywhere;}
      .tt-contact-net-state{margin:0 0 14px;padding:10px 14px;border-radius:14px;background:#fff4df;border:1px solid #e5b66b;color:#72501e;font-size:12px;font-weight:700;}
      .tt-contact-new-message{margin-top:12px;display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:10px 18px;border-radius:999px;border:1.5px solid var(--pink-dark,#ad3f67);background:#fff;color:var(--pink-dark,#ad3f67);font-weight:800;cursor:pointer;}
      .tt-contact-submit[disabled]{opacity:.65;cursor:wait;transform:none!important;}
      @media(max-width:1024px){.tt-contact-grid{grid-template-columns:1fr 1fr;gap:24px;}}
      @media(max-width:767px){.tt-contact-grid{grid-template-columns:1fr;}.tt-contact-section{padding-inline:0;}#contact-form,.tt-contact-alt{border-radius:20px;padding:18px;}.tt-page-hero-sub{max-width:34rem;margin-inline:auto;}}
      @media(max-width:390px){#contact-form,.tt-contact-alt{padding:15px;border-radius:16px}.tt-contact-wa-link,.tt-btn-lg{width:100%;justify-content:center;}}
      @media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;transition-duration:.01ms!important;animation-duration:.01ms!important;}}
    `;
    document.head.appendChild(style);
  }

  function setMeta() {
    const url = new URL('contact.html', location.href); url.search = ''; url.hash = '';
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', url.href);
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', url.href);
    const image = new URL('assets/og-cover.jpg', location.href).href;
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
    fieldError(name, values.name.length < 2 ? 'Escribí tu nombre completo.' : '');
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
    const schedule = clean(next.businessHours || next.schedule || config.schedule, 180) || config.schedule;
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
      scheduleItem.innerHTML = `<span class="tt-contact-info-icon">🕐</span><div><strong>${strong?.textContent || 'Horario de atención'}</strong><br><span>${schedule}</span></div>`;
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

  injectCss(); setMeta(); ensureAccessibility(); networkState(); bindForm(); updatePublicContact();
  window.addEventListener('online', networkState); window.addEventListener('offline', networkState);
  onSnapshot(doc(db, 'settings', 'general'), snap => { if (snap.exists()) updatePublicContact(snap.data()); }, error => console.warn('[contact-maintenance] configuración no disponible', error));
  const footer = document.querySelector('.tt-footer-bottom');
  if (footer) footer.textContent = `© 2024-${new Date().getFullYear()} TINTIN ACCESORIOS — TODOS LOS DERECHOS RESERVADOS`;
}
