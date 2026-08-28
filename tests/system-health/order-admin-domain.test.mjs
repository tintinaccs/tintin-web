// El estado integral del ecosistema debe cubrir también el puente
// Superadmin ↔ Firestore ↔ Google Sheets para pedidos. La suite real vive en
// tests/orders para poder ejecutarse de forma aislada, y se importa acá para
// que `audit:system-health` la ejecute en todos los workflows que ya protegen
// la Tarea 8.
import '../orders/order-admin-domain.test.mjs';
