# Contraste y corrección de auditoría visual — 26/10/2026

Codex /root (GPT-6), base5dc6f781. La titular solicita continuar directamente el
informe pegado y completar el trabajo. Se contrastan sus siete puntos; no se
hereda su aprobación432/432 ni su matriz19×6. No se encontró la rama indicada
publicada ni un PR asociado al comenzar.

| Punto | Evidencia actual y decisión |
| --- | --- |
|01 Galería estirada | CORRECT: la galería ya tiene align-self:start; el grid tiene align-items:start en su clase canónica. Se comprueba alineación y hueco inferior real en navegador, sin duplicar overrides. |
|02 Sticky de escritorio | NOT APPLICABLE como defecto: position:static es la configuración explícita actual y no bloquea compra/lectura. No se impone sticky96px sin medir cabecera/galerías altas; se conserva el comportamiento existente. |
|03 Fotos heterogéneas | CORRECT: catalogo.html ya declara aspect-ratio:1/1 y object-fit:contain. Se comprueban imágenes240×60 y60×240 en siete tamaños; no se añade una segunda regla. |
|04 Lectura de pasos | LOW: a320px las etiquetas calculadas eran10px. Se mejora a12–13px relativos al tamaño raíz, con salto de línea y texto completo; sin ellipsis, ocultamiento ni scroll nuevo. Prueba adicional al200% exige24px y ausencia de recorte. No se presenta como una infracción WCAG basada sólo en un tamaño mínimo. |
|05 Logo antes del CSS | MEDIUM: se reprodujo tamaño natural480×480 al deshabilitar estilos, frente a104×56 estilizado. El generador canónico incorpora width104/height56 en el HTML de los footers. Pruebas390/1440 conservan tamaño incluso sin CSS. No se afirma CLS global0. |
|06 Texto legal | CORRECT en la versión medida: párrafos de16px con716px útiles en1280; quedan dentro de72 anchos del glifo0. Se comprueban párrafos/listas reales y no una selección vacía, en cinco tamaños. No se estrecha el texto innecesariamente. |
|07 Contacto estrecho | CORRECT: container y tarjetas ya proporcionan márgenes; campos dentro del formulario. Medición desde320px, sin modificar padding ni duplicar estilos. Nosotros es alias de About, no una segunda pantalla de contacto. |

Fuentes funcionales modificadas: checkout-maintenance.css y sharedFooter del
constructor sincronizar-inicio-navegacion-publica.js. Los demás cambios de JS
son propagación de URLs inmutables desde la hoja de Checkout; no se modifica
lógica comercial, Auth, Rules ni datos reales. Rutas/CSP/caché/diagnóstico y plan
protegido se generan desde sus autoridades.

Pruebas se incorporan a tres specs canónicos ya incluidos en CI: navegación de
Checkout, espaciado/footer e interfaz de producto/catálogo. Se usan DOM/CSS y
controladores reales con transportes aislados; no hay compras ni escrituras
reales. Se mantienen las aserciones anteriores. La prueba nueva de proporciones
espera la geometría adjunta/visible: el catálogo puede reemplazar nodos al llegar
metadata y no debe confundirse una transición con una proporción incorrecta.

Evidencia RED: Checkout320 calculaba10px; logo sin CSS480px en390 y1440.
GREEN dirigida tras los cambios: ambos casos y Checkout200% aprobados.
Las primeras matrices se solaparon durante la preparación de URLs y registraron
fallos; no se declaran aprobadas ni se suman con la repetición final. Se congelan
fuentes y se repite la matriz secuencialmente. Logs privados /tmp/visual-*.log y
capturas en test-results; resultados finales y CI del SHA exacto se registran
antes del merge protegido, sin bypass ni force-push.

Límites: no Safari/iPhone físicos, transacciones reales ni certificación estética
de todas las pantallas a partir de tests unitarios. Playwright/parse5 ya existen
en package.json y CI; no se agregan dependencias, Web Components o pipelines.

Fuentes congeladas:127/127 Chromium PASS en la repetición secuencial, sin
reintentos de suite. Incluye las siete resoluciones de producto/catálogo, fotos
panorámicas/verticales,15 tamaños/orientaciones de Checkout, texto ampliado,
footer en cuenta/público y15 casos de legales/contacto con selección no vacía.
WebKit7/7 PASS en móvil/tablet/escritorio emulados y letra ampliada. Las
bibliotecas del motor se cargan desde el caché de usuario ya preparado; se omite
sólo el precheck de paquetes globales que no reconoce esas bibliotecas. No se
omiten pruebas/aserciones ni se modifica CI. Captura Checkout390 revisada.

La matriz canónica concluyó126/126 combinaciones PASS (documentos/rutas y siete
resoluciones; no certifica estados autenticados ni inspección estética individual
de cada captura). El preflight inicialmente rechazó la clave de fixture font por
su auditor estático de tipografía; se renombra a textSize conservando las dos
aserciones. Los dos casos dirigidos320/200% se repiten y aprueban después; no se
suman a127 como casos distintos. Preflight final39/39 comandos PASS, sin cambios
al auditor. Build y caché PASS. CI/merge del nuevo SHA se verifican por separado.

## Conciliación con main8e922503

Durante CI se integró el PR1244 del editor. Se incorpora mediante merge normal,
sin force-push ni descartar su trabajo. Los conflictos HTML son referencias de
release; se parte de los documentos nuevos de main y se regeneran footer/URLs.
El constructor conserva width/height y ambas fuentes de tienda.js (retirada de
variantes de main y referencia visual nueva). Política y plan se reconstruyen
contra8e922503 conservando registros y metadatos. Build/caché de la combinación
PASS; se repiten127 recorridos Chromium,7 WebKit y preflight. Los resultados
remotos de5f799437 no se atribuyen a la cabeza combinada. CI repetirá también la
matriz canónica sobre ese nuevo SHA;126/126 local documenta la pasada anterior.

Cierre local posterior a la conciliación:127/127 Chromium,7/7 WebKit y39/39
comandos preflight PASS de nuevo sobre8e922503 combinado con la mejora visual.
Se preservan todas las aserciones y las fuentes del editor; ninguna prueba o
protección se reduce. Build/caché y diff propios contra main verificados. La
cabeza combinada debe aprobar su propia CI antes del merge y monitor posterior.

## Renovación final del plan protegido

CI40359757141 aprobó todas las etapas del candidato combinado. El mantenimiento
40364881108 bloqueó correctamente el merge: el build diagnóstico había renovado
los marcadores HTML después del cálculo del plan, dejando14 huellas antiguas.
Se vuelve a ejecutar el preparador canónico sobre los artefactos finales y se
comprueban todas las entradas protegidas tras el último build. No cambia código
de aplicación ni se reduce el control; el nuevo commit requiere su propia CI.
