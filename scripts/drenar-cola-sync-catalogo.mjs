import { drainCatalogSheetSyncQueueScheduled } from '../cloudflare/resiliencia-sync-catalogo.js';

const env = {
  FIREBASE_SERVICE_ACCOUNT_KEY: process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
  FIREBASE_SERVICE_ACCOUNT_JSON: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
  SHEETS_ENGAGEMENT_SECRET: process.env.SHEETS_ENGAGEMENT_SECRET,
};

if (!env.FIREBASE_SERVICE_ACCOUNT_KEY && !env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  console.error('Falta FIREBASE_SERVICE_ACCOUNT_KEY (o FIREBASE_SERVICE_ACCOUNT_JSON) en el entorno.');
  process.exit(1);
}
if (!env.SHEETS_ENGAGEMENT_SECRET) {
  console.error('Falta SHEETS_ENGAGEMENT_SECRET en el entorno.');
  process.exit(1);
}

try {
  const result = await drainCatalogSheetSyncQueueScheduled(env, { limit: 25 });
  console.log(`catalogSheetSyncQueue: revisados=${result.checked} drenados=${result.drained} dead-letter=${result.deadLettered} restantes=${result.remaining}`);
  if (result.deadLettered > 0) {
    console.warn(`Atención: ${result.deadLettered} tarea(s) pasaron a dead-letter en esta corrida. La alerta administrativa ya quedó registrada en Firestore/Diagnóstico.`);
  }
} catch (error) {
  console.error('Fallo el drenaje programado de catalogSheetSyncQueue:', error?.message || error);
  process.exit(1);
}
