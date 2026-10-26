# Conciliación de pendientes históricos — 26/10/2026

Codex /root, base main `ed574b1c54874a30bd6aa988ebd820dd2d4a3c4e`.
La titular autoriza depurar pendientes sin que código antiguo reemplace la versión
actual. La rama nueva parte de esa base; no se integra ninguna rama antigua.

## Actions

Se verificaron SHA, antigüedad, estado queued/waiting y ausencia de PR abiertas
antes de cancelar. Los ocho runs terminaron completed/cancelled:
31119870150, 31119870144, 31119870149, 31119870023, 31119870105, 31119870128
(06/08), 28657073267 (03/07), 38983102099 (16/10). Los últimos controles de main
permanecieron verdes. Recibos antes/después en artifacts/seguimiento-pendientes-20261026.

## Issues

| Issue | Clasificación y tratamiento |
| --- | --- |
| #803 | Migración histórica no aplicable como instrucción actual. Cuatro contratos de arquitectura, 38 tests y auditoría modular de 31 archivos pasan en la base actual. Se cierra como not_planned para reactivar esa migración; no se certifican todos sus objetivos aspiracionales ni se afirma que su rama se haya integrado. |
| #374 | Activación IA no aplicable: PR370 cerrado sin merge y módulo/contrato/documento ausentes del runtime. Se cierra not_planned; no se conceden roles ni se cargan secretos para una propuesta cerrada. |
| #735 | Perfil: parte del informe antiguo ya superada (identidad canónica, cleanup de favoritos, controlador de pedidos). Sí se reproduce liberación anticipada de reservas, doble guardado y respuesta tardía sobre otra cuenta. Se corrigen desde main; la aceptación con una cuenta real sigue NOT_VERIFIED. |
| #372 | PayPal ya implementado. Lectura pública nueva: sandbox, USD, enabled=false, feature_disabled, tasa BCP del 23/10 actualizada20:12:05.662Z. Continúa seguimiento de aceptación/configuración del proveedor y decisión de activación; no se deduce ausencia de secretos de un clientId oculto. |
| #373 | Push ya implementado en main. Config protegida por SuperAdmin: entrega real, opt-in/revocación y dispositivos NOT_VERIFIED. Seguimiento operativo vigente, sin portar351/320. |
| #312 | Seguridad/recuperación: backup Firestore40312057311 del26/10 SUCCESS; restauración960/960 documentada históricamente, no repetida hoy. Continúan revisión periódica, independencia/cifrado de copias y controles de cuentas/proveedores. |
| #340 | Índice maestro actualizado; preserva cuerpo antiguo como historial. Origen actual tintinaccs.com, CI y producción de1245 aprobadas. No confundir sus viejas casillas de cutover/backup con el estado vigente. |

Los cuerpos originales se preservan en detalles desplegables de cada issue.
Cerrar migraciones históricas no elimina ramas ni decide funciones futuras:
cualquier implementación nueva debe partir de main y tener alcance propio.

## Reparación de Perfil

El handler real de perfil.html valida todo antes de reservar. Usa las funciones
canónicas reserve/release existentes y conserva ambas reservas anteriores hasta
confirmación de setDoc. Rules y módulos de reserva no se modifican. Si falla la
persistencia, la identidad anterior permanece reservada; una reserva nueva del
mismo UID puede reutilizarse al reintentar según el contrato existente.

El guardado controla su bloqueo durante la promesa real; mantenimiento-perfil
deja de desbloquear ese botón a1800ms. El UID y generación se comprueban tras
cada await antes de continuar o modificar UI. No se alteran los campos, diseño,
restricciones de username ni otros flujos de cuenta.

RED: cinco regresiones ejecutadas contra el handler anterior fallaron. GREEN:
13 pruebas dirigidas (incluye seis regresiones nuevas y siete existentes).
Revalidación de dominios:332 casos aprobaron inicialmente; dos casos de navegador
fallaron por Chromium no instalado en la ruta predeterminada y luego pasaron2/2
con /usr/bin/chromium, sin cambiar sus aserciones. Las34 pruebas Chromium de
render inicial, cambio de cuenta, estados de error y direcciones aprobaron sin
reintentos. También72/72 cuentas,79/79 Auth y el auditor de alta/perfil aprobaron. Preflight y build/caché PASS_LOCAL. CI del nuevo SHA, merge protegido
y comprobación posterior se registran en la PR antes de declarar cierre.

Sólo dos fuentes funcionales: perfil.html y mantenimiento-perfil.js. El resto
son referencias transitivas inmutables, constructor del shell, CSP, caché,
diagnóstico, versión de sitio, plan protegido y evidencia. La protección se
calcula después del build final y se comprueba de nuevo sin modificar fuentes.

No se hacen compras, cambios de cuentas reales, envíos Push/correos ni activación
de flags externos. Las pruebas aisladas no certifican aceptación con datos reales.
