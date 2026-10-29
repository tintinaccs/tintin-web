# Rendimiento global — 29 de octubre de 2026

Base: main `a936e6dd` (incluye #1269–#1272). Alcance autorizado: continuar la optimización de velocidad pública del texto aportado por la titular. Implementación: Codex raíz. Sin nuevos servicios, dependencias de aplicación, reglas, cambios comerciales ni operaciones reales de compra/guardado.

## Diagnóstico y decisiones

| Hallazgo | Evidencia y corrección |
| --- | --- |
| HIGH: portada de 1,7–2 MB por dispositivo | El HTML y las precargas seleccionaban PNG; el runtime lo conservaba tras Firestore por fidelidad. Se crean WebP **sin pérdida**, a resolución completa y con ICC conservado, manteniendo PNG originales y fallback. No se reutilizan los WebP pequeños anteriores. |
| MEDIUM: todas las imágenes visibles compiten como prioridad alta | `rendimiento-imagenes` aplicaba `fetchPriority=high` a cada imagen próxima al viewport. Ahora conserva prioridades explícitas y deja `auto` para miniaturas visibles; las imágenes diferidas conservan `lazy`. La portada mantiene su prioridad alta explícita. Aplica a toda página que utiliza este runtime compartido. |
| MEDIUM: lecturas/escrituras de layout intercaladas y trabajo de listas sin cota | Se deduplican raíces/nodos, se omiten imágenes desconectadas/procesadas y se utiliza una sola cola global con lotes de hasta 64 por frame. Se leen las geometrías del lote antes de escribir sus atributos, dando oportunidad a teclado, scroll y pintura entre lotes. |
| HIGH: segunda espera visual al revelar la portada | La sonda registró descarga WebP terminada a7,07s y LCP a10,60s. El shell ya esperaba `decode()`, pero su revelado añadía una transición de opacidad. Al revelar sin esa segunda transición, el ensayo diagnóstico registró LCP7,36s. Se conserva la espera de decodificación y el espacio de la imagen; se prueba el primer frame opaco con CSS real en los cuatro dispositivos. |
| Observabilidad | El medidor existente fijaba una ruta de Chromium antigua. Ahora usa el navegador del entorno, permite controlar red/CPU/repeticiones, conserva las corridas individuales y rechaza comparar condiciones o espejos de Firebase diferentes. No requiere un SDK nuevo ni cambia el runtime comercial. |

| Portada | PNG original | WebP sin pérdida | Reducción |
| --- | ---: | ---: | ---: |
| Desktop | 1742841 B | 1192896 B | 31,6 % |
| Mobile | 1991663 B | 1370224 B | 31,2 % |
| Tablet horizontal | 1724607 B | 1129284 B | 34,5 % |
| Tablet vertical | 1724607 B | 1129284 B | 34,5 % |

Las pruebas decodifican ambos formatos en navegador y comparan SHA256 de todos sus píxeles RGBA y sus dimensiones. `scripts/optimizar-hero-sin-perdida.py` permite regenerar offline con Python/Pillow/WebP; no participa en build/CI ni agrega dependencias de aplicación. Las fotos personalizadas siguen usando sus URL autorizadas, y un fallo conserva el respaldo PNG.

En la base, el CSS inicial ocupa 483284 B en origen: compresión local gzip 94268 B/Brotli 74080 B. Eso no es una medición de transferencia productiva. Se conserva el generador y la reutilización de CSS entre rutas; el tamaño sin comprimir por sí solo no demuestra que sea correcto eliminar reglas o reconstruir el sitio. Analytics ya respeta consentimiento, carrusel ya difiere GSAP y main ya contiene la mejora administrativa #1272; no se duplican esas correcciones.

## Verificación y límites

Verificación final local: 86/86 Chromium (2,2min) y2/2Node de snapshot/fallback, sin reintentos. Pruebas: fidelidad de las cuatro variantes, precarga compartida con `picture` en 390/820/1024/1440, snapshot/personalización/restauración de Firestore sin doble descarga, fallback, prioridad explícita, lectura antes de escritura y cota del lote. Regresiones públicas responsive y carrusel en 320–1920, CLS y contratos de imágenes. Evidencia final del candidato/CI/publicación en CURRENT_STATE y recibo del PR.

La comparación de laboratorio recorre Inicio, Catálogo, Producto, Checkout y Colecciones; comprueba apertura real del carrito cuando está disponible. Tres repeticiones, mediana, 390×844, mismo Chromium, descarga 500 KiB/s, RTT adicional 100 ms, CPU ×4 y espera 8s. SDK local con los mismos bytes en ambas versiones; los demás terceros se abortan. Los datos de producto/servicios externos y el desafío reCAPTCHA no quedan certificados por esta sonda. Es una comparación controlada de carga, **no una medición de INP de usuarios ni una promesa de velocidad productiva**. Si una interacción no puede verificarse, se registra null; la mediana excluye muestras ausentes y nunca las transforma en0.

El primer piloto usó espejos Firebase distintos entre árboles y se descarta como comparación. El medidor ahora lo rechaza. La comparación comparable se registra abajo; CI y publicación requieren evidencia del SHA final. Safari/iPhone físico y sesiones autenticadas reales no verificados. No se modifican precios, inventario, carrito, checkout, autenticación, permisos ni datos de proveedores.

## Resultados locales del candidato

Medianas de tres corridas por ruta (ms; base → candidato). Producto utiliza el ID inexistente de la sonda, sin certificar una ficha comercial real.

| Ruta | FCP | LCP | Bloqueo TBT | Apertura del carrito vacío | CLS |
| --- | ---: | ---: | ---: | ---: | ---: |
| inicio | 3636 → 3696 | 8340 → 7332 | 924 → 1251 | 275 → 306 | 0.0133 → 0.0011 |
| catalogo | 1736 → 1772 | 1948 → 1948 | 715 → 858 | 232 → 427 | 0.1384 → 0.1384 |
| producto | 1968 → 1940 | 2120 → 2104 | 406 → 490 | 224 → 232 | 0.299 → 0.5186 |
| checkout | 1972 → 2020 | 2172 → 2216 | 212 → 204 | 218 → 201 | 0.0039 → 0.0039 |
| colecciones | 1812 → 1844 | 1812 → 1948 | 422 → 427 | 213 → 218 | 0.4074 → 0.4074 |

Inicio transfiere2463690→1842251B de imágenes (−621439B;−25,2%). La portada por sí sola baja31,2–34,5% según dispositivo. LCP baja8340→7332ms(−12,1%). FCP, TBT, carrito y CLS de las otras rutas no demuestran una mejora global; se registran sin ocultar valores mayores. Las peticiones comerciales abortadas y la ficha inexistente limitan la interpretación de CLS de catálogo/producto/colecciones.

Por la dispersión de TBT se repitió Inicio en un segundo par aislado, tres corridas por versión y el mismo navegador/espejo/red/CPU: LCP8340→7408ms, TBT1148→1091ms y carrito298→298ms. El menor peso y el menor LCP se repiten; **no se acredita una reducción general de TBT ni latencia comercial real**. No se llama INP al clic del ensayo.

Evidencia: artifacts/perf/{antes-comparable,despues-final,confirmacion-base,confirmacion-final}{,-runs,-context}.json (salidas locales ignoradas por Git). El contexto registra Chromium151.0.7922.173,3corridas,390×844,red500KiB/s/100ms,CPU×4 y SHA256 del espejo Firebase1c67cc386d688ae8df0fc38d8b965ad37f523f2056f78a3e362c38f3300f7dcb. El primer piloto con espejos distintos se descartó, y el candidato intermedio con opacidad se corrigió antes del PR.

Verificaciones adicionales: 30/30Node carrito; 10/10Node shell, bundle y scroll; auditoría Fase5,29tripwires y9contratos de rendimiento PASS. El build/preflight, checks del SHA, mantenimiento, merge y publicación se deben acreditar en el recibo del PR; no se heredan de otra rama.

## Archivos e integración

- index.html, gestion-imagenes.js y cuatro WebP nuevos: portada lossless, selección responsive, precarga reutilizada, personalización y PNG de respaldo.
- rendimiento-imagenes.js: política y cola compartidas por páginas públicas y administración.
- coherencia-visual.css: revelado opaco al terminar la preparación del shell; recursos/entry/bootstrap/loader/generador actualizan sus URLs conjuntamente. CSS generado, versiones, manifiesto y plan protegidos se regeneran canónicamente.
- Medidor, auditor de fidelidad, pruebas y generador offline: evidencia reproducible sin dependencias nuevas del sitio.
- Backend, búsqueda comercial, roles y sesiones: sin cambios; se conservan las correcciones ya integradas1269–1272. No nuevas consultas, índices ni reglas.
