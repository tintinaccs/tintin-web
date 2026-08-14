const fs = require('fs');
const path = require('path');
const VERSION = 'tintin-20260814-social-notifications-1';

function walk(current) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.js')) {
      const source = fs.readFileSync(full, 'utf8');
      const updated = source
        .replace(/checkout-puente-correo\.js\?v=[A-Za-z0-9._-]+/g, `checkout-puente-correo.js?v=${VERSION}`)
        .replace(/notificacion-pedido-resend\.js\?v=[A-Za-z0-9._-]+/g, `notificacion-pedido-resend.js?v=${VERSION}`)
        .replace(/pedido-checkout-seguro\.js\?v=[A-Za-z0-9._-]+/g, `pedido-checkout-seguro.js?v=${VERSION}`)
        .replace(/sincronizacion-carrito\.js\?v=[A-Za-z0-9._-]+/g, `sincronizacion-carrito.js?v=${VERSION}`);
      if (updated !== source) fs.writeFileSync(full, updated);
    }
  }
}

walk('js');
console.log('Social cache references unified.');
