export function safeSearchTerm(value) {
  const term = String(value || '').normalize('NFKC').replace(/[\u0000-\u001f<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,100);
  // No enviar correos, teléfonos, documentos, direcciones ni consultas personales.
  if (/@|https?:|www\.|\b(?:cedula|cédula|telefono|teléfono|correo|email|direcci[oó]n|contrase[nñ]a|password)\b/i.test(term)
    || term.replace(/\D/g,'').length >= 7) return '';
  return term;
}
