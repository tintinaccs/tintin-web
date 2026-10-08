# Protección contra cambios que afecten flujos verificados

`config/proteccion-flujos.json` bloquea la publicación de modificaciones y eliminaciones de los archivos protegidos. No es sólo una lista de evidencia: incluye las superficies ejecutables existentes que pueden alterar los nodos verdes (páginas, JavaScript, CSS, Functions, código de Cloudflare y Apps Script), configuración de rutas/CSP/Firebase, dependencias npm, generadores de compilación y workflows de publicación.

La ampliación conserva las 131 huellas y los 78 alcances vigentes en main `7c8372b` sin renovar sellos ni editar código operativo. Se agregan huellas reales de sus superficies y dependencias locales. El auditor obligatorio se ejecuta desde la base confiable del PR: editar o borrar la política candidata no elimina la protección de la base.

Un agente puede preparar modificaciones en una rama o copia local; no puede publicarlas sobre main mientras fallen los checks obligatorios. Las modificaciones legítimas deben seguir `docs/agent/MANTENIMIENTO_FLUJOS.md`, con plan exacto, CI y revisión del propietario. El agente no debe aprobar por el propietario ni retirar requisitos para resolver un PR.

Este bloqueo no administra los permisos externos de Google Apps Script, Firestore, Cloudflare o PayPal. Tampoco concede una certificación nueva a archivos o rutas futuras: agregar superficies ejecutables requiere revisar su impacto. Los datos comerciales continúan cambiando por las operaciones autorizadas del sistema. No se ocultan errores reales ni se fija artificialmente el color verde.
