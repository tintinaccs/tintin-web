const DEFAULT_BACKUP_FORMAT = 'tintin-operational-backup';

function rawText(value) {
  return String(value == null ? '' : value);
}

export function parseLocalizedNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NaN;

  let raw = rawText(value)
    .trim()
    .replace(/[\s\u00a0\u202f]/g, '')
    .replace(/[^0-9,.'+\-]/g, '')
    .replace(/'/g, '');

  if (!raw || !/[0-9]/.test(raw)) return Number.NaN;
  const sign = raw.startsWith('-') ? -1 : 1;
  raw = raw.replace(/[+\-]/g, '');
  if (!raw || !/[0-9]/.test(raw)) return Number.NaN;

  const commaPositions = [...raw.matchAll(/,/g)].map(match => match.index);
  const dotPositions = [...raw.matchAll(/\./g)].map(match => match.index);
  const separators = [...commaPositions.map(index => [index, ',']), ...dotPositions.map(index => [index, '.'])]
    .sort((a, b) => a[0] - b[0]);

  let decimalSeparator = '';
  if (commaPositions.length && dotPositions.length) {
    decimalSeparator = separators.at(-1)[1];
  } else if (separators.length) {
    const separator = separators[0][1];
    const pieces = raw.split(separator);
    if (pieces.length === 2) {
      const integerDigits = pieces[0].length;
      const fractionDigits = pieces[1].length;
      if (fractionDigits > 0 && fractionDigits <= 2) decimalSeparator = separator;
      else if (fractionDigits === 3 && integerDigits > 3) decimalSeparator = separator;
    } else {
      const grouped = pieces.slice(1).every(piece => piece.length === 3);
      if (!grouped) decimalSeparator = separator;
    }
  }

  let normalized;
  if (decimalSeparator) {
    const decimalIndex = raw.lastIndexOf(decimalSeparator);
    const integerPart = raw.slice(0, decimalIndex).replace(/[.,]/g, '');
    const fractionPart = raw.slice(decimalIndex + 1).replace(/[.,]/g, '');
    normalized = `${integerPart || '0'}.${fractionPart}`;
  } else {
    normalized = raw.replace(/[.,]/g, '');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? sign * parsed : Number.NaN;
}

export function parseOptionalStock(value) {
  if (value == null) return null;
  const raw = rawText(value).trim();
  if (!raw || /^(?:sin\s*l[ií]mite|ilimitad[oa]|unlimited|infinite|∞)$/i.test(raw)) return null;
  const parsed = parseLocalizedNumber(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) return Number.NaN;
  return parsed;
}

function delimiterCounts(input, candidates) {
  const counts = Object.fromEntries(candidates.map(candidate => [candidate, 0]));
  let quoted = false;
  let completedRows = 0;
  for (let index = 0; index < input.length && completedRows < 12; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') index += 1;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (Object.prototype.hasOwnProperty.call(counts, char)) counts[char] += 1;
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && next === '\n') index += 1;
      completedRows += 1;
    }
  }
  return counts;
}

export function detectCsvDelimiter(value) {
  const input = rawText(value).replace(/^\uFEFF/, '');
  const candidates = [',', ';', '\t'];
  const counts = delimiterCounts(input, candidates);
  return candidates.reduce((best, candidate) => (
    counts[candidate] > counts[best] ? candidate : best
  ), ',');
}

export function parseDelimitedRows(value, delimiter = detectCsvDelimiter(value)) {
  if (![',', ';', '\t'].includes(delimiter)) throw new Error('El delimitador CSV no es compatible.');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const input = rawText(value).replace(/^\uFEFF/, '');

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      cell = '';
      if (row.some(item => rawText(item).trim())) rows.push(row);
      row = [];
    } else cell += char;
  }

  row.push(cell);
  if (row.some(item => rawText(item).trim())) rows.push(row);
  if (quoted) throw new Error('El CSV termina dentro de un campo entre comillas.');
  return rows;
}

export function validateOperationalBackupEnvelope(value, {
  projectId = 'tintin-accesorios',
  schemaVersion = 1,
  format = DEFAULT_BACKUP_FORMAT,
} = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('La copia operativa debe ser un objeto JSON.');
  }
  if (value.format !== format) throw new Error('El formato de la copia operativa no es compatible.');
  if (value.projectId !== projectId) throw new Error('La copia pertenece a otro proyecto Firebase.');
  if (value.schemaVersion !== schemaVersion) throw new Error('La versión de la copia operativa no es compatible.');
  if (!value.data || typeof value.data !== 'object' || !Array.isArray(value.data.products)) {
    throw new Error('La copia operativa no contiene data.products.');
  }
  return value.data.products;
}
