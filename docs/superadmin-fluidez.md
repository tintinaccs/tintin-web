# Fluidez compartida de Super Admin

Revisión del 28/10/2026 (Codex /root). Base `b1d90594ba672d66acfc5c88bf3aad381707bb29`,
conservando el editor Studio y las correcciones de guardado/búsqueda de #1270.

## Hallazgo reproducido

`js/admin/maestro/espacio-modulos-admin.js`, scheduler compartido de los módulos:
cualquier cambio de contenido o clase provocaba descubrir y medir todas las
secciones, aunque perteneciera a un único panel. En el shell real con controladores
de negocio sustituidos por fixtures, cinco cambios de título en Configuración
a390px causaron115 consultas `getClientRects` sobre secciones:5 propias y110 de
otros22 paneles. La regresión nueva falló antes de modificar el runtime.

Es trabajo innecesario confirmado; no demuestra que sea la única causa de la
sensación de lentitud en la sesión real de la titular. Una llamada de geometría
no implica necesariamente un layout forzado: no se confunden ambas mediciones.

## Corrección

El mismo scheduler agrupa raíces afectadas por frame. Montaje inicial, secciones
nuevas y resize siguen descubriendo todas las raíces; los cambios locales sólo
actualizan su módulo. Se descartan notificaciones de clase sin cambio efectivo
y las generadas por las propias barras de navegación. Las propiedades `hidden`
se escriben únicamente si su valor cambia, evitando notificaciones redundantes
a los demás observadores del documento.

No se difieren acciones comerciales ni confirmaciones del servidor. No se cambian
loaders, diseño, scroll nativo, permisos, autenticación, consultas, escritores,
campos, imágenes, inventario o precios. Biblioteca administrativa de imágenes y
panel principal consumen la misma URL nueva del módulo; caché y derivados se
generan desde sus autoridades existentes.

## Evidencia y límites

- Prueba inicial:1 FAIL reproducido; otros2 casos no ejecutados por fail-fast.
- Corrección final:7/7 PASS sin reintentos a360/390/768/1024/1280/1440/1920px.
  Cinco consultas propias, cero a otros paneles y cero escrituras redundantes
  de visibilidad de las barras en cada escenario.
- Primera regresión del scheduler:17/17 PASS; después se amplió la matriz y se
  hizo idempotente la visibilidad. Esa pasada no sustituye la regresión final.
- Node scheduling existente:3/3 PASS. Son contratos estáticos, no medición FPS.
- Regresión final ampliada:114/114 PASS,0 reintentos,3.7m. Cubre las siete
  mediciones nuevas, todos los módulos del shell, sidebar, orientaciones de
  tablet/móvil, borradores/errores/recuperación y scroll/nodos del editor.
- Build:pages PASS, caché382 recursos/67 imports dinámicos. Preflight, CI y
  producción:pendientes al preparar este documento; resultados terminales en
  CURRENT_STATE/recibos del PR y `artifacts/admin-fluidity/FOLLOWUP.json`.

Son pruebas de laboratorio Chromium con HTML/CSS reales y datos ficticios, no
una sesión autenticada productiva ni métricas de usuarios reales. No se afirma
un INP de campo, una mejora porcentual de FPS, ausencia absoluta de lag o que se
comprobaron físicamente todos los dispositivos. Si persiste lentitud tras la
entrega, el siguiente paso es capturar una traza de la pantalla y operación
concretas con una sesión autorizada, sin exportar datos privados.

## Conciliación con el editor guiado de main

El primer candidato14d2490f5 aprobó CI40807751960/1 y CodeQL40807749406/1.
Mientras corría se integró #1269 en main a7f55df7e798b9685e31742e187d9abe5fd03fd1.
La integración protegida40809820629/1 falló con «El PR o main cambiaron: se
requiere actualizar la rama y volver a verificar», sin ejecutar un bypass.
Se fusiona main normalmente en la misma rama y se regeneran únicamente los
conflictos derivados de política/plan/manifiestos. El diff contra main sigue
acotado al scheduler compartido, sus consumidores, regresión y documentación;
se conserva íntegro el editor guiado entrante y las correcciones de #1270.
Regresión combinada131/131 PASS,0reintentos,4.4m, incluyendo17 casos guiados.
Build:pages PASS; la cabeza de merge requiere CI nueva, sin heredar14d2490f5.
