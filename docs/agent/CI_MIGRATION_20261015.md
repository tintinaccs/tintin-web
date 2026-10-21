# Corrección de Actions — PR1134

Se integra main9055392f sin revertir las mejoras de carga, footer y tarjetas. La ejecución38761597067 falló en Reject generated artifact drift: el PR original modificaba workflows sin regenerar el manifiesto. Se regeneran los derivados con build:pages para el candidato actualizado.

Los cambios mantienen CI separado del código funcional: validación de reglas antes de publicar, checkout del SHA exacto, permiso OIDC acotado al despliegue y Chromium instalado antes del diagnóstico de comercio. No se publican reglas ni se ejecuta un despliegue desde esta preparación.

El check Protected flow maintenance rechazó el original con «Cambios al mecanismo de control requieren una migración separada». scripts/mantenimiento-flujos-core.mjs clasifica todos los workflows como control y scripts/preparar-mantenimiento-flujos.mjs rechaza esas rutas. Este PR requiere la migración administrativa revisada por el propietario descrita en MANTENIMIENTO_FLUJOS.md; el dispatch ordinario y la aprobación de un entorno no la sustituyen. Se conservan los hashes protegidos y los controles existentes, sin checks ficticios ni bypass.

CI del nuevo SHA pendiente; no heredar aprobaciones de las ejecuciones anteriores.
