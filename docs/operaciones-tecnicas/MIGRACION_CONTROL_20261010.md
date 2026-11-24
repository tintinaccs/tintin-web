# Reparación revisada del control de publicación

PR: https://github.com/tintinaccs/tintin-web/pull/1081
Base de preparación actual:0ccf1b889459f890154382f2b731b78b2cb7d94b. PR1083 ya se integró por su auto-merge durante la ventana administrativa; se conservan todos sus cambios y se requiere CI nuevo para esta reparación. Los resultados anteriores55/134/126/187 pertenecen al candidato8fd contra119 y no se atribuyen automáticamente al nuevo SHA.

## Problema y resultado

El programa descargaba por GitHub API cada uno de los541 archivos protegidos en inspect y nuevamente en publish. Las dos fases superan1000 solicitudes sólo en blobs, incluso para archivos idénticos al checkout confiable de main. Un403 real no tenía endpoint ni cabeceras; no se atribuye cada rechazo real al presupuesto sin esa evidencia.

El lector reutiliza los bytes de main únicamente cuando objeto Git y modo coinciden exactamente; descarga y verifica los cambios. Los errores ahora informan endpoint, recurso/límite/restante/reset y retry-after si GitHub los devuelve. No incluye credenciales ni cuerpos de respuesta. El propio lector queda clasificado como mecanismo de control, por lo que su alteración requiere migración separada.

## Validación reproducible

`node --test tests/flow-connections/lectura-blobs-mantenimiento.test.mjs tests/flow-connections/mantenimiento-flujos.test.mjs tests/flow-connections/proteccion-flujos.test.mjs tests/flow-connections/presupuesto-mantenimiento.test.mjs`

En la integración actual contra0ccf:55 pruebas específicas PASS y suite completa de conexiones127 PASS, build Pages/manifiesto/caché e inventario78/544 PASS. El resultado134 del candidato anterior no se hereda; el CI del nuevo SHA está pendiente. La integración ejecuta los programas reales inspect y publish en un repositorio temporal aislado, con541 archivos y API simulada que rechaza solicitudes después de1000. Ambas fases pasan con30 solicitudes/seis blobs remotos. Una reproducción local de la versión anterior pasó inspect y falló publish conHTTP403 al superar1000 (1008 solicitudes). Es una reproducción del defecto de consumo, no un diagnóstico confirmado del403 remoto ni una aprobación de GitHub.

El candidato anterior9b7f282d también verificó el PR1083 real contra baseec63/HEAD7961cff mediante API nativa, en modo inspect de solo lectura:98 consultas,87 blobs y cero escrituras. Validó plan, CI y entorno; no verifica el token de Actions ni sustituye la revisión real. Build Pages del candidato anterior local PASS; la nueva base requiere build y CI propios.

Se mantienen validaciones adversariales de hashes, rutas/symlinks, fallos de lectura/descarga, plan exacto, alcances/sellos, identidad de CI, base/head, entorno sin bypass y revisor humano autorizado. El inventario conserva sus78 registros y541 entradas anteriores; agrega tres archivos verificados, total544. Build reproducible y CI requieren evidencia del SHA final de este PR.

## Integración y continuación

El mecanismo ordinario rechaza cambios a su propio control. Según MANTENIMIENTO_FLUJOS.md: «Cambiar los auditores, revisores o workflows requiere otra migración revisada; el mantenimiento ordinario rechaza esos cambios». Por eso esta reparación se mantiene en un PR separado, para revisión explícita del propietario. No se cambian permisos, reglas de rama, workflows ni revisores, ni se usa bypass administrativo o un check ficticio.

1. Verificar CI del SHA final y revisar la reparación del propio control en PR1081.
2. Completar la migración administrativa revisada del mecanismo según las reglas del repositorio; un dispatch ordinario no puede autorizar este PR.
3. Confirmar el main resultante y que todos los requisitos, incluido Protected flow maintenance, estén restablecidos. PR1083 ya está en main y su artefacto se verificó; no inventar un dispatch o aprobación retroactivos.
4. Verificar el mecanismo instalado mediante un próximo PR legítimo desde main, con inspect y aprobación real del propietario si necesita renovar archivos protegidos. Si hay otro403, leer endpoint y cabeceras antes de decidir la corrección o el intervalo. No fabricar un cambio de código o un check para demostrar un PASS.
5. Confirmar merge y huella del artefacto Pages; publicar Firestore mediante su workflow oficial desde main y verificar el resultado.

No crear usuarios, pedidos, pagos ni emails de prueba en producción. No heredar aprobaciones o resultados de SHA anteriores.
