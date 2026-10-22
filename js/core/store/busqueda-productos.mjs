export function normalizeProductSearch(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function productSearchText(product) {
  const variants = product?.variants && typeof product.variants === 'object' ? JSON.stringify(product.variants) : '';
  return normalizeProductSearch([
    product?.name, product?.category, product?.cat, product?.description, product?.desc,
    product?.sku, ...(Array.isArray(product?.tags) ? product.tags : []), variants,
  ].filter(Boolean).join(' '));
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
  const name = normalizeProductSearch(product?.name);
  if (name === normalized) return 100;
  if (name.startsWith(normalized)) return 80;
  if (name.includes(normalized)) return 60;
  if (searchText.includes(normalized)) return 30;
  const words = normalized.split(' ');
  if (words.every(word => searchText.includes(word))) return 20;
  const candidates = [...new Set(searchText.split(' '))];
  return words.every(word => searchText.includes(word) || candidates.some(candidate => nearWord(word, candidate))) ? 10 : 0;
}
