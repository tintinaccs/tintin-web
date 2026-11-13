// Proyectos de reel: estados, versiones, huella de aprobación y reglas de edición.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  ErrorEstudio, conBloqueo, escribirJson, leerJson, nuevoId, prepararCarpetas, rutas, validarId,
} from './almacen.mjs';

export const ESTADOS = Object.freeze({
  BORRADOR: 'Borrador',
  PREPARANDO: 'Preparando',
  LISTO: 'Listo para revisar',
  APROBADO: 'Aprobado',
  PROGRAMADO: 'Programado',
  PUBLICADO: 'Publicado',
  ERROR: 'Error',
});

// Campos que cambian el video: invalidan el render y la aprobación.
const CAMPOS_DE_VIDEO = new Set(['guion', 'montaje']);
// Campos que no cambian el video pero sí lo aprobado: invalidan la aprobación.
const CAMPOS_DE_PUBLICACION = new Set(['caption', 'cuenta', 'programadoPara']);
const CAMPOS_LIBRES = new Set(['titulo', 'notas', 'referenciaId', 'producto', 'metadatos']);

export function huellaAprobacion({ videoSha256, caption, cuenta, programadoPara }) {
  const base = JSON.stringify({
    video: videoSha256 || null,
    caption: caption || '',
    cuenta: cuenta || '',
    programadoPara: programadoPara || null,
  });
  return crypto.createHash('sha256').update(base).digest('hex');
}

export function huellaActual(p) {
  return huellaAprobacion({
    videoSha256: p.render?.sha256,
    caption: p.caption,
    cuenta: p.cuenta,
    programadoPara: p.programadoPara,
  });
}

export function aprobacionVigente(p) {
  return Boolean(p.aprobacion && p.render?.sha256 && p.aprobacion.huella === huellaActual(p));
}

function carpetaProyecto(id, base) {
  return path.join(rutas(base).proyectos, validarId(id));
}

function archivoProyecto(id, base) {
  return path.join(carpetaProyecto(id, base), 'proyecto.json');
}

function evento(p, tipo, detalle = {}) {
  p.historial = p.historial || [];
  p.historial.push({ en: new Date().toISOString(), tipo, version: p.version, ...detalle });
}

async function guardarVersion(p, base) {
  const dir = path.join(carpetaProyecto(p.id, base), 'versiones');
  await fs.mkdir(dir, { recursive: true });
  const { historial, ...sinHistorial } = p;
  await escribirJson(path.join(dir, `v${String(p.version).padStart(4, '0')}.json`), sinHistorial);
}

export async function crearProyecto(datos = {}, base) {
  await prepararCarpetas(base);
  const ahora = new Date().toISOString();
  const p = {
    id: nuevoId('reel'),
    titulo: String(datos.titulo || 'Reel sin título').slice(0, 140),
    estado: ESTADOS.BORRADOR,
    archivado: false,
    version: 1,
    creado: ahora,
    actualizado: ahora,
    modo: datos.modo === 'real' ? 'real' : 'prueba',
    referenciaId: datos.referenciaId || null,
    producto: datos.producto || null,
    guion: datos.guion || null,
    caption: datos.caption || '',
    cuenta: datos.cuenta || '',
    programadoPara: null,
    montaje: datos.montaje || { escenas: [], voz: null, musica: null, subtitulos: null },
    render: null,
    aprobacion: null,
    revisiones: [],
    publicacion: null,
    metadatos: datos.metadatos || {},
    historial: [],
  };
  evento(p, 'creado');
  await fs.mkdir(carpetaProyecto(p.id, base), { recursive: true });
  await escribirJson(archivoProyecto(p.id, base), p);
  await guardarVersion(p, base);
  return p;
}

export async function leerProyecto(id, base) {
  const p = await leerJson(archivoProyecto(id, base));
  if (!p) throw new ErrorEstudio('no_encontrado', 'El proyecto no existe', 404);
  return p;
}

export async function listarProyectos(base) {
  const dir = rutas(base).proyectos;
  let nombres = [];
  try { nombres = await fs.readdir(dir); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const lista = [];
  for (const n of nombres) {
    const p = await leerJson(path.join(dir, n, 'proyecto.json'));
    if (p) lista.push(p);
  }
  return lista.sort((a, b) => b.actualizado.localeCompare(a.actualizado));
}

export async function listarVersiones(id, base) {
  const dir = path.join(carpetaProyecto(id, base), 'versiones');
  try {
    return (await fs.readdir(dir)).filter((n) => n.endsWith('.json')).sort();
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

// Mutación atómica de un proyecto: lee, aplica, incrementa versión si hubo cambios de contenido.
export async function mutarProyecto(id, fn, base) {
  return conBloqueo(`proyecto:${id}`, async () => {
    const p = await leerProyecto(id, base);
    const resultado = await fn(p);
    p.actualizado = new Date().toISOString();
    await escribirJson(archivoProyecto(id, base), p);
    if (resultado?.nuevaVersion) await guardarVersion(p, base);
    return p;
  });
}

// Edición del contenido. `versionEsperada` evita pisar cambios de otra pestaña.
export async function editarProyecto(id, cambios, { versionEsperada, autor = 'panel' } = {}, base) {
  return mutarProyecto(id, (p) => {
    if (p.estado === ESTADOS.PUBLICADO) throw new ErrorEstudio('publicado', 'Un reel publicado no se edita: duplicalo para crear una variante', 409);
    if (p.estado === ESTADOS.PREPARANDO) throw new ErrorEstudio('preparando', 'Esperá a que termine el montaje antes de editar', 409);
    if (versionEsperada != null && Number(versionEsperada) !== p.version) {
      throw new ErrorEstudio('version_conflicto', `El proyecto cambió (versión ${p.version}); recargá antes de guardar`, 409);
    }
    const claves = Object.keys(cambios || {});
    const desconocidas = claves.filter((k) => !CAMPOS_DE_VIDEO.has(k) && !CAMPOS_DE_PUBLICACION.has(k) && !CAMPOS_LIBRES.has(k));
    if (desconocidas.length) throw new ErrorEstudio('campo_invalido', `Campos no editables: ${desconocidas.join(', ')}`);
    const cambiadas = claves.filter((k) => JSON.stringify(p[k] ?? null) !== JSON.stringify(cambios[k] ?? null));
    if (!cambiadas.length) return { nuevaVersion: false };

    if (cambios.programadoPara !== undefined && cambios.programadoPara !== null) {
      const fecha = new Date(cambios.programadoPara);
      if (Number.isNaN(fecha.getTime())) throw new ErrorEstudio('fecha_invalida', 'Fecha de programación inválida');
      cambios.programadoPara = fecha.toISOString();
    }
    if (cambios.caption !== undefined && String(cambios.caption).length > 2200) {
      throw new ErrorEstudio('caption_largo', 'Instagram admite hasta 2200 caracteres en el texto');
    }

    const estabaAprobado = Boolean(p.aprobacion);
    for (const k of cambiadas) p[k] = cambios[k];
    p.version += 1;

    const tocaVideo = cambiadas.some((k) => CAMPOS_DE_VIDEO.has(k));
    const tocaPublicacion = cambiadas.some((k) => CAMPOS_DE_PUBLICACION.has(k));
    if (tocaVideo) {
      p.render = null;
      p.aprobacion = null;
      p.estado = ESTADOS.BORRADOR;
    } else if (tocaPublicacion && p.aprobacion) {
      p.aprobacion = null;
      p.estado = p.render ? ESTADOS.LISTO : ESTADOS.BORRADOR;
    }
    evento(p, 'editado', {
      autor,
      campos: cambiadas,
      ...(estabaAprobado && !p.aprobacion ? { aviso: 'La aprobación anterior quedó sin efecto; vuelve a revisión' } : {}),
    });
    return { nuevaVersion: true };
  }, base);
}

export async function marcarPreparando(id, base) {
  return mutarProyecto(id, (p) => {
    if (p.estado === ESTADOS.PUBLICADO) throw new ErrorEstudio('publicado', 'El reel ya está publicado', 409);
    if (p.estado === ESTADOS.PREPARANDO) throw new ErrorEstudio('preparando', 'Ya se está preparando', 409);
    if (!p.montaje?.escenas?.length) throw new ErrorEstudio('sin_escenas', 'Agregá al menos una escena con foto o video');
    p.estado = ESTADOS.PREPARANDO;
    p.aprobacion = null;
    evento(p, 'montaje_iniciado');
    return { nuevaVersion: false };
  }, base);
}

export async function registrarRender(id, { ok, render, error, versionMontada }, base) {
  return mutarProyecto(id, (p) => {
    if (p.version !== versionMontada) {
      // Se editó durante el montaje: el resultado no corresponde a la versión actual.
      p.estado = ESTADOS.BORRADOR;
      evento(p, 'montaje_descartado', { motivo: `Montaje de la versión ${versionMontada}; el proyecto ya está en la ${p.version}` });
      return { nuevaVersion: false };
    }
    if (ok) {
      p.render = { ...render, version: p.version };
      p.estado = ESTADOS.LISTO;
      evento(p, 'montaje_listo', { sha256: render.sha256, duracion: render.duracion });
    } else {
      p.render = null;
      p.estado = ESTADOS.ERROR;
      p.ultimoError = { en: new Date().toISOString(), etapa: 'montaje', mensaje: String(error).slice(0, 2000) };
      evento(p, 'montaje_error', { mensaje: String(error).slice(0, 300) });
    }
    return { nuevaVersion: false };
  }, base);
}

// Decisión de revisión. `huellaRevisada` es la huella que vio la persona en el panel.
export async function revisar(id, { decision, nota = '', huellaRevisada, autor = 'panel' }, base) {
  return mutarProyecto(id, (p) => {
    if (decision === 'pedir_cambios' || decision === 'rechazar') {
      if (p.estado === ESTADOS.PUBLICADO) throw new ErrorEstudio('publicado', 'Ya está publicado', 409);
      p.aprobacion = null;
      p.estado = p.estado === ESTADOS.PREPARANDO ? p.estado : ESTADOS.BORRADOR;
      if (decision === 'rechazar') p.archivado = true;
      p.revisiones.push({ en: new Date().toISOString(), decision, nota: String(nota).slice(0, 2000), autor, version: p.version });
      evento(p, decision === 'rechazar' ? 'rechazado' : 'cambios_pedidos', { nota: String(nota).slice(0, 300) });
      return { nuevaVersion: false };
    }
    if (decision !== 'aprobar' && decision !== 'aprobar_y_programar') throw new ErrorEstudio('decision_invalida', 'Decisión desconocida');
    if (![ESTADOS.LISTO, ESTADOS.APROBADO, ESTADOS.PROGRAMADO].includes(p.estado) || !p.render?.sha256) {
      throw new ErrorEstudio('sin_video', 'Solo se aprueba un video ya montado y revisado', 409);
    }
    if (!p.caption?.trim()) throw new ErrorEstudio('sin_caption', 'Falta el texto de la publicación');
    if (!p.cuenta?.trim()) throw new ErrorEstudio('sin_cuenta', 'Falta indicar la cuenta de Instagram');
    // El horario se guarda antes (edición) para que la huella revisada ya lo incluya.
    if (decision === 'aprobar_y_programar') {
      const fecha = new Date(p.programadoPara || '');
      if (Number.isNaN(fecha.getTime())) throw new ErrorEstudio('sin_fecha', 'Guardá primero la fecha y hora de publicación');
      if (fecha.getTime() < Date.now() + 60_000) throw new ErrorEstudio('fecha_pasada', 'La fecha programada debe ser futura');
    } else if (p.programadoPara) {
      throw new ErrorEstudio('tiene_horario', 'Este reel tiene horario: usá "Aprobar y programar" o quitá el horario');
    }
    const huella = huellaActual(p);
    if (!huellaRevisada || huellaRevisada !== huella) {
      throw new ErrorEstudio('huella_distinta', 'Lo que aprobaste no coincide con la versión actual (video, texto, cuenta u horario). Revisá de nuevo.', 409);
    }
    p.aprobacion = {
      huella,
      en: new Date().toISOString(),
      autor,
      version: p.version,
      videoSha256: p.render.sha256,
      caption: p.caption,
      cuenta: p.cuenta,
      programadoPara: p.programadoPara,
    };
    p.estado = decision === 'aprobar_y_programar' ? ESTADOS.PROGRAMADO : ESTADOS.APROBADO;
    p.revisiones.push({ en: p.aprobacion.en, decision, nota: String(nota).slice(0, 2000), autor, version: p.version, huella });
    evento(p, p.estado === ESTADOS.PROGRAMADO ? 'aprobado_y_programado' : 'aprobado', { huella: huella.slice(0, 12), programadoPara: p.programadoPara });
    return { nuevaVersion: false };
  }, base);
}

export async function duplicarProyecto(id, base) {
  const origen = await leerProyecto(id, base);
  const copia = await crearProyecto({
    titulo: `${origen.titulo} (variante)`,
    referenciaId: origen.referenciaId,
    producto: origen.producto,
    guion: origen.guion,
    caption: origen.caption,
    cuenta: origen.cuenta,
    montaje: origen.montaje,
    modo: origen.modo,
    metadatos: { ...origen.metadatos, varianteDe: origen.id },
  }, base);
  return copia;
}

export { evento };
