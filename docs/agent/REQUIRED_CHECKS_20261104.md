# Controles de integridad exigibles antes del merge

Estado: **PROPUESTO; configuración administrativa no aplicada**. Observado el2026-11-04 por Codex /root con el conector autorizado de tintinaccs.

## Evidencia

`GET /branches/main` informa protección clásica para todos (`enforcement_level: everyone`) con cuatro checks: Repository audit (GitHub Actions15368), Analyze (actions) (15368), Analyze (javascript-typescript) (15368) y Cloudflare Pages: tintinaccesorios (85455). El ruleset activo18212422 conserva PR, historia lineal y prohibición de borrado/force-push; su lista no añade checks. No se debe confundir ese ruleset con la protección clásica, que sí exige los cuatro anteriores.

Tras #1329, main2259eebc falló Protected flows41849333792/1 por cuatro hashes; #1330 lo corrigió y su post-merge41883112664/1 terminó SUCCESS. Tras #1331, main48925999 volvió a fallar Protected flows41901338196/1 por tres hashes; los grupos funcionales/Repository audit aprobaron. En PR ese job sólo aplica a push/workflow_dispatch: el control previo equivalente lo publica el mantenedor confiable después de leer candidato/plan/base y exigir CI.

Tras #1332, main0c950893 vuelve a fallar Protected flows41917190470/1 por25huellas; las seis etapas funcionales y Repository audit aprobaron. Es la misma brecha de pre-merge, con más rutas afectadas.

## Cambio administrativo concreto

En [Settings → Branches](https://github.com/tintinaccs/tintin-web/settings/branches), editar la regla clásica existente de `main`, conservar sus cuatro checks y agregar estos dos, con fuente **GitHub Actions** (app15368):

- `Protected flow maintenance`
- `Protected flow integrity`

Conservar las demás opciones actuales de la regla, incluida su aplicación a todos, y el ruleset18212422. Esta propuesta agrega controles; no sustituye ni relaja los existentes. No crear una regla paralela ni habilitar bypass.

El workflow confiable `auditoria-dependencias.yml` ejecuta `mantenimiento-flujos-github.mjs`: lee código candidato como blobs, valida hashes/plan/base, espera la CI exacta y publica ambos checks antes del merge protegido. Los publica también para cambios sin mantenimiento; si el candidato es inválido y faltan los checks, la protección debe bloquear el merge. Su lista interna de CI no depende de estos dos checks, por lo que exigirlos no introduce una espera circular.

## Aplicación y comprobación

Esta sesión no dispone de administración mediante el conector GitHub ni de herramientas de navegador para editarla; no se cambiaron credenciales. La modificación debe realizarla una persona con permisos de administración de la regla. Después, comprobar que `GET /branches/main` muestra los seis checks con sus fuentes y que una PR vigente exige los dos nuevos antes de integrar. No crear una PR deliberadamente dañina ni modificar producción para probar. El estado sigue PROPUESTO hasta verificar esa configuración remota.
