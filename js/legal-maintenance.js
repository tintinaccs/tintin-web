import { db } from './firebase.js?v=tintin-20260716-cloudinary-fix-1';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const file = (location.pathname.split('/').pop() || '').toLowerCase();
const supported = new Set(['terminos.html', 'privacidad.html']);

if (supported.has(file) && !window.TintinLegalMaintenanceBooted) {
  window.TintinLegalMaintenanceBooted = true;

  const clean = (value, max = 180) => String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
  const digits = value => String(value || '').replace(/\D/g, '').slice(0, 18);

  let contact = {
    whatsapp: '595981299331',
    email: 'tintinaccs@gmail.com',
  };

  function injectStyles() {
    if (document.getElementById('tt-legal-maintenance-css')) return;
    const style = document.createElement('style');
    style.id = 'tt-legal-maintenance-css';
    style.textContent = `
      body{background:var(--surface-soft,var(--pink-pale,#fff6fa));}
      .tt-legal-content{max-width:780px;margin-inline:auto;}
      .tt-legal-updated{color:var(--text-muted,#755f67);font-size:13px;margin:0 0 28px;}
      .tt-legal-nav{background:var(--surface,#fff);border:1px solid var(--border,#efd6df);border-radius:20px;padding:18px;margin:0 0 24px;box-shadow:0 10px 30px rgba(87,42,59,.06);}
      .tt-legal-nav-title{margin:0 0 10px;font-size:13px;font-weight:900;color:var(--text,#2b2b2b);text-transform:uppercase;letter-spacing:.06em;}
      .tt-legal-nav-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 16px;margin:0;padding:0;list-style:none;}
      .tt-legal-nav a{display:block;padding:8px 10px;border-radius:10px;color:var(--pink-dark,#ad3f67);font-size:12px;font-weight:750;text-decoration:none;line-height:1.35;}
      .tt-legal-nav a:hover,.tt-legal-nav a:focus-visible{background:var(--surface-soft,#fff6fa);outline:2px solid color-mix(in srgb,var(--pink-dark,#ad3f67) 38%,transparent);outline-offset:2px;}
      .tt-info-block{background:var(--surface,#fff);border:1px solid var(--border,#efd6df);border-radius:20px;padding:clamp(18px,3vw,28px);margin-bottom:18px;box-shadow:0 10px 30px rgba(87,42,59,.05);scroll-margin-top:96px;}
      .tt-info-block p,.tt-info-block li{color:var(--text,#2b2b2b);line-height:1.75;overflow-wrap:anywhere;}
      .tt-info-block ul{padding-left:1.25rem;}
      .tt-info-block a{color:var(--pink-dark,#ad3f67);font-weight:750;text-underline-offset:3px;}
      .tt-info-title{line-height:1.25;}
      .tt-legal-actions{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;margin-top:36px;}
      .tt-legal-note{background:#fff8e9;border:1px solid #e8c47f;color:#684b17;border-radius:16px;padding:14px 16px;font-size:12px;line-height:1.55;margin-bottom:24px;}
      @media(max-width:767px){.tt-legal-content{max-width:none;}.tt-legal-nav-list{grid-template-columns:1fr;}.tt-info-block{border-radius:16px;padding:18px;}.tt-page-hero-title{font-size:clamp(1.85rem,9vw,2.5rem);}}
      @media(max-width:390px){.tt-info-block{padding:15px}.tt-legal-nav{padding:14px;border-radius:16px}.tt-legal-actions .tt-btn{width:100%;justify-content:center;}}
      @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto!important;}*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important;}}
    `;
    document.head.appendChild(style);
  }

  function setMetadata() {
    const canonical = new URL(file, location.href);
    canonical.search = '';
    canonical.hash = '';
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical.href);
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', canonical.href);
    const image = new URL('assets/og-cover.jpg', location.href).href;
    document.querySelector('meta[property="og:image"]')?.setAttribute('content', image);
    document.querySelector('meta[name="twitter:image"]')?.setAttribute('content', image);
  }

  function enhanceStructure() {
    const content = document.querySelector('section.section > .container');
    if (!content) return;
    content.classList.add('tt-legal-content');
    content.removeAttribute('style');

    const updated = content.querySelector(':scope > p');
    if (updated) updated.classList.add('tt-legal-updated');

    const blocks = [...content.querySelectorAll(':scope > .tt-info-block')];
    blocks.forEach((block, index) => {
      const title = block.querySelector('.tt-info-title');
      const id = `seccion-${index + 1}`;
      block.id = block.id || id;
      block.setAttribute('aria-labelledby', `${block.id}-title`);
      if (title) title.id = `${block.id}-title`;
    });

    if (blocks.length && !document.getElementById('tt-legal-nav')) {
      const nav = document.createElement('nav');
      nav.id = 'tt-legal-nav';
      nav.className = 'tt-legal-nav';
      nav.setAttribute('aria-label', 'Índice de esta página');
      const list = blocks.map(block => {
        const title = block.querySelector('.tt-info-title')?.textContent?.trim() || 'Sección';
        return `<li><a href="#${block.id}">${title}</a></li>`;
      }).join('');
      nav.innerHTML = `<p class="tt-legal-nav-title">Contenido</p><ul class="tt-legal-nav-list">${list}</ul>`;
      updated?.insertAdjacentElement('afterend', nav);
    }

    const actionWrap = [...content.children].find(node => node.matches?.('div[style*="text-align:center"]'));
    if (actionWrap) {
      actionWrap.className = 'tt-legal-actions';
      actionWrap.removeAttribute('style');
    }

    if (!document.getElementById('tt-legal-note')) {
      const note = document.createElement('p');
      note.id = 'tt-legal-note';
      note.className = 'tt-legal-note';
      note.textContent = 'Esta página describe las condiciones y prácticas publicadas por la tienda. Para una consulta específica sobre tu compra o tus datos, contactanos por los canales oficiales.';
      updated?.insertAdjacentElement('afterend', note);
    }
  }

  function updateContact(next = {}) {
    contact.whatsapp = digits(next.whatsappNumber || next.whatsapp || contact.whatsapp) || contact.whatsapp;
    contact.email = clean(next.email || next.contactEmail || contact.email, 180) || contact.email;

    document.querySelectorAll('a[href*="wa.me/"]').forEach(link => {
      let text = '';
      try { text = new URL(link.href).searchParams.get('text') || ''; } catch {}
      link.href = `https://wa.me/${contact.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
    });
    document.querySelectorAll('a[href^="mailto:"]').forEach(link => {
      link.href = `mailto:${contact.email}`;
      if (link.textContent.includes('@')) link.textContent = contact.email;
    });
  }

  injectStyles();
  setMetadata();
  enhanceStructure();
  updateContact();

  const footer = document.querySelector('.tt-footer-bottom');
  if (footer) footer.textContent = `© 2024-${new Date().getFullYear()} TINTIN ACCESORIOS — TODOS LOS DERECHOS RESERVADOS`;

  onSnapshot(doc(db, 'settings', 'general'), snap => {
    if (snap.exists()) updateContact(snap.data());
  }, error => console.warn('[legal-maintenance] configuración pública no disponible', error));
}
