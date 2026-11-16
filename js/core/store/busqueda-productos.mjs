export function normalizeProductSearch(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function productSearchText(product) {
  const variants = product?.variants && typeof product.variants === 'object' ? JSON.stringify(product.variants) : '';
  return normalizeProductSearch([
    product?.name, product?.category, product?.cat, product?.description, product?.desc,
    product?.sku, product?.material, product?.colorFinish, product?.sizeFit,
    ...(Array.isArray(product?.tags) ? product.tags : []), variants,
    ...(product?.variantInventory || []).map(row => [row.sku, ...Object.values(row.attributes || {})].join(' ')),
  ].filter(Boolean).join(' '));
}

const EQUIVALENTS = [
  ['bolso', 'bolsos', 'cartera', 'carteras', 'bag', 'bags'],
  ['aro', 'aros', 'arete', 'aretes', 'pendiente', 'pendientes'],
  ['collar', 'collares', 'cadenita', 'cadenitas', 'cadena', 'cadenas'],
  ['reloj', 'relojes'], ['pulsera', 'pulseras'], ['anillo', 'anillos'],
  ['dorado', 'dorada', 'dorados', 'doradas'], ['plateado', 'plateada', 'plateados', 'plateadas'],
];
function wordMatch(word, candidates, fuzzy = false) {
  if (candidates.includes(word)) return 3;
  if (!/^\d+$/.test(word) && candidates.some(candidate => candidate.startsWith(word))) return 2;
  const synonyms = EQUIVALENTS.find(group => group.includes(word));
  if (synonyms?.some(synonym => candidates.includes(synonym))) return 1;
  return fuzzy && candidates.some(candidate => nearWord(word, candidate)) ? 0.5 : 0;
}

// Una sola inserción, omisión, sustitución o transposición. No se aplica a
// palabras cortas ni a códigos numéricos: evita coincidencias irrelevantes.
function nearWord(word, candidate) {
  if (word.length < 4 || /\d/.test(word) || Math.abs(word.length - candidate.length) > 1) return false;
  if (word.length === candidate.length) {
    const positions = [];
    for (let i = 0; i < word.length; i++) if (word[i] !== candidate[i]) positions.push(i);
    if (positions.length === 1) return true;
    return positions.length === 2 && positions[1] === positions[0] + 1
      && word[positions[0]] === candidate[positions[1]] && word[positions[1]] === candidate[positions[0]];
  }
  const [short, long] = word.length < candidate.length ? [word, candidate] : [candidate, word];
  let i = 0, j = 0;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) { i++; j++; }
    else if (j === i) j++;
    else return false;
  }
  return true;
}

export function productSearchScore(product, query, searchText = productSearchText(product)) {
  const normalized = normalizeProductSearch(query).slice(0, 200);
  if (!normalized) return 0;
  // Comparación de códigos como texto: conserva ceros y no aproxima dígitos.
  const code = normalized.replace(/ /g, '');
  const references = [product?.sku, ...(product?.variantInventory || []).map(row => row.sku)]
    .filter(value => value != null && String(value).trim()).map(value => normalizeProductSearch(value).replace(/ /g, ''));
  if (references.includes(code)) return 120;
  const name = normalizeProductSearch(product?.name);
  if (name === normalized) return 100;
  if (name.startsWith(normalized)) return 80;
  if ((' ' + name + ' ').includes(' ' + normalized + ' ')) return 70;
  if (name.includes(normalized)) return 60;
  const words = normalized.split(' ');
  const candidates = [...new Set(searchText.split(' '))];
  const matches = words.map(word => wordMatch(word, candidates));
  if (matches.every(Boolean)) {
    const primary = normalizeProductSearch([product?.name, product?.category, product?.cat,
      product?.material, product?.colorFinish, JSON.stringify(product?.variants || {}),
      ...(product?.variantInventory || []).map(row => Object.values(row.attributes || {}).join(' '))].join(' ')).split(' ');
    return 30 + words.filter(word => wordMatch(word, primary)).length * 8 + Math.min(...matches);
  }
  return words.every(word => wordMatch(word, candidates, true)) ? 10 : 0;
}
