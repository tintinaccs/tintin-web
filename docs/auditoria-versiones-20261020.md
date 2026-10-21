# Auditoría de coherencia de versiones — 20 de octubre de 2026

Codex /root. Alcance autorizado: prompt «Auditoría forense, unificación total y control permanente de versiones» y pendientes recientes. Base publicada dc6da947; candidato conjunto 19b3ba0b, reconciliado con9d58fca0 (PR1182, incluye PR1180). No se descarta trabajo ajeno ni se integran indiscriminadamente ramas históricas de cutover.

## Inventario real antes de corregir

1.416 archivos registrados en Git, 31.544.383 bytes, 541 archivos fuente de runtime, 19 HTML raíz, 58 APIs, 12 workflows, 258 archivos de pruebas Node y 98 specs de navegador. Se examinaron referencias declaradas de scripts/estilos y acciones de las 19 páginas. El inventario JSON completo queda como entregable del trabajo. Estas cifras describen archivos y referencias, no equivalen a probar cada acción dinámica.

Superficies: Inicio, Catálogo, Colecciones, Producto, Checkout, Login, Perfil, Nosotros/About, Contacto, Envíos, Preguntas frecuentes, Cambios/devoluciones, Privacidad, Términos, 404, Admin e Imágenes; Search Console y redirección Nosotros se clasifican como documentos técnicos. Admin contiene Productos, Pedidos, clientes, inventario, mayoristas, estadísticas, importación, configuración y herramientas dinámicas. La matriz completa del producto sigue en `docs/agent/ACCEPTANCE_MATRIX.md`.

Stack observado: HTML/CSS/JS y módulos Node para herramientas; Firebase Auth/Firestore/App Check/FCM; Cloudflare Pages/Functions; Apps Script/Sheets; Resend; Cloudinary; PayPal; Meta/Instagram; GitHub Actions, Playwright y emulador de Firestore. No se crea Firebase Hosting ni un backend paralelo.

## Hallazgos, impacto y acciones

| Clasificación | Evidencia y causa | Acción y resultado |
| --- | --- | --- |
| MEDIUM | PR1182 CI39505308810 falló al comparar `_routes.json`: el archivo compactaba `/nosotros*`, pero el auditor mantenía otra lista con dos aliases separados. La API Instagram ya estaba agregada en este candidato. | Una autoridad `scripts/lib/rutas-pages.js` deriva HTML/APIs y sus reglas. `build:routes` genera y `verify:routes` detecta divergencias. Auditoría final y CSP reutilizan las funciones comunes. Se mantienen las 100 reglas, APIs exactas, Auth y documentos privados. Cinco regresiones cubren nuevas APIs, aliases, HTML, exclusión técnica y bloqueo del límite. |
| LOW, contrato de pruebas | El orden esperado del editor visual todavía omitía Instagram, presente en la implementación aprobada del candidato. | La expectativa incluye la sección; siguen comprobándose orden, unicidad, migración de referencias históricas y exclusión del footer. |
| LOW, fixture de prueba | El mock de `require` del auditor de iconos devolvía `path` para cualquier dependencia nueva. | Se usa resolución real de dependencias, conservando el mock del manifiesto; siguen rechazándose archivos de icono inexistentes. |
| LOW, portabilidad | La prueba del monitor separaba YAML sólo con LF y fallaba al leer CRLF en Windows. | Se normalizan saltos de línea; se mantienen los seis escenarios que distinguen comprobación de producción de actualización de tasa. |
| CORRECT, duplicación legítima | Cinco grupos idénticos: tres fallbacks de iconos generados y dos pares responsive de imágenes de portada. | Se conservan: tienen consumidores válidos y no ejecutan lógica competidora. No se elimina historial ni recuperación por coincidencia de hash. |
| CORRECT, autoridades existentes | Los contratos verifican una inicialización Firebase, frontend sin secretos, backend edge, control de tienda, contratos de sincronización, componentes y una URL por módulo. | Se reutilizan los gates existentes; no se introduce otro inicializador, watcher de versión, pipeline o auditor global paralelo. |
| APROBADO por el titular, iPhone instalado | El usuario confirmó que el icono ya está solucionado tras comprobar el dispositivo. Los recursos de ambos hosts entregan la imagen nueva. | Se cierra ese pendiente por confirmación humana. No se borran sesión, carrito ni preferencias. |

## Riesgos y migración

| Cambio | Riesgo | Mitigación y reversión |
| --- | --- | --- |
| Fuente de rutas de build/auditores | Medio: omitir middleware/CSP o superar límite del proveedor | Derivación de archivos reales, reglas estrechas, tests de APIs/documentos, gate exacto y límite 100. El conjunto de rutas conserva el del candidato anterior; sólo orden determinista. Revertir el commit recupera el contrato anterior. |
| Consolidación de PR1180/1182 | Alto: presentación compartida, variantes y guardado | Conserva los merges normales y editor minimalista. Pruebas de concurrencia, cuenta, borrador, responsive y navegación. No migra documentos comerciales. |
| Expectativas y fixtures | Bajo: ocultar una regresión | Se corrigen supuestos concretos demostrados; no se reduce ningún presupuesto, aserción de permisos ni umbral de seguridad. |
| Reglas futuras de ingeniería | Bajo | AGENTS y documento de fuentes canónicas exigen rastrear consumidores antes de retirar código; los generadores/gates existentes aplican la política en CI. |

## Evidencia ejecutada de este ciclo

- APROBADO local: 1.737/1.737 pruebas Node, sin omitidas. Incluyen cuentas, autenticación, catálogo/stock, carrito, pedidos, pagos simulados, idempotencia, sincronización, permisos, recuperación, arquitectura, CSP, caché y versión. La primera ejecución detectó cuatro fallos de pruebas; después de corregir los tres puntos anteriores se repitió el conjunto completo.
- APROBADO local: 143/143 Chromium de editor, tarjetas por color, Instagram, marca móvil, retorno push y transición de versiones. Se cubren tamaños 320–1920, orientación horizontal y vertical, conservación de borradores y carrito. Son servicios aislados; no representan escrituras comerciales en producción.
- APROBADO local: emulador Firestore, 200 ataques/controles de reglas. Prueba real de cuota: 200 solicitudes de dos instancias, nunca más de 20 reservas, agotamiento e instancia fría. Primer intento sobrecargado concedió cero y falló la disponibilidad; repetición aislada aprobó sin modificar timeout, cuota ni código de seguridad.
- APROBADO local: controles de identidad del emulador, teléfono y username; los resultados finales se registran en CURRENT_STATE.
- APROBADO local: integraciones canónicas (100 rutas, 12 workflows, uno de PR), 22 controles de integración final, caché (360 archivos/67 cargas dinámicas) y autoridades arquitectónicas.
- PENDING: cierre completo de `audit:final`, reproducibilidad del build definitivo, CI del SHA final y producción de ese SHA. El primer barrido de diagnóstico se ejecutó mientras se corregían archivos y detectó diferencia entre sus dos inventarios; se repite con el árbol definitivo, sin omitir el control.

Tras incorporar9d58fca0 se repitieron64/64 Chromium de tarjetas, Maestro, Instagram y versión, y26/26 contratos; todos aprobados. Se conserva Agotado como estado canónico de la tarjeta y su stock0/active independiente. El servidor local incluye el endpoint Instagram sin credenciales, para validar su fallback real.

## Prevención y límites

Las autoridades y comandos quedan en `arquitectura-versiones-canonicas.md`. Se utiliza el generador existente de release (`site-version.json`/diagnóstico), el auditor de bytes/URLs inmutables y su resolución de 67 cargas dinámicas. La actualización de una pestaña se comprueba con el watcher existente: decide el usuario y conserva datos. El SW de push no usa Cache Storage ni una segunda copia offline del sitio; no se agrega limpieza indiscriminada.

La CSP sigue generada por ruta, servida por middleware y respaldada por el fallback estático. No se añaden unsafe-inline/unsafe-eval. La publicación de Pages es la entrega canónica; GitHub Pages queda como fallback manual explícito, no como despliegue simultáneo automático. Cloudflare, dominio principal y dominio técnico deben comprobarse después del despliegue por huella, bytes y headers.

No se han realizado compras, cargos, envíos de correo/push ni borrados reales durante esta auditoría. Quedan NO EJECUTADOS en este ciclo OAuth real, pruebas monetarias, conexión Meta real, paridad privada de Sheets y recepción push en dispositivos físicos; el icono del iPhone fue confirmado resuelto por el titular. Las credenciales presentes o una respuesta saludable no prueban esos efectos externos.

## Criterio de cierre

No se afirma ausencia matemática de toda duplicación parcial ni cobertura de cada botón dinámico sólo a partir de búsquedas o conteos. Los controles ejecutados permiten verificar las responsabilidades y regresiones descritas. Las ramas históricas son propuestas, no versiones activas por el solo hecho de existir.

La conclusión final debe distinguir código probado, SHA integrado, artefacto publicado y operaciones externas no ejecutadas. Mientras falte CI/publicación o comprobación de los proveedores indicados, no está justificado certificar el 100 % funcional de todos los dispositivos y servicios.
