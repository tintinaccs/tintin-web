export function isValidReviewRating(value) {
  const rating = Number(value);
  return Number.isFinite(rating) && Number.isInteger(rating) && rating >= 1 && rating <= 5;
}

export function syncReviewPublishState(form, rating) {
  if (!form) return false;
  const submit = form.querySelector('[data-review-submit], button[type="submit"]');
  const valid = isValidReviewRating(rating);
  if (!submit) return valid;

  submit.disabled = !valid;
  submit.setAttribute('aria-disabled', String(!valid));
  submit.classList.toggle('is-rating-required', !valid);
  if (valid) submit.removeAttribute('title');
  else submit.setAttribute('title', 'Elegí una puntuación de 1 a 5 estrellas para publicar.');
  return valid;
}

export function reportMissingReviewRating(form) {
  if (!form) return;
  const message = 'Elegí de 1 a 5 estrellas antes de publicar tu comentario.';
  const errorNode = form.querySelector('[data-review-error]');
  const statusNode = form.querySelector('[data-rating-status]');
  const firstRating = form.querySelector('[data-review-rating][tabindex="0"], [data-review-rating]');

  if (errorNode) errorNode.textContent = message;
  if (statusNode) statusNode.textContent = message;
  firstRating?.focus();
}
