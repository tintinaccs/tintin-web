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

const auditPath = 'scripts/audit-phase6-security.js';
let audit = fs.readFileSync(auditPath, 'utf8');
audit = audit.replace(
  `const server = read('apps-script/Phase4CreateOrder.gs');\nconst pkg = read('package.json');`,
  `const server = read('apps-script/Phase4CreateOrder.gs');\nconst orderClient = read('js/create-order-client.js');\nconst pkg = read('package.json');`
);
audit = audit.replace(
  `check(\n  'El endpoint no devuelve cuerpos internos de Firestore',\n  !server.includes('detail: response.getContentText()') &&\n    !server.includes('detail: String(error)'),\n  'Los detalles quedan solo en logs del servidor'\n);`,
  `check(\n  'El endpoint no devuelve cuerpos internos de Firestore',\n  !server.includes('detail: response.getContentText()') &&\n    !server.includes('detail: String(error)'),\n  'Los detalles quedan solo en logs del servidor'\n);\ncheck(\n  'El cliente no propaga respuestas crudas del endpoint',\n  !orderClient.includes('raw: body.slice') &&\n    orderClient.includes("error: 'invalid_response', status: response.status"),\n  'La UI solo recibe un código estable y el estado HTTP'\n);`
);
fs.writeFileSync(auditPath, audit);
console.log('Cliente del endpoint endurecido.');
