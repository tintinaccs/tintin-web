# Validación E2E controlada sin compra real

Estado: **activa para el cierre actual**.

Esta validación reemplaza temporalmente la compra real de punta a punta. Su objetivo es comprobar el flujo comercial y sus contratos sin cobrar dinero, sin crear un pedido real y sin modificar stock de producción.

## Regla principal

Durante esta fase **NO** se debe:

- confirmar una compra real;
- crear pedidos de prueba en producción;
- descontar o reponer stock real;
- cambiar estados de pedidos reales;
- borrar pedidos, productos o usuarios reales;
- modificar DNS o ejecutar el cutover del dominio.

La compra real queda diferida hasta que el propietario la autorice expresamente cerca del cutover definitivo.

## Capa 1 — Contratos comerciales y checkout

Ejecutar:

```bash
npm run audit:level2
npm run test:checkout-contract
npm run audit:critical-healing
```

Debe comprobar, como mínimo:

- identidad idempotente de pedidos mediante UID + requestId;
- relectura server-side de precio, stock y configuración;
- rechazo de cambios de precio/envío que requieren nueva confirmación;
- creación de pedido y descuento de stock en una sola transacción;
- liberación de inventario de forma idempotente;
- permisos y auditoría para cambios administrativos;
- contrato de correo con timeout, reintentos acotados e idempotencia.

## Capa 2 — Firestore en emulador

Ejecutar las pruebas críticas de reglas contra el emulador, nunca contra producción:

```bash
npm run test:rules-critical
```

Criterio de aprobación: las operaciones permitidas deben pasar y los ataques/escrituras no autorizadas deben ser rechazados por las reglas.

## Capa 3 — Navegación y carga pública

Ejecutar:

```bash
npm run test:pages
npm run audit:global-responsive-geometry
```

Criterio de aprobación:

- páginas públicas cargan sin errores críticos;
- loaders cierran;
- recursos locales y rutas limpias resuelven;
- cabeceras móvil/tablet/escritorio conservan su geometría;
- no aparecen regresiones responsive.

## Capa 4 — Preview de Cloudflare

La validación del preview debe comprobar:

- CSP runtime correcta por ruta;
- fallback 404 protegido;
- rutas limpias;
- redirects de Shopify hacia sus destinos Cloudflare;
- ausencia de cambio del dominio principal.

Esta capa puede consultar el preview desplegado, pero no debe cambiar DNS ni mover `tintinaccs.com`.

## Capa 5 — Smoke autenticado sin mutaciones

Este paso sigue siendo manual porque necesita una sesión real autorizada.

Con una cuenta Super Admin, recorrer en modo lectura:

- [ ] Dashboard
- [ ] Estadísticas
- [ ] Usuarios
- [ ] Pedidos
- [ ] Productos
- [ ] Colecciones
- [ ] Multimedia
- [ ] Mensajes/correos
- [ ] Auditoría
- [ ] Diagnóstico
- [ ] Configuración
- [ ] Permisos
- [ ] Apariencia

Verificar solamente que cada módulo carga y muestra el estado esperado.

**No guardar, borrar, bloquear, cambiar stock, cambiar pedidos ni ejecutar acciones masivas durante este smoke.**

También comprobar:

- [ ] Google Login en escritorio
- [ ] Google Login en móvil real
- [ ] acceso al Admin únicamente con cuenta autorizada
- [ ] cierre de sesión correcto
- [ ] sitio público accesible sin sesión

## Evidencia mínima a conservar

Para cada ejecución registrar:

- fecha y hora;
- SHA de `main` o del PR evaluado;
- resultado de cada comando;
- enlaces de GitHub Actions;
- artefactos generados;
- cualquier warning nuevo;
- responsable de la revisión manual autenticada.

## Qué NO valida esta fase

Esta estrategia reduce considerablemente el riesgo, pero no demuestra por sí sola que un pedido real haya recorrido producción de punta a punta. Esa comprobación queda **diferida**, no declarada como aprobada.

Antes del cutover definitivo se deberá decidir explícitamente si se autoriza la prueba real o si se acepta el riesgo residual documentado.
