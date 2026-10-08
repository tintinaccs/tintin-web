# Mantenimiento revisado de archivos protegidos

El bloqueo histórico `Protected flow integrity` congela los archivos verdes, incluyendo su propio auditor y workflow. Esta instalación es aditiva: conserva sus bytes y hashes, los 76 alcances y la evidencia histórica. Agrega `Protected flow maintenance`, que permite renovar hashes de código mediante un plan exacto, CI completo y revisión del propietario en un entorno protegido. No declara que los flujos modificados tienen nueva evidencia de producción.

## Instalación y activación

1. Integrar el PR de instalación sólo después del CI obligatorio. El auditor histórico debe pasar porque no cambia ninguno de sus archivos protegidos.
2. Crear el entorno `protected-flow-maintenance`: revisor requerido `tintinaccs` (ID 274170818), ramas protegidas únicamente y **desactivar bypass de administradores**. No guardar secretos. La auto-revisión de GitHub debe permitirse porque el propietario es también quien dispara el workflow; el agente no debe aprobar en su nombre.
3. Verificar una ejecución real del nuevo workflow sobre un PR que conserve los archivos protegidos. Añadir `Protected flow maintenance` (GitHub Actions) a los checks obligatorios, conservando todos los anteriores.
4. Revisar las pruebas y el mecanismo. Sustituir el requisito histórico `Protected flow integrity` por el nuevo requisito sólo cuando el nuevo ya esté obligatorio y verificado. Conservar Repository audit, ambos Analyze, Cloudflare Pages, strict, enforce_admins y las reglas de main. El workflow antiguo permanece y sigue mostrando su resultado real; no se sobrescribe su check.

Esta migración de protección es un paso administrativo explícito. Antes de completarlo, un PR de mantenimiento seguirá bloqueado por el requisito histórico. No eliminarlo para solucionar incidentalmente otro PR. Cambiar los auditores, revisores o workflows requiere otra migración revisada; el mantenimiento ordinario rechaza esos cambios.

## Preparar una renovación legítima

Actualizar la rama contra el main vigente. Hacer las correcciones y sus pruebas específicas. Desde el repositorio:

```text
node scripts/preparar-mantenimiento-flujos.mjs SHA_COMPLETO_DE_MAIN "Motivo concreto del cambio y pruebas relevantes" ruta/protegida1.js ruta/protegida2.js
```

El helper calcula los hashes reales y genera `config/mantenimiento-flujos-plan.json`. Conserva metadatos y alcances; no renueva sellos, aprueba ni publica. Rechaza rutas sin cambios y cambios protegidos omitidos. Revisar el diff y regenerar el manifiesto diagnóstico con el generador del repositorio. Commit/push y esperar Repository audit, ambos Analyze y Cloudflare Pages en success. El workflow automático bloqueará una renovación y explicará que requiere dispatch.

En Actions, ejecutar **Revisión controlada de flujos protegidos** desde **main**, con número de PR y SHA completo de su último commit. El workflow sólo lee blobs candidatos; nunca ejecuta código del PR con permisos privilegiados. Valida la base vigente, plan exacto, hashes reales, alcances, origen/app de CI y controles del entorno antes de solicitar aprobación. Revisar en el resumen base, candidato, motivo, archivos y registros afectados; el nombre del job incluye el SHA. El propietario aprueba manualmente el entorno en GitHub.

Tras la aprobación, se vuelven a verificar plan, CI, estado abierto del PR, main/head y la revisión del entorno de esa ejecución. Un nuevo commit, avance de main, check fallido/pendiente, cancelación, rechazo o reintento de un run anterior impide success. Para reintentar, iniciar un **nuevo dispatch** y revisión; no reutilizar una aprobación anterior. Concurrency cancela solicitudes anteriores del mismo PR. Un fallo de API no autoriza cambios.

El check certifica autorización de una renovación de código, no funcionamiento en producción. Las evidencias de los flujos afectados deben volver a comprobarse de forma real y no destructiva antes de atribuirles un PASS actualizado. No fabricar pedidos, pagos, emails, sellos ni resultados verdes.

## Verificación local

```text
node --test tests/flow-connections/proteccion-flujos.test.mjs tests/flow-connections/mantenimiento-flujos.test.mjs
node scripts/auditar-proteccion-flujos.mjs
```

Las pruebas incluyen rechazo de hashes inventados, cambios fuera del plan, retiro de protección, alteración de alcance/sellos/control, aprobación ausente o ajena, bots, bypass, checks falsos/pendientes/fallidos y cambios de main/head. La aprobación real y el dispatch deben verificarse después de instalar el workflow; las pruebas locales no se presentan como una aprobación de GitHub.
