import { serveAdminWithCsp } from '../cloudflare/servir-admin-con-csp.js';

export function onRequest(context) {
  return serveAdminWithCsp(context, 'admin');
}
