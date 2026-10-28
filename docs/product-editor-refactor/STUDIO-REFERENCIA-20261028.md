# Editor Studio: referencia visual recibida

La titular mostró primero el editor publicado de #1265 y luego la referencia
esperada (captura con Anillo alissea, Fotos y colores). No era un fallo de caché:
las seis pestañas estaban publicadas, pero la composición no correspondía.
Esta referencia ahora sí fue vista en la conversación; no se hereda la anterior
afirmación de fidelidad ni se afirma disponer del HTML original de Windows.

## Alcance

Base main `c031635b9d421ece436b878119247c34bcf93f2a`; rama
`fix/editor-studio-reference-20261028`, Codex /root. El formulario, los inputs,
los escritores, permisos y contratos V1/V2 existentes siguen siendo la autoridad.
No se cambian Rules, endpoints, catálogo, pagos, límites ni dependencias.

Se ajusta la presentación canónica: lienzo neutro derivado del tema, tarjeta
blanca continua, pestañas con subrayado rosa, cabecera con ruta/título/ayuda,
vista previa explícita y navegación Anterior/Continuar. Galería con imagen grande,
tarjetas de color con miniatura y panel comercial canónico a la derecha; se abre
al elegir un color. La asignación, orden, portada general, reemplazo y eliminación
siguen usando las funciones existentes, sin recrear inputs de stock/precios.
En la galería inline de Variantes se conserva el contexto antes de las fotos.
Sin asociación a un color, la imagen de respaldo se identifica como general:
nunca se presenta como asociación guardada ni se infiere una foto por color.

Mantener Montserrat/tokens semánticos, foco, teclado, reducción de movimiento,
áreas táctiles y recuperación. La referencia guía composición y densidad, no
autoriza falsificar estados, deshabilitar guardado por apariencia ni borrar campos.

## Verificación y continuidad

11 pruebas originales de pestañas PASS en la primera pasada. Las seis pruebas
nuevas de referencia ejercitan320/390/768/854/1024/1440px, foto local decodificada,
stock canónico sin duplicados, dos columnas cuando hay espacio y navegación.
Primera ejecución falló por selector de captura ambiguo `.adm-card-body`, no por
geometría; se acotó al formulario. Repetición y ampliación:17 PASS sin reintentos.
Las capturas detectaron overrides heredados: se consolidó el bloque Studio
después de las reglas anteriores, manteniendo su alcance en el editor.

La ampliada detectó el orden visual del contexto inline (debía permanecer antes
de las fotos); corregido sin retirar esa aserción. Después se aprobaron6 pruebas
con shell completo/workspace real aislado, y30 Node de permisos, CAS, publicación,
reintentos y recuperación. Build:pages y preflight39 comandos PASS. Las pruebas
252 y el preflight en curso fueron interrumpidos por reinicio del entorno y no
se acreditan como resultado terminal; se reiniciaron los252 y el preflight, este
último terminó PASS. Tras compactar sólo la posición del botón Cancelar, se
repiten6 geometrías y10 casos de error/reintento:16 PASS sin reintentos (2.1m).
Build:pages/preflight final39/39 PASS. La batería252 sigue en curso; CI/merge/
producción:PENDING al preparar el commit; consultar recibos de la PR y
`artifacts/editor-studio/FOLLOWUP.json` para su cierre sin heredar otro SHA.
No heredar aprobaciones de #1265/#1266. Evidencias locales bajo
`artifacts/editor-studio/`; actualizar CURRENT_STATE con resultados terminales.
La aceptación con una sesión administrativa real y hardware físico no está
acreditada por fixtures. Ninguna prueba escribe datos comerciales productivos.

La batería252 reiniciada terminó249 PASS/3 FAIL (sin skips/flaky). Detectó dos
alineaciones de Cancelar en escritorio y el área útil de568x320. Se conserva cada
aserción: el botón canónico vuelve al grupo de acciones y en pantallas bajas se
ocultan sólo breadcrumb/ayuda, no campos.12/12 pruebas originales afectadas PASS
sin reintentos (34.7s); regresión59 PASS sin reintentos (2.6m), incluyendo scroll,
workspaces y pestañas; build/preflight39/39 finales PASS. El tag1 ya está en el
preview del PR1268, por lo que CSS/interfaz y su loader renuevan a tag2, sin
reescribir una URL publicada. CI/merge se verifican por cabeza e intento nuevos.
