// Montaje real con ffmpeg: escenas (foto/video) → recorte 9:16, zoom, duración, transiciones,
// textos en pantalla y subtítulos quemados, voz y música → MP4 1080×1920 H.264/AAC.
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ErrorEstudio, rutaDentro, sha256Archivo } from './almacen.mjs';
import { LIENZO, generarAss, generarSrt, palabrasAproximadas } from './subtitulos.mjs';

const FPS = 30;
const DIR_FUENTES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'fuentes');
const EXT_IMAGEN = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const EXT_VIDEO = new Set(['.mp4', '.mov', '.m4v', '.webm']);
const TRANSICIONES = new Set(['corte', 'fundido', 'deslizar', 'zoom']);

export function ejecutar(bin, args, { timeoutMs = 15 * 60_000 } = {}) {
  return new Promise((resolve, reject) => {
    const hijo = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const reloj = setTimeout(() => { hijo.kill('SIGKILL'); }, timeoutMs);
    hijo.stdout.on('data', (d) => { out += d; });
    hijo.stderr.on('data', (d) => { err += d; if (err.length > 200_000) err = err.slice(-100_000); });
    hijo.on('error', (e) => { clearTimeout(reloj); reject(e); });
    hijo.on('close', (codigo, senal) => {
      clearTimeout(reloj);
      if (codigo === 0) resolve({ out, err });
      else reject(new Error(`${path.basename(bin)} terminó con ${senal || codigo}: ${err.trim().split('\n').slice(-6).join(' | ')}`));
    });
  });
}

export async function sondear(archivo) {
  const { out } = await ejecutar('ffprobe', ['-v', 'error', '-show_entries',
    'format=duration,size:stream=index,codec_type,codec_name,width,height,r_frame_rate,pix_fmt,sample_rate,channels',
    '-of', 'json', archivo], { timeoutMs: 60_000 });
  const d = JSON.parse(out);
  const v = d.streams.find((s) => s.codec_type === 'video');
  const a = d.streams.find((s) => s.codec_type === 'audio');
  const [n, den] = String(v?.r_frame_rate || '0/1').split('/').map(Number);
  return {
    duracion: Number(d.format?.duration || 0),
    tamano: Number(d.format?.size || 0),
    video: v ? { codec: v.codec_name, ancho: v.width, alto: v.height, fps: den ? n / den : 0, pixfmt: v.pix_fmt } : null,
    audio: a ? { codec: a.codec_name, frecuencia: Number(a.sample_rate), canales: a.channels } : null,
  };
}

function num(v, def, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

// Normaliza y valida una escena. Las rutas de medios son relativas a la carpeta de medios.
export function normalizarEscena(e, i) {
  const medio = String(e?.medio || '');
  const ext = path.extname(medio).toLowerCase();
  const tipo = EXT_IMAGEN.has(ext) ? 'imagen' : EXT_VIDEO.has(ext) ? 'video' : null;
  if (!tipo) throw new ErrorEstudio('medio_invalido', `Escena ${i + 1}: formato no admitido (${ext || 'sin extensión'})`);
  return {
    id: e.id || `esc${i + 1}`,
    medio,
    tipo,
    duracion: num(e.duracion, 2.5, 0.5, 30),
    inicio: num(e.inicio, 0, 0, 3600), // recorte de video: segundo de inicio
    foco: { x: num(e.foco?.x, 0.5, 0, 1), y: num(e.foco?.y, 0.5, 0, 1) },
    zoomInicio: num(e.zoomInicio, 1, 1, 3),
    zoomFin: num(e.zoomFin, tipo === 'imagen' ? 1.08 : 1, 1, 3),
    texto: String(e.texto || '').slice(0, 120),
    // 'cubrir' llena el cuadro 9:16 recortando; 'contener' muestra la foto entera sobre un fondo liso
    // (útil para fotos de catálogo cuadradas con fondo blanco, para no cortar el producto).
    encuadre: e.encuadre === 'contener' ? 'contener' : 'cubrir',
    fondo: /^#[0-9a-fA-F]{6}$/.test(e.fondo || '') ? e.fondo : '#FFFFFF',
    transicion: TRANSICIONES.has(e.transicion) ? e.transicion : 'fundido',
    audioOriginal: Boolean(e.audioOriginal) && tipo === 'video',
  };
}

const DUR_TRANSICION = 0.35;

// Línea de tiempo: inicio de cada escena en el video final, descontando el solapamiento de transiciones.
export function lineaDeTiempo(escenas) {
  let t = 0;
  return escenas.map((e, i) => {
    const trans = i === 0 || escenas[i].transicion === 'corte' ? 0 : DUR_TRANSICION;
    const inicio = Math.max(0, t - trans);
    t = inicio + e.duracion;
    return { inicio: +inicio.toFixed(3), fin: +t.toFixed(3), transicion: trans };
  });
}

function filtroEscena(e) {
  const frames = Math.round(e.duracion * FPS);
  // Escala tipo "cover" al doble de resolución para que el zoom no pixele, luego zoompan al lienzo final.
  const W = LIENZO.ancho * 2;
  const H = LIENZO.alto * 2;
  const zi = e.zoomInicio.toFixed(4);
  const zf = e.zoomFin.toFixed(4);
  const z = `(${zi}+(${zf}-${zi})*on/${Math.max(1, frames - 1)})`;
  const encuadre = e.encuadre === 'contener'
    ? [
      `scale=${W}:${H}:force_original_aspect_ratio=decrease:flags=lanczos`,
      `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x${e.fondo.slice(1)}`,
    ]
    : [
      `scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos`,
      `crop=${W}:${H}:(iw-${W})*${e.foco.x.toFixed(4)}:(ih-${H})*${e.foco.y.toFixed(4)}`,
    ];
  return [
    ...encuadre,
    'setsar=1',
    `zoompan=z='${z}':x='(iw-iw/zoom)*${e.foco.x.toFixed(4)}':y='(ih-ih/zoom)*${e.foco.y.toFixed(4)}':d=${e.tipo === 'imagen' ? frames : 1}:s=${LIENZO.ancho}x${LIENZO.alto}:fps=${FPS}`,
    `trim=end_frame=${frames}`,
    'setpts=PTS-STARTPTS',
    'format=yuv420p',
  ].join(',');
}

async function renderEscena(e, archivoMedio, salida) {
  const args = ['-v', 'error', '-nostdin', '-y'];
  if (e.tipo === 'imagen') args.push('-loop', '1', '-framerate', String(FPS), '-t', String(e.duracion), '-i', archivoMedio);
  else args.push('-ss', String(e.inicio), '-t', String(e.duracion), '-i', archivoMedio);
  args.push('-f', 'lavfi', '-t', String(e.duracion), '-i', 'anullsrc=r=48000:cl=stereo');
  const audio = e.audioOriginal ? '[0:a]aresample=48000,aformat=channel_layouts=stereo,apad[a]' : '[1:a]anull[a]';
  args.push('-filter_complex', `[0:v]${filtroEscena(e)}[v];${audio}`, '-map', '[v]', '-map', '[a]',
    '-t', String(e.duracion), '-r', String(FPS), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16',
    '-c:a', 'pcm_s16le', salida);
  try {
    await ejecutar('ffmpeg', args);
  } catch (error) {
    if (e.audioOriginal) {
      // El clip no tiene pista de audio: se repite sin audio original en lugar de fallar.
      return renderEscena({ ...e, audioOriginal: false }, archivoMedio, salida);
    }
    throw error;
  }
  return salida;
}

const XFADE = { fundido: 'fade', deslizar: 'slideleft', zoom: 'zoomin' };

// plan: { escenas, voz: {archivo, volumen}, musica: {archivo, volumen, licencia}, palabras, textos, estilo }
export async function renderizar({ proyecto, dirMedios, dirSalida, palabras = null, alProgreso = () => {} }) {
  const m = proyecto.montaje || {};
  const escenas = (m.escenas || []).map(normalizarEscena);
  if (!escenas.length) throw new ErrorEstudio('sin_escenas', 'No hay escenas para montar');

  await fs.mkdir(dirSalida, { recursive: true });
  const tmp = await fs.mkdtemp(path.join(dirSalida, '.tmp-'));
  try {
    // Voz: si dura más que el video, se extiende la última escena (aviso, no recorte de la voz).
    let vozArchivo = null;
    let vozDuracion = 0;
    if (m.voz?.archivo) {
      vozArchivo = rutaDentro(dirMedios, m.voz.archivo);
      vozDuracion = (await sondear(vozArchivo)).duracion;
    }
    const avisos = [];
    let tl = lineaDeTiempo(escenas);
    const inicioVoz = num(m.voz?.inicio, 0.25, 0, 10);
    const necesario = vozArchivo ? inicioVoz + vozDuracion + 0.6 : 0;
    if (necesario > tl[tl.length - 1].fin) {
      const extra = necesario - tl[tl.length - 1].fin;
      escenas[escenas.length - 1].duracion = +(escenas[escenas.length - 1].duracion + extra).toFixed(3);
      avisos.push(`La voz dura más que las escenas: la última escena se extendió ${extra.toFixed(1)} s`);
      tl = lineaDeTiempo(escenas);
    }
    const total = tl[tl.length - 1].fin;
    if (total < 3) throw new ErrorEstudio('muy_corto', 'Instagram exige al menos 3 segundos de video');
    if (total > 90) avisos.push('Más de 90 s: revisá si conviene acortar para reels');

    // 1) Escenas individuales.
    const segmentos = [];
    for (let i = 0; i < escenas.length; i++) {
      alProgreso({ etapa: 'escenas', actual: i + 1, total: escenas.length });
      const archivoMedio = rutaDentro(dirMedios, escenas[i].medio);
      await fs.access(archivoMedio).catch(() => { throw new ErrorEstudio('medio_faltante', `Escena ${i + 1}: no se encuentra ${escenas[i].medio}`); });
      segmentos.push(await renderEscena(escenas[i], archivoMedio, path.join(tmp, `esc${i}.mkv`)));
    }

    // 2) Subtítulos y textos en pantalla.
    let subPalabras = palabras;
    let sincronizacion = 'transcripcion';
    if (!subPalabras?.length) {
      const textoVoz = proyecto.guion?.narracion || '';
      subPalabras = vozArchivo && textoVoz ? palabrasAproximadas(textoVoz, inicioVoz, inicioVoz + vozDuracion) : [];
      sincronizacion = subPalabras.length ? 'aproximada' : 'sin_subtitulos';
    } else {
      subPalabras = subPalabras.map((w) => ({ ...w, inicio: w.inicio + inicioVoz, fin: w.fin + inicioVoz }));
    }
    if (m.subtitulos?.activos === false) { subPalabras = []; sincronizacion = 'desactivados'; }
    const textos = escenas.map((e, i) => ({ inicio: tl[i].inicio + 0.1, fin: tl[i].fin - 0.05, texto: e.texto }));
    const ass = generarAss({ palabras: subPalabras, textos, estilo: m.estilo || {} });
    const archivoAss = path.join(tmp, 'subs.ass');
    await fs.writeFile(archivoAss, ass, 'utf8');

    // 3) Unión con transiciones + audio.
    alProgreso({ etapa: 'union' });
    const args = ['-v', 'error', '-nostdin', '-y'];
    for (const s of segmentos) args.push('-i', s);
    let idx = segmentos.length;
    let vozIdx = null;
    let musIdx = null;
    if (vozArchivo) { args.push('-i', vozArchivo); vozIdx = idx++; }
    if (m.musica?.archivo) {
      if (!m.musica.licencia) throw new ErrorEstudio('musica_sin_licencia', 'La música necesita indicar su licencia o permiso de uso');
      args.push('-stream_loop', '-1', '-i', rutaDentro(dirMedios, m.musica.archivo));
      musIdx = idx++;
    }
    const f = [];
    let v = '[0:v]';
    let a = '[0:a]';
    for (let i = 1; i < segmentos.length; i++) {
      const tr = tl[i].transicion;
      const offset = tl[i].inicio.toFixed(3);
      if (tr > 0) {
        f.push(`${v}[${i}:v]xfade=transition=${XFADE[escenas[i].transicion] || 'fade'}:duration=${tr}:offset=${offset}[v${i}]`);
        f.push(`${a}[${i}:a]acrossfade=d=${tr}:c1=tri:c2=tri[a${i}]`);
      } else {
        f.push(`${v}[${i}:v]concat=n=2:v=1:a=0[v${i}]`);
        f.push(`${a}[${i}:a]concat=n=2:v=0:a=1[a${i}]`);
      }
      v = `[v${i}]`;
      a = `[a${i}]`;
    }
    const assEsc = archivoAss.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
    const fuentesEsc = DIR_FUENTES.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
    f.push(`${v}subtitles=filename='${assEsc}':fontsdir='${fuentesEsc}',format=yuv420p[vout]`);
    const mezcla = [`${a}volume=${num(m.volumenClips, 1, 0, 2)}[ac]`];
    const entradasMezcla = ['[ac]'];
    if (vozIdx != null) {
      const ms = Math.round(inicioVoz * 1000);
      mezcla.push(`[${vozIdx}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${num(m.voz?.volumen, 1, 0, 3)},adelay=${ms}|${ms}[av]`);
      entradasMezcla.push('[av]');
    }
    if (musIdx != null) {
      mezcla.push(`[${musIdx}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${num(m.musica?.volumen, 0.18, 0, 1)}[am]`);
      entradasMezcla.push('[am]');
    }
    f.push(...mezcla);
    f.push(`${entradasMezcla.join('')}amix=inputs=${entradasMezcla.length}:normalize=0:duration=first,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[aout]`);

    const nombre = `reel-${proyecto.id}-v${proyecto.version}.mp4`;
    const salida = path.join(dirSalida, nombre);
    args.push('-filter_complex', f.join(';'), '-map', '[vout]', '-map', '[aout]', '-t', total.toFixed(3),
      '-r', String(FPS), '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-crf', '19', '-maxrate', '12M', '-bufsize', '24M',
      '-g', String(FPS * 2), '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2',
      '-movflags', '+faststart', salida);
    await ejecutar('ffmpeg', args);

    // 4) Verificación del archivo resultante (no se confía en que ffmpeg "terminó bien").
    alProgreso({ etapa: 'verificacion' });
    const info = await sondear(salida);
    const problemas = verificarRequisitos(info);
    if (problemas.length) throw new Error(`El video no cumple: ${problemas.join('; ')}`);
    const srt = path.join(dirSalida, nombre.replace(/\.mp4$/, '.srt'));
    await fs.writeFile(srt, generarSrt(subPalabras), 'utf8');
    const portada = path.join(dirSalida, nombre.replace(/\.mp4$/, '.jpg'));
    await ejecutar('ffmpeg', ['-v', 'error', '-nostdin', '-y', '-ss', String(Math.min(1, total / 2)), '-i', salida, '-frames:v', '1', '-q:v', '3', portada]);
    return {
      archivo: nombre,
      srt: path.basename(srt),
      portada: path.basename(portada),
      sha256: await sha256Archivo(salida),
      duracion: +info.duracion.toFixed(3),
      ancho: info.video.ancho,
      alto: info.video.alto,
      fps: +info.video.fps.toFixed(2),
      tamano: info.tamano,
      audio: info.audio,
      sincronizacion,
      avisos,
      escenas: escenas.map((e, i) => ({ id: e.id, inicio: tl[i].inicio, fin: tl[i].fin })),
      generado: new Date().toISOString(),
    };
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

// Requisitos oficiales de Reels (Meta, content publishing): MP4/MOV, H.264/HEVC, 4:2:0,
// 23-60 fps, máx. 1920 px, AAC ≤48 kHz, 3 s a 15 min, ≤300 MB. Más el formato pedido 1080×1920 con audio.
export function verificarRequisitos(info) {
  const p = [];
  if (!info.video) p.push('sin pista de video');
  else {
    if (info.video.ancho !== 1080 || info.video.alto !== 1920) p.push(`resolución ${info.video.ancho}×${info.video.alto}`);
    if (!['h264', 'hevc'].includes(info.video.codec)) p.push(`códec ${info.video.codec}`);
    if (info.video.pixfmt !== 'yuv420p') p.push(`formato de color ${info.video.pixfmt}`);
    if (info.video.fps < 23 || info.video.fps > 60) p.push(`fps ${info.video.fps}`);
  }
  if (!info.audio) p.push('sin audio');
  else if (info.audio.codec !== 'aac' || info.audio.frecuencia > 48000) p.push(`audio ${info.audio.codec} ${info.audio.frecuencia} Hz`);
  if (info.duracion < 3 || info.duracion > 900) p.push(`duración ${info.duracion.toFixed(1)} s`);
  if (info.tamano > 300 * 1024 * 1024) p.push('más de 300 MB');
  return p;
}
