/**
 * TINTIN — Teléfono internacional
 * Normaliza el número de un cliente a formato internacional (+<código país><número>)
 * sin importar cómo lo haya escrito (con 0 inicial, sin 0, con o sin '+').
 */

export const COUNTRIES = [
  { code: 'PY', name: 'Paraguay',        dial: '595', flag: '🇵🇾', minDigits: 9,  maxDigits: 9  },
  { code: 'AR', name: 'Argentina',       dial: '54',  flag: '🇦🇷', minDigits: 10, maxDigits: 11 },
  { code: 'BR', name: 'Brasil',          dial: '55',  flag: '🇧🇷', minDigits: 10, maxDigits: 11 },
  { code: 'UY', name: 'Uruguay',         dial: '598', flag: '🇺🇾', minDigits: 8,  maxDigits: 9  },
  { code: 'CL', name: 'Chile',           dial: '56',  flag: '🇨🇱', minDigits: 9,  maxDigits: 9  },
  { code: 'BO', name: 'Bolivia',         dial: '591', flag: '🇧🇴', minDigits: 8,  maxDigits: 8  },
  { code: 'PE', name: 'Perú',            dial: '51',  flag: '🇵🇪', minDigits: 9,  maxDigits: 9  },
  { code: 'CO', name: 'Colombia',        dial: '57',  flag: '🇨🇴', minDigits: 10, maxDigits: 10 },
  { code: 'MX', name: 'México',          dial: '52',  flag: '🇲🇽', minDigits: 10, maxDigits: 10 },
  { code: 'ES', name: 'España',          dial: '34',  flag: '🇪🇸', minDigits: 9,  maxDigits: 9  },
  { code: 'US', name: 'Estados Unidos',  dial: '1',   flag: '🇺🇸', minDigits: 10, maxDigits: 10 },
];

export const DEFAULT_COUNTRY = COUNTRIES[0]; // Paraguay

export function findCountryByCode(code) {
  return COUNTRIES.find(c => c.code === code) || DEFAULT_COUNTRY;
}

/** Longest-prefix match against known dial codes (for numbers pasted with their own '+55...' etc.) */
function detectCountryFromDigits(digits) {
  let best = null;
  for (const c of COUNTRIES) {
    if (digits.startsWith(c.dial) && (!best || c.dial.length > best.dial.length)) best = c;
  }
  return best;
}

/**
 * @param {string} rawInput - lo que escribió el cliente
 * @param {object} country - país seleccionado en el selector (de COUNTRIES)
 * @returns {{ value: string, country: object }} número normalizado ('+595981299331')
 *          y el país que corresponde (puede cambiar si se detectó otro por el '+').
 */
export function normalizePhone(rawInput, country) {
  const s = String(rawInput || '').trim();
  if (!s) return { value: '', country };

  const hadPlus = s.startsWith('+');
  let digits = s.replace(/\D/g, '');
  if (!digits) return { value: '', country };

  if (hadPlus) {
    if (digits.startsWith('0')) {
      // "+0981299331" no es válido en ningún país — el 0 es un prefijo local
      // que se coló por error; se descarta y se sigue como número local.
      digits = digits.slice(1);
    } else {
      const detected = detectCountryFromDigits(digits);
      return { value: '+' + digits, country: detected || country };
    }
  } else if (digits.startsWith('0')) {
    digits = digits.slice(1); // formato local con 0 inicial (Paraguay: 0981... -> 981...)
  }

  // Evita duplicar el prefijo si el cliente ya lo escribió sin el '+'
  if (digits.startsWith(country.dial)) {
    return { value: '+' + digits, country };
  }
  return { value: '+' + country.dial + digits, country };
}

/** true si, ya normalizado, tiene la cantidad de dígitos esperada para su país */
export function isValidPhone(rawInput, country) {
  const { value, country: detected } = normalizePhone(rawInput, country);
  const c = detected || country;
  if (!value || !value.startsWith('+' + c.dial)) return false;
  const national = value.slice(1 + c.dial.length);
  return national.length >= c.minDigits && national.length <= c.maxDigits;
}
