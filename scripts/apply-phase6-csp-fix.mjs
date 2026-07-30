import fs from 'node:fs';

const headersPath = '_headers';
let headers = fs.readFileSync(headersPath, 'utf8');
const oldConnect = "connect-src 'self' https://*.googleapis.com https://securetoken.google.com https://www.google.com https://www.gstatic.com https://apis.google.com https://res.cloudinary.com https://api.imgbb.com;";
const newConnect = "connect-src 'self' https://*.googleapis.com https://securetoken.google.com https://www.google.com https://www.gstatic.com https://apis.google.com https://script.google.com https://script.googleusercontent.com https://*.googleusercontent.com https://res.cloudinary.com https://api.imgbb.com;";
if (!headers.includes(oldConnect)) throw new Error('No se encontró connect-src para Apps Script');
headers = headers.replace(oldConnect, newConnect);
fs.writeFileSync(headersPath, headers);

const auditPath = 'scripts/audit-phase6-security.js';
let audit = fs.readFileSync(auditPath, 'utf8');
const marker = `].forEach(header => check('Encabezado presente: ' + header, headers.includes(header)));`;
const addition = `${marker}\ncheck(\n  'La CSP permite el endpoint server-side de pedidos',\n  headers.includes('https://script.google.com') &&\n    headers.includes('https://script.googleusercontent.com'),\n  'Apps Script y su redirección deben estar en connect-src'\n);`;
if (!audit.includes(marker)) throw new Error('No se encontró marcador de cabeceras en auditoría');
audit = audit.replace(marker, addition);
fs.writeFileSync(auditPath, audit);
console.log('CSP habilitada para Google Apps Script.');
