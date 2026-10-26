# Conciliación del informe aportado y los avances — 26/10/2026

Verificación nueva de GitHub, sin reactivar ramas ni ejecuciones antiguas.
Este documento distingue integración comprobada de aceptación operativa pendiente.

| Trabajo | Estado comprobado | Acción correspondiente |
| --- | --- | --- |
| Fases0–3 / #1241 | Integradas, main46a1e9ba2 | Conservar; las regresiones actuales verifican los consumidores afectados |
| Continuación funcional Fase6 / #1244 | MERGED8e9225038; CI40354102927, mantenimiento40357012620 y monitor40357109191 aprobados | Conservar; nuevo rediseño responde al pedido visual posterior |
| #1228 | Cerrada como superada | No fusionar su rama antigua |
| Dependabot#1231/#1242 | Cerradas; dependencias conciliadas por#1243 /5dc6f781 | Conservar lock vigente; no reabrir los PR antiguos |
| Footer y lectura de checkout / #1245 | Integradaed574b1c5; CI40370397017 y monitor40370400656 SUCCESS | Incorporada a la base del rediseño; sus archivos comerciales quedan fuera del cambio visual |
| Perfil / #735 y PR#1246 | MERGED e78a9de2fef629bb353cac27b394d288867f9d53; CI40376208312, CodeQL y mantenimiento40380440513 aprobados | Incorporada a la base antes de publicar el rediseño; preservar reservas y bloqueo de guardado. Monitor posterior40380534105 también SUCCESS |
| Arquitectura / #803 | CLOSED; cuerpo actualizado a contratos vigentes | Seguimiento histórico retirado; no migración antigua |
| Desarrollador IA / #374 | CLOSED; propuesta#370 cerrada sin integrar, ausente del runtime según revisión publicada | No cargar secretos ni reactivar una propuesta retirada |
| PayPal / #372 | OPEN; implementación actual documentada en main, informe reciente registra sandbox deshabilitado | Sigue la aceptación/configuración externa; no activar live ni tocar pagos como parte del editor |
| Push / #373 | OPEN; backend/UI existentes; aceptación real pendiente | Validar configuración y entrega desde sesión autorizada, fuera de esta prueba aislada |
| Backups / #312 | OPEN; run40312057311 consultada de nuevo:SUCCESS | Conservar respaldo, revalidar restauración periódica y recuperación externa; un workflow verde no prueba restauración actual |
| Maestro / #340 | OPEN; índice conciliado con pendientes concretos | Mantener seguimiento de aceptaciones externas sin reutilizar checklists antiguos como código a integrar |

Se verificaron individualmente las ocho ejecuciones citadas:31119870150,
31119870144,31119870149,31119870023,31119870105,31119870128,28657073267,
38983102099. Las ocho están COMPLETED/CANCELLED. No se reiniciaron.
Recibo compacto en `evidencias/rediseno-visual/ejecuciones-historicas.json`.

Límite nuevo: la lectura directa de `/api/paypal-config` desde este entorno devolvió
HTTP403. No se transforma esa respuesta en una confirmación actual del flag, ni se
contradice la lectura anterior registrada en#372. Push y accesos de recuperación
no se probaron con una cuenta real. No se cierran esos pendientes por inferencia.

La integración del rediseño sólo puede avanzar con la base más reciente y sus
gates protegidos. Perfil se integró durante esta revisión: se incorpora main y se regenera
el plan, preservando su código. El estado vivo de esa PR prevalece sobre esta
fotografía temporal del seguimiento.
