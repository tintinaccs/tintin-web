# Recuperación de Firestore

Estado real de las copias de Firestore, qué está cubierto hoy y qué no. Complementa
`docs/plan-respaldo-recuperacion.md`, que describe el objetivo; este documento describe
lo que el proyecto **puede ejecutar hoy**.

No debe contener secretos, claves ni credenciales.

## Advertencia sobre este documento

Una versión anterior afirmaba que `orders` y `users` **no tenían ningún respaldo**. Era
falso. Esa conclusión salió de auditar únicamente el repositorio —el export del panel
excluye esas colecciones, el plan era Spark y App Check bloquea el acceso externo— sin
consultar el estado real de la base.

**Los respaldos de Firestore se configuran en la consola de Google y no dejan ningún
rastro en el código.** Ninguna auditoría de este repositorio puede verlos. Para conocer
la cobertura real hay que preguntarle a la infraestructura:

```
gcloud firestore databases list --project=tintin-accesorios
gcloud firestore backups schedules list --database='(default)'
gcloud firestore backups list
```

## Resumen

Verificado el 2026-08-08 contra el proyecto real.

| Datos | Cobertura real |
| --- | --- |
| `products`, `collections`, `site_content`, `settings`, `rolePermissions` | Copia operativa del panel, descargable + todo lo de abajo |
| `orders`, `users`, `auditLog`, `emailLogs` | **Sí tienen respaldo**: PITR 7 días, diario 30 días, semanal 84 días |
| `cart` | Cubierto igual, aunque es efímero y no crítico |

Mecanismos activos sobre la base `(default)` en `us-east1`:

| Mecanismo | Alcance | Estado |
| --- | --- | --- |
| Point-in-Time Recovery | Cualquier instante de los últimos **7 días** | `POINT_IN_TIME_RECOVERY_ENABLED`, `versionRetentionPeriod: 604800s` |
| Respaldo programado diario | Retención **30 días** | Activo desde 2026-08-05 |
| Respaldo programado semanal (domingos) | Retención **84 días** | Activo desde 2026-08-05 |
| Copia operativa del panel | Catálogo y configuración | Manual, descargable |
| Exportación administrada a bucket | Todo, y **se puede sacar de Google** | Manual |

## Lo que sigue faltando de verdad

1. **La restauración nunca se probó.** Hay respaldos en estado `READY`, pero nadie
   confirmó que se puedan volver a leer. Un respaldo sin restauración probada es una
   suposición, no una copia.
2. **Todo vive en la misma cuenta de Google.** PITR, los respaldos programados y el
   bucket de exportación dependen de la misma cuenta que la base de producción. Si se
   pierde el acceso a esa cuenta, se pierden la base y todos sus respaldos a la vez. Por
   eso el 2FA de Google no es solo protección de producción: es también la única
   protección de los respaldos.
3. **La protección contra borrado estaba desactivada**
   (`deleteProtectionState: DELETE_PROTECTION_DISABLED`). Se activa con:

   ```
   gcloud firestore databases update --database='(default)' --delete-protection
   ```

La exportación administrada sigue teniendo valor pese a PITR y a los respaldos
programados: es el **único** mecanismo cuyo resultado se puede descargar y guardar fuera
de Google. Son redes distintas, no redundantes.

## Lo que sí existe: copia operativa

El panel de Super Admin ya genera una copia descargable. No hace falta instalar nada.

1. Entrar al panel como Super Admin.
2. Ir a la sección de importación/exportación.
3. Pulsar **Descargar copia operativa**.
4. Se descarga `tintin-copia-operativa-AAAA-MM-DD.json`.

El archivo lleva un sobre validado (`format: tintin-operational-backup`, `schemaVersion`,
`projectId`, `exportedAt`, `exportedBy`) y un bloque `counts` con el número de documentos
de cada colección. La importación verifica ese sobre antes de aplicar nada, así que un
archivo de otro proyecto o de otro esquema se rechaza.

Implementación: `js/admin/importacion-admin.js`.

### Restauración

La misma pantalla importa el archivo. Antes de restaurar sobre producción:

- Comparar el bloque `counts` del archivo con lo que hay en producción.
- Restaurar primero en un proyecto o base no productiva si el cambio es masivo.
- Nunca ensayar una importación directamente sobre producción.

### Verificación de una copia

Una copia se considera válida cuando:

- El sobre tiene el `projectId` correcto y `schemaVersion` reconocido.
- `counts` coincide con lo observado en el panel.
- Una muestra de productos y colecciones conserva precio, stock, estado e imágenes.

## Lo que no existe: pedidos, usuarios y registros

`exportOperationalBackup()` declara explícitamente
`excludes: ['users', 'orders', 'carts', 'auditLog', 'emailLogs']`.

Esto es una decisión de diseño, no un olvido: esas colecciones contienen datos
personales y transaccionales, y descargarlas a un archivo local tiene implicancias de
privacidad que no se resuelven con un botón.

Esa exclusión **no** deja a los pedidos sin protección: PITR y los respaldos programados
los cubren igual, como se detalla en el resumen. Lo que la exclusión sí implica es que
`orders` y `users` no entran en el archivo descargable del panel, que es la única copia
que hoy se puede sacar de Google sin usar la exportación administrada.

## Por qué no se puede resolver con un script

La salida obvia sería un script que lea Firestore con el SDK y vuelque JSON. **No
funciona en este proyecto**, por dos restricciones reales:

1. **Plan Spark.** La exportación administrada de Firestore (`gcloud firestore export`)
   escribe en un bucket de Cloud Storage y **requiere plan Blaze**. El proyecto está
   deliberadamente en Spark: `scripts/auditar-imagenes-fase-5.js` verifica que
   `npm run deploy:rules` no intente activar Storage.
2. **App Check con Enforcement.** `js/core/firebase/firebase.js` registra App Check con
   reCAPTCHA Enterprise. Con Enforcement activo en Firestore, las llamadas que no vienen
   de la web legítima quedan rechazadas — que es exactamente lo que cortó el agotamiento
   de cuota que motivó activarlo. Un script Node con el SDK cliente cae en esa categoría.

`firebase-admin` tampoco es una salida: no está entre las dependencias, y las Pages
Functions corren sobre el runtime de Workers, donde ese paquete no funciona.

Cualquier procedimiento que ignore estas dos restricciones no se va a poder ejecutar.

## Opciones para cerrar el hueco

Requieren una decisión de la propietaria. Ninguna se puede tomar desde el repositorio.

### Opción A — Subir a Blaze y usar exportación administrada

La única ruta que da respaldo **completo y programado** de todas las colecciones.

No hace falta instalar nada: **Cloud Shell** (<https://shell.cloud.google.com>) ya trae
`gcloud` autenticado en el navegador.

```
# 0. Fijar el proyecto
gcloud config set project tintin-accesorios

# 1. Averiguar en qué región vive la base ANTES de crear nada.
#    El bucket de destino tiene que estar en una región compatible con la
#    base; si no coincide, el export falla con INVALID_ARGUMENT. La cercanía
#    geográfica no importa: importa que coincidan.
gcloud firestore databases list --project=tintin-accesorios

# 2. Crear el bucket usando el locationId que devolvió el paso anterior.
#    Una base en nam5 o us-east1 necesita un bucket en "us" o "us-east1".
gcloud storage buckets create gs://tintin-accesorios-respaldos \
  --project=tintin-accesorios --location=REGION_DE_LA_BASE

# 2. Exportación completa
gcloud firestore export gs://tintin-accesorios-respaldos/$(date +%Y-%m-%d) \
  --project=tintin-accesorios

# 3. La exportación no bloquea: se corre en segundo plano.
#    Esperar a que aparezca "done: true" antes de intentar restaurar.
gcloud firestore operations list --project=tintin-accesorios
gcloud storage ls gs://tintin-accesorios-respaldos/

# Exportación de colecciones puntuales, si solo interesan esas
gcloud firestore export gs://tintin-accesorios-respaldos/$(date +%Y-%m-%d) \
  --project=tintin-accesorios \
  --collection-ids=orders,users,auditLog,emailLogs

# 4. Crear la base de prueba ANTES de importar.
#    Sin este paso el import falla: la base de destino tiene que existir.
gcloud firestore databases create \
  --database=restauracion-prueba \
  --location=REGION_DE_LA_BASE \
  --type=firestore-native \
  --project=tintin-accesorios

# 5. Restaurar SIEMPRE en esa base, nunca sobre producción.
#    Reemplazar AAAA-MM-DD por la carpeta real listada en el paso 3.
gcloud firestore import gs://tintin-accesorios-respaldos/AAAA-MM-DD \
  --project=tintin-accesorios --database=restauracion-prueba

# 6. Opcional: borrar la base de prueba cuando la verificación terminó
gcloud firestore databases delete \
  --database=restauracion-prueba --project=tintin-accesorios
```

La verificación real no es que la exportación corra, sino que lo exportado se pueda
volver a leer: en la consola de Firestore hay un selector de base de datos arriba a la
izquierda; cambiando a `restauracion-prueba` tienen que verse `orders` y `users` con
documentos adentro.

La exportación administrada corre del lado del servidor con IAM, así que **no la afecta
App Check**.

Consideraciones antes de decidir:

- Blaze es de pago por uso, pero **no elimina el nivel gratuito**: las mismas cuotas que
  hoy cubre Spark siguen sin costo y solo se paga el consumo por encima. Conviene
  configurar un **presupuesto con alerta** en Google Cloud Billing
  (<https://console.cloud.google.com/billing> → *Budgets & alerts*) **antes** de
  habilitarlo, no después.
- La exportación se cobra por documento leído, y el respaldo ocupa espacio en Cloud
  Storage. Con el volumen actual el costo es mínimo; la alerta de presupuesto es lo que
  cubre cualquier sorpresa.
- Habilitar Blaze **no** obliga a activar Firebase Storage. La verificación de
  `audit:images` seguiría pasando mientras `firebase.json` no declare `storage` ni exista
  `storage.rules`.
- Programar la exportación periódica requiere Cloud Scheduler.

### Opción B — Extender la copia operativa a pedidos

Agregar `orders` al export del panel. Es una modificación de código acotada.

Antes de implementarla hay que resolver:

- **Privacidad.** Los pedidos incluyen nombre, teléfono, dirección y detalle de compra.
  Un archivo JSON descargado no tiene control de acceso. Corresponde revisarlo junto con
  la revisión legal del punto 11 de #340.
- **Retención.** Cuánto tiempo se conservan esas copias y dónde.
- **Volumen.** El export lee la colección completa; con muchos pedidos consume lecturas
  de la cuota diaria de Spark.

No se implementó en este cierre precisamente porque es una decisión de privacidad, no
una tarea técnica.

### Opción C — Quedarse con lo que ya hay

Dejar PITR y los respaldos programados como única cobertura, sin exportaciones a bucket.

Es defendible: cubre 7 días a cualquier instante, 30 días de copias diarias y 84 de
semanales. **Lo que no cubre es la pérdida de la cuenta de Google**, porque todos esos
respaldos viven dentro de ella. Si se elige esta opción, la contrapartida obligatoria es
tratar el 2FA y los códigos de recuperación de Google como crítico, y probar al menos una
restauración para confirmar que los respaldos sirven.

## Registro de pruebas

Anotar cada prueba en `docs/inventario-recuperacion-servicios.md`.

| Qué probar | Cómo se verifica |
| --- | --- |
| Copia operativa | `counts` coincide y una muestra conserva precio, stock e imágenes |
| Importación | Restaurada en entorno no productivo, sin tocar producción |
| Exportación completa (si se elige A) | Conteo por colección igual al de producción |
