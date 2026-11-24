# Validación y publicación automáticas

Desde la migración autorizada por el titular el 2026-10-18, los PR propios de tintinaccs se validan y publican automáticamente al completar CI. No se solicita aprobación del entorno protected-flow-maintenance ni dispatch manual por cada cambio. El entorno anterior puede conservarse sin cambios: el workflow nuevo no lo utiliza.

## Flujo habitual

1. Preparar un PR y las pruebas. Para modificar archivos protegidos, actualizar contra main y generar el plan exacto con el helper canónico:

```text
node scripts/preparar-mantenimiento-flujos.mjs SHA_COMPLETO_DE_MAIN "Motivo concreto y pruebas relevantes" ruta/protegida1.js ruta/protegida2.js
```

2. Regenerar los artefactos relacionados y publicar el commit. Repository audit sigue ejecutando la suite completa; CodeQL y Cloudflare Pages siguen siendo obligatorios.
3. Al terminar Repository audit, workflow_run ejecuta únicamente código confiable de main. El PR candidato se lee como datos: no se ejecutan scripts, dependencias ni comandos del PR con permisos de escritura.
4. Se comprueban autor autorizado, repositorio propio, PR abierto sin borrador, main/base/head vigentes, plan, hashes reales, alcances y todos los checks obligatorios con su aplicación/workflow/evento correctos. Las evidencias históricas no se renuevan.
5. Los checks Protected flow maintenance y Protected flow integrity pasan únicamente después de esa validación técnica. GitHub integra por squash con el SHA esperado y sus reglas de rama vigentes. Un rechazo del merge no se elude.
6. Cloudflare publica main mediante su integración existente. Como un push de GITHUB_TOKEN no dispara Actions, se inician explícitamente la auditoría de main y el monitor de producción. El monitor verifica el artefacto publicado y los flujos reales; iniciar el monitor no equivale a PASS_PRODUCTION.

Un CI pendiente se espera hasta el plazo configurado; un fallo, API denegada, archivo fuera del plan o avance de main/head bloquea la integración. Corregir y subir otro commit inicia un nuevo ciclo. Reintentar Repository audit también dispara la validación mediante workflow_run. Eventos antiguos sin PR abierto vigente se ignoran.

## Activación inicial, una sola vez

Esta migración cambia el propio mecanismo de control y no puede autorizarse a sí misma con el workflow anterior. El titular ya autorizó este cambio expresamente en la conversación. El acceso de esta sesión no permite editar la protección de rama.

Después de verificar Repository audit, ambos Analyze y Cloudflare Pages del PR de migración:

1. En Settings → Branches → regla de main, retirar temporalmente sólo el requisito Protected flow maintenance. Conservar los otros cuatro checks obligatorios y las demás protecciones.
2. Integrar el PR de migración desde GitHub. Volver a añadir inmediatamente Protected flow maintenance, de GitHub Actions, como obligatorio. No retirar Repository audit, ambos Analyze ni Cloudflare Pages. Si la rama exige revisiones humanas por PR, desactivar únicamente ese requisito para el flujo rutinario automático solicitado por el titular; conservar los checks y la restricción a main actualizado.
3. Actualizar los PR anteriores contra el nuevo main y regenerar sus planes. Confirmar una ejecución real de validación, merge y monitor de producción antes de declarar el mecanismo activado.

No hace falta desactivar Required reviewers en el entorno antiguo: ya no participa. No se agregan credenciales ni servicios externos. No se ocultan ni borran ejecuciones fallidas históricas.

## Cambios al mecanismo

La configuración confiable de main habilita automaticControlMaintenance para los PR del titular. También los workflows y scripts de control requieren plan exacto, hashes reales, todos los checks y SHA vigente; no requieren una aprobación manual adicional. El helper consulta esa autorización desde el commit base, nunca desde el candidato. Una rama candidata no puede habilitarse a sí misma cambiando el flag: hasta que esa política esté instalada en main, el cambio inicial sigue siendo una migración administrativa. Las modificaciones de protección en la configuración de GitHub siguen requiriendo acceso administrativo; el token del workflow no recibe ese permiso.

## Verificación

```text
node --test tests/flow-connections/proteccion-flujos.test.mjs tests/flow-connections/mantenimiento-flujos.test.mjs tests/flow-connections/presupuesto-mantenimiento.test.mjs tests/flow-connections/lectura-blobs-mantenimiento.test.mjs
node scripts/auditar-proteccion-flujos.mjs
```

Las pruebas locales incluyen plan exacto, retiro de protección/alcances/sellos, autores/forks no autorizados, CI falso/pendiente/fallido, cambios de main/head, API denegada, espera y éxito posterior, merge con SHA exacto y dispatch explícito de las comprobaciones posteriores. Los fixtures interceptan toda la API y no fusionan ni despliegan repositorios reales.


## Alcance del estado global de un commit

El controlador automático activado por workflow_run ejecuta main confiable para validar el SHA de un PR. Su job no es una prueba del artefacto de main. El Diagnóstico Maestro conserva esa ejecución y sus checks de job como evidencia fuera del cómputo del commit únicamente cuando comprueba workflow, evento, rama, repositorio y SHA. Cada check de job exige además app GitHub Actions, URL del repositorio y el mismo ID de check suite de la ejecución. Los checks personalizados de protección se evalúan sobre el candidato y siguen bloqueando. Los runs programados/manuales de dependencias permanecen dentro del cómputo. Ante metadata o enlaces insuficientes no se descarta el error.

Al repetir Maestro, los runs anteriores de ese mismo workflow no son dependencias del actual: su gate final sigue exigiendo todas las suites nuevas. Esta distinción evita una dependencia circular; no permite presentar como aprobadas las pruebas pendientes o fallidas del candidato. Los contratos de alcance forman parte de tests/operations y del CI canónico.
