# Preparacion tecnica actual - 2026-10-11

Agente: Codex /root. Commit funcional evaluado: `0f2e058c0ab53a596e5016b9db7cd3edd2b12060`. Este informe describe evidencia observada; no autoriza ni anuncia el cutover.

## Integracion y publicacion

- #1092 integrado en `b4bbdbd4`: salud/ecosistema, perfil movil y colecciones frescas al restaurar importacion.
- #1093 integrado en `ac7e3948`: validacion heredada del espejo Auditoria en Apps Script. El HEAD externo se guardo y recargo; ciclos posteriores completos. Las demoras intermitentes siguen sin causa acreditada.
- #1095 integrado en `3335db53`: clic Continuar, login movil, perfil, guardado y bootstrap de navegacion.
- [#1094](https://github.com/tintinaccs/tintin-web/pull/1094) integrado en `0f2e058c`: reintentar una importacion recupera IDs del mismo job y los envia a Sheets sin sobrescribir productos. Sheets no confirmado conserva FAILED/reintentable.
- Candidato #1094 `95a36c6c9f3f92686cfe4f543748fa69e8c736b7` tiene el mismo arbol Git que el merge. [CI candidata 38137903095](https://github.com/tintinaccs/tintin-web/actions/runs/38137903095), CodeQL 38137901503 y mantenimiento protegido 38138762900: SUCCESS.
- Pages produccion: `e25cc293-218b-4370-bf3a-574e12411ecb`, SUCCESS. El panel recargado referencia el loader con `click-replay-20261011-1-resume-sheets-1`.
- [Salud de produccion 38138834204](https://github.com/tintinaccs/tintin-web/actions/runs/38138834204): SUCCESS sobre `0f2e058c`; artefacto exacto, monitor, catalogo, auth observable, smoke, cache/CSP/headers. Cuatro reportes JSON descargados con `ok: true`.
- CodeQL de main 38138833272: SUCCESS. CI de main 38138834156 seguia en curso al verificar este informe; no se hereda su resultado ni se reinicia.
- #929 permanece abierto y excluido de esta integracion. Dominio, DNS y origen comercial Shopify conservados.

## Cobertura y limites de la evidencia

| Area | Evidencia actual | Limite pendiente |
| --- | --- | --- |
| Estructura, build, cache, loaders | CI candidata SUCCESS; 19 paginas, 316 assets versionados, 64 cargas dinamicas, 78 registros/544 archivos protegidos | No acredita dispositivos fisicos |
| Responsive, accesibilidad, SEO, performance | Gates de navegador/static de la CI candidata SUCCESS sobre arbol identico; headers y smoke reales SUCCESS | No sustituye la aceptacion comercial del catalogo definitivo |
| Auth, login y perfil | Contratos y runtime con Auth/Firestore emulados, SDK oficial y reglas reales; Chrome Desktop/Chromium Mobile/WebKit Mobile; smoke publicado observable | OAuth Google real, OTP recibido y onboarding de cliente real de extremo a extremo no acreditados |
| Cuenta bloqueada/eliminada | Contratos/reglas de cuenta en CI; borrado de cuenta DIFERIDO segun decision canonica del propietario | No se borran ni desbloquean clientes reales como prueba |
| Carrito, checkout, pedidos, inventario | Contratos/emulador/browser de CI SUCCESS | No se hizo compra, pedido, cobro o transicion comercial real de prueba |
| App Check y permisos | Bootstrap/reglas/guards en CI; lectura Super Admin autenticada observable | Desafio real y fallo/recuperacion completos de cliente no acreditados |
| Feedback central CRUD | Edicion y restauracion reales de coleccion QA oculta: OP-20261010-000001/000002 Correcto; descripcion original recargada | Alta y borrado real no acreditados; fixture no equivale a produccion |
| Importacion reanudable | 56 Phase2 y siete regresiones nuevas; dos pruebas Chromium incluidas en CI; mismo-job y productos ajenos diferenciados | Alta/importacion real del CSV QA no ejecutada |
| Medios fuera de Shopify | Monitor analiza URLs del catalogo publico, colecciones y configuracion visual; rechaza referencias Shopify. Paso actual SUCCESS con producto canary no vacio | No prueba datos privados/inactivos ni una importacion futura. Copia real de medios y preflight habilitado no acreditados |
| Sheets/Apps Script | Firestore fuente de verdad; espejo y webhook canonicos en contratos; HEAD externo corregido y ciclos completos; edicion de coleccion persistida | Reanudacion real, paridad tras alta y flujo editable Sheets hacia Firestore no ejercidos en esta verificacion. Latencia intermitente sin cerrar |
| Correo, push y PayPal | Contratos/colas/guards en CI; salud sin transaccion real. PayPal deshabilitado es NO APLICA para compra actual | Entrega de correo/push y PayPal sandbox de extremo a extremo no acreditados; no activar Live como prueba |
| Backup y recuperacion | [Backup 38135334540](https://github.com/tintinaccs/tintin-web/actions/runs/38135334540): exportacion Firestore completa SUCCESS hoy, 11:26 UTC. CLI restore y guard de proyecto/base probados en CI | Backup correcto no acredita restauracion remota actual; no importar un snapshot sobre produccion para probar |

## Siguiente prueba segura de importacion

CSV local preparado: `PRUEBA_QA_NO_PUBLICAR_IMPORT_SHEETS.csv`, un producto explicitamente ficticio, draft/inactivo, stock cero, SKU QA y coleccion QA oculta. No se subio ni creo un producto.

El selector de archivo funciona, pero `setFiles` fue rechazado por Chrome: falta **Allow access to file URLs** en la extension ChatGPT. Habilitarlo corresponde al usuario en `chrome://extensions` / ChatGPT / Detalles. No se cambia ese permiso de seguridad automaticamente.

Una vez disponible: cargar el CSV por la interfaz, revisar estado inactivo/stock cero/coleccion oculta, descargar la copia operativa y aplicar; verificar persistencia, ventana central y reflejo Sheets. No crear pedidos, enviar emails ni realizar pagos reales. La copia operativa excluye usuarios/pedidos/auditoria.

Para el catalogo con fotos, seguir [importacion-shopify-media.md](../importacion-shopify-media.md): preflight autenticado, configuracion Cloudinary, activacion temporal del copiado solo durante importacion y verificacion de URLs confirmadas fuera de Shopify. No confundir pruebas de media aisladas con una copia real.

## Dos hitos distintos

1. **Comenzar importacion real y validar**: falta la prueba real segura del importador y su feedback/paridad; resolver el permiso de subida y revisar el preflight de fotos. La CI verde por si sola no acredita este recorrido.
2. **Cambiar dominio**: requiere ademas catalogo e imagenes reales aceptados, cuenta/checkout/email/App Check verificados y checklist DNS/OAuth/Search Console del [runbook](../cutover-tintinaccs-com.md). El propietario decide el momento. Mantener Shopify como origen comercial mientras falte esa aceptacion.

Los bloques anteriores de CURRENT_STATE y los informes fechados son historial. Sus frases de CI/merge/publicacion pendientes no prevalecen sobre los estados integrados acreditados en este informe; tampoco heredan PASS para trabajos no ensayados.
