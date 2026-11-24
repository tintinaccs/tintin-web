# Fase08 — Optimización transversal consolidada en Fase09

2026-11-02 America/Buenos_Aires. Codex /root. Base39744311; no hubo PR ni integración independiente de08. Sus cambios locales se conservan en codex/phase09-integral-acceptance y deben aceptarse con ese candidato.

## Cambios y medición

- Normalizador de enlaces: no reescribir rel ya correcto. Con200enlaces y10refrescos,2000→0mutaciones. Se conservan noopener/noreferrer, target y normalización posterior de enlaces alterados. Seis pares alternados de Chromium154: mediana20,15→18ms, con variación de carga; no es una promesa de mejora de CWV ni un resultado de campo. [Muestras](evidence/phase08-20261102/link-refresh-measurements.json).
- Carrusel público: estado-colecciones y resolvedor de imágenes importaban SDK Firebase estáticamente para funciones administrativas/defaults. La API pública no podía renderizar si el SDK fallaba. Se difiere ese I/O en las mismas autoridades. Antes: card ausente hasta timeout15s; después: card a890ms en la muestra con SDK remoto bloqueado, manteniendo portadas vivas, carga parcial y cero lecturas de catálogo completo innecesarias. No se atribuye ese tiempo a todas las visitas.
- El listener administrativo sigue paginado/autorizado; tests de251colecciones para titular y200para rol limitado conservan cambios remotos. Resolver imagen ya disponible no carga SDK; lectura/guardado de defaults conservan paths/autoridad; cancelar antes de importar no deja listener sin consumidores.
- Medición: POST sendBeacon de /api/telemetry contiene eventos distintos; no es descarga duplicada de recurso. Se informa telemetryRequests por separado manteniendo peticiones/bytes totales. JS duplicado, fetch repetido y otros beacons siguen activando el tripwire. Sin subir presupuestos.
- Referencias y derivados generados canónicamente. Sin librerías de producción nuevas, rediseño, efectos3D, cambios de paleta, permisos, inventario, cachés comerciales ni recargas forzadas.

## Evidencia y límites

163 pruebas UX/accesibilidad/actualizaciones/navegación PASS sin reintentos;144/144combinaciones de geometría canónica PASS.326pruebas catálogo/admin/arquitectura PASS,1SKIP dependiente de emulador;23pruebas Node de rendimiento PASS y78dominio/SEO/arquitectura/paleta en el barrido que incorporó clasificación de telemetría (conteos solapados). Auditoría SEO1192 y regresiones de rendimiento29 sin fallos. Estos son resultados locales de08 previos al cierre09, que los revalida.

La primera invocación mezcló el origen público por defecto del helper con fixtures locales. No se utiliza como comparación causal del candidato. Repetición con PERF_BASE_URL y PLAYWRIGHT_BASE_URL locales identificó el bloqueo de carrusel; tras reparación,107casos de rendimiento:106PASS/1FLAKY(envios, interacción dentro del presupuesto al repetir). No se presenta como primer barrido limpio. Los resultados finales09/CI prevalecen.

No se certifica WCAG integral, contraste de cada contenido administrable, lector de pantalla real, hardware físico, Safari/WebKit/Firefox ni INP/LCP/CLS de campo. La geometría canónica usa fixtures y no credenciales productivas. Los números de laboratorio dependen de CPU/red/datos/viewport; no se promete porcentaje global ni mejora de ranking. Preservar medición de campo y revisión manual antes de certificar accesibilidad.

Revalidación final09 tras conciliar1317: **685pruebas de dominios PASS,0FAIL/0SKIP**; **107/107Chromium de rendimiento PASS sin reintentos** (3min, ambos orígenes locales). El primer barrido08 de106/1FLAKY se conserva como histórico; esta ejecución nueva no hereda su resultado. Skills46por agente validados; --help del script oficial PASS. [Evidencia local](evidence/phase09-20261102/local-validation.json). Build/CI del candidato y limitaciones productivas se registran por separado.
