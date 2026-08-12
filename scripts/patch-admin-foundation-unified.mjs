import fs from 'node:fs';

const path = 'scripts/auditar-admin-fundamentos.js';
let text = fs.readFileSync(path, 'utf8');
const old = `  /const requiredPerm = SECTION_PERMISSION\\[target\\]/.test(adminApp) &&
    /if \\(requiredPerm && !can\\(currentRole, requiredPerm\\)\\)/.test(adminApp),`;
const next = `  /const requiredPerm = SECTION_PERMISSION\\[target\\]/.test(adminApp) &&
    ( /if \\(requiredPerm && !can\\(currentRole, requiredPerm\\)\\)/.test(adminApp) ||
      ( /function canAccessUnifiedAppearance/.test(adminApp) &&
        /const allowedByPermission = target === 'apariencia'/.test(adminApp) &&
        /if \\(requiredPerm && !allowedByPermission\\)/.test(adminApp) ) ),`;
if (!text.includes(old)) throw new Error('No se encontró la comprobación anterior de switchSection.');
text = text.replace(old, next);
fs.writeFileSync(path, text);
console.log('Auditoría de permisos alineada con la superficie unificada.');
