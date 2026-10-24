# Cierre verificable del editor por fases

24/10/2026. Codex /root. Producción inspeccionada: main `0f253a4113fb9c6bcc04423f79ad1cc4f3e11d8d` (#1227), que incluye #1226. Candidato local: integración normal de esa base con #1228 (`5ccd87f7163dac56b6edf3eb852f613c1db6740a`).

## Qué está publicado y qué falta

| Fase/criterio | Evidencia actual | Estado |
| --- | --- | --- |
| Editor compatible, guardado, variantes, estados, SEO, plantillas acotadas y estadísticas | Implementaciones y contratos de 14–17; pruebas dirigidas ejecutadas en esta revisión | Ver resultados locales; no equivale a CRUD autenticado productivo |
| Diseño familiar a Shopify, bloques, lateral y guía opcional | Fuentes canónicas en main; capturas de fixtures 390/1440 revisadas; distribución 320–1920 | Publicado; no paridad exacta con Shopify |
| Galería compacta y estado proporcional de #1226 | PR integrado 24/10/2026 11:56:43 America/Asuncion; todos sus controles requeridos aprobaron | PASS_CI del SHA del PR |
| Artefacto servido por producción | SHA256 de CSS del editor, interfaz-productos-adaptable y admin-app coincide con main; monitor 40110758382 acredita artefacto de main | PASS_PRODUCTION de esos recursos, lectura directa sin escrituras |
| Quitar/restaurar colores y controles comerciales de #1228 | CI anterior aprobada en 5ccd87f7; borrador; conflictos con #1227 reproducidos mediante merge-tree | No publicado; necesita validar la integración y autorización explícita |
| Entrega de correo del incidente 502 | Dominio y pruebas de cola/recibos inspeccionados; faltan respuesta original y registros autenticados del intento | BLOCKED para causa exacta; no corregido por el editor |

La apariencia usa el tema Tintin aprobado (Montserrat, rosa/ciruela y tarjetas), con Shopify como referencia de organización. Que no sea una copia visual exacta no demuestra por sí solo una función faltante. La matriz vigente conserva 33 decisiones SÍ y 10 NO; no se añaden funciones rechazadas para aparentar paridad.

## Conciliación real de #1228 y #1227

El conflicto funcional está en el listener de opciones de `admin-app.js`. Se preserva de #1227 la restauración del stock agregado al quitar la última opción de un producto nuevo sin stock por fila, incluido el rechazo si aún tiene existencias. Se conserva de #1228 el argumento `expectedEntries` para proteger referencias persistidas y el retiro/restauración reversible. Los conflictos de documentación conservan ambas entregas. Los derivados, caché y protección se reconstruyen con las autoridades existentes; admin-app recibe una URL nueva para sus bytes combinados.

No hay migración automática de productos ni escrituras comerciales. El guardado conserva CAS, IDs y reservas; retirado no significa borrar historial.

## Diagnóstico acotado del 502

`functions/api/order-email.js` devuelve 502 cuando `sendOrderEmails` devuelve `success:false`: al menos un canal solicitado falló, o no se envió ninguno. Los errores por canal se capturan en `error`, y el escritor intenta persistir `notificationError`/`notificationStatus`; los envíos iniciales fallidos se encolan. La falta de RESEND_API_KEY devuelve 500, mientras autenticación/lectura/otras excepciones de la ruta devuelven 400; el número 502 aislado no identifica cuál fallo ocurrió. También puede existir un 502 de infraestructura: sin el cuerpo original no se atribuye al handler.

Las 42 pruebas dirigidas iniciales de editor, visión, recibos, cola, drenaje y App Check aprobaron. Los seis drenajes programados consultados del 23–24/10 figuran aprobados; eso no prueba la entrega del pedido afectado, cola vacía ni ausencia de dead letters. La descarga de logs del último drenaje fue denegada y el conector devolvió ReadTimeout. El entorno no tiene credenciales backend configuradas ni navegador autenticado disponible. No se reenvían correos ni se crean compras para investigar.

Siguiente evidencia necesaria: respuesta original de /api/order-email o lectura autenticada de notificationError y recibos/cola del intento afectado; aplicar una corrección sólo cuando exista causa demostrada. No exponer datos personales o credenciales en el informe.

## Límites y cierre

Las capturas y pruebas locales usan fixtures; no certifican CRUD con sesión real, Safari físico ni una compra real. #1228 registró un rechazo previo de revisión automática a publicar cambios comerciales sin autorización; se mantiene en borrador. La petición de autorización en este chat identifica ese PR y su comportamiento concreto. La aprobación de CI de 5ccd87f7 no se hereda a la conciliación con #1227.

Resultados finales locales y SHA se registran en CURRENT_STATE antes de entregar el candidato. El cierre global permanece pendiente de autorización/publicación del candidato y diagnóstico del correo; no se declara «todo terminado».

## Evidencia del candidato conciliado

- `npm run test:commerce`:462/462 PASS_LOCAL.
- Editor comercial/editorial, controlador, presentación y dominio de pedidos:111/111 PASS_LOCAL, incluido retiro/restauración conectado al pedido en memoria.
- Cuatro suites Chromium de editor responsive, galería, tarjetas y matriz comercial:168/168 PASS_LOCAL, sin reintentos (4.6min).
- `npm run build:pages`:PASS_LOCAL; caché373 recursos/67 cargas dinámicas.
- Preflight inicial: fallo de entorno por dependencias preinstaladas diferentes del lock; se prepara instalación exacta aparte antes de repetir. No se cambia package-lock ni se omite el control.
- Guardado real aislado:104/104 Chromium PASS_LOCAL (4.8min,320–2560px, sin reintentos), incluye stock general restaurado al quitar la última opción sin stock por fila, rechazo con stock, doble envío, fallo/reintento, reapertura y precio por combinación.
- Instalación exacta del lock completada (671 paquetes, sin cambios en package.json/package-lock); preflight se repite con ese entorno.
- Preflight completo repetido con las dependencias exactas:PASS_LOCAL, incluidos los5 imports Chromium de test:fast. El fallo inicial por dependencias heredadas quedó resuelto; no se omitió el control.
- Total de los dos lotes de navegador del candidato:272/272, sin reintentos. La nueva CI y publicación siguen pendientes; el PR conserva su condición de borrador.
