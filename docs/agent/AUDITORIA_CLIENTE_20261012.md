# Auditoría de la experiencia del cliente — en curso

## Alcance vigente

Prompt maestro del titular del12oct: inventariar y probar cada acción alcanzable del cliente, incluidos estados condicionales, teclado/táctil, persistencia, errores internos y dispositivos. Super Panel Admin excluido de esta ejecución. Conservar evidencias previas sin convertirlas en cobertura de acciones no ejecutadas. Dominio/DNS siguen reservados para el último paso. Pruebas con pagos/correos/pedidos únicamente en sistemas aislados; no cargos ni notificaciones comerciales reales.

## Descubrimiento

Usar manifiesto y rutas canónicas como punto de partida, módulos/controladores y recorridos reales para completar acciones dinámicas. `node scripts/inventariar-acciones-cliente.mjs` genera el inventario HTML inicial; todos sus controles nacen PENDING. Ese archivo no certifica100% de descubrimiento ni sustituye el inventario de estados. Páginas técnicas/aliases se clasifican por su función, nunca como funcionalidad faltante. Recuperación de contraseña no aplica al acceso actual por Google/OTP.

## Evidencia nueva y defectos abiertos

- Sesión real con rol cliente autorizado: correo OTP enviado, titular confirmó directamente en página; perfil y dos pedidos propios visibles. No editar identidad, direcciones ni pedidos reales.
- Carrito originalmente vacío: agregar una unidad, subtotal70000, navegar a checkout, recargar, cargar tarifas y comprobar campos existentes. Removida la unidad; carrito volvió a vacío y checkout bloqueó continuar. No pedido, pago ni envío comercial.
- FAIL: primera carga de perfil y checkout produjo permission-denied en varios listeners y envío sin departamentos; recargar recuperó la lectura. Lecturas de perfil/navegación/settings deben esperar App Check y recuperar cuando su token llega después del timeout, sin habilitar escrituras ni eludir Rules. Corrección local en curso; falta navegador con servicios aislados, CI e integración.
- FAIL: favorito existente mostrabaGs0; el mismo ID en catálogo público y ficha tenía70000. Favoritos debe hidratar precio/media desde catálogo actual; si falta ese catálogo, no presentar precio histórico o cero como precio vigente. Corrección local en curso, prueba publicada pendiente.
- PASS_LOCAL: 273 tests relacionados de perfil/carrito/checkout/cuentas/navegación y 10 Playwright de perfil en 320/390/768/1024/1280/1440/1920, incluyendo recuperación tardía y aislamiento entre cuentas. Son comprobaciones específicas, no acciones aprobadas automáticamente del inventario.
- Servicios aislados: primera ejecución completa 249/261 PASS; recorridos críticos posteriores 29/30 y 28/30. Esa última reprodujo pérdida intermitente del carrito en Chromium escritorio y móvil, después de mostrar el producto en checkout. Tras corregir el tratamiento de snapshots, nueva ejecución 30/30 PASS en Chromium escritorio, Pixel 7 y WebKit iPhone 13 (3.5 minutos), sin pedidos reales. Evidencia: client-runtime-metadata-retest.log y real-interactions/runtime-results.json/runtime-report.zip. No convierte la suite completa de 261 ni el inventario en aprobado.
- Carrito: acuse de una escritura anterior no limpia una edición nueva; recuperación de cambios pendientes conserva bajas y cantidades reducidas. Dos regresiones adicionales reprodujeron que snapshots de caché o escrituras optimistas limpiaban indebidamente el estado pendiente. Ambas pasan después de exigir confirmación del servidor; la sesión y el carrito local siguen disponibles sin conexión.
- El entorno aislado usa SDK oficial y Auth/Firestore emulados, con correo de prueba y bloqueo de servicios de producción. App Check no tiene emulador: su readiness es fixture, por lo que esos recorridos no certifican tokens de producción. Las pruebas de compra se detienen antes de enviar pedidos o pagos.

## Próximas comprobaciones

1. Completar inventario HTML con componentes compartidos y controles creados por JS, estados de datos y escenarios.
2. Ejecutar servicios aislados existentes con Auth/Firestore emulator y SDK oficial; ampliar recorridos del cliente en vez de crear otro sistema de pruebas.
3. Relacionar cada acción con aserción, entorno/viewport y evidencia; mantener pendientes explícitos.
4. Integrar correcciones con gates vigentes y volver a comprobar recorridos afectados.

No declarar terminado,100% ni listo el cambio de dominio mientras haya acciones/defectos pendientes. Las pruebas físicas de dispositivos se distinguen de la emulación. Evidencia local: client-recovery-tests.log, client-profile-browser.log, client-cart-restored-20261012.jpg. Codex /root.
