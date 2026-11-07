# Pulido de rendimiento — 2026-11-03

Codex /root. Base publicada `b0f50a1012b5b2affbe301f3ac4bbd2e5c550cea`.
Pedido: revisar y optimizar carga/fluidez preservando la tienda existente.
Skills leídos y aplicados: tintin-performance-loading y tintin-performance-budgets.
No se afirma una auditoría comercial integral ni INP de campo.

## Evidencia y correcciones

- Indicador móvil compartido: una ráfaga de20 eventos generaba20 mediciones,
  con lecturas de layout después de escribir estilos. Ahora se agrupa en un
  frame, se completan las lecturas antes de escribir y se omiten propiedades
  idénticas. La prueba dirigida pasó de FAIL a PASS:20→1 mediciones (95% menos
  para ese escenario), sin cambiar el halo, sus estados ni su animación.
- Instagram: cada respuesta idéntica sustituía los botones y sus imágenes.
  Se conserva el DOM cuando los videos no cambian; respuestas nuevas siguen
  actualizando el feed sin desplazar el foco. Un timeout único sustituye al
  intervalo permanente; se pausa fuera del área próxima visible, al ocultar
  y en pagehide; cancela la petición pendiente y reanuda con pageshow/visibilidad.
  El límite de un minuto y la ausencia de peticiones simultáneas se conservan.
- Inicio: el margen que reserva el header fijo colapsaba hasta body (top88).
  flow-root mantiene body en0 y conserva hero en88 en tablet/escritorio;
  móvil mantiene ambos en0. La corrida inicial registró un desplazamiento de
  body con CLS.06821; no se atribuye una mejora universal de CLS a una muestra.

## Alcance de la verificación

Base: auditor de rendimiento sin críticos,29 tripwires PASS y10 rutas públicas
PASS. Advertencias persistentes de presupuesto orientativo: CSS inicial392KB
sin comprimir y JS directo282KB. No se eliminan reglas responsive, calidad de
imágenes ni funcionalidades para ocultar esas advertencias. No se redujeron
los presupuestos ni se relajaron pruebas.

Las pruebas nuevas reproducen trabajo real redundante, conservación de nodos,
pausa/reanudación del feed y geometría del hero; se ejecutan dentro de suites
existentes de CI. La verificación final, SHA, PR y resultados de publicación
se registran en el recibo de entrega de la PR para no crear un nuevo ciclo de
CI sólo por escribir resultados del ciclo anterior.

Se conservan los logos originales y la firma NOVAK, autenticación, permisos,
stock, precios, checkout, sesiones y datos. No hay pedidos, correos, escrituras
comerciales, migraciones, dependencias nuevas ni cambios de proveedor.

Los resultados de laboratorio no certifican hardware físico ni todas las
sesiones autenticadas de producción. La lectura HTTP pública desde el entorno
puede estar restringida; distinguir cada bloqueo de un fallo del producto.

## Resultados locales del candidato

Suite completa:111 pruebas de rendimiento,109 aprobadas directamente y2
flaky en la respuesta del carrito (Contacto836ms, FAQ590ms frente al límite
500ms), aprobadas al reintentar. Repetición aislada sin retries:2/2 PASS,
Contacto344,5ms y FAQ299,7ms. No se modifica ni aumenta ese límite. Inicio
registró CLS0 frente a.06821 inicial; muestras de laboratorio, no p75 de campo.
Node:9 archivos de pruebas de rendimiento/social PASS; auditor de estilos y
29 tripwires PASS. Verificación final específica Chromium/WebKit y entrega
se completan con sus recibos, sin heredar el PASS de versiones anteriores.

WebKit directo no pudo conectarse a localhost, incluso para un JS simple.
Se ejecutan las pruebas relevantes con los mismos HTML/CSS/JS servidos por
interceptación local de Playwright en un origen virtual, sin datos productivos.
Una sonda antigua de alternancia (no modificada) incluye trabajo de arranque
con su espera fija de100ms bajo WebKit; no se atribuye a estos cambios ni se
presenta como PASS. La matriz dirigida cubre los componentes realmente tocados.
WebKit detectó un callback de IntersectionObserver atrasado tras scroll; la
corrección confirma geometría antes del fetch y conserva fallback sin observer.
