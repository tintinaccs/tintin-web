# Incidencias pendientes y condiciones de publicación

Los resultados locales concretos están en MATRIZ-PRUEBAS-FINAL.md. Esta lista no
convierte ausencia de evidencia en un defecto confirmado de producción.

| ID / clasificación | Estado | Evidencia, impacto y siguiente paso |
| --- | --- | --- | --- |
| CONT-01 MEDIUM | NOT_VERIFIED | La carpeta y los cambios originales del adjunto no aparecen en las 701 referencias remotas ni el historial accesible. Se reconstruye la continuidad disponible. Si aparece el entorno de origen, comparar ese diff con esta rama antes de incorporarlo; no sobrescribirlo. |
| REL-01 HIGH, condición de release | NO EJECUTADA | CI remota del candidato, merge y despliegue no autorizados. La rama local no certifica el artefacto publicado. Revisar el diff, autorizar la publicación de un candidato sin auto-merge y exigir todos los gates de su SHA. |
| EXT-01 HIGH, aceptación externa | NO EJECUTADA | Sesión administrativa autenticada contra staging, subidas reales de Cloudinary y confirmación real de Sheets. Los fixtures ejecutan los componentes reales con proveedor/identidad/almacén sintéticos; emulador verifica REST/CAS y Rules locales. Validar con recursos de staging autorizados antes de uso productivo sin reservas. |
| DEV-01 MEDIUM | NO EJECUTADA | iOS/Safari físico, teclado virtual real, lector de pantalla, safe areas no nulas y zoom nativo del navegador. Chromium/táctil emulado, viewport reducido y reflujo equivalente no certifican esos dispositivos. Completar matriz física y accesibilidad en staging. |
| MEDIA-01 MEDIUM, compatibilidad existente | LÍMITE CONSERVADO | Galería histórica con más de 13 fotos únicas bloquea guardar hasta revisarla; no se trunca. El límite era anterior y sigue explícito. Revisar ejemplos de staging antes de cambiar capacidad; no reducir datos automáticamente. |
| PERF-01 LOW | MEDICIÓN ACOTADA | La comparación de galería mide eventos sintéticos y reemplazos de tarjetas. No certifica velocidad con red real ni ausencia de fugas de heap a largo plazo. Perfil de sesión de staging pendiente si se reproduce lentitud. |
| PAY-1228 HIGH, alcance separado | NO MODIFICADA | #1228 contiene cambios de captura/notificaciones PayPal y UI de checkout además del editor. La instrucción actual los excluye. La rama original sigue pendiente; revisar ese delta en otra incidencia, sin importarlo ni afirmar que su problema está reproducido en producción. |

No se ejecutan pagos reales, correos, compras, pedidos productivos, escrituras de
catálogo real, migraciones, cambios de DNS, deploy de Rules ni operaciones de
borrado físico. La futura aprobación debe corresponder al candidato revisado,
no a checks históricos de #1228 o #1241.
