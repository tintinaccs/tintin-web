# Informe final — Editor Tintin, Fase 6

Actualización verificada el 27/10/2026: CI, merge protegido y publicación ya
aprobados. La versión de aplicación consultada es `65ee34250b20738591ec65cc097ee4e8bd452486`
(PR #1262), que conserva la única versión de seis fases y sus continuaciones.
Recibos por SHA y separación entre publicación y aceptación autenticada:
[CIERRE-VERIFICADO-20261027.md](CIERRE-VERIFICADO-20261027.md). Los resultados anteriores que siguen abajo son evidencia
fechada de su ejecución, no nuevas aprobaciones del código actual.

**Integración protegida y publicación aprobadas; aceptación autenticada todavía abierta.**

Estado comprobado: main65ee3425 (#1262). CI de main40560324289 y monitor40560326995
SUCCESS. #1252 está mergeada en33af11a5, con CI40421504536, CI posterior40424020632
y producción40424022740 aprobados. El recibo contiene SHA completos y resultados
por intento. Las continuaciones del editor están conservadas, sin otro diseño.

La comprobación de acceso encontró «Tintin Super Admin» sin sesión registrada.
Se solicitó confirmación/login; aún no se creó producto de QA, subió imagen real
ni leyó su fila de Sheets. EXT-01 sigue BLOQUEADA. La operación global de Sheets
aprobada no equivale a aceptación por producto. Hardware físico y medición de red
real siguen no ejecutados. No afirmar aceptación total del proyecto.

## Evidencia histórica de la auditoría funcional

Las cifras siguientes corresponden a la ejecución local de Fase6 sobre5dc6f781,
no a una nueva corrida ni a los proveedores reales del estado actual.

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
importan ni se marca su PR integrado. En aquella ejecución local aún no había publicación; ese estado fue superado
por los merges y recibos remotos enlazados al inicio.

CI, merge y publicación de esas entregas ya se completaron. La aceptación real
requiere confirmar la sesión y ejecutar la matriz de QA autorizada, sin compras,
pedidos, pagos ni modificación de productos comerciales. Las evidencias locales
y emuladas conservan su alcance y no se convierten en pruebas autenticadas.

- [Auditoría y hallazgos](06-AUDITORIA-FINAL.md).
- [Matriz completa y evidencia](MATRIZ-PRUEBAS-FINAL.md).
- [Cambios y compatibilidad](CAMBIOS-Y-COMPATIBILIDAD.md).
- [Pendientes y próximos pasos](INCIDENCIAS-PENDIENTES.md).
- [Rendimiento reproducible](RENDIMIENTO.md).
