# Sincronización canónica de Productos

## Contrato final

- Firestore `products`: datos públicos de la tienda.
- Firestore `productInventory`: costo, compras, stock mínimo y notas internas.
- Google Sheets `Productos`: única vista administrativa de productos.
- Google Sheets `Usuarios web`: única vista administrativa de cuentas.
- Google Sheets `Historial sync`: trazabilidad operacional.

`Catálogo web` es legado. El código versionado no la crea ni escribe en ella.
Solo se conserva una comprobación diagnóstica de su existencia para permitir
retirarla después de validar producción.

Los nombres públicos `sincronizarCatalogoWeb` y `probarEdicionCatalogo` pueden
conservarse como wrappers por compatibilidad con menús y activadores antiguos,
pero deben delegar exclusivamente al motor prefijado `tintin*`.

## Inventario auditado

| Componente | Estado | Decisión |
| --- | --- | --- |
| `apps-script/ProductosUnificados.gs` | CANÓNICO | Copiar completo al proyecto Apps Script oficial. |
| `functions/api/sheets-products-webhook.js` | CANÓNICO | Endpoint Sheets → Firestore con autenticación y commit atómico. |
| `functions/api/sheets-product-sync.js` | CANÓNICO | Ruta Admin → Apps Script → `Productos`. |
| `Código.gs` desplegado | LEGADO NO VERSIONADO | Retirar creación/escritura de `Catálogo web` y convertir APIs públicas en wrappers. |
| `ZZ_ProductosCanonicos.gs` desplegado | DUPLICADO NO VERSIONADO | Reemplazar por el archivo canónico o retirarlo; nunca usar el prefijo `ZZ` para sobreescribir funciones. |
| `Catálogo web` | OBSOLETO | No borrar hasta completar la matriz de validación. |
| Trigger `tintinProductosOnEdit` | LEGADO | El instalador canónico lo elimina y crea un solo dispatcher. |

La auditoría automática comprueba que todos los `.gs` versionados tienen
nombres globales únicos. No puede comprobar archivos que solo viven en el
editor de Apps Script: antes de desplegar hay que exportarlos o compararlos.

## Integración con `Código.gs`

El `doPost(e)` único debe leer el JSON una sola vez y delegar productos antes
de las rutas heredadas:

```javascript
var unifiedProductsResponse = tintinHandleUnifiedProductsPost_(payload);
if (unifiedProductsResponse) return unifiedProductsResponse;
```

Los nombres públicos heredados deben ser wrappers, no implementaciones
alternativas:

```javascript
function alEditarCatalogoWeb_(e) {
  return tintinHandleProductEdit_(e);
}

function probarEdicionCatalogo() {
  return tintinProbarEdicionCatalogo();
}

function diagnosticarWebhookProductos() {
  return tintinDiagnosticarWebhookProductos();
}
```

Si esos nombres ya existen, se edita su cuerpo. No se pegan wrappers duplicados
en otro archivo. `sincronizarCatalogoWeb()` puede conservar el nombre si un
trigger lo consume, pero debe leer Firestore y escribir únicamente `Productos`.
Debe quedar una sola definición global.

## Dispatcher instalable

Ejecutar una vez `tintinInstalarDispatcherUnificado()`. El instalador es
idempotente: retira los triggers de edición de esa planilla y crea exactamente
uno con el handler `tintinDespacharEdicionInstalable`.

El dispatcher enruta:

- `Productos` → `tintinHandleProductEdit_`.
- `Usuarios web` → `alEditarClientas`.
- `Resenas` → `tintinEngagementOnEdit`.

Los refresh temporales de usuarios y productos no son eliminados. Debe existir
como máximo uno de cada uno.

## Diagnóstico seguro del 401

Después de desplegar Cloudflare, ejecutar
`tintinDiagnosticarWebhookProductos()` en Apps Script.

| Resultado | Significado |
| --- | --- |
| `secret-missing-in-apps-script` | Falta la propiedad del script. |
| `missing-header` | La solicitud alcanzó la Function sin el header esperado. |
| `server-secret-missing` | El deployment alcanzado no tiene la variable de Cloudflare. |
| `secret-mismatch` | Ambos lados tienen valor, pero no coincide. |
| `legacy-or-wrong-endpoint` | El host responde, pero no tiene la revisión canónica. |
| HTTP 200 + `products-canonical-v3` | Autenticación y deployment correctos. |

El diagnóstico no imprime ni devuelve el secreto. Las respuestas incluyen
solamente estado y revisión del endpoint.

Variables requeridas, solo nombres:

- Apps Script: `SHEETS_ENGAGEMENT_SECRET`, `TINTIN_STORE_URL`,
  `SUPER_ADMIN_EMAIL`, `SA_LECTURA_KEY`, `SA_ESCRITURA_KEY`.
- Cloudflare Production: `SHEETS_ENGAGEMENT_SECRET` y las credenciales Firebase
  Admin ya consumidas por `firebase-admin-ligero.js`.
- `FIREBASE_WEB_API_KEY` solo sigue siendo necesaria en Apps Script si también
  se despliega `Participacion.gs`, que valida el ID token con Identity Toolkit.

## Despliegue sin cambiar URLs

1. Fusionar el PR con CI verde.
2. Confirmar que Cloudflare Pages despliegue ese commit en Production.
3. Verificar `SHEETS_ENGAGEMENT_SECRET` en Production, no solo Preview.
4. Copiar `ProductosUnificados.gs` al proyecto `Tintin Sync — Motor`.
5. Editar las funciones heredadas en lugar de duplicarlas.
6. Actualizar el deployment existente de Apps Script como versión nueva,
   conservando su URL `/exec`.
7. Ejecutar `tintinInstalarDispatcherUnificado()` una vez.
8. Ejecutar `tintinDiagnosticarWebhookProductos()`.
9. Ejecutar `tintinProbarEdicionCatalogo()`.
10. Ejecutar los refresh Firestore → `Productos` y Firestore → `Usuarios web`.

## Criterio para borrar `Catálogo web`

Puede borrarse manualmente únicamente cuando se demuestre en producción:

- Firestore → `Productos`.
- `Productos` → webhook → Firestore.
- Admin → Firestore → `Productos`.
- alta, actualización, desactivación y eliminación canary.
- stock y `productInventory`.
- fórmulas, validaciones y formatos preservados.
- cero callers o triggers que mencionen la hoja anterior.
- backup de la planilla creado.

Hasta entonces la pestaña puede permanecer físicamente, pero ningún código
canónico debe crearla ni escribirla.
