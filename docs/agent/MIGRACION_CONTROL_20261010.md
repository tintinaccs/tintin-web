# Reparación revisada del control de publicación

PR: https://github.com/tintinaccs/tintin-web/pull/1081
Base de preparación: ec63adce6551cb6210c20fdcea21c4f3447f2896.

## Problema y resultado

El programa descargaba por GitHub API cada uno de los541 archivos protegidos en inspect y nuevamente en publish. Las dos fases superan1000 solicitudes sólo en blobs, incluso para archivos idénticos al checkout confiable de main. Un403 real no tenía endpoint ni cabeceras; no se atribuye cada rechazo real al presupuesto sin esa evidencia.

El lector reutiliza los bytes de main únicamente cuando objeto Git y modo coinciden exactamente; descarga y verifica los cambios. Los errores ahora informan endpoint, recurso/límite/restante/reset y retry-after si GitHub los devuelve. No incluye credenciales ni cuerpos de respuesta. El propio lector queda clasificado como mecanismo de control, por lo que su alteración requiere migración separada.

## Validación reproducible

`node --test tests/flow-connections/lectura-blobs-mantenimiento.test.mjs tests/flow-connections/mantenimiento-flujos.test.mjs tests/flow-connections/proteccion-flujos.test.mjs tests/flow-connections/presupuesto-mantenimiento.test.mjs`

55 pruebas específicas PASS y suite completa de conexiones134 PASS. La integración ejecuta los programas reales inspect y publish en un repositorio temporal aislado, con541 archivos y API simulada que rechaza solicitudes después de1000. Ambas fases pasan con30 solicitudes/seis blobs remotos. Una reproducción local de la versión anterior pasó inspect y falló publish conHTTP403 al superar1000 (1008 solicitudes). Es una reproducción del defecto de consumo, no un diagnóstico confirmado del403 remoto ni una aprobación de GitHub.

El programa corregido también verificó el PR1083 real contra su base/HEAD mediante API nativa, en modo inspect de solo lectura:98 consultas,87 blobs y cero escrituras. Validó plan, CI y entorno; no verifica el token de Actions ni sustituye la revisión real. Build Pages local PASS.

Se mantienen validaciones adversariales de hashes, rutas/symlinks, fallos de lectura/descarga, plan exacto, alcances/sellos, identidad de CI, base/head, entorno sin bypass y revisor humano autorizado. El inventario conserva sus78 registros y541 entradas anteriores; agrega tres archivos verificados, total544. Build reproducible y CI requieren evidencia del SHA final de este PR.

## Integración y continuación

El mecanismo ordinario rechaza cambios a su propio control. Según MANTENIMIENTO_FLUJOS.md: «Cambiar los auditores, revisores o workflows requiere otra migración revisada; el mantenimiento ordinario rechaza esos cambios». Por eso esta reparación se mantiene en un PR separado, para revisión explícita del propietario. No se cambian permisos, reglas de rama, workflows ni revisores, ni se usa bypass administrativo o un check ficticio.

1. Verificar CI del SHA final y revisar la reparación del propio control en PR1081.
2. Completar la migración administrativa revisada del mecanismo según las reglas del repositorio; un dispatch ordinario no puede autorizar este PR.
3. Confirmar main resultante y actualizar PR1083 contra esa base. Recalcular su plan oficial, manifiesto y CI del nuevo SHA.
4. Despachar mantenimiento de PR1083 desde main; comprobar inspect y aprobación real del propietario. Si hay otro403, leer endpoint y cabeceras antes de decidir la corrección o el intervalo.
5. Confirmar merge y huella del artefacto Pages; publicar Firestore mediante su workflow oficial desde main y verificar el resultado.

No crear usuarios, pedidos, pagos ni emails de prueba en producción. No heredar aprobaciones o resultados de SHA anteriores.
