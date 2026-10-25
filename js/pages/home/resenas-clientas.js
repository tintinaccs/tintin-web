/* La galería completa se descarga al abrirla. El diálogo nativo mantiene
   foco, Escape y contenido de fondo inerte en celular, tablet y escritorio. */
(() => {
  const button = document.getElementById('tt-reviews-more');
  const dialog = document.getElementById('tt-reviews-dialog');
  const template = document.getElementById('tt-reviews-template');
  if (!button || !dialog || !template) return;
  let previousOverflow;
  let opener = button;
  button.hidden = false;
  function openGallery(event) {
    if (dialog.open) return;
    if (!dialog.querySelector('.tt-review-screens')) {
      dialog.querySelector('[data-reviews-content]').append(template.content.cloneNode(true));
    }
    previousOverflow = document.documentElement.style.overflow;
    opener = event.currentTarget;
    dialog.showModal();
    document.documentElement.style.overflow = 'hidden';
    button.setAttribute('aria-expanded', 'true');
  }
  button.addEventListener('click', openGallery);
  for (const image of document.querySelectorAll('.tt-reviews-section .tt-review-screen img')) {
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.setAttribute('aria-label', `${image.alt}. Abrir galería de reseñas`);
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', dialog.id);
    trigger.style.cssText = 'display:block;width:100%;padding:0;border:0;background:transparent;cursor:pointer';
    image.before(trigger);trigger.append(image);
    trigger.addEventListener('click', openGallery);
  }
  function restorePage() {
    document.documentElement.style.overflow = previousOverflow;
    button.setAttribute('aria-expanded', 'false');
    opener.focus({ preventScroll: true });
  }
  function closeGallery() {
    dialog.close();
    restorePage();
  }
  dialog.querySelector('[data-reviews-close]').addEventListener('click', closeGallery);
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeGallery(); });
  dialog.addEventListener('click', event => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) closeGallery();
  });
  dialog.addEventListener('close', () => {
    if (!dialog.open) restorePage();
  });
})();
