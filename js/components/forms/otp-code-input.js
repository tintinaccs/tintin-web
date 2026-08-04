// =============================================================
// TINTIN ACCESORIOS — Campo del código de acceso (6 dígitos)
// =============================================================
// Un único lugar con las reglas del campo del código, para que login.html y
// cualquier otra pantalla que pida el código se comporten igual.
//
// El atributo maxlength="6" del HTML no alcanza: recorta el pegado ANTES de
// limpiarlo, así que pegar "Tu código es: 12 34 56." dejaba literalmente
// "Tu cód" en el campo. Acá el pegado se intercepta, se extraen los dígitos
// y recién entonces se escribe el valor.

/**
 * Deja sólo dígitos y devuelve como máximo los primeros `length`.
 * Sirve tanto para lo tecleado como para lo pegado desde el correo.
 */
export function extractOtpDigits(value, length = 6) {
  return String(value == null ? '' : value).replace(/\D+/g, '').slice(0, length);
}

/** El código está completo y es válido cuando son exactamente `length` dígitos. */
export function isCompleteOtp(value, length = 6) {
  return new RegExp(`^\\d{${length}}$`).test(String(value == null ? '' : value));
}

/**
 * Aplica las reglas del código sobre un <input>.
 *
 * - Al teclear: sólo 0-9. Letras, espacios, puntos, comas, guiones, símbolos
 *   y emojis se bloquean antes de entrar al campo.
 * - Al pegar: se toman los dígitos del texto pegado y se conservan los
 *   primeros 6. Si no llega a 6 dígitos se avisa con `onInvalidPaste`.
 * - Autocompletado del SMS/correo (autocomplete="one-time-code"): pasa por el
 *   mismo saneado, porque algunos gestores pegan el texto entero.
 *
 * @returns {() => void} función para desconectar los listeners.
 */
export function attachOtpCodeInput(input, options = {}) {
  if (!input) return () => {};
  const length = Number(options.length) || 6;
  const { onComplete, onInvalidPaste, onInput } = options;

  const setValue = digits => {
    if (input.value !== digits) input.value = digits;
    if (typeof onInput === 'function') onInput(digits);
    if (digits.length === length && typeof onComplete === 'function') onComplete(digits);
  };

  // `beforeinput` permite rechazar la inserción sin que el caracter llegue a
  // dibujarse — evita el parpadeo de ver la letra y que desaparezca.
  const onBeforeInput = event => {
    if (event.inputType === 'insertFromPaste' || event.inputType === 'insertFromDrop') return;
    if (typeof event.data !== 'string' || event.data === '') return;
    if (/\D/.test(event.data)) event.preventDefault();
  };

  const onPaste = event => {
    event.preventDefault();
    const pasted = (event.clipboardData || window.clipboardData)?.getData('text') || '';
    const digits = extractOtpDigits(pasted, length);
    setValue(digits);
    if (digits.length < length && typeof onInvalidPaste === 'function') {
      onInvalidPaste(digits);
    }
  };

  const onDrop = event => {
    event.preventDefault();
    const digits = extractOtpDigits(event.dataTransfer?.getData('text') || '', length);
    setValue(digits);
  };

  // Red de seguridad: teclados móviles y gestores de contraseñas a veces
  // escriben sin emitir `beforeinput` cancelable.
  const onInputEvent = () => {
    const digits = extractOtpDigits(input.value, length);
    setValue(digits);
  };

  input.addEventListener('beforeinput', onBeforeInput);
  input.addEventListener('paste', onPaste);
  input.addEventListener('drop', onDrop);
  input.addEventListener('input', onInputEvent);

  return () => {
    input.removeEventListener('beforeinput', onBeforeInput);
    input.removeEventListener('paste', onPaste);
    input.removeEventListener('drop', onDrop);
    input.removeEventListener('input', onInputEvent);
  };
}
