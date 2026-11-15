# Hero completo antes del reveal — 15 de noviembre de 2026

Codex /root. Reparación puntual solicitada por la titular mediante captura:
el maletín se pintaba parcialmente al entrar. Mismo comportamiento requerido
en móvil, tablet, escritorio y orientación horizontal. Base68e8861f; no se
modifican fotos, variantes, colores, fuentes ni geometría del hero.

## Causa y reproducción

MEDIUM: `inicio-premium.js` esperaba decode o1500ms, pero el HTML/CSS ya
mostraba la imagen antes de empezar esa espera. Al superar el plazo arrancaba
la animación aunque la descarga siguiera incompleta. La prueba con la foto
retenida reproduce FAIL: esperaba visibility:hidden y recibía visible.
La evidencia local queda en artifacts/hero-reveal-20261115/baseline.log.

## Corrección

El bootstrap mínimo del head reserva el estado invisible antes del primer
frame. El controlador existente sigue diferido, sin otra petición bloqueante.
Una foto permanece invisible hasta completar descarga y decode de su fuente
responsive vigente. Sólo entonces empieza su entrada existente mediante
opacity/transform. Texto/acciones pueden aparecer si la foto tarda: el plazo
de1500ms libera únicamente ese contenido, nunca una foto a medio dibujar.
Los espacios se reservan y no cambian al revelarse el arte.

El estado se opta desde JS: sin JS la portada sigue siendo HTML legible.
Si el controlador tarda, el fallback del bootstrap libera texto/acciones a
los4300ms; al llegar no vuelve a animar ese texto. Un fallo del controlador
restaura la portada estática. Un error de imagen conserva texto/acciones
operables sin pintar un icono de imagen rota. Reduced motion espera igualmente
la imagen y muestra el resultado sin desplazamientos ni escala animada.
Se mantienen una sola entrada, cancelación, preferencias y retorno de página.

## Evidencia y límites

- FAIL reproducido antes de editar el controlador: foto visible mientras la
  petición estaba retenida.
- PASS_LOCAL:8 casos de descarga lenta en320/390/844/768/1024/1440/1920/2560px,
  incluyendo horizontal/tablet. Se supera el plazo anterior, se comprueba
  invisibilidad mientras carga, tamaño reservado y resultado completo.
- PASS_LOCAL: decode pausado pese a descarga completa, reduced motion móvil/
  escritorio, imagen fallida y cambio de orientación durante la petición.
- PASS_LOCAL: controlador lento, controlador fallido y ausencia de WAAPI.
- PASS_LOCAL:38 pruebas de hero/precarga en una corrida inicial y13+3 casos
  dirigidos después de mantener el controlador diferido. La corrida final de
  suites y los recibos del SHA definitivo se registran en la PR de entrega.
- Auditor de rendimiento:0 fallos críticos. Conserva2 avisos de tamaño total
  CSS/JS ya superiores a260KB en la base; no se elevan presupuestos ni se añade
  una excepción de scripts bloqueantes.29 tripwires de regresión PASS.

Se reutilizan Playwright y generadores existentes; no se instalan dependencias.
Skills leídos/aplicados manualmente: systematic-debugging,
tintin-performance-loading y emil-animate (incluida receta de reveal). La
finalidad del movimiento es evitar un cambio brusco de primera entrada;
se conservan curva, tiempos y escalonado de la composición aprobada.

CSP, bundle, versiones de caché y diagnóstico se regeneran desde sus autoridades;
el plan protegido debe validarse contra el main real. CI/merge/publicación
requieren recibos propios, no se heredan los de la entrega global anterior.
Las pruebas son automatizadas en Chromium; no certifican todo hardware físico
ni sesiones de Safari/iOS. No se alteran permisos, pagos ni datos comerciales.

## Validación local final

41/41 pruebas de hero/precarga PASS; preflight completo PASS; build y hashes
protegidos PASS. Comparación aislada con PERF_BASE_URL explícito hacia dos
servidores locales (base68e8861f y candidato): ambos dentro de presupuestos,
CLS0 y119 solicitudes propias en ambos. Muestra de candidato: DCL1197ms,
LCP540ms y apertura de carrito397ms; base1489/1120/366ms. Son muestras locales,
no Web Vitals de campo ni una mejora estadística generalizable. Runtime de
2835 a5536 bytes; gzip1201 a1924 bytes (+723), sin solicitudes nuevas.

Las dos primeras sondas de rendimiento tomaron por defecto el origen de
producción anterior, no el candidato local; fallaron en apertura del carrito
679/1409ms. Se conservan los logs y se corrige el destino de la comparación,
sin cambiar carrito, presupuestos ni descartar esas mediciones como PASS.
La ejecución intermedia iniciada antes de completar CSS/HTML se interrumpió;
no se computa como aprobada. Los fallos previos de reproducción se conservan.

Los recibos terminales de la PR vinculada acreditan CI, fusión y publicación
del SHA definitivo. No se ejecuta otro Maestro global para esta corrección
puntual: se usa la CI canónica y la comprobación no destructiva del hero real.
