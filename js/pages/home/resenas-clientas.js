/* La galería completa se descarga al abrirla. El diálogo nativo mantiene
   foco, Escape y contenido de fondo inerte en celular, tablet y escritorio. */
(() => {
  const button = document.getElementById('tt-reviews-more');
  const dialog = document.getElementById('tt-reviews-dialog');
  const template = document.getElementById('tt-reviews-template');
  if (!button || !dialog || !template) return;
  let previousOverflow;
  let opener = button;
  const content = dialog.querySelector('[data-reviews-content]');
  const reviews = [...document.querySelectorAll('.tt-reviews-section .tt-review-screen img'), ...template.content.querySelectorAll('img')]
    .map(image => ({ src: image.getAttribute('src'), alt: image.alt }));
  let selected = -1;
  const viewer = document.createElement('section');
  viewer.className = 'tt-review-viewer';
  viewer.hidden = true;
  viewer.innerHTML = '<div class="tt-review-viewer__nav"><button type="button" data-review-previous aria-label="Reseña anterior">←</button><span role="status" aria-live="polite"></span><button type="button" data-review-next aria-label="Reseña siguiente">→</button></div><img data-review-enlarged alt="">';
  content.after(viewer);
  const enlarged = viewer.querySelector('img');
  function selectReview(index) {
    selected = (index + reviews.length) % reviews.length;
    const review = reviews[selected];
    enlarged.src = review.src;
    enlarged.alt = review.alt;
    viewer.querySelector('[role="status"]').textContent = `${selected + 1} de ${reviews.length}`;
    content.hidden = true;
    viewer.hidden = false;
    if (content.contains(document.activeElement)) dialog.querySelector('[data-reviews-close]').focus({ preventScroll: true });
    dialog.scrollTop = 0;
  }
  viewer.querySelector('[data-review-previous]').addEventListener('click', () => selectReview(selected - 1));
  viewer.querySelector('[data-review-next]').addEventListener('click', () => selectReview(selected + 1));
  dialog.addEventListener('keydown', event => {
    if (viewer.hidden || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    selectReview(selected + (event.key === 'ArrowRight' ? 1 : -1));
  });
  function makeTrigger(image, onClick) {
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'tt-review-trigger';
    trigger.setAttribute('aria-label', `${image.alt}. Ampliar reseña`);
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', dialog.id);
    image.before(trigger);trigger.append(image);
    trigger.addEventListener('click', onClick);
  }
  button.hidden = false;
  function openGallery(event) {
    if (dialog.open) return;
    const image = event.currentTarget.querySelector('img');
    content.hidden = false;
    viewer.hidden = true;
    if (image) {
      selectReview(reviews.findIndex(review => review.src === image.getAttribute('src')));
    } else if (!content.querySelector('.tt-review-screens')) {
      content.append(template.content.cloneNode(true));
      for (const item of content.querySelectorAll('img')) {
        makeTrigger(item, () => selectReview(reviews.findIndex(review => review.src === item.getAttribute('src'))));
      }
    }
    previousOverflow = document.documentElement.style.overflow;
    opener = event.currentTarget;
    dialog.showModal();
    document.documentElement.style.overflow = 'hidden';
    button.setAttribute('aria-expanded', 'true');
  }
  button.addEventListener('click', openGallery);
  for (const image of document.querySelectorAll('.tt-reviews-section .tt-review-screen img')) {
    makeTrigger(image, openGallery);
  }
  function restorePage() {
    document.documentElement.style.overflow = previousOverflow;
    button.setAttribute('aria-expanded', 'false');
    opener.focus({ preventScroll: true });
  }
  function closeGallery() {
    dialog.close();
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
