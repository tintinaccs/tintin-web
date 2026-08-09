export const BUILDER_LIMITS = Object.freeze({
  requestChars: 1200,
  bodyBytes: 12_000,
  requestsPerHour: 10,
  minimumIntervalMs: 8_000,
  providerTimeoutMs: 12_000,
  maxBlocks: 12,
  maxHistory: 80
});

export const SAFE_BLOCK_TYPES = Object.freeze([
  'banner', 'text', 'products', 'gallery', 'promotion', 'button', 'section'
]);

const FORBIDDEN_SCOPE = [
  /(?:checkout|precio|precios|pago|pagos|pedido|pedidos|paypal|transferencia)/i,
  /(?:usuario|usuarios|cuenta|cuentas|rol|roles|autenticaci[oó]n)/i,
  /(?:clave|claves|credencial|credenciales|secreto|token|api[ -]?key)/i,
  /(?:firestore\s*rules?|reglas\s+de\s+firestore|security\s*rules?)/i,
  /(?:producci[oó]n|main|configuraci[oó]n\s+cr[ií]tica)/i
];

const INJECTION_PATTERNS = [
  /ignor[aáe].{0,30}(instrucciones|reglas|sistema)/i,
  /(?:system|developer)\s*(?:prompt|message)/i,
  /revel[aáe].{0,30}(prompt|secreto|clave|token)/i,
  /act[uú]a\s+como\s+(?:root|administrador|developer|system)/i,
  /(?:bypass|salt[aáe]|elud[aáe]).{0,30}(seguridad|permiso|filtro)/i
];

export function cleanRequest(value) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function assessRequest(value) {
  const request = cleanRequest(value);
  if (request.length < 12) return { ok: false, code: 'ambiguous', message: 'Contame qué querés cambiar y en qué parte del sitio.' };
  if (request.length > BUILDER_LIMITS.requestChars) return { ok: false, code: 'too_large', message: `La solicitud supera ${BUILDER_LIMITS.requestChars} caracteres.` };
  if (INJECTION_PATTERNS.some(pattern => pattern.test(request))) {
    return { ok: false, code: 'prompt_injection', message: 'La solicitud contiene instrucciones no permitidas.' };
  }
  if (FORBIDDEN_SCOPE.some(pattern => pattern.test(request))) {
    return { ok: false, code: 'protected_scope', message: 'TINTÍN AI Builder no puede modificar pagos, precios, pedidos, usuarios, credenciales, reglas ni configuración crítica.' };
  }
  const hasAction = /(agreg|cre|cambi|modific|edit|mov|quit|elimin|mostr|ocult|actualiz|public|restaur|quiero|necesito)/i.test(request);
  const hasTarget = /(banner|texto|t[ií]tulo|producto|galer[ií]a|promoci[oó]n|bot[oó]n|secci[oó]n|contenido|dise[nñ]o|fondo|color|p[aá]gina|c[oó]digo|api)/i.test(request);
  if (!hasAction || !hasTarget) return { ok: false, code: 'ambiguous', message: 'Indicá qué elemento querés cambiar y el resultado esperado.' };
  return { ok: true, request };
}

export function classifyRequest(request) {
  if (/(c[oó]digo|javascript|html|css|api|integraci[oó]n|checkout|login|base de datos|funci[oó]n|nuevo flujo|p[aá]gina nueva)/i.test(request)) return 'complex';
  if (/(debajo|encima|mover|estructura|secci[oó]n|columnas?|grilla|dise[nñ]o|fondo|color|tipograf[ií]a|responsive|galer[ií]a)/i.test(request)) return 'visual';
  return 'content';
}

function text(value, max = 160) {
  return cleanRequest(value).slice(0, max);
}

function safeHref(value) {
  const href = String(value || '').trim();
  if (/^(?:catalogo|collections|about|contact|index)\.html(?:[?#][A-Za-z0-9_=&%-]*)?$/i.test(href)) return href;
  return 'catalogo.html';
}

function safeColor(value) {
  const color = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : '#fbe4ec';
}

export function sanitizeBlocks(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(0, BUILDER_LIMITS.maxBlocks).map((raw, index) => {
    const type = SAFE_BLOCK_TYPES.includes(raw?.type) ? raw.type : 'section';
    const base = {
      id: text(raw?.id || `${type}-${index + 1}`, 64).replace(/[^a-z0-9_-]/gi, '-').toLowerCase(),
      type,
      title: text(raw?.title || '', 100),
      text: text(raw?.text || '', 360),
      background: safeColor(raw?.background),
      align: ['left', 'center'].includes(raw?.align) ? raw.align : 'center'
    };
    if (type === 'button' || type === 'banner' || type === 'promotion' || type === 'section') {
      base.buttonLabel = text(raw?.buttonLabel || 'Abrir catálogo', 48);
      base.href = safeHref(raw?.href);
    }
    if (type === 'products') base.count = Math.max(1, Math.min(6, Number(raw?.count) || 3));
    if (type === 'gallery') {
      base.images = Array.isArray(raw?.images) ? raw.images.slice(0, 6).map(item => ({
        src: /^assets-tintin\/[A-Za-z0-9_./-]+$/i.test(String(item?.src || '')) ? item.src : 'assets-tintin/images/general/placeholder-section.webp',
        alt: text(item?.alt || 'Imagen de Tintin', 100)
      })) : [];
    }
    return base;
  });
}

export function deterministicProposal(request) {
  const type = classifyRequest(request);
  if (type === 'complex') {
    return {
      type,
      summary: 'Cambio técnico aislado en rama, sujeto a revisión y preview.',
      blocks: [],
      technicalProposal: {
        objective: text(request, 500),
        scope: ['Implementación en rama feature aislada', 'Pruebas automatizadas', 'Pull Request en borrador', 'Preview de Cloudflare'],
        excluded: ['main', 'checkout', 'precios', 'pagos', 'pedidos', 'usuarios', 'credenciales', 'Firestore Rules'],
        acceptance: ['CI verde', 'revisión explícita de la dueña', 'preview responsive disponible']
      }
    };
  }
  const pink = /rosa|rosado|rosada/i.test(request);
  const countMatch = request.match(/\b([1-6]|un[oa]?|dos|tres|cuatro|cinco|seis)\s+productos?\b/i)
    || request.match(/\b([1-6]|un[oa]?|dos|tres|cuatro|cinco|seis)\b/i);
  const counts = { uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6 };
  const count = countMatch ? (Number(countMatch[1]) || counts[countMatch[1].toLowerCase()] || 3) : 3;
  const products = /producto/i.test(request);
  const block = products ? {
    type: 'products', title: 'Productos destacados', text: 'Una selección especial para vos.', count,
    background: pink ? '#fbe4ec' : '#fff8fa', buttonLabel: 'Abrir catálogo', href: 'catalogo.html'
  } : {
    type: /promoci[oó]n|oferta/i.test(request) ? 'promotion' : 'section',
    title: 'Novedades TINTÍN', text: text(request, 220), background: pink ? '#fbe4ec' : '#fff8fa',
    buttonLabel: 'Abrir catálogo', href: 'catalogo.html'
  };
  return {
    type,
    summary: type === 'visual' ? 'Cambio visual preparado con bloques seguros.' : 'Cambio de contenido preparado con bloques seguros.',
    blocks: sanitizeBlocks([block]),
    technicalProposal: null
  };
}

export function validateProposal(raw, fallbackRequest = '') {
  const type = ['content', 'visual', 'complex'].includes(raw?.type) ? raw.type : classifyRequest(fallbackRequest);
  return {
    type,
    summary: text(raw?.summary || 'Propuesta preparada para revisión.', 240),
    blocks: type === 'complex' ? [] : sanitizeBlocks(raw?.blocks),
    technicalProposal: type === 'complex' ? {
      objective: text(raw?.technicalProposal?.objective || fallbackRequest, 500),
      scope: (Array.isArray(raw?.technicalProposal?.scope) ? raw.technicalProposal.scope : []).slice(0, 8).map(v => text(v, 180)),
      excluded: ['main', 'checkout', 'precios', 'pagos', 'pedidos', 'usuarios', 'credenciales', 'Firestore Rules'],
      acceptance: (Array.isArray(raw?.technicalProposal?.acceptance) ? raw.technicalProposal.acceptance : []).slice(0, 8).map(v => text(v, 180))
    } : null
  };
}

// Solo 'publish' y 'restore' guardan un snapshot publicable en el
// historial: 'propose', 'modify', 'cancel' y 'technical_pr' se registran con
// snapshot:[] y version:0 porque nunca llegaron a publicarse. Restaurar una
// de esas entradas sobreescribiría aiBuilder/state con un array vacío y
// vaciaría el contenido publicado — este chequeo es lo que distingue una
// versión real restaurable de una entrada de auditoría sin contenido.
export function isRestorableHistoryEntry(entry) {
  return Boolean(entry) && Array.isArray(entry.snapshot) && entry.snapshot.length > 0 && Number(entry.version) > 0;
}

export function isRateAllowed(usage, now = Date.now()) {
  const timestamps = Array.isArray(usage?.timestamps) ? usage.timestamps.map(Number).filter(Number.isFinite) : [];
  const recent = timestamps.filter(value => now - value < 3_600_000);
  if (recent.length >= BUILDER_LIMITS.requestsPerHour) return { ok: false, retryAfter: 3600 };
  const last = recent.at(-1) || 0;
  if (now - last < BUILDER_LIMITS.minimumIntervalMs) return { ok: false, retryAfter: Math.ceil((BUILDER_LIMITS.minimumIntervalMs - (now - last)) / 1000) };
  return { ok: true, timestamps: [...recent, now] };
}
