#!/usr/bin/env node
// Corrección puntual (aprobada por la dueña en el chat): productos con varios
// colores que comparten un único stock agregado pasan a tener 1 unidad por
// combinación de color. Solo toca los IDs listados y solo si el documento
// sigue exactamente como se auditó (sin variantInventory, v1, stock esperado).
//
// Uso:
//   node scripts/corregir-stock-por-color.mjs            -> vista previa, no escribe
//   node scripts/corregir-stock-por-color.mjs --aplicar  -> escribe en Firestore
// Requiere FIREBASE_SERVICE_ACCOUNT_JSON en el entorno (nunca se imprime).
import {
  firestoreAdminGet, firestoreAdminMerge, decodeFirestoreFields, encodeFirestoreFields
} from '../cloudflare/firebase-admin-ligero.js';
import { productVariantGroups, variantInventoryEntries } from '../js/core/store/inventario-variantes.mjs';

const OBJETIVOS = [
  ['66a6f5b0-9811-41fd-a223-cc312323ada2', 'COLLAR CAROLINE', 1],
  ['67f5e565-1fc5-4c17-b63e-b2b4d68ad4cc', 'MOCHILA ALYSSIA', 1],
  ['86917d1b-5700-4fa0-b249-ff9d7aa89a6b', 'MOCHILA MELINA', 1],
  ['89644b43-2cd3-495b-8127-7f4caa65f1b2', 'MOCHILA ZELINA', 1],
  ['95b5232b-4d18-4d81-bd22-687f620a423c', 'COLLAR AZURIA', 1],
  ['MrtJ4lio2oUeKzBCcuUt', 'BOLSO ELIZABETH', 1],
  ['a1fefc5d-4076-4c82-92c4-d411f1c3ec96', 'MOCHILA AZENIA', 1],
  ['bM3sX0OrqLnT7nSK2xSp', 'RELOJ CHARLOTTE', 2],
  ['cc0865a2-b415-49f5-84a6-94832425c4f7', 'BOLSO ISADORA', 1],
  ['f90b7a7b-74ea-4922-9ddc-4103e44c79e8', 'BOLSO ZARETH', 1]
];

export function combinaciones(product) {
  const grupos = productVariantGroups(product);
  if (!grupos.length) return [];
  return grupos.reduce((acc, valores) => acc.flatMap(base => valores.map(v => base ? `${base} / ${v}` : v)), ['']);
}

export function planificar(product, stockEsperado) {
  if (product.variantCommerceVersion === 2) return { error: 'es v2; no se toca' };
  if (product.variantInventory != null) return { error: 'ya tiene stock por color; no se toca' };
  if (Number(product.stock) !== stockEsperado) return { error: `stock cambió (${product.stock} ≠ ${stockEsperado}); revisar a mano` };
  const combos = combinaciones(product);
  if (combos.length < 2) return { error: 'tiene menos de 2 combinaciones' };
  const variantInventory = combos.map(variant => ({ variant, stock: 1 }));
  const nuevo = { ...product, variantInventory, stock: combos.length };
  const entries = variantInventoryEntries(nuevo);
  if (!entries || entries.length !== combos.length) return { error: 'la matriz resultante no valida' };
  return { variantInventory, stock: combos.length };
}

async function main() {
  const aplicar = process.argv.includes('--aplicar');
  const env = process.env;
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON && !env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    console.error('Falta FIREBASE_SERVICE_ACCOUNT_JSON en el entorno.');
    process.exit(2);
  }
  let fallos = 0;
  for (const [id, nombre, stockEsperado] of OBJETIVOS) {
    const doc = await firestoreAdminGet(env, `products/${id}`);
    if (!doc) { console.log(`✗ ${nombre} [${id}]: no existe`); fallos++; continue; }
    const product = decodeFirestoreFields(doc.fields || {});
    const plan = planificar(product, stockEsperado);
    if (plan.error) { console.log(`✗ ${nombre} [${id}]: ${plan.error}`); fallos++; continue; }
    const detalle = plan.variantInventory.map(e => `${e.variant}=1`).join(', ');
    console.log(`${aplicar ? '→' : '·'} ${nombre}: stock ${product.stock} → ${plan.stock} | ${detalle}`);
    if (!aplicar) continue;
    try {
      await firestoreAdminMerge(env, `products/${id}`, encodeFirestoreFields({
        variantInventory: plan.variantInventory, stock: plan.stock, updatedAt: new Date()
      }), { updateTime: doc.updateTime });
      const despues = decodeFirestoreFields((await firestoreAdminGet(env, `products/${id}`)).fields || {});
      const ok = despues.stock === plan.stock && variantInventoryEntries(despues)?.length === plan.stock;
      console.log(`  ${ok ? '✓ verificado' : '✗ verificación falló'}`);
      if (!ok) fallos++;
    } catch (error) { console.log(`  ✗ ${error.code || ''} ${error.message}`); fallos++; }
  }
  console.log(aplicar ? `\nTerminado. Fallos: ${fallos}` : `\nVista previa (nada escrito). Fallos/omitidos: ${fallos}`);
  process.exit(fallos ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
