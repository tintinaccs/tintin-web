# Lista obligatoria de impacto

Esta lista se completa para cada cambio. Marcar una parte como “no aplica” requiere una razón concreta.

## Inventario inicial

- [ ] Páginas HTML afectadas.
- [ ] Módulos JavaScript afectados.
- [ ] CSS, tokens y componentes compartidos afectados.
- [ ] Colecciones, documentos e índices de Firestore afectados.
- [ ] Firestore Rules y permisos afectados.
- [ ] Authentication y perfiles afectados.
- [ ] Carrito, checkout, pedidos, pagos, promociones o stock afectados.
- [ ] Correos, webhooks y automatizaciones afectadas.
- [ ] SEO, datos estructurados, analítica y diagnósticos afectados.
- [ ] Datos existentes que requieren compatibilidad o migración.

## Viewports

- [ ] 1920 × 1080.
- [ ] 1440 × 900.
- [ ] 1280 × 720.
- [ ] 1024 × 768.
- [ ] 768 × 1024.
- [ ] 390 × 844.
- [ ] 320 × 568.

Revisar orientación, scroll, foco, teclado, modales, menús, tablas, formularios, imágenes, loaders y barras fijas.

## Roles

- [ ] Invitado.
- [ ] Cliente.
- [ ] Viewer.
- [ ] Agente.
- [ ] Admin.
- [ ] Super Admin.
- [ ] Cuenta bloqueada.
- [ ] Sesión vencida.

## Estados funcionales

- [ ] Carga inicial.
- [ ] Éxito.
- [ ] Sin datos.
- [ ] Error recuperable.
- [ ] Permiso denegado.
- [ ] Sin conexión o conexión lenta.
- [ ] Reintento automático o manual sin duplicados.
- [ ] Doble clic y solicitudes repetidas.
- [ ] Datos cambiados en otra pestaña.
- [ ] Regreso desde login o pago sin perder contexto.

## Seguridad

- [ ] El navegador no es autoridad final para datos sensibles.
- [ ] La acción está protegida en Firestore Rules o backend.
- [ ] No se exponen secretos ni datos personales.
- [ ] Los textos del usuario no se interpretan como HTML.
- [ ] Se validan tipo, tamaño, formato, límites y propiedad.
- [ ] Se prueban accesos permitidos y denegados.
- [ ] La acción administrativa deja auditoría.

## Datos e integridad

- [ ] Existe una única fuente de verdad.
- [ ] La escritura es atómica o idempotente cuando corresponde.
- [ ] Los reintentos no duplican pedidos, pagos, correos ni stock.
- [ ] Los pedidos conservan valores históricos.
- [ ] Las variantes tienen stock independiente cuando corresponde.
- [ ] Los documentos antiguos siguen funcionando.
- [ ] Existe reversión o respaldo para cambios masivos.

## Rendimiento

- [ ] No se agregan listeners duplicados.
- [ ] Los listeners se liberan al abandonar la vista.
- [ ] No se carga el catálogo completo sin necesidad.
- [ ] Imágenes y fuentes tienen tamaño y estrategia correctos.
- [ ] Se evita CLS y bloqueo del hilo principal.
- [ ] No se añade un loader para ocultar una espera evitable.
- [ ] Las consultas respetan el presupuesto de lecturas.

## Accesibilidad

- [ ] Navegación completa con teclado.
- [ ] Foco visible y orden lógico.
- [ ] Labels y nombres accesibles.
- [ ] Errores asociados al campo correcto.
- [ ] Contraste suficiente.
- [ ] Área táctil adecuada.
- [ ] Movimiento reducido respetado.
- [ ] No se comunica información únicamente con color.

## SEO y analítica

- [ ] Título, descripción, canonical y Open Graph coherentes.
- [ ] Datos estructurados actualizados cuando aplica.
- [ ] URL y redirecciones preservadas.
- [ ] Eventos analíticos no se duplican.
- [ ] No se envían datos sensibles a analítica.
- [ ] Errores relevantes quedan registrados con versión.

## Matriz de impactos frecuentes

### Precio o promoción

Revisar tarjeta, producto, carrito, checkout, pedido histórico, correo, panel, analítica, SEO de producto, reglas y validación confiable.

### Header, navegación o sesión

Revisar todas las páginas, estados autenticados, contador del carrito, menú desktop/tablet/mobile, foco, scroll, tienda cerrada y cuenta bloqueada.

### Rol o permiso

Revisar interfaz, rutas, Firestore Rules, permisos dinámicos, auditoría, acciones masivas y pruebas negativas.

### Pedido, pago o stock

Revisar idempotencia, transacciones, reintentos, correos, historial, cancelación, restauración de inventario, panel y perfil del cliente.

### Contenido administrable

Revisar editor, vista previa, publicación, sanitización, fallback, SEO, caché, todas las páginas consumidoras y datos antiguos.

## Cierre

- [ ] Auditorías locales correctas.
- [ ] Pull Request describe alcance, riesgo y rollback.
- [ ] Todas las comprobaciones de GitHub están verdes.
- [ ] El cambio está integrado en `main`.
- [ ] El despliegue terminó correctamente.
- [ ] No quedaron archivos, imports, estilos o TODO obsoletos.
- [ ] Documentación y registro de mantenimiento actualizados.
