'use strict';

// Mantiene todas las funciones existentes y suma el checkout seguro sin
// duplicar la inicialización de Firebase Admin.
Object.assign(exports, require('./index'));
Object.assign(exports, require('./create-order'));
