// Ayuda editorial local. Nunca infiere composición, certificaciones ni cobertura.
const normalize=value=>String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const profiles=[
  ['cartera', /carteras?|bolsos?|bags?|billeteras?|wallets?/, 'Guardar vacía, sin peso encima y limpiar según el material confirmado.', 'Revisar cierre, costuras y herrajes con el proveedor.'],
  ['reloj', /reloj(?:es)?|watches?|watch/, 'Limpiar con un paño suave y seguir las indicaciones del fabricante para la correa.', 'Confirmar cobertura del mecanismo, pila y correa por separado.'],
  ['collar', /collar(?:es)?|cadenas?|necklaces?/, 'Guardar la cadena extendida o separada para evitar nudos.', 'Confirmar cobertura del cierre y de la cadena.'],
  ['anillo', /anillos?|rings?/, 'Evitar golpes y guardar por separado para prevenir rayaduras.', 'Confirmar cobertura del acabado y de las piedras, si tiene.'],
  ['pulsera', /pulseras?|brazaletes?|bracelets?|armcuffs?|tobilleras?/, 'Guardar por separado y evitar tirones en cierres y extensores.', 'Confirmar cobertura del cierre, extensor y acabado.'],
  ['aros', /aros?|aretes?|pendientes|earrings?|earcuffs?/, 'Guardar el par junto y limpiar los cierres según el material confirmado.', 'Confirmar cobertura del cierre y de las piezas decorativas.'],
  ['accesorio', /llaveros?|keyrings?|joyeros?|organizers?|gafas?|lentes|sunglasses|cabello|pelo/, 'Guardar protegido de golpes y limpiar según el material confirmado.', 'Confirmar qué piezas y defectos cubre la política vigente.'],
];
export function productSuggestionProfile({category='',name='',material=''}={}) {
  // Una categoría reconocida prevalece sobre el nombre. Con categorías propias,
  // el nombre sólo orienta una propuesta editable; no cambia la clasificación.
  const categoryText=normalize(category),nameText=normalize(name);
  const matches=(pattern,value)=>new RegExp(`(?:^|[^a-z0-9])(?:${pattern.source})(?:$|[^a-z0-9])`).test(value);
  const match=profiles.find(([,pattern])=>matches(pattern,categoryText)) || profiles.find(([,pattern])=>matches(pattern,nameText));
  const type=match?.[0] || 'producto';
  const care=[match?.[2] || 'Consultar los cuidados del proveedor para este producto.'];
  const confirmed=normalize(material);
  if(/plata.*925|925.*plata/.test(confirmed))care.push('Usar un paño específico para plata y guardar en un lugar seco.');
  else if(/bano|chapad|enchapad/.test(confirmed))care.push('Evitar fricción, perfumes y productos abrasivos para cuidar el baño.');
  else if(/acero/.test(confirmed))care.push('Limpiar con un paño suave y secar antes de guardar.');
  else if(/cuero|cuerina|sintetico/.test(confirmed))care.push('Probar la limpieza en una zona poco visible y evitar fuentes de calor.');
  return {type,care,warrantyReview:match?.[3] || 'Confirmar plazo, cobertura y exclusiones con la política de Tintin o el proveedor.'};
}
