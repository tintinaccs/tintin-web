# Fase 12 — Validación final y entrega

## Estado del cierre

Las doce fases quedan integradas en el repositorio mediante ramas y pull requests independientes. La Fase 12 no agrega funciones comerciales nuevas: verifica que el conjunto sea reproducible, seguro, navegable, responsive y publicable sin restos temporales.

## Problemas y causas

- La plataforma acumulaba controles repartidos entre múltiples auditorías, por lo que faltaba una puerta final única que ejercitara reglas, páginas, navegador, responsive, SEO y producción en una misma ejecución.
- Los paquetes npm se usan como herramientas de desarrollo y auditoría; sus avisos no deben confundirse con dependencias JavaScript servidas al público.
- Algunos controles importantes dependen de consolas o deployments externos y no pueden deducirse únicamente del código versionado.

## Cambios realizados

- Se añadió una auditoría permanente de cierre que verifica entregables de las fases 5 a 12, ausencia de aplicadores temporales, conflictos y claves privadas.
- Se añadió un smoke real contra la URL pública de Cloudflare Pages, con reintentos, rutas, canonical, robots, sitemap, manifest y encabezados de seguridad.
- Se añadió un workflow final con Node 22 que ejecuta auditoría integral, reglas de Firestore en emulador, smoke de 18 páginas, pruebas de Chromium, matriz responsive y auditoría de dependencias de producción.
- Las evidencias se guardan como artefactos durante 30 días.

## Pruebas ejecutadas

La puerta final ejecuta:

1. `npm run audit:final` para las fases y contratos permanentes.
2. `npm run test:rules-critical` con Firestore Emulator.
3. `npm run test:pages` sobre las 18 páginas inventariadas.
4. Pruebas UI, accesibilidad y SEO en Chromium.
5. `npm run audit:canonical-viewports` para la matriz responsive.
6. `npm audit --omit=dev --audit-level=critical` para dependencias utilizadas en producción.
7. `node scripts/produccion-smoke-fase-12.mjs` contra `https://tintinaccesorios.pages.dev`.

El informe JSON completo de npm se conserva como evidencia aunque contenga avisos de herramientas de desarrollo.

## Controles externos

- **Firestore Rules:** el repositorio y el emulador validan las reglas, pero el despliegue efectivo en el proyecto Firebase requiere credenciales y debe verificarse en la consola o mediante `firebase deploy` autenticado. No se afirma como verificado únicamente por CI.
- **App Check:** el bootstrap, obtención inicial de token y degradación segura están auditados. El estado de **Enforcement** en Firebase no está verificado desde el repositorio y debe confirmarse en la consola.
- **Apps Script:** el código y sus contratos están auditados, pero la versión desplegada del Web App de Apps Script no está verificada automáticamente; requiere revisar el deployment externo.
- **Cloudflare Pages:** el smoke comprueba el sitio público, pero la asociación exacta entre un commit y su deployment se confirma después del merge mediante la respuesta real de producción.

## Riesgos residuales

- Las vulnerabilidades informadas exclusivamente en herramientas de desarrollo deben actualizarse de forma planificada para evitar cambios incompatibles; la puerta bloquea vulnerabilidades críticas de dependencias usadas en producción.
- Los servicios externos pueden cambiar permisos, cuotas o deployments sin modificar este repositorio.
- La cobertura automática reduce regresiones, pero no sustituye una compra real controlada cuando se cambian credenciales, reglas, Apps Script, Resend, Cloudinary o configuración de Firebase.
- Si App Check Enforcement o las reglas publicadas difieren de este repositorio, la consola externa prevalece hasta un nuevo despliegue verificado.

## Criterio de entrega

La Fase 12 se considera cerrada cuando la PR final queda fusionada, la batería de CI termina correctamente y el smoke posterior al merge confirma producción. Cualquier control externo no verificable queda expresamente registrado como riesgo, nunca presentado como completado sin evidencia.
