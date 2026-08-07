# Operación continua

Este documento cubre el punto 10 del issue maestro #340: qué se revisa, cada
cuánto y con qué evidencia, una vez que el desarrollo quedó cerrado.

No debe contener secretos, contraseñas, tokens ni códigos de recuperación.
Para credenciales, ver `docs/inventario-recuperacion-servicios.md`.

## Cómo leer este documento

Las tablas tienen dos tipos de campo:

- **Verificable desde el repositorio**: el valor sale del código o de un
  workflow y se puede comprobar sin abrir ninguna consola. Está completo.
- **Requiere consola del proveedor**: el valor vive en Firebase, Cloudflare,
  Cloudinary, Resend o el registrador. Queda como `Pendiente` con la ruta
  exacta donde leerlo. Nadie debe inventarlo.

## 1. Responsable y frecuencia

| Ámbito | Responsable | Frecuencia propuesta | Estado |
| --- | --- | --- | --- |
| Monitor de producción | Propietaria de Tintin | Semanal | Propuesta, requiere confirmación |
| Revisión técnica general | Propietaria de Tintin | Mensual | Propuesta, requiere confirmación |
| Prueba de recuperación | Propietaria de Tintin | Trimestral | Propuesta, requiere confirmación |
| Cuentas, dominio y proveedores | Propietaria de Tintin | Anual | Propuesta, requiere confirmación |

Las frecuencias son una propuesta de línea base, no una decisión tomada. Al
confirmarlas o cambiarlas, actualizar esta tabla y marcar el punto 10 de #340.

## 2. Revisión semanal — monitor de producción

- [ ] El sitio público carga: `https://tintinaccs.github.io/tintin-web/` y
      `https://tintinaccesorios.pages.dev`.
- [ ] El último workflow de `main` terminó en verde.
- [ ] El último despliegue de Cloudflare Pages terminó correctamente.
- [ ] No hay pedidos atascados sin cambio de estado en Admin.

## 3. Revisión mensual

- [ ] Errores y diagnósticos: revisar el panel de diagnóstico del Admin.
- [ ] Rendimiento: confirmar que `Nivel 3 — Calidad integral` sigue en verde
      sobre `main` (incluye Web Vitals y geometría responsive).
- [ ] Dependencias: revisar avisos de seguridad del repositorio.
- [ ] Cuotas: completar la tabla de la sección 6 con los consumos del mes.
- [ ] Seguridad: revisar accesos y sesiones activas (ver
      `docs/inventario-recuperacion-servicios.md`).

## 4. Prueba trimestral de recuperación

| Activo | Procedimiento | Evidencia esperada |
| --- | --- | --- |
| Código | Restaurar el bundle en una carpeta aislada y correr `git fsck --full` | Workflow `respaldo-repositorio.yml` y artefacto |
| Datos | Restaurar una exportación de Firestore en un proyecto o base no productiva | Conteos por colección y muestra verificada |
| Imágenes | Restaurar una muestra de originales de Cloudinary | Muestra visible y URL activa |

Registrar cada prueba en la tabla «Registro de pruebas» de
`docs/inventario-recuperacion-servicios.md`, con fecha y resultado, **sin
guardar secretos**.

## 5. Revisión anual

- [ ] Cuentas: GitHub, Google/Firebase, Cloudflare, correo y registrador.
- [ ] Dominio: renovación automática activa y contacto vigente.
- [ ] DNS: registros vigentes y sin entradas huérfanas.
- [ ] Proveedores: condiciones, planes y alternativas.
- [ ] Rotación de credenciales críticas.

## 6. Límites y cuotas

### 6.1 Límites que el propio código impone

Estos salen del repositorio y se pueden verificar sin abrir ninguna consola.

| Límite | Valor | Dónde está definido |
| --- | --- | --- |
| Reintentos de envío de correo de pedido | 3 | `js/email/notificacion-pedido-resend.js` |
| Techo duro de correos de prueba por día | 50 | `functions/configuracion-correo.md` (`ABSOLUTE_MAX_TEST_PER_DAY`) |
| Techo duro de reenvíos por día | 80 | `functions/configuracion-correo.md` (`ABSOLUTE_MAX_RESEND_PER_DAY`) |
| Cantidad máxima por línea del carrito | 99 | `js/components/cart/sincronizacion-carrito.js` |
| Líneas máximas del carrito | 100 | `js/components/cart/sincronizacion-carrito.js` |
| Tamaño máximo de archivo de importación | 5 MB | `js/admin/importacion-admin.js` |
| Cuerpo máximo del webhook de sincronización | 64 KB | `functions/api/sheets-product-sync.js` |
| Longitud máxima de URL de imagen | 2048 | `js/components/images/utilidades-imagenes.js` |

El presupuesto de lecturas de Firestore no es un número único sino un conjunto
de reglas de arquitectura verificadas por
`scripts/auditar-firestore-lecturas-presupuesto.js`: un solo listener acotado
para productos, caché TTL compacta, deduplicación de consultas simultáneas,
`limit(12)` en relacionados, y cero lectura de productos en perfil, login,
contacto, legales y checkout. Ese script corre dentro del `Repository audit`,
así que una regresión de consumo rompe CI antes de llegar a producción.

### 6.2 Cuotas del proveedor

Requieren abrir cada consola. **No completar de memoria.**

| Servicio | Qué medir | Dónde leerlo | Consumo actual |
| --- | --- | --- | --- |
| Firebase / Firestore | Lecturas, escrituras y borrados diarios del plan Spark | Consola Firebase → Uso y facturación | Pendiente |
| Firebase Authentication | Verificaciones y usuarios activos | Consola Firebase → Authentication | Pendiente |
| Cloudflare Pages | Builds por mes y peticiones a Functions | Panel Cloudflare → Pages → el proyecto | Pendiente |
| Cloudinary | Almacenamiento, transformaciones y ancho de banda | Panel Cloudinary → Usage | Pendiente |
| Resend | Correos por día y por mes | Panel Resend → Usage | Pendiente |
| Google Apps Script | Ejecuciones y tiempo de ejecución diario | Panel de Apps Script → Ejecuciones | Pendiente |
| GitHub Actions | Minutos y almacenamiento de artefactos | GitHub → Settings → Billing | Pendiente |

El proyecto está deliberadamente en los planes gratuitos. En particular
Firebase se mantiene en **Spark**: `scripts/auditar-imagenes-fase-5.js`
verifica que `npm run deploy:rules` no intente activar Storage, porque Storage
exige Blaze. Cambiar de plan es una decisión explícita, no un efecto lateral.

## 7. Alertas

| Evento | Detección actual | Estado |
| --- | --- | --- |
| Fallo de workflow en `main` | Notificación de GitHub Actions al propietario | Activo |
| Fallo de despliegue de Cloudflare Pages | Notificación del panel de Cloudflare | Requiere confirmar que esté habilitada |
| Fallo de una Pages Function | Sin alerta automática | Pendiente de definir |
| Cuota cerca del límite | Sin alerta automática | Pendiente de definir |
| Caída del sitio público | Sin monitor externo | Pendiente de definir |

Las tres últimas filas son huecos reales. Cubrirlas requiere configurar algo
fuera del repositorio (alertas de proveedor o un monitor externo), así que
quedan como pendiente manual del punto 10.

## 8. Alta y baja de accesos

### Alta

1. Registrar en `docs/inventario-recuperacion-servicios.md` quién recibe el
   acceso, a qué servicio y con qué rol. Nunca el valor de la credencial.
2. Conceder el permiso mínimo necesario.
3. Exigir 2FA o passkey antes de habilitar el acceso.
4. Registrar la fecha del alta.

### Baja

1. Revocar el acceso en cada servicio: GitHub, Google/Firebase, Cloudflare,
   Cloudinary, Resend, correo y registrador.
2. Cerrar sesiones activas.
3. Rotar cualquier credencial compartida que la persona haya conocido.
4. Registrar la fecha de la baja y de la rotación.

En el Admin del sitio, la baja de un usuario administrativo se hace desde
Usuarios y permisos; el Super Admin está protegido y no puede degradarse a sí
mismo por accidente (verificado por `audit:users-roles`).

## 9. Versiones futuras

Cada cambio funcional posterior al cierre se publica como Release separada,
con su tag, para que el estado desplegado siempre sea identificable. La
restauración de código descrita en la sección 4 depende de eso.
