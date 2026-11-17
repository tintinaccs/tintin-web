const protectedWords = new Map([
  ['TINTIN', 'Tintin'], ['TINTÍN', 'Tintín'], ['NOVAK', 'Novak'],
  ['WHATSAPP', 'WhatsApp'], ['INSTAGRAM', 'Instagram'], ['FACEBOOK', 'Facebook'],
  ['TIKTOK', 'TikTok'], ['GOOGLE', 'Google'], ['SHOPIFY', 'Shopify'],
  ['FIREBASE', 'Firebase'], ['CLOUDFLARE', 'Cloudflare'], ['PAYPAL', 'PayPal'],
  ...['API', 'CSP', 'CSV', 'FAQ', 'HTML', 'ID', 'ISBN', 'INOX', 'JSON', 'OTP', 'PDF', 'POS', 'PYG', 'QR', 'RUC', 'SEO', 'SKU', 'SMS', 'UI', 'URL', 'USD', 'UX', 'VIP']
    .map(word => [word, word]),
]);

// Los textos que ya tienen capitalización editorial conservan sus nombres propios.
export function sentenceCase(value) {
  const text = String(value ?? '').trim();
  if (!text || /\p{Ll}/u.test(text) && /\p{Lu}/u.test(text)) return text;
  let first = true;
  return text.replace(/(?:https?:\/\/|www\.)\S+|[^\s@]+@[^\s@]+|[\p{L}\d]+(?:[-_][\p{L}\d]+)*/giu, word => {
    if (!/\p{L}/u.test(word) || /[\d@.:/_-]/.test(word)) return word;
    const protectedValue = protectedWords.get(word.toLocaleUpperCase('es'));
    const lower = word.toLocaleLowerCase('es');
    const result = protectedValue ?? (first ? lower[0].toLocaleUpperCase('es') + lower.slice(1) : lower);
    first = false;
    return result;
  });
}

export function interfaceLabel(value) {
  return sentenceCase(value).replace(/(?<![.\s])\.$/, '');
}
