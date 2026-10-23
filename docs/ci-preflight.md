# Validación rápida y fases obligatorias

El CI conserva el nombre de workflow y el check obligatorio `Repository audit`.
Ese check es ahora un agregador que sólo aprueba si **todas** las fases terminan
con `success`; un fallo, cancelación, omisión o resultado ausente lo bloquea.

## Antes de enviar cambios

```sh
npm ci
npm run ci:preflight
npm run test:commerce
```

`ci:preflight` ejecuta además todas las auditorías estáticas de Calidad, el
contrato 2H y el auditor legal antes de iniciar Comercio. Resuelve la conexión
workflow → scripts npm → plan de fases → gate final; rechaza fases desconectadas
u opcionales y componentes ausentes de `audit:final`. Las pruebas de regresión
introducen esas roturas deliberadamente. No necesita navegador ni emuladores.

`test:fast` conserva el subconjunto mínimo y no instala Chromium ni inicia emuladores. Analiza la sintaxis de los
JS/CJS/MJS propios, comprueba los destinos de imports estáticos y dependencias
directas, recorre el grafo servidor, importa las 72 funciones sin permitir fetch,
ejecuta contratos de variantes/inventario/carrito/checkout y carga metadata con
el runtime de Playwright sin fixture de navegador. No es una auditoría completa.
Los fallos indican archivo/import y comando para reproducirlos.

`test:commerce` ejecuta las suites Node completas de checkout, pedidos, carrito,
pagos, autenticación y presentación comercial seleccionada. Son pruebas de dominio
con fixtures, almacenamiento/fetch simulados y contratos; no acreditan una compra
real de extremo a extremo. El precio vigente es el precio canónico del producto
para todas sus variantes; estas mejoras no introducen precios diferenciados.

Para pruebas de navegador, usar sólo el servidor local:

```sh
npx playwright install --with-deps chromium
node scripts/servidor-local-pruebas.mjs 4173
# En otra terminal:
npm run test:phase11-seo
npm run ci:commerce
```

Las suites se ejecutan con Node 22 en Actions. Playwright deja las fuentes del
servidor al cargador ESM nativo de Node. Los parámetros de versión de módulos del
navegador permanecen intactos; no se transforman sus URLs en rutas CommonJS.

La integración de almacenamiento real se ejecuta con:

```sh
# Requiere Java 21; rechaza un host de emulador que no sea loopback.
npm run test:commerce-integration
```

También forma parte de `test:rules-critical`, reutilizando el emulador ya
iniciado. Usa REST, commits atómicos y precondiciones de Firestore reales contra
un proyecto `demo-*` fijo; prueba pedido sin variantes, precio canónico, color y
talle, dos reservas concurrentes, reintento, confirmación y cancelación. La
identidad es un fixture: no acredita Auth, pago externo ni una compra E2E.

## Dependencias y aislamiento

| Fase | Espera | Contenido |
|---|---|---|
| A: preflight | Nada | `test:fast`, auditorías estáticas, 2H/legal, build reproducible, drift, CSS, dominio e integraciones |
| B: commerce | A | Productos, pedidos, pagos, cuentas, stock, carrito, checkout y navegador comercial |
| B: rules | B commerce | Firestore con proyectos `demo-*` y Java 21 |
| C: admin | B commerce | Editor, persistencia, importación, imágenes, panel, operaciones y conectores |
| D: quality | B commerce | Regresiones técnicas Node/navegador y runtime aislado Auth/Firestore con Java 21; runtime largo al final |
| D: browser | B commerce | SEO, interfaz, responsive, accesibilidad y rendimiento |
| E: Repository audit | Todas, incluso si fallaron | Exige `success` en las seis fases anteriores |

Cada trabajo tiene su checkout, procesos HTTP, fixtures y emuladores. Las pruebas
que comparten un trabajo siguen en serie. Las fases C/D/reglas corren en paralelo
sobre máquinas independientes. Se conserva `npm ci` y caché npm; Chromium tiene
caché por SO/arquitectura/lockfile. No se comparten datos de producción.

## Cobertura y tiempos

Seguimiento del 2026-10-23: el preflight ampliado completó 39 comandos en
20,352 segundos (suma medida con Node 22.23.4; otra ejecución Node 24 dio
20,327 segundos). Incluye 37 componentes estáticos de `audit:final`, `test:fast`
y el auditor legal; el build tiene su medición y sigue siendo obligatorio después.
Estos tiempos son mediciones locales, no una duración garantizada de GitHub.
La ejecución 39995716643 del SHA 3c072c1d aprobó 405 casos del runtime con
Auth/Firestore (11,8 minutos de Playwright), pero falló posteriormente en el
contrato estático 2H y en el auditor legal. Ambos todavía buscaban comandos
literales en el workflow anterior. Ahora leen la cobertura conectada al gate final
y corren en preflight; los demás componentes estáticos de Calidad también se
adelantan. La validación completa del SHA que incorpora este ajuste sigue pendiente.

`config/ci-stages.json` asigna exactamente una vez cada componente del comando
local `audit:final`, que permanece disponible sin cambios. El runner, el auditor
de Nivel 1 y las pruebas del gate rechazan omisiones o duplicaciones en esa
asignación. Las comprobaciones adicionales del workflow anterior están distribuidas
en el mismo plan. Se retiran repeticiones que ya cubren suites completas:
checkout dentro de `audit:secure-orders`, pedidos dentro de `audit:admin-orders`,
Maestro dentro de `audit:admin-sync`, geometría de Productos dentro de
`audit:admin-responsive` y footer dentro de `test:navigation-header`.
Se retira también el glob obsoleto `tests/code-studio/*.test.mjs`: la carpeta no existe y Node lo aprobaba con cero pruebas. El preflight ahora rechaza globs de suites inexistentes o vacías.
Se incorpora a CI el recorrido existente de dos colores hasta el borrador de
checkout; usa catálogo simulado y tampoco constituye una compra real.

`npm run ci:preflight`, `ci:commerce`, `ci:admin`, `ci:quality`, `ci:browser` y
`ci:rules` imprimen tiempos por comando, guardan JSON en `artifacts/ci/` y añaden
una tabla al resumen de Actions. El JSON conserva también el comando fallido.
Los artefactos se suben incluso cuando falla una fase.

El generador canónico del diagnóstico analizaba cada JS con un nuevo proceso
Node. Ahora usa un único proceso V8 para todos los archivos, con resultados por
archivo y pruebas negativas de sintaxis CJS/ESM. No ejecuta las fuentes analizadas.
El build y los verificadores del manifiesto siguen siendo obligatorios.

## Protección y publicación

El ruleset activo `Protect main` exige `Repository audit` (GitHub Actions) y
`Cloudflare Pages`, rama actualizada, PR, resolución de conversaciones, historial
lineal, squash y protección frente a borrado/force-push; no tiene bypass actors.
El nombre `Repository audit` se mantiene para conservar esa exigencia.
La lectura del endpoint clásico de protección devuelve 403 con esta integración;
la verificación anterior proviene del ruleset público 18212422.

El repositorio tiene un workflow de mantenimiento que puede fusionar PRs de la
titular al quedar verdes. Por la instrucción de esta ejecución, el PR #1214 se
mantiene **en borrador**: bloquea ese mecanismo y el merge. No marcarlo listo ni
activar publicación sin una nueva autorización. Las previsualizaciones de PR de
Cloudflare existentes no equivalen a un despliegue de producción autorizado.

Resultados y limitaciones de esta ejecución se registran en `docs/agent/CURRENT_STATE.md`.
