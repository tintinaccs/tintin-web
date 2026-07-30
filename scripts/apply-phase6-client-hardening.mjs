import fs from 'node:fs';

const clientPath = 'js/create-order-client.js';
let client = fs.readFileSync(clientPath, 'utf8');
const oldClientError = `  } catch {
    return { ok: false, error: 'invalid_response', status: response.status, raw: body.slice(0, 500) };
  }`;
const newClientError = `  } catch {
    console.error('[create-order-client] El endpoint devolvió una respuesta no válida. HTTP', response.status);
    return { ok: false, error: 'invalid_response', status: response.status };
  }`;
if (!client.includes(oldClientError)) throw new Error('No se encontró el error crudo del cliente');
client = client.replace(oldClientError, newClientError);
fs.writeFileSync(clientPath, client);

const phase3Path = 'apps-script/Phase3Security.gs';
let phase3 = fs.readFileSync(phase3Path, 'utf8');
const oldReadCatch = `  } catch (error) {
    return { ok: false, error: 'firestore_read_failed', detail: String(error) };
  }`;
const newReadCatch = `  } catch (error) {
    console.error('[Phase3Security] Lectura de Firestore fallida:', error);
    return { ok: false, error: 'firestore_read_failed' };
  }`;
const oldWriteCatch = `  } catch (error) {
    return { ok: false, error: 'notification_status_write_failed', detail: String(error) };
  }`;
const newWriteCatch = `  } catch (error) {
    console.error('[Phase3Security] Escritura de notificationStatus fallida:', error);
    return { ok: false, error: 'notification_status_write_failed' };
  }`;
if (!phase3.includes(oldReadCatch) || !phase3.includes(oldWriteCatch)) {
  throw new Error('No se encontraron los detalles internos de Phase3Security');
}
phase3 = phase3.replace(oldReadCatch, newReadCatch).replace(oldWriteCatch, newWriteCatch);
fs.writeFileSync(phase3Path, phase3);

const auditPath = 'scripts/audit-phase6-security.js';
let audit = fs.readFileSync(auditPath, 'utf8');
audit = audit.replace(
  `const server = read('apps-script/Phase4CreateOrder.gs');\nconst pkg = read('package.json');`,
  `const server = read('apps-script/Phase4CreateOrder.gs');\nconst phase3 = read('apps-script/Phase3Security.gs');\nconst orderClient = read('js/create-order-client.js');\nconst pkg = read('package.json');`
);
audit = audit.replace(
  `check(\n  'El endpoint no devuelve cuerpos internos de Firestore',\n  !server.includes('detail: response.getContentText()') &&\n    !server.includes('detail: String(error)'),\n  'Los detalles quedan solo en logs del servidor'\n);`,
  `check(\n  'El endpoint no devuelve cuerpos internos de Firestore',\n  !server.includes('detail: response.getContentText()') &&\n    !server.includes('detail: String(error)') &&\n    !phase3.includes('detail: String(error)'),\n  'Los detalles quedan solo en logs del servidor'\n);\ncheck(\n  'El cliente no propaga respuestas crudas del endpoint',\n  !orderClient.includes('raw: body.slice') &&\n    orderClient.includes("error: 'invalid_response', status: response.status"),\n  'La UI solo recibe un código estable y el estado HTTP'\n);`
);
fs.writeFileSync(auditPath, audit);

const gateAuditPath = 'scripts/audit-store-gate.js';
let gateAudit = fs.readFileSync(gateAuditPath, 'utf8');
const oldGateCondition = `  rules.includes('allow create: if sparkOrderCreateValid(orderId);') &&
    rules.includes("settings.get('storeOpen', false) == true") &&
    rules.includes("userData.get('blocked', false) != true"),`;
const newGateCondition = `  rules.includes('allow create: if false;') &&
    !rules.includes('allow create: if sparkOrderCreateValid(orderId);'),`;
if (!gateAudit.includes(oldGateCondition)) throw new Error('No se encontró el contrato viejo del gate de pedidos');
gateAudit = gateAudit
  .replace('Pedidos cerrados mediante el validador Spark', 'Pedidos cerrados y exclusivos del servidor')
  .replace(oldGateCondition, newGateCondition)
  .replace('el validador seguro debe rechazar tienda cerrada y cuentas bloqueadas', 'Firestore debe rechazar cualquier creación directa; el servidor valida tienda y cuenta');
fs.writeFileSync(gateAuditPath, gateAudit);

const secureAuditPath = 'scripts/audit-secure-orders.js';
let secureAudit = fs.readFileSync(secureAuditPath, 'utf8');
const oldDirectCondition = `  rules.includes('items.size() <= 4') &&
    rules.includes('product.price == item.price'),`;
const newDirectCondition = `  rules.includes('allow create: if false;') &&
    !rules.includes('allow create: if sparkOrderCreateValid(orderId);'),`;
if (!secureAudit.includes(oldDirectCondition)) throw new Error('No se encontró el contrato viejo de pedidos directos');
secureAudit = secureAudit
  .replace('Las reglas de Firestore siguen limitando el pedido directo como red de seguridad', 'Las reglas de Firestore bloquean todo pedido directo desde el navegador')
  .replace(oldDirectCondition, newDirectCondition)
  .replace('Las reglas deben seguir validando cualquier escritura directa a orders/{orderId}.', 'Toda creación debe pasar por el endpoint server-side, que opera con credenciales del servidor.')
  .replace('Las reglas validan tienda, cuenta y correo para cualquier escritura directa', 'El servidor valida tienda, cuenta y correo antes de crear el pedido')
  .replace(
    `  rules.includes("settings.get('storeOpen', false) == true") &&
    rules.includes("userData.get('blocked', false) != true") &&
    rules.includes('request.auth.token.email_verified == true'),`,
    `  phase4.includes("settings.storeOpen !== true") &&
    phase4.includes("userData.blocked === true") &&
    phase4.includes('!auth.emailVerified'),`
  )
  .replace('Una tienda cerrada, cuenta bloqueada o correo no verificado debe fallar también en las reglas.', 'El endpoint debe rechazar tienda cerrada, cuenta bloqueada o correo no verificado.');
fs.writeFileSync(secureAuditPath, secureAudit);

const rolesAuditPath = 'scripts/audit-admin-users-roles.js';
let rolesAudit = fs.readFileSync(rolesAuditPath, 'utf8');
const oldRoleRule = `/request\\.resource\\.data\\.role != 'superadmin' \\|\\|\\s*\\n\\s*request\\.auth\\.token\\.email == "tintinaccs@gmail\\.com"/.test(rules),`;
const newRoleRule = `rules.includes("request.resource.data.role in ['client', 'admin', 'agent', 'viewer']") &&\n    rules.includes('!isSuperAdminAccount(resource.data)'),`;
if (!rolesAudit.includes(oldRoleRule)) throw new Error('No se encontró el contrato viejo de rol superadmin');
rolesAudit = rolesAudit
  .replace('Las reglas impiden escribir role:"superadmin" salvo la cuenta oficial', 'Las reglas impiden asignar superadmin y protegen la cuenta oficial')
  .replace(oldRoleRule, newRoleRule)
  .replace('Nadie debe poder elevar a "superadmin" a otra cuenta desde el panel.', 'Solo se admiten roles editables y la cuenta oficial no puede degradarse.');
fs.writeFileSync(rolesAuditPath, rolesAudit);

console.log('Cliente, endpoint y contratos de seguridad endurecidos.');
