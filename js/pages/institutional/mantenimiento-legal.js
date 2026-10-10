const page = (location.pathname.split('/').pop() || '').toLowerCase().replace(/\.html$/, '');
const supported = new Set(['terminos', 'privacidad']);

if (supported.has(page) && !window.TintinLegalMaintenanceBooted) {
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



  function setMetadata() {
    const canonical = new URL(`/${page}`, location.origin);
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical.href);
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', canonical.href);
    const image = new URL('/assets/og-cover.jpg', location.origin).href;
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
      const heading = document.createElement('p');
      heading.className = 'tt-legal-nav-title';
      heading.textContent = 'Contenido';
      const list = document.createElement('ul');
      list.className = 'tt-legal-nav-list';
      blocks.forEach(block => {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = `#${block.id}`;
        link.textContent = block.querySelector('.tt-info-title')?.textContent?.trim() || 'Sección';
        item.appendChild(link);
        list.appendChild(item);
      });
      nav.append(heading, list);
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

  // La hoja de estilo forma parte del HTML inicial.
  setMetadata();
  enhanceStructure();
  updateContact();
  document.body?.classList.add('tt-legal-runtime-ready');

  const refreshLegalLayout = () => {
    window.dispatchEvent(new CustomEvent('tintin:legal-layout-ready'));
    window.TintinWaOverlapGuard?.refresh?.();
    window.TintinWaOverlapGuard?.markReady?.();
  };
  window.addEventListener('tintin:wa-overlap-ready', refreshLegalLayout, { once: true });
  refreshLegalLayout();
  [0, 120, 400, 1000, 2500].forEach(delay => setTimeout(refreshLegalLayout, delay));

  const footer = document.querySelector('.tt-footer-bottom');
  if (footer) footer.textContent = `© 2024-${new Date().getFullYear()} TINTIN ACCESORIOS — TODOS LOS DERECHOS RESERVADOS`;

  // Nada de lo de arriba necesita datos remotos (solo reordena HTML ya
  // presente), así que el SDK de Firebase se carga después del contenido.
  Promise.all([
    import('../../core/firebase/firebase.js?v=tintin-20260924-auth-popup-resolver-1-launch-20260926-1'),
    import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js'),
  ]).then(([{ db }, { doc, onSnapshot }]) => {
    onSnapshot(doc(db, 'settings', 'general'), snap => {
      if (snap.exists()) updateContact(snap.data());
    }, error => console.warn('[legal-maintenance] configuración pública no disponible', error));
  });
}
