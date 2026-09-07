# Pruebas de recuperación de roles

Ejecutar `node --test tests/accounts/admin-role-recovery.test.mjs` desde la raíz del repositorio. El test ejecuta el módulo de roles con dependencias simuladas para comprobar la identidad del SuperAdmin, la lectura de roles, la ausencia de sesión y la propagación de errores de autorización. No crea usuarios, modifica Firestore ni utiliza credenciales reales.

Estas pruebas no sustituyen una validación autenticada del navegador, Firebase App Check, reglas publicadas o datos de producción. El pipeline específico ejecuta estas pruebas al abrir un PR contra main. El resto de la suite y los criterios de recuperación documentados deben verificarse antes de integrar.
