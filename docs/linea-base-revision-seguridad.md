# Línea base para revisión de seguridad externa

Documento a entregar a quien haga la revisión externa del punto 11 de #340. Describe qué
es el sistema, qué superficies expone y qué ya está verificado automáticamente, para que
la revisión no gaste tiempo redescubriendo lo conocido.

**No debe contener secretos, claves, tokens ni códigos de recuperación.** Si la persona
revisora necesita credenciales, se entregan por un canal aparte y se rotan al terminar.

## Identificación

| Campo | Valor |
| --- | --- |
| Proyecto | Tintin Accesorios — tienda pública y panel administrativo |
| Repositorio | `tintinaccs/tintin-web` (público) |
| Rama de referencia | `main` |
| Commit exacto | *completar en el momento de la entrega* |
| Release | `v1.0.0` |
| Alojamiento | Cloudflare Pages y GitHub Pages |
| Datos | Google Firestore, proyecto `tintin-accesorios`, **plan Spark** |
| Imágenes | Cloudinary |
| Correo | Resend, más Google Apps Script |

## Arquitectura en una frase

Sitio estático en HTML, CSS y JavaScript modular sin framework ni build step, que habla
directamente con Firestore desde el navegador; las operaciones que necesitan un secreto
pasan por Cloudflare Pages Functions.

Esto define el modelo de amenaza: **la autorización real vive en las reglas de Firestore y
en App Check, no en el cliente.** Cualquier revisión debe partir de ahí.

## Superficies expuestas

### Páginas públicas (18)

`index` · `catalogo` · `collections` · `product` · `checkout` · `login` · `perfil` ·
`about` · `nosotros` · `contact` · `envios` · `cambios-devoluciones` ·
`preguntas-frecuentes` · `privacidad` · `terminos` · `404` · `admin` · `admin-images`

Las dos últimas son el panel: se sirven públicamente pero su contenido depende de
autenticación y rol.

### Endpoints de Cloudflare Pages Functions (10)

| Endpoint | Función | Secreto que usa |
| --- | --- | --- |
| `cloudinary-sign-upload` | Firma subidas de imagen | `CLOUDINARY_API_SECRET` |
| `cloudinary-delete` | Borra imágenes | `CLOUDINARY_API_SECRET` |
| `order-email` | Correo de pedido | `RESEND_API_KEY` |
| `test-email` | Correo de prueba | `RESEND_API_KEY` |
| `email-otp-send` | Envía código de acceso | `RESEND_API_KEY` |
| `email-otp-verify` | Verifica código de acceso | `FIREBASE_SERVICE_ACCOUNT_KEY` |
| `sheets-product-sync` | Sincroniza con Google Sheets | URL del webhook de Apps Script |
| `geo-search` | Búsqueda geográfica | — |
| `location-search` | Búsqueda de ubicación | — |
| `visitor-geo` | País de la visita | — |

### Colecciones de Firestore (22)

`products` · `collections` · `site_content` · `settings` · `colorSchemes` · `media` ·
`orders` · `cart` · `checkoutGuards` · `phoneReservations` · `users` · `rolePermissions` ·
`auditLog` · `emailLogs` · `emailSettings` · `emailTemplates` · `emailCampaigns` ·
`history` · `siteAggregate` · `sitePresence` · `siteTraffic`

## Controles ya implementados y verificados en CI

Todo lo siguiente se ejecuta en cada Pull Request dentro del check obligatorio
`Repository audit`. **No hace falta re-verificarlo manualmente**, pero sí cuestionar si
cubre lo que dice cubrir.

| Control | Verificación |
| --- | --- |
| Reglas de Firestore | Tests adversariales contra el emulador (`test:rules-critical`) |
| Unicidad de teléfono | `test:rules-phone` |
| Aislamiento de cuentas y roles | `audit:security`, `audit:users-roles` |
| Pedidos y precios | `audit:secure-orders` — precio y stock se revalidan en el servidor |
| App Check | `audit:app-check-bootstrap` |
| Ausencia de secretos en el frontend | `audit:tintin`, `audit:images` |
| Correo por un solo canal | `audit:emails` |
| Presupuesto de lecturas | `node scripts/auditar-firestore-lecturas-presupuesto.js` |
| Arquitectura modular | `audit:modular-architecture` |
| Limpiador de ramas | `tests/branches/auditar-limpiar-ramas.test.mjs` |

## Decisiones de diseño que conviene entender antes de reportarlas

Estas cosas **parecen** hallazgos y no lo son. Están documentadas para no gastar tiempo de
revisión en ellas.

1. **Hay identificadores de Firebase en el JavaScript público.** El `apiKey` de Firebase
   Web y la clave de sitio de App Check son públicos por diseño: identifican el proyecto,
   no autorizan nada. La autorización la dan las reglas y App Check. Detalle en
   `docs/inventario-recuperacion-servicios.md`.
2. **La URL del webhook de Apps Script es visible.** La autorización de ese endpoint es la
   verificación del idToken del lado del servidor, no el secreto de la URL. Si se
   concluye que igual debería ocultarse, la corrección es rediseñar la autorización, no
   esconder la URL.
3. **El proyecto está en plan Spark a propósito.** Firebase Storage no está activo y
   `storage.rules` está prohibido por auditoría. Ver `scripts/auditar-imagenes-fase-5.js`.
4. **No hay build step ni framework.** Es deliberado. No hay `node_modules` en producción
   ni bundle que auditar: lo que se sirve es lo que está en el repositorio.

## Zonas donde la revisión aporta más

Sugerencias de foco, sin condicionar el alcance:

- **Reglas de Firestore.** Son el control de acceso real de todo el sistema. Los tests
  cubren los casos previstos; el valor está en los no previstos.
- **Escalada de privilegios entre roles.** Cliente → admin → Super Admin.
- **Los cuatro endpoints que manejan secretos.** Especialmente `cloudinary-sign-upload`
  (¿se puede abusar de la firma?) y `email-otp-verify` (¿se puede falsificar la
  verificación?).
- **El webhook de sincronización** (`sheets-product-sync`). No firma el cuerpo: valida el
  `origin` y reenvía un `idToken` a Apps Script, que es quien lo verifica. Conviene
  revisar si esa cadena resiste una petición construida a mano.
- **La transacción de compra.** ¿Se puede provocar un descuento de stock incorrecto, un
  precio distinto al publicado o una condición de carrera entre dos compras del último
  ítem?
- **Datos personales en pedidos.** Qué se guarda, quién puede leerlo y cuánto se conserva.

## Qué se entrega

- URL del sitio en producción.
- Commit exacto de `main` usado como línea base.
- Este documento.
- Acceso de solo lectura al repositorio (ya es público).
- Si se requiere una cuenta de prueba: se crea para la revisión y se elimina al terminar.

## Registro de hallazgos

Cada hallazgo se anota en #340, punto 11, con este formato:

| ID | Severidad | Descripción | Superficie | Estado | Corrección | Evidencia de cierre |
| --- | --- | --- | --- | --- | --- | --- |

Severidad sugerida: crítica, alta, media, baja, informativa.

Un hallazgo solo se cierra con evidencia verificable: un commit, un test que falla antes y
pasa después, o una configuración comprobable. **No se cierra por descripción.**

## Después de la revisión

- Rotar cualquier credencial que se haya compartido para la revisión.
- Rotar credenciales críticas si el alcance incluyó producción (punto 8 de #340).
- Eliminar las cuentas de prueba creadas.
- Registrar fecha, alcance y resultado sin guardar secretos.
