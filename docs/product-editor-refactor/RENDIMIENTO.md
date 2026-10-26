# Rendimiento reproducible de la galería

Base de galería: `5dc6f781a81e0ae0dd07d84b0c742ec3d567e133`. Resto del editor final, mismo entorno y datos.
Node24.19.0, Playwright1.64.1, motor Chromium **151.0.7922.173**.
El user-agent de Desktop Chrome es emulado; no se usa para identificar el motor.
Sin otros navegadores de pruebas concurrentes, un worker,1440×900, sin throttling.
Cinco muestras consecutivas de20 eventos input sobre cinco fotografías sin cambios.

| Medición | Galería base | Galería final |
| --- | ---: | ---: |
| Tarjetas retiradas,100 eventos | 500 | 0 |
| Nodos originales conservados | No | Sí |
| Mediana de20 eventos y un frame, ms | 62.0 | 39.0 |
| Muestras, ms | 57.7, 69.5, 63.0, 62.0, 55.6 | 39.0, 41.9, 42.4, 36.7, 31.6 |

El dato robusto de este ensayo es evitar100 reemplazos por muestra,500 en total.
La mediana es descriptiva de cinco muestras en este contenedor: no demuestra una
aceleración general del sitio, subidas, Firestore o una sesión productiva. No se
certifica memoria retenida ni ausencia global de long tasks con este ensayo.

Reproducir con servidor local en4173, dependencias del lock y sin otras suites:

```sh
EDITOR_MEASURE_BASELINE=1 npx --no-install playwright test tests/ui-ux/product-editor-final.spec.js --grep 'galería: eventos' --workers=1 --retries=0
npx --no-install playwright test tests/ui-ux/product-editor-final.spec.js --grep 'galería: eventos' --workers=1 --retries=0
```

La primera prueba sirve el archivo de galería desde git show del commit base
**después** de instalar las rutas genéricas de la fixture, y exige500 reemplazos.
La segunda exige0 y conserva los nodos. Esto impide comparar accidentalmente dos
veces la implementación final. El primer intento con override inefectivo queda
invalidado en evidencias/intentos-previos.json; tampoco se usan tiempos recogidos
con dependencias anteriores o trabajo concurrente.

Datos crudos: [rendimiento.json](evidencias/rendimiento.json).

Las cinco mediciones del antiguo «perfil sintético» de1/2/5/10/20 fotos no se
repiten en esta entrega. La tanda amplia las excluye expresamente y la comparación
actual mide la galería unificada; no certifica el rendimiento total del editor.
