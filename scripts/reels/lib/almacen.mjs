// Almacén local del Estudio de Reels.
// Guarda proyectos, referencias, calendario y registro de ejecuciones como JSON
// en una carpeta de trabajo fuera del control de versiones (reels-trabajo/ o REELS_DIR).
// Escrituras atómicas (archivo temporal + rename) para no dejar JSON a medias.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const RAIZ_REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export function carpetaTrabajo() {
  return path.resolve(process.env.REELS_DIR || path.join(RAIZ_REPO, 'reels-trabajo'));
}

export function rutas(base = carpetaTrabajo()) {
  return {
    base,
    proyectos: path.join(base, 'proyectos'),
    referencias: path.join(base, 'referencias'),
    medios: path.join(base, 'medios'),
    salidas: path.join(base, 'salidas'),
    config: path.join(base, 'config.json'),
    calendario: path.join(base, 'calendario.json'),
    ejecuciones: path.join(base, 'ejecuciones.jsonl'),
    publicaciones: path.join(base, 'publicaciones.json'),
    metricas: path.join(base, 'metricas.json'),
  };
}

export async function prepararCarpetas(base = carpetaTrabajo()) {
  const r = rutas(base);
  for (const dir of [r.base, r.proyectos, r.referencias, r.medios, r.salidas]) {
    await fs.mkdir(dir, { recursive: true });
  }
  return r;
}

export function nuevoId(prefijo) {
  return `${prefijo}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${crypto.randomBytes(4).toString('hex')}`;
}

const ID_SEGURO = /^[a-z]+_[0-9]{8}_[0-9a-f]{8}$/;
export function validarId(id) {
  if (typeof id !== 'string' || !ID_SEGURO.test(id)) throw new ErrorEstudio('id_invalido', `Identificador inválido: ${String(id).slice(0, 40)}`, 400);
  return id;
}

export class ErrorEstudio extends Error {
  constructor(codigo, mensaje, estado = 400) {
    super(mensaje);
    this.codigo = codigo;
    this.estado = estado;
  }
}

export async function leerJson(archivo, porDefecto = null) {
  try {
    return JSON.parse(await fs.readFile(archivo, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return porDefecto;
    throw error;
  }
}

export async function escribirJson(archivo, datos) {
  await fs.mkdir(path.dirname(archivo), { recursive: true });
  const tmp = `${archivo}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(datos, null, 2)}\n`, 'utf8');
  await fs.rename(tmp, archivo);
}

// Cola por archivo: evita que dos escrituras concurrentes del mismo proceso pisen datos.
const colas = new Map();
export async function conBloqueo(clave, fn) {
  const previa = colas.get(clave) || Promise.resolve();
  let liberar;
  const actual = new Promise((resolve) => { liberar = resolve; });
  const cadena = previa.then(() => actual);
  colas.set(clave, cadena);
  await previa;
  try {
    return await fn();
  } finally {
    liberar();
    if (colas.get(clave) === cadena) colas.delete(clave);
  }
}

export async function registrarEjecucion(entrada, base = carpetaTrabajo()) {
  const r = rutas(base);
  await fs.mkdir(r.base, { recursive: true });
  const linea = { en: new Date().toISOString(), ...entrada };
  await fs.appendFile(r.ejecuciones, `${JSON.stringify(linea)}\n`, 'utf8');
  return linea;
}

export async function leerEjecuciones(limite = 200, base = carpetaTrabajo()) {
  try {
    const texto = await fs.readFile(rutas(base).ejecuciones, 'utf8');
    return texto.trim().split('\n').filter(Boolean).slice(-limite).map((l) => JSON.parse(l)).reverse();
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export async function sha256Archivo(archivo) {
  const hash = crypto.createHash('sha256');
  const fh = await fs.open(archivo, 'r');
  try {
    for await (const trozo of fh.createReadStream()) hash.update(trozo);
  } finally {
    await fh.close().catch(() => {});
  }
  return hash.digest('hex');
}

// Resuelve una ruta relativa dentro de una carpeta permitida; rechaza salidas de la carpeta.
export function rutaDentro(baseDir, relativa) {
  if (typeof relativa !== 'string' || !relativa || relativa.includes('\0')) throw new ErrorEstudio('ruta_invalida', 'Ruta de archivo inválida');
  const destino = path.resolve(baseDir, relativa);
  if (destino !== baseDir && !destino.startsWith(baseDir + path.sep)) throw new ErrorEstudio('ruta_invalida', 'La ruta sale de la carpeta permitida');
  return destino;
}

export { RAIZ_REPO };
