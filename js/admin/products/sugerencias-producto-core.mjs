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

// Opciones editoriales por categoría. Son propuestas explícitas, nunca datos inferidos.
const categoryDetails=[
 ['wallet','Billeteras',/billeteras?|wallets?/,['Cuero sintético','Cuero genuino','Tela / textil'],['Tipo de billetera: tarjetero.','Tipo de billetera: con monedero.','Cierre: cremallera.','Cierre: broche.'],['Color','Modelo','Tamaño'],'Alto × ancho × profundidad en cm','Distribución de tarjetas y compartimentos'],
 ['bag','Bolsos y carteras',/carteras?|bolsos?|bags?/,['Cuero sintético','Cuero genuino','Tela / textil','Resina'],['Tipo de bolso: bandolera.','Tipo de bolso: tote.','Tipo de bolso: mochila.','Cierre: cremallera.','Cierre: broche magnético.','Correa: desmontable.','Correa: regulable.'],['Color','Tamaño','Modelo','Tipo de bolso'],'Alto × ancho × profundidad en cm','Largo de correa, regulación y forma de uso'],
 ['watch','Relojes',/reloj(?:es)?|watches?|watch/,['Acero inoxidable','Aleación metálica','Cuero sintético','Resina'],['Mecanismo: cuarzo.','Mecanismo: automático.','Correa: metálica.','Correa: de cuero.','Cierre: hebilla.','Cierre: desplegable.'],['Color','Modelo','Tamaño'],'Diámetro de caja y ancho de correa en mm','Contorno de muñeca y eslabones ajustables'],
 ['earring','Aros y pendientes',/aros?|aretes?|pendientes|earrings?/,['Acero inoxidable','Acero quirúrgico','Plata 925','Aleación metálica'],['Cierre: mariposa.','Cierre: presión.','Diseño: argolla.','Diseño: colgante.'],['Color','Diseño','Tamaño'],'Largo y diámetro en cm','Tipo de cierre y ajuste'],
 ['necklace','Collares y cadenas',/collar(?:es)?|cadenas?|necklaces?/,['Acero inoxidable','Acero quirúrgico','Plata 925','Chapado en oro'],['Cierre: mosquetón.','Cadena con extensor.','Incluye dije.'],['Color','Modelo','Largo'],'Largo de cadena, extensor y tamaño del dije','Rango de ajuste del extensor'],
 ['ring','Anillos',/anillos?|rings?/,['Acero inoxidable','Acero quirúrgico','Plata 925','Aleación metálica'],['Diseño: solitario.','Diseño: cinta.','Ajuste: regulable.'],['Color','Talle','Diseño'],'Diámetro interior en mm o talle confirmado','Talle fijo o rango regulable'],
 ['earcuff','Earcuffs',/earcuffs?|earcuff/,['Acero inoxidable','Plata 925','Aleación metálica'],['Ajuste: presión.','No requiere perforación.'],['Color','Diseño'],'Diámetro y ancho de la pieza','Forma de sujeción'],
 ['anklet','Tobilleras',/tobilleras?|anklets?/,['Acero inoxidable','Plata 925','Chapado en oro'],['Cierre: mosquetón.','Incluye extensor.'],['Color','Largo','Diseño'],'Largo de tobillera y extensor','Rango de ajuste'],
 ['bracelet','Pulseras y brazaletes',/pulseras?|brazaletes?|bracelets?|armcuffs?/,['Acero inoxidable','Acero quirúrgico','Plata 925','Cuero sintético'],['Cierre: broche.','Cierre: mosquetón.','Ajuste: regulable.'],['Color','Talle','Diseño'],'Largo, diámetro o contorno en cm','Rango de ajuste o talle'],
 ['sunglasses','Gafas y lentes',/gafas?|lentes|sunglasses?/,['Resina','Acetato','Aleación metálica'],['Forma: rectangular.','Forma: redonda.','Forma: cat eye.','Incluye estuche.'],['Color','Modelo'],'Ancho de lente, puente y patilla en mm','Ajuste de puente y patillas'],
 ['hair','Accesorios para cabello',/cabello|pelo|hair/,['Resina','Tela / textil','Aleación metálica'],['Tipo: pinza.','Tipo: vincha.','Tipo: hebilla.','Tipo: scrunchie.'],['Color','Modelo','Tamaño'],'Largo, ancho o diámetro en cm','Tipo de sujeción'],
 ['keyring','Llaveros',/llaveros?|keyrings?/,['Aleación metálica','Resina','Cuero sintético'],['Sujeción: argolla.','Sujeción: mosquetón.'],['Color','Diseño'],'Largo total y tamaño del adorno','Tipo de sujeción'],
 ['organizer','Joyeros y organizadores',/joyeros?|organizadores?|organizers?/,['Cuero sintético','Tela / textil','Resina'],['Formato: de viaje.','Formato: de mesa.','Cierre: cremallera.'],['Color','Tamaño','Modelo'],'Alto × ancho × profundidad en cm','Distribución y capacidad'],
];
export function productEditorCategoryProfile({category='',name=''}={}){
 const matches=(pattern,value)=>new RegExp(`(?:^|[^a-z0-9])(?:${pattern.source})(?:$|[^a-z0-9])`).test(normalize(value));
 const profile=categoryDetails.find(([, ,pattern])=>matches(pattern,category)) || categoryDetails.find(([, ,pattern])=>matches(pattern,name));
 if(!profile)return {key:'generic',title:'Producto',materials:[],descriptionChoices:[],variantGroups:['Color','Modelo','Tamaño'],measurements:'Medidas confirmadas del producto',sizeFit:'Talle, ajuste o forma de uso'};
 const [key,title,,materials,descriptionChoices,variantGroups,measurements,sizeFit]=profile;
 return {key,title,materials:[...materials],descriptionChoices:[...descriptionChoices],variantGroups:[...variantGroups],measurements,sizeFit};
}
