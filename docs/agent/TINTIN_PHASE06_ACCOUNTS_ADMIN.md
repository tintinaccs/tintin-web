# Fase06 — Clientes, administración y notificaciones

2026-11-02. Codex /root. Base001c4218 (#1313), rama codex/phase06-accounts-admin. Alcance solicitado: revisión funcional de cuentas, backoffice y actividad real. No acredita cierre de seguridad03A ni de verificaciones externas anteriores.

## Autoridades y revisión

Firebase Auth/coordinador-sesion identifican la cuenta; users/{uid}, contrato-cuentas y guard de perfil determinan estado y datos. Perfil, direcciones, favoritos y preferencias conservan sus escritores existentes y listeners por UID. Pedidos se consultan desde orders mediante el índice y detalle paginado del perfil. No se modifica registro, OTP, recuperación, bloqueo ni sesión para corregir presentación.

Pedidos confirmados y cambios comerciales reales → notificaciones-pedido → notificaciones-sociales → users/{uid}/notifications. La identidad del evento es determinista; notas internas y reenvíos no inventan un cambio comercial. El cliente escucha su colección privada; sólo Super Admin escucha adminNotifications. API de lectura usa UID autenticado y CAS, nunca el UID del payload. Rules permiten consultas privadas con límite máximo100 y niegan escrituras directas del cliente. Lectura voluntaria, título/cuerpo/fecha/icono/contexto y enlaces existentes se conservan; abrir el panel no marca eventos como leídos. No se crean eventos ni mensajes para ensayar.

Roles efectivos: superadmin, admin, agent, viewer, client; los nombres de UI no crean roles nuevos. roles.js define defaults; rolePermissions/main y validadores del servidor/Rules determinan acciones. Admin opera catálogo/contenido/pedidos sin heredar cuentas/configuración/importaciones del Super Admin; Agente tiene operación acotada de pedidos; Viewer lectura operativa; cliente sólo recursos propios y sin panel. Los permisos personalizados requieren su comprobación real en servidor. No se cambian permisos ni se muestran datos privados por una corrección visual.

Dashboard, navegación, usuarios, catálogo, colecciones, configuración, auditoría y herramientas conservan sus módulos existentes. La revisión usa las suites de administración, seguridad y arquitectura, y los gates completos del CI; no equivale a operar cada botón con cuentas reales. Se preserva la presentación móvil vigente, sin CSS nuevo.

## Defectos demostrados

| Clasificación | Evidencia | Corrección |
| --- | --- | --- |
| HIGH funcional | La campana aumentaba historyLimit a200 al pedir anteriores, pero Rules sólo permiten100: falla el historial de cuentas con más eventos. | Páginas reactivas de100 con startAfter. Un único subscribe administra y desmonta todos sus listeners. Cambiar un cursor invalida páginas posteriores; deduplicación por ID documental. No ampliar Rules. |
| MEDIUM | pagehide desmontaba auth/feed con once:true; pageshow persistido no restauraba nada. Volver desde BFCache dejaba datos obsoletos. | Restaurar inicialización al volver, limpiar en cada salida y delegar eventos una sola vez. Sin recarga ni logout. |
| MEDIUM | Navegación demorada tras lectura podía ejecutarse luego de cambiar cuenta. | Verificar UID capturado antes de navegar al contenido relacionado. |

Las respuestas de páginas anuladas se descartan por generación y token de página. Una lectura fallida conserva el estado sin leer; un fallo de escucha informa error conservando actividad cargada y reintento existente. Los IDs almacenados no pueden reemplazar el ID real del documento.

## Evidencia y límites

- RED inicial: nueva prueba reproduce la consulta superior a100 y ausencia de restauración BFCache. GREEN: historial101, dos páginas, cambio de cuenta y dos ciclos BFCache. Se actualiza la prueba antigua que esperaba una consulta200 para exigir dos consultas autorizadas.
- 532 pruebas de cuentas/perfil/login/auth/push/social/actividad y notificaciones de pedidos PASS; 277 administración/seguridad/arquitectura PASS,1SKIP por emulador. Posteriormente se añade regresión de segundo ciclo BFCache; su ejecución específica también PASS. El primer intento de dos pruebas de login falló por ejecutable Playwright ausente: repetidas con Chromium del entorno, sin fallos.
- Chromium local:61 PASS y1FLAKY en el barrido de62; timeout del historial1440 en primer intento, repetición aislada de sus3anchos PASS sin reintentos. Los12casos de lectura voluntaria/error cliente-admin y los flujos de perfil/direcciones/cuenta pasan. No se atribuye causa al timeout sin evidencia.
- Actividad antigua paginada no produce avisos flotantes nuevos: sólo la primera página alimenta el detector existente.
- Navegador y gates finales: recibos de esta rama/PR; no heredar PASS de05. Derivados, referencias y plan protegido mediante constructores canónicos.
- NOT_VERIFIED: sincronización entre dispositivos físicos, sesiones reales de cada rol con permisos desplegados, correos/push reales, índices/Rules desplegados y proveedores de acceso. No se crean cuentas reales ni se envían mensajes. La prueba omitida requiere emulador, no producción.
- Pendientes previos: F01-RULES HIGH (metadata inventario,03A), deployment del WebApp Apps Script retirado en05 y F02-STATS. No se declaran reparados por esta fase.
