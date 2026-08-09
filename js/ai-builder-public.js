(function () {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  function renderBlock(block) {
    const section = document.createElement('section');
    section.className = `tt-ai-block tt-ai-block-${block.type}`;
    section.style.setProperty('--tt-ai-background', /^#[0-9a-f]{6}$/i.test(block.background) ? block.background : '#fff8fa');
    section.dataset.blockId = block.id;
    const products = block.type === 'products' ? `<div class="tt-ai-products">${Array.from({ length: Math.max(1, Math.min(6, Number(block.count) || 3)) }, (_, index) => `<a href="catalogo.html" class="tt-ai-product"><span aria-hidden="true"></span><strong>Producto destacado ${index + 1}</strong><small>Ver en catálogo</small></a>`).join('')}</div>` : '';
    const images = block.type === 'gallery' ? `<div class="tt-ai-products">${(block.images || []).slice(0, 6).map(image => `<img src="${escape(image.src)}" alt="${escape(image.alt)}" loading="lazy" decoding="async">`).join('')}</div>` : '';
    const button = block.buttonLabel ? `<a class="tt-btn" href="${escape(block.href || 'catalogo.html')}">${escape(block.buttonLabel)}</a>` : '';
    section.innerHTML = `<div class="container" style="text-align:${block.align === 'left' ? 'left' : 'center'}"><p class="tt-section-sub">TINTÍN</p><h2 class="tt-section-title">${escape(block.title)}</h2>${block.text ? `<p class="tt-section-desc">${escape(block.text)}</p>` : ''}${products}${images}${button}</div>`;
    return section;
  }
  fetch('/api/ai-builder-public', { headers: { accept: 'application/json' } })
    .then(response => response.ok ? response.json() : { blocks: [] })
    .then(data => {
      const root = document.getElementById('tt-ai-builder-content');
      if (!root || !Array.isArray(data.blocks)) return;
      data.blocks.forEach(block => root.appendChild(renderBlock(block)));
      root.hidden = root.children.length === 0;
    }).catch(() => {});
})();
