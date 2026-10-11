## Restaurar colecciones del preview - 2026-10-10

Lectura fresca de colecciones Firestore antes de restaurar un preview local. No escribe catalogo ni aplica jobs. Mantiene exclusion por busy y Super Admin; fallo de lectura conserva el preview previo y muestra error. Versionado propagado a importador, calidad-interfaz y cargador-pagina con referencias HTML coherentes. Test de regresion de colecciones y suites existentes 21 PASS. Sin cambios DNS.

## Registro 2026-10-10: alertas operativas opcionales e historicas

- Perfil movil: tabs en filas para que todas las opciones queden visibles. CSS perfil y referencia HTML versionadas; auditor global conservado sin excepciones nuevas. Sin cambio de datos ni logica de perfil.
- Backend system-health y conciliacion checkout; UI administrativa del diagnostico y su version de cache.
- Sin cambios de precios, stock, pedidos, usuarios, Auth, Rules, DNS, origen publico o credenciales. Sin envios de correos ni activacion PayPal.
- Ventas historicas identificadas por el contrato de comercio-local; compras web y fallos explicitos mantienen alerta. Se informa el numero de registros excluidos del requisito email.
- PayPal deshabilitado se muestra neutral NO APLICA con estilos SKIPPED existentes; sandbox activo/configuracion rota siguen FAIL. Backend no declara PayPal productionReady.
- Roles cliente/invitado sin cambio; endpoint mantiene requireSuperAdmin. Cache UI versionada por injector; manifiesto regenerado desde fuente.
- Regresion: tests de system-health/backend/render y checkout operacional, sin debilitar controles. UI desplegada pendiente de integracion aprobada.

# Lista obligatoria de impacto

Esta lista se completa para cada cambio. Marcar una parte como “no aplica” requiere una razón concreta.

## Registro del 2026-10-10: login, OTP y Envíos

Base publicada `34aa0f3b`; evidencia detallada en `docs/agent/AUDITORIA_MULTIDISPOSITIVO_20261010.md` y CURRENT_STATE.

- Páginas: login (teclado) y Envíos (lecturas y tarifas); las restantes reciben únicamente referencias transitivas de caché del shell.
- Componentes: coordinación compartida de sesión en conexiones y logo canónico de cuenta/carrito/catálogo, sin cambiar imagen, CSS ni geometría. Se conservan la tipografía itálica y todas las precargas.
- Firestore: reservas server-side en la colección privada existente `emailOtpRateLimits`; Rules sin cambios, lectura/escritura cliente rechazada. Contador por correo separado del código; conserva cuota legacy cuando existe el documento previo. No hay migración destructiva ni cambios de pedidos/precios/stock.
- Auth: mismo UID, sesión, nombre/WhatsApp mínimos, proveedores y validación; MFA sólo propuesta revisable, sin activación ni excepciones nuevas. OTP conserva seis dígitos y cinco minutos.
- Checkout/pagos/Sheets: contratos ejecutados y comportamiento conservado; ninguna escritura real de prueba. Reserva de cuota y contador de intentos aplican antes de contactar al proveedor.
- Diagnósticos/caché/CSP: artefactos regenerados por helpers oficiales; sin renovar sellos de producción ni modificar controles/revisores/workflows.
- Compatibilidad: 14 tamaños y ambas orientaciones para Google/correo; Chromium/Firefox/WebKit reales con emulación de pantalla y toque. Dispositivos físicos no ensayados.
- Cierre: CI/revisión protegida/integración/publicación del SHA nuevo pendientes hasta su evidencia propia. MFA y restauración remota requieren los prerrequisitos externos documentados.

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
