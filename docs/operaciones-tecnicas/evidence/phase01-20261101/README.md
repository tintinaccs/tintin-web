# Evidencia reproducible — Fase 01

Base de código: 085953dc0b700e91f95fc8c84dd8e17f4627a70c. Son pruebas de auditoría,
no reparaciones. Los probes esperan confirmar el fallo descrito: su salida0 no
significa que el invariante de seguridad/negocio esté aprobado. Tras una reparación
la regresión deberá exigir el comportamiento seguro opuesto.

## Archivos

Los JSON están en esta carpeta; las herramientas ejecutables y el config están
en scripts/agent/phase01-audit (categoría Node existente del generador).

- inventory.json: páginas, 58API, módulos/imports, fan-in, ciclos, referencias y
  distribución de archivos de tests. collect-index.py lee el SHA base fijo con git.
- validation.json: resultados terminales y límites de ejecución.
- rules-probe.mjs / rules-result.json: actualización de inventory* por agent sin
  permiso, con controles anónimo/cliente y lectura denegada; Rules reales en demo.
- stats-probe.mjs / stats-result.json: módulo real con I/O sintético, 5.001pedidos
  globales y finalización de dos snapshots fuera de orden.
- fallback-probe.mjs / fallback-result.json: inspección de recursos del public
  producido por prepare:hosting, sin publicar nada.
- legacy-order-probe.mjs / legacy-order-result.json: dispatcher y creador reales
  de Apps Script con transacción/salidas externas sintéticas; dominio CF real
  con dependencias de I/O sintéticas rechaza la misma variante agotada.
- npm-audit-summary.json: dos avisos únicos y14paquetes de herramientas afectados,
  lockSHA256 y alcance; sin fix automático.
- diagnostic-index-result.json: nombres de colección fantasma; no son huecos de Rules.
- firebase-rules-assessment.json: evaluación parcial del camino auditado, formato
  del Skill de auditoría. No acredita el conjunto de reglas desplegado.
- browser-runtime.mjs: adaptador de ejecutable local; conserva tests y plazos.

## Repetición

Usar Linux y las dependencias existentes del lock. No ejecutar escrituras contra
un proyecto real ni introducir credenciales de producción en estas fixtures.
Los probes resuelven módulos relativos al repositorio que los contiene: si el
código ya cambió, copiarlos a un worktree del SHA base para repetir la evidencia.

```sh
# Desde el checkout que contiene este informe; directorio nuevo para no sobrescribir.
audit_source="$PWD"
audit_repro=$(mktemp -d /tmp/tintin-phase01-repro.XXXXXX)
git worktree add --detach "$audit_repro" 085953dc0b700e91f95fc8c84dd8e17f4627a70c
ln -s "$audit_source/node_modules" "$audit_repro/node_modules"
cd "$audit_repro"
npm run build:pages
git diff --exit-code
npm run prepare:hosting
# Copiar sólo después del build limpio: el inventario diagnóstico incluye docs nuevos.
mkdir -p docs/agent/evidence scripts/agent
cp -R "$audit_source/docs/agent/evidence/phase01-20261101" docs/agent/evidence/
cp -R "$audit_source/scripts/agent/phase01-audit" scripts/agent/
node --experimental-vm-modules scripts/agent/phase01-audit/stats-probe.mjs
node scripts/agent/phase01-audit/legacy-order-probe.mjs
node scripts/agent/phase01-audit/fallback-probe.mjs "$audit_repro"
```

Para Rules, run-rules-probe.mjs transforma la plantilla emulator-config.json
en un config temporal con ruta ABSOLUTA a las Rules del mismo worktree. Firebase
rechazó el primer config anidado con rutas relativas fuera de su project directory;
ese intento no ejecutó la prueba. El lanzador corregido evita ese problema sin
modificar reglas ni comprobaciones. Usa host127.0.0.1/puerto18189 y proyecto demo;
comprobar que el puerto esté libre y no reutilizar un emulador ajeno.

```sh
node scripts/agent/phase01-audit/run-rules-probe.mjs
```

El probe rechaza FIRESTORE_EMULATOR_HOST no loopback y fija un proyecto demo.
Conserva las restricciones de la prueba y evita conflictos con otros emuladores.

## Suites existentes ejecutadas

```sh
npm run audit:architecture-contracts
npm run test:architecture-gates
npm run audit:site-structure
node scripts/auditar-integraciones-canonicas.mjs
npm run audit:modular-architecture
npm run audit:account-contract
npm run audit:sync-contracts
npm run audit:cache-versioning
node --test tests/checkout/*.test.mjs tests/orders/*.test.mjs tests/payments/*.test.mjs tests/cart/*.test.mjs tests/accounts/*.test.mjs tests/sync/*.test.mjs
node --test tests/operations/ci-immutable-checkout.test.mjs tests/diagnostics/manifest-exclusions.test.mjs
npm audit --package-lock-only --json
```

El npm audit terminó con avisos moderados, no PASS. No aplicar su sugerencia de
cambio mayor sin evaluar compatibilidad. No se ejecutó audit:final como bucle ni
se declaró una reparación integral de todos los criterios.

Para navegador se reutilizó Chromium existente /usr/bin/chromium, versión151,
porque faltaba la copia cacheada requerida por Playwright. El intento inicial de
smoke no llegó a ejecutar casos; se conserva ese límite. En el worktree base:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium \
node --import "$audit_source/scripts/agent/phase01-audit/browser-runtime.mjs" \
  scripts/smoke-todas-paginas.mjs
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium \
node --import "$audit_source/scripts/agent/phase01-audit/browser-runtime.mjs" \
  scripts/auditar-canonicos-viewports.mjs
```

Las cinco pruebas de accesibilidad se ejecutaron contra servidor-local-pruebas.mjs
con puerto18173 y PLAYWRIGHT_BASE_URL=http://127.0.0.1:18173,
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium:

```sh
npx playwright test tests/ui-ux/phase10-accessibility.spec.js --project=chromium --workers=1 --retries=0
```

Son tests del helper con DOM sintético. El Admin del auditor geométrico usa un
fixture de layout sin negocio; Producto en smoke se comprueba como documento
base. No atribuir esos PASS a compras, autorización productiva, WCAG completa,
Core Web Vitals de campo ni dispositivos que no se probaron.

Logs extensos locales: artifacts/phase01/*.log (no versionados). Los resultados
compactos y probes de esta carpeta sí se conservan para que otro agente continúe.
No actualizar esta evidencia fija para aparentar que ya describe un SHA nuevo.
