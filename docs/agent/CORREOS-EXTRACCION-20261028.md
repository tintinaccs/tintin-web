# Extracción de Correos — 2026-10-28

Alcance: primer bloque del plan aportado por la titular. No se avanza a Roles,
fragmentos HTML, catálogo ni migraciones de datos hasta cerrar este bloque.

## Dependencias identificadas antes de mover el bloque

- Firestore: db, collection, doc, getDoc/getDocs/getDocsPaginated, setDoc,
  updateDoc, deleteDoc, addDoc, query, orderBy, limit, writeBatch,
  serverTimestamp y onSnapshot.
- Estado mutable externo: currentUser, allUsers y allOrders. Se inyectan getters
  para consultar la sesión y las listas vigentes después de cada reasignación.
- Correo: sendTestCustomerEmail, sendTemplatedEmail, sendBulkTemplatedEmail,
  EMAIL_WEBHOOK_URL y emailErrorMessage_.
- Presentación: ORDER_STATUS_LABELS, escapeHtmlAdmin, adminEventAttributes,
  formatDate, formatPrice, toast y downloadCsv.
- Operaciones: withAdminSiteChange, logAudit, batchUpdateChunked,
  addAdminBulkSelection y rejectOversizedAdminBulkSelection.
- toJsDate_ también es consumida por Pedidos y Estadísticas: permanece en el
  módulo principal y se inyecta al nuevo módulo.
- Dependencias del navegador: document, window, confirm, alert y tipos nativos.
  Los 29 callbacks window.xxx conservan sus nombres y comportamiento.
- Acceso: la navegación y SECTION_PERMISSION conservan el control Super Admin;
  el bloque extraído no leía currentRole ni can() directamente.

## Integración

`iniciarCorreos` devuelve carga, refresco de clientas y cierre de listeners.
`stopAdminRealtimeData` invoca el cierre al terminar la sesión; las fuentes
compartidas siguen notificando a la función de refresco. El estado de correo
queda encapsulado. La extracción no cambia proveedores ni ejecuta envíos reales.

El módulo nuevo se incorpora al inventario y las huellas semánticas mediante
build:diagnostics, y a las URLs inmutables mediante cache-versioning:write.
La renovación de archivos protegidos usa preparar-mantenimiento-flujos.mjs.

## Evidencia

Codex /root. Base: 9fcc8c570. Los logs locales se guardan en
artifacts/correos-refactor (no versionados).

Antes: audit:emails, audit:email-messaging y las 14 pruebas de
content-security-boundaries aprobados. El audit:final de la base se ejecuta en
un worktree separado para no certificar el estado anterior por inferencia.

Después: las mismas 14 pruebas aprobadas; dos recorridos del módulo completo
con HTML/CSS reales y Firestore simulado, a390 y1440px, aprobados. Comprueban
pestañas, reemplazo de fuentes vivas, limpieza idempotente de cuatro escuchas
y reinicio. La auditoría tipográfica mantiene sus mismas comprobaciones,
leyendo también el módulo nuevo. No se verificó sesión productiva autenticada
ni se enviaron correos reales. Resultado global, CI y merge: ver CURRENT_STATE.
