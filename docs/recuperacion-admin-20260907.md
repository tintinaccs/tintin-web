# Recuperación de Admin — 7 de septiembre de 2026

## Evidencia y estado

La captura de producción muestra `permission-denied` en orders, users, products, collections, inventory, siteTraffic, sitePresence y siteAggregate. La interfaz conserva el panel tras un `null` de Auth, pero eso no demuestra que el token de Firebase siga vigente. El diagnóstico maestro devuelve 502 por una limitación de GitHub y debe investigarse por separado.

El monitor de producción 34157517834 (19:57 UTC) confirmó que las páginas, el catálogo público y los endpoints de salud responden. El test real de navegador falló porque `/login` y `/perfil` reportaron App Check error. Los datos de este monitor no contienen una sesión autenticada de SuperAdmin y no prueban que los módulos internos funcionen.

La rama base contiene el cambio #725, que espera un token de App Check antes de resolver `appCheckReady`, y #726, que ajustó el presupuesto de rendimiento. `firebase.js` todavía utiliza una carrera con timeout de ocho segundos: el resultado `false` no debe interpretarse como autorización válida. Se debe investigar el error real de App Check y comprobar configuración de dominio, sitio Enterprise, aplicación Firebase y reglas publicadas antes de cambiar controles de seguridad.

## Alcance del primer parche

`getUserRole` distingue un error de lectura de un perfil ausente en la ruta Admin y compara la identidad elevada con el token autenticado. El contrato público de incorporación se conserva por compatibilidad. Este cambio no repara por sí solo App Check, las reglas de producción ni el ciclo de vida de los listeners.

## Criterios de salida pendientes

- Confirmar el commit desplegado en Cloudflare y comparar los artefactos publicados con el repositorio.
- Confirmar el proyecto Firebase, el estado de App Check y las reglas efectivamente publicadas. No publicar reglas nuevas por suposición.
- Probar con una sesión real de SuperAdmin, sin registrar ni compartir tokens, que el UID y el correo verificado coinciden con la identidad autorizada.
- Separar los estados `restoring`, `authenticated`, `temporarily-unavailable` y `signed-out`; no reutilizar un usuario antiguo como credencial después de una invalidación real.
- Iniciar y detener listeners según el ciclo de vida autenticado. Ante una falla, mostrar error y permitir recuperación sin convertir datos no disponibles en cero.
- Probar pedidos, productos, inventario, usuarios, colecciones, estadísticas, sesiones y presencia con lecturas reales y cambios controlados.
- Mantener Firestore como fuente de verdad, sin crear datos ficticios ni modificar stock o pedidos para simular éxito.
- Ejecutar pruebas de roles, Auth, App Check, reglas y regresión de clientes antes de integrar. Publicar únicamente tras comprobar los permisos y el comportamiento esperado.
- Corregir de forma separada el SVG, la CSP de vista previa y el 502 de GitHub, sin relajar la política de seguridad para ocultar errores.

No se ha comprobado el cumplimiento de estos criterios ni se afirma que producción esté reparada.
