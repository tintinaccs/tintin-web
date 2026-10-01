export const APPS_SCRIPT_SYNC_URL = 'https://script.google.com/macros/s/AKfycbwwfwHrcI3ncwIxvoKuUULjDjBhrmkC-MAiwmbj6wZbCBer72C9r1UThfcXhh_7GUqD/exec';
// Apps Script puede demorar al iniciar en frío y cada push de producto actualiza
// fórmulas/formatos de una fila. Doce segundos abortaban lotes legítimos antes
// de que la respuesta llegara; 25 s sigue dentro del presupuesto del Worker.
export const SHEETS_TIMEOUT_MS = 25_000;
export const SHEETS_HEALTH_TIMEOUT_MS = 5_000;
// Probe no destructivo: confirma que el despliegue de Apps Script reconoce
// la ruta canónica syncProducts y conserva su barrera de autenticación.
export const SHEETS_HEALTH_REVISION = 'apps-script-products-guard-v1';
