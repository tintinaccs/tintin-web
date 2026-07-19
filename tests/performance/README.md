# Pruebas de rendimiento (Playwright)

Estas pruebas miden Web Vitals reales (FCP/LCP/CLS), verifican que el loader
siempre se cierre, que no haya desplazamiento horizontal en las 7 resoluciones
obligatorias y que la app se recupere ante red intermitente/offline.

## Requisitos

- `@playwright/test` instalado (`npm i -D @playwright/test`).
- Un navegador Chromium disponible.
- Acceso de red al despliegue real (Firebase/gstatic/Cloudinary alcanzables).

## Cómo ejecutar

```bash
# Contra el despliegue real (recomendado: métricas con sentido):
PERF_BASE_URL="https://tintinaccs.github.io/tintin-web" npx playwright test tests/performance

# Una sola suite:
npx playwright test tests/performance/public-pages.performance.spec.js
```

## Limitación conocida en CI de este repositorio

El workflow de auditoría de GitHub Actions ejecuta comprobaciones **estáticas**
sin dependencias (`node scripts/audit-*.js`) y **no** instala Playwright ni abre
un navegador. Por eso estas pruebas **no** forman parte del CI que bloquea el
merge: se ejecutan a demanda en un entorno con navegador + red.

La invariante de rendimiento/tiempo real que sí corre en CI, sin navegador, es
`scripts/audit-performance-realtime.js` (`npm run audit:performance`).

Durante el mantenimiento que creó estas pruebas, el entorno de ejecución tenía
la red externa del navegador bloqueada por el proxy del sandbox, por lo que las
métricas de laboratorio quedaron marcadas como **"no medida"** en
`maintenance/12-rendimiento-velocidad-sincronizacion.txt`. Las pruebas están
escritas para producir números reales en cuanto se corran donde haya red.
