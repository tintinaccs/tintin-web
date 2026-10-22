# Fuentes canónicas y coherencia de publicación

Esta política acompaña los contratos existentes; no crea otro sistema de versiones o publicación.

Regla global de avisos: una publicación sólo ofrece actualizar en la página que necesita una carga nueva de su HTML o recursos de cliente realmente cargados. Aplica a visitantes, cuentas y Super Admin, escritorio/tablets/móviles y apps instaladas; Checkout también puede posponer el aviso sin recargar ni alterar el pago. Un cambio de otra página no avisa; al navegar se obtiene su HTML vigente por la política existente sin caché. Las altas/ediciones/bajas/ocultaciones/movimientos de productos, colecciones, precios, stock u otros datos usan sus suscripciones y no se convierten en versiones de aplicación. Tampoco avisan los cambios exclusivos de servidor ni la propagación mecánica de tags de imports. Los cambios compartidos reales sí afectan a las páginas que utilizan esos recursos. Las huellas semánticas no sustituyen los hashes exactos de integridad, las URLs inmutables ni los gates de publicación. El marcador embebido del documento impide adoptar una publicación posterior como referencia del HTML anterior durante el arranque. Si la red no prueba un cambio, no se inventa un aviso. Nunca se fuerza una recarga ni se borran sesiones, borradores, carrito o preferencias.

| Responsabilidad | Fuente y aplicación | Control |
| --- | --- | --- |
| Código autorizado | Rama `main`, PR y SHA exacto | `auditar-tintin.yml` y mantenimiento protegido |
| URLs internas | `scripts/normalizar-rutas-publicas.js` | `build:routes` / `verify:routes` |
| Cobertura de Pages Functions | `scripts/lib/rutas-pages.js`, derivada de documentos y APIs existentes | El mismo build/verify y auditoría final; límite de 100 reglas |
| Políticas CSP por documento | `scripts/generar-csp-cloudflare.js` y `documentRoutes` compartido | `build:csp` / `verify:csp`; middleware falla cerrado |
| Identidad de release y páginas | `scripts/construir-manifiesto-diagnostico.js` → `diagnostic-manifest.json` y `site-version.json` | Reproducibilidad y verificación del artefacto publicado |
| URLs inmutables JS/CSS y dependencias dinámicas | `scripts/auditar-versionado-cache.mjs`, baseline y generadores del shell | Cambio de bytes exige URL nueva; una URL por módulo |
| Aviso de actualización | `js/quality/vigilancia-version.js`, normalización compartida `revision-visual.mjs` y marcador generado `site-version.json` | Sólo documento abierto o recursos de cliente cargados con cambios semánticos; pruebas de versión/navegación, sin recarga automática ni borrado de datos |
| Revisión de datos comerciales | Contratos de `revision-tienda`, cambios confirmados y watchers | Se distingue de una nueva versión de aplicación |
| Notificación push | `firebase-messaging-sw.js` y controlador administrativo | Datos FCM sin notificación duplicada; iconos generados y destinos comprobados |

Antes de sustituir una implementación hay que identificar consumidores estáticos y dinámicos, permisos, contratos y efectos secundarios. Los nombres parecidos y los bytes idénticos sólo son candidatos a revisión. Los fallbacks Apple/favicon copiados del generador y las imágenes responsive de igual contenido son legítimos mientras tengan consumidores válidos; no deben retirarse por su hash.

Las rutas de error y Nosotros compactan únicamente sus aliases conocidos para respetar el límite de Pages. Las APIs conservan reglas exactas; agregar una API actualiza la cobertura durante build:routes. Si se supera el límite, el build falla y exige revisar el diseño. No se sustituye la cobertura por `/*` ni `/api/*` para silenciar el control. Search Console conserva su documento estático. Las URLs HTML completas siguen teniendo CSP por documento, independientemente de la compactación de reglas del proveedor.

Una publicación se prepara con dependencias bloqueadas, build reproducible, controles del SHA y plan de protección. El diagnóstico debe generarse después de los cambios definitivos del plan. CI rechaza cualquier derivado diferente. Tras desplegar se comparan la huella y los recursos públicos con el candidato aprobado; un resultado local o de una rama anterior no certifica producción.

Los metadatos no contienen secretos. Las pruebas no eliminan sesiones, carritos, pedidos ni preferencias. Una pestaña con borrador o checkout conserva su trabajo y decide cuándo actualizar. Los despliegues anteriores y el historial Git sirven para recuperación, sin convertirlos en implementaciones activas competidoras.

Al cerrar cada cambio se registra evidencia en CURRENT_STATE y se distingue APROBADO local, CI, producción, FALLIDO, BLOQUEADO y NO EJECUTADO. La documentación de una auditoría anterior no prueba el estado actual. La representación de una app ya instalada en un teléfono requiere comprobar ese dispositivo; validar los PNG publicados no sustituye esa prueba.
