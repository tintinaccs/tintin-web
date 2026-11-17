# Checkout y seguimiento — 17/11/2026

La clienta observada en Checkout no tiene paso ni error conocido. No se puede concluir que una visita a esa pantalla sea un fallo. Las pruebas de esta entrega usan identidades y servicios aislados; nunca un pedido o cobro real.

## Uso del panel

- En «En línea ahora», se muestra por ejemplo `Catálogo de relojes` o `Checkout · Paso 4 de 5: Pago`.
- Durante la confirmación se distinguen preparación, preferencias, verificación del intento y espera de la respuesta de la tienda. Se registra intento, error clasificado o pedido confirmado; una espera larga indica ausencia de resultado, sin inventar un bloqueo.
- El nombre de una cuenta identificada abre su ficha. En «Historial de navegación», elegir Día, Semana o Mes y una fecha de referencia. Los períodos y las horas son de Paraguay; la semana comienza el lunes. Cada ingreso muestra hora inicial, última señal, destino y acciones. Actualizar vuelve a leer; Cargar más sesiones continúa la paginación.
- Categorías, productos públicos, apartados de Mi cuenta y paneles distinguen contextos; las rutas informativas mantienen su nombre. No se registran teclas ni valores de los formularios. Un producto se identifica por su ID público, sin copiar campos privados.

## Arquitectura y límites

Se reutilizan `/api/site-activity`, `sitePresence` y `siteTraffic/{día}/sessions/{sesión}` y las lecturas existentes de Super Admin. No hay servicio ni almacén nuevos, ni índices o Rules que desplegar. El servidor valida el contexto con una lista permitida y solo asocia una cuenta después de verificar su token. Escribe presencia e historial mediante el mismo commit y precondiciones; duplicados no agregan acciones. Las sesiones de una cuenta no se reasignan a otra.

El historial comienza con esta publicación y una aceptación v3 de estadísticas. Las elecciones anteriores de solo necesarias se conservan; las aceptaciones anteriores no habilitan automáticamente el nuevo alcance. La cuenta y el carrito siguen siendo esenciales y no dependen de estadísticas. Retirar el permiso detiene el observador, los envíos y la cola local.

La cola local conserva hasta200eventos pendientes. El envío normal conserva los límites existentes: intervalo mínimo20s y heartbeat60s. Los cambios se encolan entre páginas; no se escribe por cada tecla. Cada documento de sesión conserva las últimas200acciones y lo informa cuando trunca; la ficha pagina20sesiones por pedido. El cierre definitivo de una pestaña antes de sincronizar puede dejar el último tramo sin registrar. La hora de una acción proviene del navegador y se valida contra una ventana de24h; la recepción, comienzo y última señal usan el reloj del servidor. Una diferencia de reloj puede impedir registrar acciones.

La última señal, una pestaña abandonada o un formulario sin completar no prueban un fallo. La confirmación y sus errores se registran por eventos del flujo real; no se infieren a partir de vaciar o restaurar el carrito. No se reconstruye detalle para sesiones anteriores. GA4 no recibe este historial de cuenta ni su uid.

## Verificación

Antes de cambios:542 comercio,19 integración Firestore,79Chromium de checkout aprobados. Después:542comercio,20integración Firestore y suites de contexto/API/privacidad/panel aprobadas; la evidencia final del candidato y CI se vincula en la PR. Las pruebas incluyen duplicados, cambio de cuenta rechazado, ausencia de PII, límite de historial, transacción de presencia+sesión real emulada, períodos bisiestos, estados de espera, retiro del permiso y UI móvil/escritorio.

El aviso ampliado reprodujo un cierre fuera de pantalla en844x390. La fuente CSS compartida ahora limita la altura y permite desplazamiento sin alterar la compra. La regresión conserva los controles de teclado y de fondo inerte y carga la hoja CSS compartida real en su fixture. La tanda de108Chromium aprobó;186Node de operaciones/analítica/estadísticas también aprobaron. Se alinearon las dependencias locales con el lock vigente mediante npm ci --ignore-scripts; no se cambiaron dependencias del proyecto.

La sonda pública de salud se ejecutó en solo lectura y aprobó. Eso no sustituye una compra autenticada de producción ni una captura real de pago. El código nuevo requiere integración, publicación y señales nuevas para verse en el panel.
