# Pruebas de rendimiento (Playwright)

Estas pruebas miden métricas de laboratorio (FCP/LCP/CLS), verifican que el loader
siempre se cierre, que no haya desplazamiento horizontal en los siete anchos
solicitados (360/390/768/1024/1280/1440/1920), además de320px, y que la app se
recupere ante red intermitente/offline.

## Requisitos

- `@playwright/test` instalado (`npm i -D @playwright/test`).
- Un navegador Chromium disponible.
- Acceso de red al despliegue real (Firebase/gstatic/Cloudinary alcanzables).

## Cómo ejecutar

```bash
# Contra el despliegue real (recomendado: métricas con sentido):
PERF_BASE_URL="https://tintinaccesorios.pages.dev" npx playwright test tests/performance

# Una sola suite:
npx playwright test tests/performance/public-pages.performance.spec.js
```

## Integración y alcance

El stage `browser` de `config/ci-stages.json` ejecuta `npm run test:performance`
con Playwright. Las auditorías estáticas son complementarias, no sustituyen
estos recorridos. Para una repetición local sin operaciones productivas:

```bash
node scripts/servidor-local-pruebas.mjs 4173
# En otra terminal:
PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173 PERF_BASE_URL=http://127.0.0.1:4173 npm run test:performance
```

`editor-scroll.performance.spec.js` utiliza el editor y estilos reales con
persistencia/proveedores simulados. Comprueba scroll por rueda y conservación
de posición/nodos en los siete anchos solicitados; adjunta tiempos de frames y
tareas largas. Esos tiempos no certifican FPS en hardware físico. La interacción
sintética de `_helpers.js` tampoco equivale al INP de usuarios reales.

La invariante de rendimiento/tiempo real que sí corre en CI, sin navegador, es
`scripts/auditar-rendimiento-tiempo-real.js` (`npm run audit:performance`).

Durante el mantenimiento original que creó estas pruebas, el entorno tenía
la red externa del navegador bloqueada por el proxy del sandbox, por lo que las
métricas de laboratorio quedaron marcadas como **"no medida"** en
`maintenance/12-rendimiento-velocidad-sincronizacion.txt`. Las pruebas están
escritas para producir números reales en cuanto se corran donde haya red.
