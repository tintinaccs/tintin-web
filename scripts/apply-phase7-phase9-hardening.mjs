import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const filePath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(filePath), '..');

function update(relative, transform) {
  const absolute = path.join(root, relative);
  const before = fs.readFileSync(absolute, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`No se aplicó ningún cambio en ${relative}`);
  fs.writeFileSync(absolute, after, 'utf8');
  console.log(`Actualizado: ${relative}`);
}

function replaceExact(text, search, replacement, label) {
  if (!text.includes(search)) throw new Error(`No se encontró el bloque esperado: ${label}`);
  return text.replace(search, replacement);
}

update('js/admin-import-phase9.js', source => {
  let text = source;

  text = replaceExact(
    text,
    "import { getDocsPaginated } from './firestore-pagination.js?v=tintin-20260716-cloudinary-fix-1';",
    "import { getDocsPaginated } from './firestore-pagination.js?v=tintin-20260716-cloudinary-fix-1';\nimport {\n  parseDelimitedRows,\n  parseLocalizedNumber,\n  parseOptionalStock,\n  validateOperationalBackupEnvelope,\n} from './import-normalization.mjs?v=tintin-20260731-phase9-import-1';",
    'import del normalizador'
  );

  text = replaceExact(
    text,
    `  function numberValue(value) {\n    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;\n    const raw = text(value).trim().replace(/\\s/g, '');\n    if (!raw) return 0;\n    const normalized = raw.includes(',') && raw.includes('.')\n      ? raw.replace(/\\./g, '').replace(',', '.')\n      : raw.replace(/,/g, '');\n    const number = Number(normalized);\n    return Number.isFinite(number) ? number : 0;\n  }\n\n  function integerValue(value) {\n    return Math.max(0, Math.floor(numberValue(value)));\n  }`,
    `  function numberValue(value) {\n    const parsed = parseLocalizedNumber(value);\n    return Number.isFinite(parsed) ? parsed : 0;\n  }`,
    'normalización numérica anterior'
  );

  text = replaceExact(
    text,
    `    const price = Math.round(Math.max(0, numberValue(raw?.price)));\n    const stock = integerValue(raw?.stock);`,
    `    const price = Math.round(Math.max(0, numberValue(raw?.price)));\n    const parsedStock = parseOptionalStock(raw?.stock);\n    const stock = Number.isNaN(parsedStock) ? 0 : parsedStock;`,
    'stock normalizado'
  );

  text = replaceExact(
    text,
    `    if (!(product.price > 0)) errors.push('El precio debe ser mayor que cero');\n    if (rawImage && imageUrl === null) errors.push('La URL de imagen no es segura');`,
    `    if (!(product.price > 0)) errors.push('El precio debe ser mayor que cero');\n    if (Number.isNaN(parsedStock)) errors.push('El stock debe ser un entero mayor o igual a cero, o quedar vacío para usar stock ilimitado');\n    if (rawImage && imageUrl === null) errors.push('La URL de imagen no es segura');`,
    'validación de stock'
  );

  const csvStart = text.indexOf('  function parseCsv(textValue) {');
  const csvEnd = text.indexOf('\n\n  function csvObjects(textValue) {', csvStart);
  if (csvStart < 0 || csvEnd < 0) throw new Error('No se encontró el parser CSV anterior');
  text = `${text.slice(0, csvStart)}  function parseCsv(textValue) {\n    return parseDelimitedRows(textValue);\n  }${text.slice(csvEnd)}`;

  text = replaceExact(
    text,
    `          stock: 0,\n          imageUrl: image,`,
    `          stock: null,\n          _stockInvalid: false,\n          imageUrl: image,`,
    'stock inicial agrupado'
  );

  text = replaceExact(
    text,
    `      const product = grouped.get(groupKey);\n      product.stock += integerValue(stock);`,
    `      const product = grouped.get(groupKey);\n      const parsedStock = parseOptionalStock(stock);\n      if (Number.isNaN(parsedStock)) product._stockInvalid = true;\n      else if (parsedStock != null) product.stock = (product.stock ?? 0) + parsedStock;`,
    'acumulación de stock CSV'
  );

  text = replaceExact(
    text,
    `    return [...grouped.values()].map(item => {\n      const sourceKey = item._sourceKey;\n      delete item._sourceKey;\n      return normalizeProduct(item, { source: 'catalog-csv', sourceKey });\n    });`,
    `    return [...grouped.values()].map(item => {\n      const sourceKey = item._sourceKey;\n      if (item._stockInvalid) item.stock = '__stock_invalido__';\n      delete item._sourceKey;\n      delete item._stockInvalid;\n      return normalizeProduct(item, { source: 'catalog-csv', sourceKey });\n    });`,
    'marcado de stock CSV inválido'
  );

  text = replaceExact(
    text,
    `  function productsFromJson(textValue) {\n    const parsed = JSON.parse(textValue);\n    const list = Array.isArray(parsed)\n      ? parsed\n      : (Array.isArray(parsed?.data?.products) ? parsed.data.products : null);\n    if (!list) throw new Error('El JSON debe ser un array de productos o una copia Tintin con data.products.');\n    return list.map((item, index) => normalizeProduct(item, {\n      source: parsed?.format === 'tintin-operational-backup' ? 'tintin-backup' : 'json',\n      sourceKey: item?.id || item?.importFingerprint || \`${item?.name || 'producto'}-${index + 1}\`,\n    }));\n  }`,
    `  function productsFromJson(textValue) {\n    const parsed = JSON.parse(textValue);\n    const list = Array.isArray(parsed)\n      ? parsed\n      : validateOperationalBackupEnvelope(parsed, { projectId: PROJECT_ID, schemaVersion: 1 });\n    return list.map((item, index) => normalizeProduct(item, {\n      source: Array.isArray(parsed) ? 'json' : 'tintin-backup',\n      sourceKey: item?.id || item?.importFingerprint || \`${item?.name || 'producto'}-${index + 1}\`,\n    }));\n  }`,
    'validación del JSON de respaldo'
  );

  text = replaceExact(
    text,
    `      const stockCell = node('td', '', String(record.product.stock));`,
    `      const stockCell = node('td', '', record.product.stock == null ? 'Sin límite' : String(record.product.stock));`,
    'vista previa de stock ilimitado'
  );

  text = replaceExact(
    text,
    `    let completed = 0;\n\n    try {`,
    `    let completed = 0;\n    let sheetsSyncFailures = 0;\n\n    try {`,
    'contador de sincronización Sheets'
  );

  text = replaceExact(
    text,
    `        await batch.commit();\n        if (typeof window.tintinPushProductsToSheets === 'function') {\n          await window.tintinPushProductsToSheets(importedIds);\n        }\n        completed += chunk.length;\n        state.ui.progressBar.style.width = \`${Math.round((completed / ready.length) * 100)}%\`;\n        state.ui.progressText.textContent = \`${completed} de ${ready.length} importados\`;`,
    `        await batch.commit();\n        completed += chunk.length;\n        state.ui.progressBar.style.width = \`${Math.round((completed / ready.length) * 100)}%\`;\n        state.ui.progressText.textContent = \`${completed} de ${ready.length} importados\`;\n        if (typeof window.tintinPushProductsToSheets === 'function') {\n          try {\n            await window.tintinPushProductsToSheets(importedIds);\n          } catch (syncError) {\n            sheetsSyncFailures += importedIds.length;\n            console.warn('[phase9] Firestore quedó confirmado; Sheets se reintentará por separado.', syncError);\n          }\n        }`,
    'sincronización secundaria con Sheets'
  );

  text = replaceExact(
    text,
    `      toast(\`${completed} productos importados sin sobrescribir existentes\`);`,
    `      if (sheetsSyncFailures) {\n        toast(\`${completed} productos importados en Firestore. ${sheetsSyncFailures} quedan pendientes de sincronizar con Sheets.\`, true);\n      } else {\n        toast(\`${completed} productos importados sin sobrescribir existentes\`);\n      }`,
    'resultado de sincronización secundaria'
  );

  return text;
});

update('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts['test:phase9-import'] = 'node --test tests/import/phase9-import-normalization.test.mjs';
  if (!pkg.scripts['audit:final'].includes('test:phase9-import')) {
    pkg.scripts['audit:final'] = pkg.scripts['audit:final'].replace(
      'npm run audit:release',
      'npm run test:phase9-import && npm run audit:release'
    );
  }
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

update('scripts/audit-final-release.js', source => {
  let text = source;
  text = replaceExact(
    text,
    `const phase9 = read('js/admin-import-phase9.js');\nconst quality = read('js/ui-quality.js');`,
    `const phase9 = read('js/admin-import-phase9.js');\nconst normalization = read('js/import-normalization.mjs');\nconst normalizationTests = read('tests/import/phase9-import-normalization.test.mjs');\nconst quality = read('js/ui-quality.js');`,
    'lectura de normalización Fase 9'
  );

  text = replaceExact(
    text,
    `check(\n  'El CSV soporta comillas escapadas y saltos de línea',\n  phase9.includes("char === '\\"' && next === '\\"'") &&\n    phase9.includes("char === '\\\\n' || char === '\\\\r'") &&\n    phase9.includes('if (quoted) throw new Error'),\n  'No se puede dividir un CSV solamente por líneas y comas'\n);`,
    `check(\n  'El CSV detecta coma, punto y coma o tabulador y conserva campos citados',\n  phase9.includes('parseDelimitedRows(textValue)') &&\n    normalization.includes("const candidates = [',', ';', '\\\\t']") &&\n    normalization.includes("char === '\\"' && next === '\\"'") &&\n    normalization.includes("char === '\\\\n' || char === '\\\\r'") &&\n    normalizationTests.includes('detecta coma, punto y coma o tabulador'),\n  'El importador debe aceptar exportaciones CSV regionales sin romper comillas o saltos de línea'\n);\n\ncheck(\n  'Los precios localizados se normalizan sin confundir miles y decimales',\n  phase9.includes('parseLocalizedNumber(value)') &&\n    normalization.includes('export function parseLocalizedNumber') &&\n    normalizationTests.includes("parseLocalizedNumber('100.000'), 100000") &&\n    normalizationTests.includes("parseLocalizedNumber('1.234,56'), 1234.56") &&\n    normalizationTests.includes("parseLocalizedNumber('1,234.56'), 1234.56"),\n  'Los precios paraguayos e internacionales deben producir el mismo número estable'\n);\n\ncheck(\n  'El stock vacío queda ilimitado y los valores inválidos se rechazan',\n  phase9.includes('parseOptionalStock(raw?.stock)') &&\n    phase9.includes("record.product.stock == null ? 'Sin límite'") &&\n    normalization.includes('export function parseOptionalStock') &&\n    normalizationTests.includes("parseOptionalStock('Sin límite'), null") &&\n    normalizationTests.includes("Number.isNaN(parseOptionalStock('-1'))"),\n  'Un stock vacío no debe convertirse silenciosamente en agotado'\n);\n\ncheck(\n  'Las copias operativas validan formato, proyecto y versión antes de importar',\n  phase9.includes('validateOperationalBackupEnvelope(parsed') &&\n    normalization.includes("value.format !== format") &&\n    normalization.includes("value.projectId !== projectId") &&\n    normalization.includes("value.schemaVersion !== schemaVersion") &&\n    normalizationTests.includes('valida proyecto, formato y versión'),\n  'No se debe importar una copia de otro proyecto o esquema incompatible'\n);\n\ncheck(\n  'Una falla secundaria de Sheets no invalida productos ya confirmados en Firestore',\n  phase9.includes('await batch.commit();') &&\n    phase9.includes('sheetsSyncFailures += importedIds.length') &&\n    phase9.includes('Firestore quedó confirmado; Sheets se reintentará por separado') &&\n    phase9.indexOf('completed += chunk.length') < phase9.indexOf('window.tintinPushProductsToSheets(importedIds)'),\n  'La interfaz debe distinguir el commit principal de una sincronización secundaria'\n);`,
    'auditoría del parser CSV anterior'
  );

  text = replaceExact(
    text,
    `check(\n  'Existe un comando final único',\n  pkg.scripts?.['audit:final']?.includes('audit:secure-orders') &&\n    pkg.scripts['audit:final'].includes('audit:release'),\n  'La revisión final debe ejecutarse con npm run audit:final'\n);`,
    `check(\n  'Existe un comando final único',\n  pkg.scripts?.['audit:final']?.includes('audit:secure-orders') &&\n    pkg.scripts['audit:final'].includes('test:phase9-import') &&\n    pkg.scripts['audit:final'].includes('audit:release') &&\n    pkg.scripts?.['test:phase9-import'] === 'node --test tests/import/phase9-import-normalization.test.mjs',\n  'La revisión final debe ejecutar las pruebas de importación dentro de npm run audit:final'\n);`,
    'comando final de Fase 9'
  );

  return text;
});

update('docs/BACKUP_RECOVERY.md', source => {
  if (source.includes('## Validación de copias operativas Tintin')) return source;
  return `${source.trim()}\n\n## Validación de copias operativas Tintin\n\nAntes de aceptar una copia para importar productos, el panel verifica de forma obligatoria:\n\n- formato exacto \`tintin-operational-backup\`;\n- proyecto Firebase \`tintin-accesorios\`;\n- versión de esquema compatible;\n- presencia de \`data.products\` como lista.\n\nUna copia de otro proyecto, con versión futura o estructura incompleta se rechaza antes de preparar escrituras. El stock vacío se conserva como ilimitado; no se convierte en cero.\n`;
});

update('docs/PHASE9_FINAL_RELEASE.md', source => {
  if (source.includes('## Endurecimiento final de importación')) return source;
  return `${source.trim()}\n\n## Endurecimiento final de importación\n\nEl cierre definitivo incorpora un normalizador aislado y probado para:\n\n- precios con separadores paraguayos e internacionales;\n- stock ilimitado representado como \`null\`;\n- CSV separados por coma, punto y coma o tabulador;\n- campos citados, comillas escapadas y saltos de línea;\n- validación del formato, proyecto y versión de cada copia operativa.\n\nEl commit principal ocurre en Firestore. La sincronización con Sheets es secundaria: una falla externa queda informada como pendiente, pero no presenta como revertidos productos que ya fueron confirmados.\n`;
});

fs.unlinkSync(filePath);
console.log('Endurecimiento final de Fase 9 aplicado y script temporal eliminado.');
