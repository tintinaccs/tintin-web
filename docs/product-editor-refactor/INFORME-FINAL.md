> Actualización26/10/2026: la entrega funcional de este informe se integró en#1244.
> El rediseño visual solicitado después y la comparación con avances generales
> se documentan en08-REDISENO-VISUAL.md y09-CONCILIACION-AVANCES-GENERALES.md.
> Las cifras siguientes pertenecen a su ejecución fechada, no se heredan al nuevo candidato.

# Informe final — Editor Tintin, Fase 6

**Aceptación local con pendientes externos. Integración protegida autorizada por la titular.**

Actualización posterior a la entrega local: la titular solicitó terminar y hacer
merge. Ver07-INTEGRACION-AUTORIZADA.md. Las frases de sólo entrega local siguientes
describen la situación anterior; el estado final de CI/merge se consulta en el PR.
Base `5dc6f781a81e0ae0dd07d84b0c742ec3d567e133`, rama local `codex/editor-fase6-integracion-20261026`.

Se reconstruyó la continuidad del adjunto sobre main y se concilió la funcionalidad
de editor/presentación de#1228. Cancelar confirma cambios incluso autoguardados;
Guardar cambios conserva borradores incompletos y publicar exige elegir Activo.
Se conserva retiro/restauración con identidad, stock, precios y fotos; se corrige
la pérdida de cantidades pendientes al quitar una opción nueva V1. La galería
conserva sus tarjetas cuando sus datos no cambian. Listado, mensajes y diálogos
se ajustan sin otra autoridad de datos ni dependencias nuevas.

Validación con npm ci y lock intacto:610 pruebas Node;21 controles de privacidad,
233 de Rules y15 integraciones Firestore;24 recorridos de tarjetas; matriz amplia
423/428 con5 fallos de fixture resueltos y repetidos en10 tamaños;64 regresiones
finales aprobadas después del guard de cantidades. Son **454 casos distintos de
navegador con última ejecución aprobada**, no una única corrida de ese tamaño.
El perfil aislado reduce500 reemplazos de tarjetas a0; mediana descriptiva62→39ms
en cinco muestras. Build/caché y39 comandos preflight aprobados; recibos y límites
en la matriz. No se cuentan como PASS las corridas con dependencias iniciales.

No se modifican fuentes de checkout/pagos, Rules, contratos de pedidos/reservas,
package/lock ni datos reales. El backend de compra se ejecuta como consumidor en
emulador. Las actualizaciones de referencias de caché en HTML son metadatos de
integridad. #1228 completo sigue separado: sus cambios de PayPal/checkout no se
importan ni se marca su PR integrado. No hubo push, PR nuevo, merge ni deploy.

Faltan CI del candidato, flujo autenticado/proveedores reales en staging y
validación física de Safari/iOS, teclado, lector, safe areas y zoom nativo. La
carpeta original del adjunto no se recuperó tras buscar701 cabezas remotas y
chats accesibles; se documenta la reconstrucción y no se inventan sus archivos.
No se afirma que el proyecto esté completamente terminado.

Antes de publicar: revisar este diff y compatibilidad, completar staging y matriz
física; autorizar expresamente un candidato de publicación y ejecutar CI de su
SHA sin permitir que el mantenimiento automático se adelante a esa decisión.
Conservar permisos, CAS y validaciones; hacer una verificación posterior del
artefacto aprobado. No realizar compras ni escrituras productivas como QA.

- [Auditoría y hallazgos](06-AUDITORIA-FINAL.md).
- [Matriz completa y evidencia](MATRIZ-PRUEBAS-FINAL.md).
- [Cambios y compatibilidad](CAMBIOS-Y-COMPATIBILIDAD.md).
- [Pendientes y próximos pasos](INCIDENCIAS-PENDIENTES.md).
- [Rendimiento reproducible](RENDIMIENTO.md).
