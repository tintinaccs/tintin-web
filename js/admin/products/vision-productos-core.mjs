// Sugerencias visuales acotadas. Nunca produce precios, stock ni materiales.
export function rankProductImage(vector, labels) {
  if(!Array.isArray(labels) || !vector || vector.length!==512 || !Array.from(vector).every(Number.isFinite))throw Error('Resultado visual inválido.');
  const norm=Math.hypot(...vector);if(!norm)return null;
  const ranked=labels.map(({key,label,embedding})=>{
    if(!Array.isArray(embedding) || embedding.length!==512 || !embedding.every(Number.isFinite))throw Error('Etiquetas visuales inválidas.');
    return {key,label,score:embedding.reduce((sum,value,index)=>sum+value*vector[index]/norm,0)};
  }).sort((a,b)=>b.score-a.score);
  const first=ranked[0],second=ranked.find(row=>row.key!==first?.key);
  if(!first || first.key==='other' || first.score<.22 || first.score-(second?.score || 0)<.025)return null;
  return {key:first.key,label:first.label};
}

const categoryNames={bag:['cartera','carteras','bolso','bolsos','bags'],earrings:['aro','aros','arete','aretes','pendientes'],necklace:['cadena','cadenas','collar','collares'],bracelet:['pulsera','pulseras'],watch:['reloj','relojes'],ring:['anillo','anillos'],hair:['accesorios para el pelo','accesorios de cabello'],keyring:['llavero','llaveros'],wallet:['billetera','billeteras'],cuff:['brazalete','brazaletes','armcuff'],earcuff:['earcuff','earcuffs'],anklet:['tobillera','tobilleras'],organizer:['joyero','joyeros'],sunglasses:['gafa','gafas','lentes']};
const normalize=value=>String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('es');
export function suggestedCategory(key,options) {
  const names=categoryNames[key] || [];
  return Array.from(options || []).find(option=>option.value && !option.disabled && names.some(name=>normalize(option.value)===name || normalize(option.textContent)===name))?.value || '';
}
