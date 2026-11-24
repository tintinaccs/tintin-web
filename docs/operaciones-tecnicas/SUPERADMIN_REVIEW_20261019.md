# Super Admin — revisión del 19 de octubre de 2026

Autor: Codex. Alcance: presentación, navegación, conexiones existentes y notificaciones; sin operaciones comerciales reales.

## Lista de revisión por módulo

En cada módulo: entrada nativa/permiso, ancho, controles, formularios/tablas, búsqueda/retorno y autoridad de datos. Los contratos locales no acreditan conexión autenticada en producción.

| Módulo | Superficie revisada | Comprobación |
| --- | --- | --- |
| Maestro | Montaje dinámico | Registro Maestro y conexión canónica; interfaz compartida responsive |
| Dashboard | Sección del panel | Registro Maestro y conexión canónica; interfaz compartida responsive |
| Estadísticas | Sección del panel | Registro Maestro y conexión canónica; interfaz compartida responsive |
| Usuarios | Sección del panel | Registro Maestro y conexión canónica; interfaz compartida responsive |
| Pedidos | Sección del panel | Registro Maestro y conexión canónica; interfaz compartida responsive |
| Ventas locales | Sección del panel | Registro Maestro y conexión canónica; interfaz compartida responsive |
| Clientes que compraron | Sección del panel | Registro Maestro y conexión canónica; interfaz compartida responsive |
| Espejos de Sheets | Sección del panel | Registro Maestro y conexión canónica; interfaz compartida responsive |
| Mayoristas | Sección del panel | Registro Maestro y conexión canónica; interfaz compartida responsive |
| Productos | Sección del panel | Registro Maestro y conexión canónica; interfaz compartida responsive |
| Reseñas | Sección del panel | Registro Maestro y conexión canónica; interfaz compartida responsive |
| Me gusta | Sección del panel | Registro Maestro y conexión canónica; interfaz compartida responsive |
| Colecciones | Sección del panel | Registro Maestro y conexión canónica; interfaz compartida responsive |
| Páginas | Sección del panel | Registro Maestro y conexión canónica; interfaz compartida responsive |
| Import / Export | Sección del panel | Registro Maestro y conexión canónica; interfaz compartida responsive |
| Imágenes | Biblioteca independiente | Registro Maestro y conexión canónica; interfaz compartida responsive |
| Mensajes | Sección del panel | Registro Maestro y conexión canónica; interfaz compartida responsive |
| Notificaciones push | Sección del panel | Registro Maestro y conexión canónica; interfaz compartida responsive |
| Auditoría | Sección del panel | Registro Maestro y conexión canónica; interfaz compartida responsive |
| Diagnóstico | Sección del panel | Registro Maestro y conexión canónica; interfaz compartida responsive |
| Flujo de conexiones | Sección del panel | Registro Maestro y conexión canónica; interfaz compartida responsive |
| Correos | Sección del panel | Registro Maestro y conexión canónica; interfaz compartida responsive |
| Configuración | Sección del panel | Registro Maestro y conexión canónica; interfaz compartida responsive |
| Roles y Permisos | Sección del panel | Registro Maestro y conexión canónica; interfaz compartida responsive |
| Apariencia y contenido | Sección del panel | Registro Maestro y conexión canónica; interfaz compartida responsive |
| Mensaje de bienvenida | Montaje dinámico | Registro Maestro y conexión canónica; interfaz compartida responsive |

## Errores corregidos

- Login: texto genérico sustituido por nombre de perfil obtenido en servidor; auth_time verificado y clave de deduplicación conservados.
- Push social: enlaces relativos con #section-usuarios antes se descartaban y abrían Pedidos. El SW acepta sólo destinos administrativos internos y normaliza esos enlaces.
- SW: un fallo de client.navigate ya no termina el manejo sin abrir el destino; una pestaña de checkout no se reemplaza.
- Pedido: un snapshot tardío ya no elimina el destino a los 24 segundos. La apertura consume la fuente autenticada y limpia suscripción/URL para no repetirse.
- Menú: buscador desde el cajón móvil cierra el cajón mediante el control nativo antes de abrir el diálogo; libera inert y devuelve foco.
- Telemetría push: actualiza eventos/dispositivos sin recargar ni sobrescribir preferencias. No se detiene porque el botón de prueba del dispositivo no esté disponible.
- Espejos: actualización visible cada cinco segundos y recuperación inmediata al volver/recuperar red; un aviso durante carga queda pendiente para el siguiente render.

## Validación y límites

La navegación y las superficies se verifican con markup/CSS/runtime reales y conexiones comerciales bloqueadas. Las pruebas de notificaciones usan datos sintéticos y el SW real en VM. No se envían push ni se crean pedidos o usuarios reales. La entrega con iPhone bloqueado y la salud de cada integración externa necesitan una sesión y dispositivo autorizados; no se marcan como producción verificada por una prueba local.

La revisión usa los gates existentes de Maestro, conexiones, fundamentos, Web Push, suscripciones y salud. Los resultados concretos del último estado se registran en CURRENT_STATE.
