# Bibliotecas de diseño y pie único — 2026-11-03

Trabajo de Codex /root sobre la base `5d446cc75ebe31c9022f6db540f0a2fc12c75f8d`. Alcance autorizado: incorporar las bibliotecas solicitadas, aplicarlas a mejoras justificadas y resolver las dos versiones del pie conservando las columnas.

## Integración

Impeccable y los 16 Skills de Emil Kowalski se copian completos en ambas raíces de agentes; Taste ya coincide con la revisión upstream fijada y no se duplica. Las revisiones, hashes originales y archivos adaptados están en `design-skills-lock.json`. Se conservan licencias y NOTICE, incluidos recursos auxiliares. La adaptación de cada SKILL.md agrega las prioridades del repositorio; no cambia sus referencias ni ejecutables. El verificador comprueba metadatos de63Skills, recursos nuevos y paridad entre clientes, integridad de importaciones y Taste. Los cuatro Skills antiguos con traducciones propias por cliente conservan sus textos; no se exige igualdad donde ya no existía.

La selección por tarea está en SKILLS_AUTO_ROUTING.md y los puntos de entrada de ambos agentes. No hay hooks, procesos, instalaciones globales ni descarga/ejecución automática de herramientas de terceros. La invocación nativa por el cliente no está verificada.

## Aplicación y hallazgos comprobados

Se leyeron Impeccable (audit y craft-floor), Taste y las guías de Emil de revisión de animaciones y móvil. Se aplicó revisión manual sobre los componentes y contexto existentes de Tintín. El CLI de contexto de Impeccable no se ejecutó; se usaron DESIGN.md, identidad visual, componentes y contexto PRODUCT.md. No se atribuyen puntuaciones de detector ni una auditoría comercial integral.

| Antes | Después | Evidencia y motivo |
| --- | --- | --- |
| El generador emitía copyright corto; siete scripts de página lo reescribían con resultados distintos | El generador toma el valor del esquema de contenido global existente; los siete escritores redundantes se eliminan | Home solo sustituía el año; Nosotros y otras páginas agregaban derechos reservados. Explica las dos capturas |
| Hover del kit también aplicaba transformaciones en punteros táctiles | La integración del sitio neutraliza hover en touch sin afectar foco visible, ratón ni SVG/kit original | CSS `(hover: none), (pointer: coarse)` y prueba Chromium con hasTouch/isMobile |
| Importación adicional sin trazabilidad sería difícil de mantener | Fuentes fijadas, licencias, recursos completos y verificación de integridad | Validador de Skills existente ampliado |

Se conserva el texto aprobado completo `© 2024-2026 TINTIN ACCESORIOS — TODOS LOS DERECHOS RESERVADOS`, las columnas, el enlace único y «Desarrollado por» con el símbolo original. El campo global del editor sigue disponible: no se borran datos ni configuraciones guardadas. La fecha no se reescribe desde siete relojes de cliente.

El logo sigue siendo el original SHA256 `d031d3ee6ef4df3f62f3a5995d858d6a169ee2681f69de9cf8251720f1ff05f1`. Se conserva carga al acercarse al pie, reserva de espacio, alternativa sin JavaScript, hover/foco originales y reducción de movimiento. Los cambios de URLs de módulos son propagación obligatoria de caché inmutable, no cambios de lógica comercial.

## Evidencia local

- 46 pruebas Chromium de firma y espaciado aprobadas:17documentos por8tamaños (136combinaciones), logo, enlace, contraste, foco, hover, reduced-motion, noscript y touch emulado; se conservan las columnas. Regresión de ausencia de escritores por página.
- Metadatos de63Skills por cliente e integridad de recursos nuevos aprobados; bootstrap Linux `--check` aprobado.
- Tipografía, colores y consistencia CSS aprobados.

Las pruebas de runtime, CI, merge y producción se registran por SHA/run en CURRENT_STATE.md y la PR. No se heredan de PR1322. Emulación móvil no acredita uso en hardware físico; tampoco se afirma haber aplicado todas las guías de plataformas ajenas al sitio.

- Dos pruebas con scripts reales de Inicio/Nosotros en390/1440px y evento pageshow aprobadas. Auditor responsive existente:33/33 combinaciones en320/360/375px aprobadas, sin relajar sus condiciones.

## Ampliación solicitada: mayúsculas y nitidez

Todo el texto del pie se presenta en mayúsculas mediante estilos compartidos, incluidas colecciones recibidas en vivo, títulos, contacto y firma. No se transforman los nombres almacenados ni los enlaces. Pruebas actualizadas de los17documentos, columnas/colecciones en vivo y runtime:57Chromium aprobadas. Se añaden2pruebas de densidad: ocho viewports por2densidades, ambos logos cargados y con resolución suficiente al tamaño dibujado, sin blur CSS ni opacidad reducida. Total dirigido actual:59pruebas aprobadas.

Lectura pública independiente en390px/DPR3: Tintín usa el PNG original480×600 dibujado104×56; NOVAK usa el SVG original dibujado42×40, sin filtro CSS. No se encontró una URL de miniatura ni se inventó un vector maestro. Se preservan ambos archivos originales. «Full HD» describe el viewport1920×1080 comprobado, no un archivo raster nuevo1920×1080; no se afirma haber recuperado detalle inexistente ni nitidez ilimitada a cualquier ampliación.

Regresión corregida antes de publicar: el texto en mayúsculas aumentó el ancho de la firma y el auditor detectó solapamiento con WhatsApp en375px (24/33). Se amplió la separación existente hasta480px sin mover controles. Revalidación:48pruebas de firma/espaciado (170combinaciones:17documentos×10tamaños), incluidas375/390px y ausencia de solapamiento, PASS; auditor original ampliado:55/55 en320/360/375/390/430px PASS. Con las13pruebas de runtime/colecciones/densidad, cobertura dirigida61casos.

La comparación completa de Taste confirmó igualdad de todos sus recursos existentes; se agregó únicamente el fixture opcional evals/evals.json que faltaba, sin duplicar el Skill. El lock y validador cubren ahora todos sus recursos upstream.

## CI: preservación del año automático en el componente común

PR1323, head629e046daad504da60f696c1daa6eee4769322a5, CI41663251829/1 terminó FAILURE: el auditor de Catálogo aún exigía `new Date().getFullYear()` dentro de su script por página. Las pruebas comerciales anteriores a ese punto pasaron; no se omite el requisito. El año automático se conserva en `js/components/novak-credit.js`, cargado una sola vez en los17documentos. Solo reemplaza el intervalo inicial2024–año, usa UTC y se vuelve a aplicar en pageshow y tras los eventos reales del contenido/editor. El resto del texto editable permanece intacto; textos propios sin ese intervalo no se reescriben.

Se actualizan ambos auditores para exigir el componente común y prohibir escritores de año por página. El auditor antiguo de Inicio aún exigía look-grid, ausente también en la base5d446cc7; se alinea con la sección canónica existente Más vendidos, conservando una comprobación obligatoria de sección. Inicio y Catálogo pasan completos. Prueba del reloj2032/2033, restauración y contenido editado:PASS. El fixture declara UTF-8 para probar los caracteres reales. Cobertura específica ampliada a62casos. CI del nuevo SHA requiere ejecución propia; no se heredan checks de629e046d.

Revalidación completa de la fase fallida: `npm run ci:commerce` PASS_LOCAL con servidor local4184 y Chromium configurado; incluye carrito, catálogo/búsqueda, checkout, recuperación de cuenta y decisión de stock al cancelar/rechazar. Preflight completo PASS_LOCAL. No se modificó la lógica comercial.
