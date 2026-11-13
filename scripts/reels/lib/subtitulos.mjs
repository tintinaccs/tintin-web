// Subtítulos palabra por palabra (ASS para quemar en el video y SRT para descargar).
// Zonas seguras de Instagram Reels (1080×1920): se evita la franja superior (cabecera),
// la inferior (texto de la publicación y audio) y la columna derecha (botones).

export const LIENZO = Object.freeze({ ancho: 1080, alto: 1920 });
export const ZONA_SEGURA = Object.freeze({ arriba: 260, abajo: 420, izquierda: 90, derecha: 170 });

const ROSA = '&H00CAAAF8'; // #F8AACA en formato ASS (AABBGGRR)
const BLANCO = '&H00FFFFFF';
const TEXTO = '&H00222222';
const SOMBRA = '&H8C000000';

function tiempoAss(s) {
  const t = Math.max(0, s);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const seg = t % 60;
  return `${h}:${String(m).padStart(2, '0')}:${seg.toFixed(2).padStart(5, '0')}`;
}

function tiempoSrt(s) {
  const ms = Math.round(Math.max(0, s) * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const seg = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(seg).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
}

export function escaparAss(texto) {
  return String(texto ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '(')
    .replace(/\}/g, ')')
    .replace(/\r?\n/g, '\\N');
}

// Palabras desde una transcripción {segmentos:[{palabras:[{inicio,fin,texto}]}]}.
export function palabrasDeTranscripcion(transcripcion, desplazamiento = 0) {
  const out = [];
  for (const seg of transcripcion?.segmentos || []) {
    for (const p of seg.palabras || []) {
      const texto = String(p.texto || '').trim();
      if (!texto) continue;
      out.push({ inicio: +(p.inicio + desplazamiento).toFixed(3), fin: +(p.fin + desplazamiento).toFixed(3), texto });
    }
  }
  return out;
}

// Reparto aproximado cuando no hay transcripción: proporcional a la longitud de cada palabra.
// Se marca como aproximado; nunca se presenta como sincronizado con la voz.
export function palabrasAproximadas(texto, inicio, fin) {
  const palabras = String(texto || '').split(/\s+/).filter(Boolean);
  if (!palabras.length || fin <= inicio) return [];
  const pesos = palabras.map((p) => p.length + 2);
  const total = pesos.reduce((a, b) => a + b, 0);
  let t = inicio;
  return palabras.map((p, i) => {
    const d = ((fin - inicio) * pesos[i]) / total;
    const w = { inicio: +t.toFixed(3), fin: +(t + d).toFixed(3), texto: p, aproximado: true };
    t += d;
    return w;
  });
}

// Agrupa en bloques cortos (máx. 3 palabras / 18 caracteres), cortando en signos de puntuación.
export function agrupar(palabras, { maxPalabras = 3, maxCaracteres = 18 } = {}) {
  const grupos = [];
  let actual = [];
  const cerrar = () => { if (actual.length) grupos.push(actual); actual = []; };
  for (const p of palabras) {
    const largo = actual.map((x) => x.texto).join(' ').length + p.texto.length + 1;
    if (actual.length && (actual.length >= maxPalabras || largo > maxCaracteres || p.inicio - actual[actual.length - 1].fin > 0.6)) cerrar();
    actual.push(p);
    if (/[.!?¿¡,;:…]$/.test(p.texto)) cerrar();
  }
  cerrar();
  return grupos;
}

function limpiarPalabra(t, minusculas) {
  const s = String(t).replace(/[.,;:]+$/u, '');
  return minusculas ? s.toLocaleLowerCase('es') : s;
}

// Textos en pantalla por escena: [{inicio, fin, texto}]
export function generarAss({ palabras = [], textos = [], estilo = {} } = {}) {
  const minusculas = estilo.minusculas !== false;
  const tamSub = estilo.tamanoSubtitulo || 86;
  const tamTitulo = estilo.tamanoTitulo || 62;
  const subY = estilo.subtituloY || 1260; // línea base aproximada, dentro de la zona segura
  const margenSub = LIENZO.alto - subY;
  const cab = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${LIENZO.ancho}`,
    `PlayResY: ${LIENZO.alto}`,
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    'YCbCr Matrix: TV.709',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Sub,Montserrat,${tamSub},${BLANCO},${BLANCO},&H64000000,${SOMBRA},-1,0,0,0,100,100,0,0,1,4,4,2,${ZONA_SEGURA.izquierda},${ZONA_SEGURA.derecha},${margenSub},1`,
    `Style: Titulo,Montserrat,${tamTitulo},${TEXTO},${TEXTO},${BLANCO},&H00FFFFFF,-1,0,0,0,100,100,0,0,3,22,0,8,${ZONA_SEGURA.izquierda + 20},${ZONA_SEGURA.derecha + 20},${ZONA_SEGURA.arriba + 40},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];
  const eventos = [];
  for (const t of textos) {
    if (!String(t.texto || '').trim() || !(t.fin > t.inicio)) continue;
    eventos.push(`Dialogue: 1,${tiempoAss(t.inicio)},${tiempoAss(t.fin)},Titulo,,0,0,0,,{\\fad(150,150)}${escaparAss(t.texto)}`);
  }
  for (const grupo of agrupar(palabras)) {
    for (let i = 0; i < grupo.length; i++) {
      const inicio = grupo[i].inicio;
      const fin = i + 1 < grupo.length ? grupo[i + 1].inicio : grupo[i].fin + 0.12;
      const texto = grupo
        .map((w, j) => (j === i ? `{\\c${ROSA}}${escaparAss(limpiarPalabra(w.texto, minusculas))}{\\c${BLANCO}}` : escaparAss(limpiarPalabra(w.texto, minusculas))))
        .join(' ');
      eventos.push(`Dialogue: 0,${tiempoAss(inicio)},${tiempoAss(Math.max(fin, inicio + 0.08))},Sub,,0,0,0,,${texto}`);
    }
  }
  return `${cab.join('\n')}\n${eventos.join('\n')}\n`;
}

export function generarSrt(palabras) {
  return agrupar(palabras)
    .map((g, i) => `${i + 1}\n${tiempoSrt(g[0].inicio)} --> ${tiempoSrt(g[g.length - 1].fin)}\n${g.map((w) => w.texto).join(' ')}\n`)
    .join('\n');
}
