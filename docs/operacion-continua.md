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

La disponibilidad del sitio **ya está vigilada automáticamente**. El workflow
`.github/workflows/seo-produccion-fase-11.yml` ejecuta `npm run monitor:production`
**cada hora** (`cron: '17 * * * *'`) contra el origen público, definido por
`TINTIN_PUBLIC_ORIGIN` con `https://tintinaccesorios.pages.dev` por defecto.

`scripts/auditar-produccion-salud.mjs` comprueba en cada corrida:

- Inicio, catálogo, colecciones y ficha de producto responden y son HTML.
- El canonical de inicio apunta al origen correcto.
- El HTML público **no** expone la URL antigua de GitHub Pages.
- `robots.txt` apunta al sitemap vigente.
- `sitemap.xml` no está vacío y todas sus URL usan el mismo origen.
- `manifest.json` responde como JSON.

Hace **3 intentos con backoff** y trata cualquier 5xx como reintentable, así
que un 503 pasajero no dispara una falsa alarma. Si tras los tres intentos algo
sigue fallando, el job sale con código 1 y GitHub notifica. Cada corrida sube
el artefacto `phase11-production-health` con el detalle y los tiempos.

Por eso la revisión semanal manual se reduce a lo que el monitor no cubre:

- [ ] El último workflow de `main` terminó en verde.
- [ ] El último despliegue de Cloudflare Pages terminó correctamente.
- [ ] No hay pedidos atascados sin cambio de estado en Admin.
- [ ] Las Pages Functions (`/api/*`) responden: el monitor horario cubre las
      páginas estáticas y los metadatos, no los endpoints de Functions.

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
| Caída del sitio público | `seo-produccion-fase-11.yml`, cada hora, con 3 reintentos | Activo |
| Metadatos públicos rotos (canonical, robots, sitemap, manifest) | El mismo monitor horario | Activo |
| Fallo de despliegue de Cloudflare Pages | Notificación del panel de Cloudflare | Requiere confirmar que esté habilitada |
| Fallo de una Pages Function (`/api/*`) | Sin alerta automática | Hueco real |
| Cuota cerca del límite | Sin alerta automática | Hueco real |

Quedan **dos huecos reales**. Ninguno se puede cerrar desde el repositorio:

- **Pages Functions**: el monitor horario consulta páginas estáticas y
  metadatos, no los endpoints de Functions. Vigilarlos exige o bien un
  endpoint de salud pensado para eso, o las alertas del panel de Cloudflare.
- **Cuotas**: cada proveedor las expone en su propio panel. Requiere activar
  las alertas de Firebase, Cloudflare, Cloudinary y Resend a mano.

No se agregó un monitor nuevo de disponibilidad: ya existe uno y es más
completo que un simple ping.

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
