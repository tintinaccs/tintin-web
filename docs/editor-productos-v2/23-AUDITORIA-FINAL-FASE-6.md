# Fase 6 — Auditoría del candidato de editor

Fecha: 25/10/2026, America/Buenos_Aires. Ejecuciones UTC: 26/10/2026.
Responsable: Codex /root. Revisión propia automatizada; no se presenta como una
revisión humana independiente ni como una auditoría efectuada por varios agentes.

## Dictamen

**No se aprueba todavía su uso en producción como conjunto integrado.** El
candidato tiene validación local del editor y correcciones acotadas, pero las
cuatro fases previas siguen en PR abiertos; faltan CI del conjunto integrado,
validación autorizada en staging, instalación limpia reproducible y comprobaciones físicas/Safari. Los resultados
locales se enumeran individualmente abajo. No se heredan aprobaciones históricas.

La conclusión no afirma que todo el checkout/pagos esté auditado. Sólo se ejecutan
regresiones sintéticas de sus contratos como consumidores de precio/stock/medios.
No hubo pedidos, compras, cobros, correos, migraciones o escrituras de catálogo reales.

## Base exacta y estado de integración

Main consultado: `f9399a90c73398a18c877bcaf1985491d4085913` (#1236).
La primera ejecución de 440 Node se hizo sobre main antes de descubrir la nueva
cadena; **no se usa como aprobación del candidato**. Se recuperó la cabeza de
Fase 4 sin mezclar ramas ni fusionar PR.

| Fase | Cabeza recuperada | PR / situación al recuperar |
| --- | --- | --- |
| 1 estabilización | `0f57f327ad43671d22d0bd4d373d2f5b7bee8e40` | [#1237](https://github.com/tintinaccs/tintin-web/pull/1237), abierto, sobre main |
| 2 fotos | `746e944d0d05abf45d9f00d55d3448913352fa6f` | [#1238](https://github.com/tintinaccs/tintin-web/pull/1238), abierto, sobre Fase 1 |
| 3 opciones/stock | `38fa577b629c7106c7085360ae6d0070fc89c5c5` | [#1239](https://github.com/tintinaccs/tintin-web/pull/1239), abierto, sobre Fase 2 |
| 4 progreso/publicación | `a6e197e5382cf694caf6d07272e6450a2dfe5b5b` | [#1240](https://github.com/tintinaccs/tintin-web/pull/1240), abierto, sobre Fase 3 |
| 5–6 presentación/auditoría | HEAD de `codex/editor-responsive-auditoria-fases5-6` | Entrega apilada sobre Fase 4; consultar PR y `git rev-parse HEAD` para SHA final |

Los padres de Fase 4 reúnen las fases anteriores. No se integran #1228, #1231 ni
#1233 como ramas paralelas; Fase 4 ya incorpora la corrección acotada de privacidad
que documenta su informe. No se detectó una segunda implementación activa del
editor en el candidato. La orden expresa sin merge/deploy prevalece sobre la
instrucción permanente de AGENTS. Mantener el target sobre Fase 4: el mantenimiento
automático sólo admite PR contra main y no debe habilitarse mediante retarget.

La numeración de los textos actuales corresponde a informes 18–23. Los informes
09–17 pertenecen a una iteración anterior y se preservan como historia.

## Arquitectura y funcionalidades conservadas

Un formulario en `admin.html` y controlador `admin-app.js`; interfaz adaptable
reorganiza los nodos existentes. Galería unificada serializa `imageUrl`,
`imagesExtra`, `variantMedia`; resolvedores compartidos consumen sus asociaciones.
Opciones V1/V2 conservan identidades, precio override/fallback, stock nullable,
protecciones de referencias históricas y reparto explícito.

`espacio-trabajo-producto.js` administra progreso privado por UID/producto,
autoguardado, respaldo de sesión, reintentos y salida. No modifica `products` al
escribir progreso. `product-editor-workspaces.mjs` valida permisos, revisión,
idempotencia y snapshot. `product-editor-domain.mjs` aplica explícitamente producto,
inventario privado, cierre de progreso y auditoría en un commit con precondiciones.
Firestore Rules niega lectura/escritura SDK de espacios privados y lectura pública
de borradores/archivados. API pública y metadata comparten política de publicación.
Sheets conserva su espejo/reintentos; no adquiere autoridad sobre inventario V2.

Se mantienen crear/editar/duplicar, vista previa, SEO opcional, plantilla existente,
archivar/restaurar, detalle técnico, costo/notas restringidos y estadísticas brutas
por ID con sus límites. La matriz funcional histórica de 43/58 decisiones no se
convierte en un PASS nuevo por estar documentada.

## Matriz de verificación

Los resultados finales y comandos exactos se registran en [el recibo](evidencias-f56.json).
Las suites se solapan: no sumar sus conteos como casos únicos.

CORRECT / PASS_LOCAL:495 Node;81 recorridos públicos;213 controles de Rules,
12 integraciones REST/CAS,1 prueba concurrente de cuota y21 de privacidad.
Matriz amplia259/259, seguida de una corrección final exclusivamente en cabecera
desktop del workspace. Se repiten sus23/23 recorridos afectados después,
incluidos dos casos nuevos; no se presentan259 ejecuciones del CSS posterior.
El recibo distingue el blob CSS anterior, las huellas finales y cada comando.
Build Pages y39 comandos preflight PASS_LOCAL sobre fuentes finales.
Después de cerrar este recibo documental se regenera y verifica el diagnóstico,
sin atribuir a una instalación limpia el PASS de pruebas sobre caché restaurada.

| Área / operaciones | Evidencia ejecutable | Alcance real |
| --- | --- | --- |
| Crear, guardar, reabrir, editar, doble acción, errores | `product-save-responsive.spec.js` | DOM/controlador y writer reales; transporte sintético |
| Progreso incompleto, volver, recuperar, publicar, retirar/archivo/restaurar | `product-workspaces.spec.js`, `product-workspaces.test.mjs` | Versión pública permanece intacta al guardar progreso; conflicto/reintento/archivo probado |
| CAS servidor y cierre de progreso | `commerce-firestore.test.mjs` | REST y batch reales contra emulador demo, no Firestore productivo |
| Permisos cliente/servidor y campos privados | `editor-comercial.test.mjs`, `product-workspaces.test.mjs` | Rechazo de rol no permitido, permisos revocados, acceso cruzado y campos privados |
| Privacidad Rules | `probar-privacidad-borradores.mjs` | 21 verificaciones positivas/negativas en emulador; Rules desplegadas NOT VERIFIED |
| Primera/múltiples fotos, portada, orden, reemplazo, quitar, asociaciones | `product-color-gallery.spec.js`, contratos de galería y variantes | Hasta límite canónico; sin borrar medios reales ni probar proveedor real |
| Carga fallida/reintento, pendientes y recuperación | `product-workspaces.spec.js`, `products-responsive-phase-one.spec.js` | No se presenta blob pendiente como URL persistida |
| Sin variantes, V1/V2, precio, cero/no controlado e identidades | Node admin/catalog/orders/cart e integración | Se conservan límites comerciales y referencias históricas |
| Borrador/archivado/agotado/inactivo histórico | política pública, Node editorial y Rules | Stock y estado editorial independientes; ninguna nueva semántica comercial |
| Catálogo, búsqueda, colección, ficha y WhatsApp | `search-responsive`, `public-spacing-product`, `wrist-collections`, `product-stock-first`, `collection-menu-parity` | Interacción/contención locales con datos sintéticos |
| Reseñas y actualización de portada | `home-review-gallery.spec.js` | Imágenes originales; diálogo existente; encabezado canónico y caché/red controlada |
| Responsive y teclado | specs anteriores, nuevo caso de altura reducida | Chromium, 320–2560 y tamaños extra de suites; orientación y foco reales en navegador |
| Duplicar y eliminar permitido/protecciones históricas | Node editor/maestro y catálogo | No se ejecutó eliminación comercial real |
| Sheets, importación y carrito | suites sync y variantes/cart | Contratos locales; conexión desplegada y sincronización real NOT VERIFIED |
| Memoria, lector de pantalla y teclado físico | Inspección limitada | NOT VERIFIED; heap sintético no demuestra ausencia de fugas |

## Hallazgos y correcciones

| ID / nivel | Evidencia, impacto, causa y estado |
| --- | --- |
| UI01–UI06 MEDIUM/LOW | Detalle individual, ubicaciones, capturas y regresiones en [Fase 5](22-UI-RESPONSIVE-FASE-5.md). No se agrupan como una corrección comercial. |
| QA01 MEDIUM, corregido | Integración Firestore: fixtures publicados no tenían descripción/portada y el writer de Fase 4 rechaza con 422. Se completan datos sintéticos, se conserva explícitamente el rechazo de incompletos antes del commit y las aserciones comerciales previas. El primer fallo de lote deriva de no haberse creado su fixture. |
| QA02 MEDIUM, corregido | CI no incluía `product-workspaces.spec.js`, `product-color-gallery.spec.js` ni privacidad de borradores. Se añaden a etapas admin/reglas existentes. No se retiran comandos, condiciones ni controles. |
| QA03 LOW, corregido | Auditor de catálogo esperaba literalmente `loadCollections()` sin parámetros. Ahora admite también `onData(collections)` y conserva todos los requisitos de política. Pruebas negativas nuevas retiran carga/asignación; no se omite el gate. |
| LIMIT01 MEDIUM, pendiente | Listado de progreso acotado a 100 activos/escaneo de 1000 documentos; sin paginación/retención. El aviso nuevo evita aparentar exhaustividad, pero no recupera automáticamente trabajos nuevos fuera del límite. Antes de una operación extensa, definir paginación/retención y recuperación sin borrar datos. |
| LIMIT02 NOT VERIFIED | Safari/iOS, teclado físico/virtual, lector de pantalla y sesión Auth real. Chromium y reducción de viewport no sustituyen esas comprobaciones. |
| LIMIT03 NOT VERIFIED | Reglas/índices y edición real de Firestore, Cloudinary, Sheets desplegado y consumo público de una edición autenticada. Exigen staging/sesión autorizados; no se fabrican accesos ni datos de prueba en producción. |
| LIMIT04 NOT VERIFIED | CI del SHA final y de la futura integración de la cadena. El workflow automático sólo cubre PR hacia main; un PR apilado sin checks no está aprobado. No cambiar target ni triggers para simularlo. |
| ENV01 BLOCKED, externo | `npm ci` y el reintento `--prefer-offline` fallan HTTP 503 al descargar `@firebase/app-check-compat@0.4.7`. Se restauraron 670 paquetes desde la caché local verificando la integridad exacta del lock; ese paquete sigue ausente. Las pruebas posteriores usan Playwright1.64.1, Firebase13.0.0, CLI15.34.0, Rules6.0.0 y parse5 8.0.1, sin cambiar versiones/lock. No equivale a una instalación limpia aprobada. Repetir `npm ci` y CI cuando el registro responda. |
| ENV02 BLOCKED, transporte Git | Consulta Git HTTPS vuelve a dar 503 del túnel. El conector GitHub sí confirma #1240 abierto y su SHA intacto. Se usa el conector para preparar el PR si el push convencional continúa bloqueado; nunca se declara un push fallido como exitoso. |

No se confirmó un defecto CRITICAL/HIGH de producción mediante este entorno;
eso no certifica ausencia global de vulnerabilidades. Los conflictos se resuelven
manualmente; no se mezclan ni redistribuyen automáticamente inventarios.

## Rendimiento

Se conserva el perfil sintético original de Fase 1 (1/2/5/10/20 fotos): apertura,
input/change hasta dos frames, mutaciones y long tasks. El modo
`EDITOR_PROFILE_BASELINE=1` sustituye sólo la interfaz antigua; **no representa
una ejecución de toda Fase 1**. Las primeras mediciones concurrentes y con dependencias preinstaladas distintas del lock se guardan
como exploratorias y no demuestran aceleración ni regresión causal.
La comparación nueva usa el árbol completo de #1237 `0f57f327` y el árbol actual,
un worker, sin otras pruebas concurrentes, mismo Chromium151.0.7922.173 y
Playwright1.64.1, sin CPU throttling. Una observación por escenario; cinco casos
por árbol aprobados. Apertura incluye fixture/navegador, no latencia de Firestore.

| Fotos | Apertura base/final ms | Color base/final ms | Stock base/final ms | Mutaciones de color base/final |
| --- | --- | --- | --- | --- |
| 1 | 1458/1351 | 73.6/60.4 | 33.4/28.9 | 14/13 |
| 2 | 1202/1173 | 67.5/57.4 | 28.8/40.6 | 15/14 |
| 5 | 1158/1026 | 116.4/78.6 | 38.3/34.5 | 18/17 |
| 10 | 1064/1034 | 69.0/83.5 | 55.1/33.0 | 23/22 |
| 20 | 1013/1103 | 128.1/106.8 | 47.4/52.3 | 33/32 |

No se afirma una mejora global ni una regresión causal a partir de n=1. El costo
sube o baja según caso; al agregar color hay una mutación menos en cada escenario.
Se observó una long task de54ms con20 fotos en el candidato y ninguna en esa
muestra base. Se conserva el dato, no se oculta ni se atribuye a un cambio sin
perfil adicional. Heap es una lectura sintética (no prueba de memoria retenida).
El perfil original no monta el autoguardado real de Fase4; mide su fixture sintético compatible.
Sesión administrativa auténtica, tiempos de subida/servicios y estabilidad de
memoria a largo plazo: NOT VERIFIED. Los valores crudos están en el recibo.

## Reproducción, integración y reversión

1. Instalar con `npm ci` y conservar lock; Node >=22, Java para emulador.
   El 503 de esta sesión impide acreditar ese paso; la restauración de caché
   sólo permite continuar pruebas dirigidas y no sustituye la instalación limpia.
2. Servir localmente: `node scripts/servidor-local-pruebas.mjs 4173`.
3. Ejecutar comandos del recibo; proyectos demo y hosts loopback obligatorios.
4. `npm run build`, `npm run ci:preflight`, diff y verificación del plan protegido.
5. Revisar primero #1237→#1238→#1239→#1240 y luego esta entrega. Sin retarget,
   merge, auto-merge ni despliegue por este pedido. Repetir CI sobre el SHA que
   finalmente integre el conjunto; no heredar el resultado de un padre.
6. Validar reglas y flujo autenticado en staging autorizado, dispositivos y límites
   de progreso antes de aprobar administración cotidiana sin reservas.

La reversión de esta entrega es un commit normal del delta de presentación/tests,
con regeneración de versiones y derivados. Conservar lectores/writer V2, identidades,
reservas, historial y protección de borradores de fases previas. Revertir interfaz
no autoriza volver a lecturas públicas inseguras, borrar matrices ni migrar datos.
Para mantenimiento: una única autoridad por dominio, errores de red visibles,
pruebas negativas de permisos y CAS, fotos fallidas recuperables y CI con estas
suites. Toda nueva versión requiere evidencia de su propio SHA.
