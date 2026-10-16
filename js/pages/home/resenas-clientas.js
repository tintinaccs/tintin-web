/* La galería completa se descarga al abrirla. El diálogo nativo mantiene
   foco, Escape y contenido de fondo inerte en celular, tablet y escritorio. */
(() => {
  const button = document.getElementById('tt-reviews-more');
  const dialog = document.getElementById('tt-reviews-dialog');
  const template = document.getElementById('tt-reviews-template');
  if (!button || !dialog || !template) return;
  let previousOverflow;
  button.hidden = false;
  button.addEventListener('click', () => {
    if (dialog.open) return;
    if (!dialog.querySelector('.tt-review-screens')) {
      dialog.querySelector('[data-reviews-content]').append(template.content.cloneNode(true));
    }
    previousOverflow = document.documentElement.style.overflow;
    dialog.showModal();
    document.documentElement.style.overflow = 'hidden';
    button.setAttribute('aria-expanded', 'true');
  });
  function restorePage() {
    document.documentElement.style.overflow = previousOverflow;
    button.setAttribute('aria-expanded', 'false');
    button.focus({ preventScroll: true });
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
