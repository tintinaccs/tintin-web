export const APPS_SCRIPT_SYNC_URL = 'https://script.google.com/macros/s/AKfycbwwfwHrcI3ncwIxvoKuUULjDjBhrmkC-MAiwmbj6wZbCBer72C9r1UThfcXhh_7GUqD/exec';
export const SHEETS_TIMEOUT_MS = 12_000;
export const SHEETS_HEALTH_TIMEOUT_MS = 5_000;
// Probe no destructivo: confirma que el despliegue de Apps Script reconoce
// la ruta canónica syncProducts y conserva su barrera de autenticación.
export const SHEETS_HEALTH_REVISION = 'apps-script-products-guard-v1';
