# Recuperación de Firestore

Estado real de las copias de Firestore, qué está cubierto hoy y qué no. Complementa
`docs/plan-respaldo-recuperacion.md`, que describe el objetivo; este documento describe
lo que el proyecto **puede ejecutar hoy**.

No debe contener secretos, claves ni credenciales.

## Resumen

| Datos | Copia disponible | Cómo | Cobertura |
| --- | --- | --- | --- |
| `products` | Sí | Copia operativa del panel | Completa |
| `collections` | Sí | Copia operativa del panel | Completa |
| `site_content` | Sí | Copia operativa del panel | Completa |
| `settings` | Sí | Copia operativa del panel | Completa |
| `rolePermissions` | Sí | Copia operativa del panel | Completa |
| `orders` | **No** | — | **Sin respaldo** |
| `users` | **No** | — | **Sin respaldo** |
| `auditLog` | **No** | — | **Sin respaldo** |
| `emailLogs` | **No** | — | **Sin respaldo** |
| `cart` | No | — | Sin respaldo (efímero, no crítico) |

El catálogo y la configuración se recuperan hoy mismo. **Los pedidos y los usuarios no.**

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

Pero implica que **hoy un borrado accidental de `orders` no se puede revertir**.

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

```
# Una vez: crear el bucket de destino
gcloud storage buckets create gs://tintin-accesorios-respaldos \
  --project=tintin-accesorios --location=southamerica-east1

# Exportación completa
gcloud firestore export gs://tintin-accesorios-respaldos/$(date +%Y-%m-%d) \
  --project=tintin-accesorios

# Exportación de colecciones puntuales
gcloud firestore export gs://tintin-accesorios-respaldos/$(date +%Y-%m-%d) \
  --project=tintin-accesorios \
  --collection-ids=orders,users,auditLog,emailLogs

# Restaurar SIEMPRE en una base no productiva
gcloud firestore import gs://tintin-accesorios-respaldos/AAAA-MM-DD \
  --project=tintin-accesorios --database=restauracion-prueba
```

La exportación administrada corre del lado del servidor con IAM, así que **no la afecta
App Check**.

Consideraciones antes de decidir:

- Blaze es de pago por uso; conviene configurar un **presupuesto con alerta** en Google
  Cloud Billing antes de habilitarlo.
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

### Opción C — Aceptar el riesgo

Documentar que los pedidos no tienen respaldo y asumirlo. **No recomendada**: los pedidos
son el registro comercial del negocio y su pérdida no es reconstruible.

## Registro de pruebas

Anotar cada prueba en `docs/inventario-recuperacion-servicios.md`.

| Qué probar | Cómo se verifica |
| --- | --- |
| Copia operativa | `counts` coincide y una muestra conserva precio, stock e imágenes |
| Importación | Restaurada en entorno no productivo, sin tocar producción |
| Exportación completa (si se elige A) | Conteo por colección igual al de producción |
