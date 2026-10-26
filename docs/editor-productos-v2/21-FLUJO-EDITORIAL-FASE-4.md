# Fase 4 — Espacio de trabajo, progreso privado y publicación

Fecha: 2026-10-26. Rama `codex/editor-borradores-fase4-20261026`.
Base comprobada: `38fa577b629c7106c7085360ae6d0070fc89c5c5` (Fase 3).
Sin merge, auto-merge, despliegue, migraciones, pedidos ni escrituras de datos reales.
La restricción expresa de esta fase prevalece sobre la instrucción permanente de merge de AGENTS.

## Continuidad verificada

| Fase | SHA recuperado | PR / estado al iniciar |
| --- | --- | --- |
| 1 | `0f57f327ad43671d22d0bd4d373d2f5b7bee8e40` | #1237 OPEN, borrador |
| 2 | `746e944d0d05abf45d9f00d55d3448913352fa6f` | #1238 OPEN, listo, sobre #1237 |
| 3 | `38fa577b629c7106c7085360ae6d0070fc89c5c5` | #1239 OPEN, listo, sobre #1238 |

No estaban integradas en main (`f9399a90c`). Se conserva su ascendencia, galería,
identidades de variantes, inventario V1/V2, writer comercial, CAS y auditoría.
El PR de esta fase se apila sobre la rama de #1239, no sobre main, y no habilita auto-merge.
El PR #1233 (`b6ca686d6b06f601b7e5c368f8e4fc202797a7e1`, DRAFT sobre main)
evidencia el problema de privacidad de Rules. Se incorpora la corrección acotada
de lectura, optimizada y probada en emulador; no se integra ese PR ni otras ramas.

## Problemas confirmados y arquitectura

Antes: Guardar actualizaba directamente `products/{id}` (V2 por writer servidor;
V1 mediante transacción administrativa SDK), y el progreso incompleto sólo tenía
protección de salida. No existía una revisión privada independiente de un producto
publicado. Los contadores miraban principalmente `active`; Rules permitía leer
borradores por get y por listas públicas amplias aunque la API pública los filtrara.

Ahora: un único formulario y serializer alimentan un espacio privado por cuenta y
producto. No es otra autoridad de productos, stock, reservas o precios. Ningún
consumidor comercial lee estos espacios. Sólo una aplicación explícita pasa por
`saveProductEditor` y su batch canónico de producto, inventario privado y auditoría.
También V1 usa ese writer en el nuevo flujo; los escritores compartidos anteriores
se conservan para sus otros consumidores. No hay distribución automática de stock.
La intención de reposición V1 calculada por el controlador se transmite como
metadata; el servidor fija `restockedAt` y conserva la prioridad comercial previa.

| Dato | Autoridad / propósito |
| --- | --- |
| `products/{id}` | Única versión comercial, conserva campos históricos por mergeFields |
| `productInventory/{id}` | Inventario privado existente, sólo superadmin |
| `productEditorWorkspaces/{uid}/items/{id}` | Snapshot privado del formulario, no comercial |
| `auditLog` | Auditoría en el mismo commit de progreso o aplicación |
| `sessionStorage` | Respaldo complementario por UID/id/revisión, nunca confirmación de persistencia |

El id nuevo se asigna una sola vez antes de la primera escritura. Las imágenes
usan sus URLs de biblioteca; los archivos binarios no se incrustan en Firestore.
Las fotos pendientes sólo conservan metadatos para advertir su pérdida de bytes:
al reabrir hay que volver a elegirlas o confirmar continuar sin ellas. Las fotos ya
subidas y las asociaciones por color/combinación se restauran desde el snapshot.
Quitar/descartar progreso no elimina archivos compartidos.

## Modelo editorial y transiciones

Se conservan exactamente los estados persistidos `active`, `draft`, `archived` y
el booleano de compatibilidad `active`. No se agrega un cuarto estado persistido.
`productIsPublished` sigue siendo la autoridad pública: sólo activo editorial y
booleano distinto de false. El stock cero no cambia la publicación.

“Inactivo (histórico)” es una representación administrativa de `active:false` sin
estado editorial o con `publicationStatus:active`. Abrir/guardar no lo reclasifica
como borrador ni lo activa: la opción visual no se persiste como enum desconocido.
Los estados desconocidos siguen fuera de la tienda.

| Acción | Resultado |
| --- | --- |
| Nuevo producto | Trabajo inicialmente draft, privado; no crea un producto público vacío |
| Guardar progreso / autoguardado | Sólo snapshot privado, admite campos incompletos |
| Volver | Espera progreso pendiente y vuelve; sin modal si está guardado |
| Publicar producto | Acción explícita; valida nombre, categoría existente, precio, descripción y portada |
| Guardar cambios en publicado | Aplica explícitamente la revisión, mantiene active salvo transición elegida |
| Elegir Borrador + Retirar de publicación | Aplica explícitamente draft/active:false |
| Elegir Archivado + Archivar | Aplica explícitamente archived/active:false, sin borrar stock/identidades |
| Recuperar archivado | Abrir, elegir Activo y publicar explícitamente; conserva inventario |
| Descartar progreso guardado | Tombstone privado auditado; versión comercial sin cambios |
| Descartar cambios pendientes y volver | Conserva último progreso servidor, descarta sólo trabajo no confirmado |

No se crea automáticamente una copia comercial para edición de publicados.
El snapshot tiene el estado editorial pretendido; el encabezado muestra el estado
real de la versión comercial abierta, no una publicación que todavía no ocurrió.
Los filtros Todos/Activos/Borradores/Inactivos históricos/Archivados/Agotados
usan el modelo real. Agotados/stock bajo excluyen no publicados. Borradores además
presenta el progreso privado de la cuenta, separado de filas comerciales y acciones masivas.
Búsqueda, paginación y selecciones comerciales se mantienen.

## Guardado, concurrencia y seguridad

- Debounce: 1,8 s tras input/change/medios/variantes; botón Guardar progreso.
- Recuperación remota antes de habilitar controles: evita pisar texto durante la lectura.
- Una operación en vuelo; hasta tres rondas para cambios nuevos mientras guarda.
- Reintentos de red controlados: 2, 5 y 15 s; también reintento manual/online.
- Un changeId se conserva ante respuesta incierta. El servidor reconoce el último
  changeId y no duplica revisión/auditoría en el reintento inmediato.
- CAS de revisión del espacio y precondición updateTime/exists:false en batch.
- Huella SHA256 de `productFingerprint` y los cuatro campos privados (superadmin).
  Al aplicar se comprueba huella original, revisión del trabajo y CAS de producto,
  inventario privado y cierre del espacio dentro del mismo batch. Una venta/cambio
  de stock concurrente bloquea aplicación; no se rebasa ni redistribuye inventario.
- Conflicto 409: conservar trabajo, reabrir/comparar; descartar progreso explícitamente
  permite partir de la versión vigente. No hay conciliación automática de campos.
- Admin/superadmin, permisos crear/editar/ver y activarDesactivar revalidados en
  servidor; campos privados sólo superadmin. La cuenta no puede leer trabajo ajeno.
  Cambiar de cuenta en la sesión invalida solicitudes del formulario anterior.
- No se marca limpio ante error de red/carga. Si falla una foto se intenta guardar
  el texto y se informa exactamente qué queda pendiente; la salida no es silenciosa.
- El guard existente protege cierre/recarga con cambios pendientes; no se promete
  persistir una petición asíncrona tras matar el proceso/dispositivo. El respaldo
  de sesión sólo se recupera si coincide con revisión y base del servidor.
- API administrativa existente: origen, autenticación, rate limit, límite request
  750 KB. Snapshot <=450.000 bytes, profundidad <=12, strings <=20.000 y <=2.000
  entradas por nodo. Rechaza blob/data y claves de contaminación de prototipo.
- Lista hasta 100 trabajos activos por cuenta tras exploración acotada a 1.000
  documentos (incluye tombstones). Escala superior requiere paginación/retención
  revisada en Fase 5; sin limpieza automática ni índices nuevos en esta fase.

## Privacidad pública y Rules

SDK get público sólo permite producto publicado (defaults históricos conservados).
SDK list público requiere limit <=1000 y filtros `active == true`,
`publicationStatus == active`; las consultas amplias del panel requieren permiso
de lectura de Productos. Superadmin conserva acceso durante mantenimiento.
`public-catalog` ya filtra con `productIsPublished`, tanto listado como ID; no
consulta progreso privado. No hay proyección pública de estos espacios.
SDK del espacio privado: denegado incluso al propietario/superadmin; únicamente
API propietaria con credenciales servidor. No se agregan permisos públicos.

La primera prueba de Rules detectó exceso de evaluación con helpers de rol
repetidos; se simplificó la lectura del rol/permiso y se repitió la suite completa
de privacidad. Edición real de Firestore NOT_VERIFIED: CLI sin autenticación.
Emulador Standard local no certifica configuración, índices ni Rules desplegadas.
Las guías de Firestore y creación de Rules orientaron el límite conservador,
default-deny y las pruebas de acceso negativo; no se provisionó ni desplegó nada.

## Interfaz y responsive

Editor ocupa el viewport disponible, navegación Superpanel oculta, Volver arriba
a la izquierda, acciones persistentes, estado guardado/pendiente/error anunciado.
Se conservan secciones internas y vista previa. Montserrat y superficies Tintin,
controles táctiles >=44 px, recorrido de teclado dentro del espacio de edición y
diálogos existentes por encima. No se fuerza scroll de página al escribir.
Capturas automatizadas: `test-results/ui-ux-product-workspaces-*/phase4-*.png`,
con copia durable local en `artifacts/editor-fase4/`,
320×568, 390×844, 844×390, 768×1024, 1366×768 y 1920×1080.
Son emulación Chromium, no hardware físico/Safari.

## Verificación reproducible

Se ejecutan de nuevo; no se heredan resultados de Fases 1–3:

```sh
node --test tests/admin/*.test.mjs tests/catalog/*.test.mjs tests/orders/variant-inventory.test.mjs tests/orders/variant-commerce-v2.test.mjs
npx playwright test tests/ui-ux/product-workspaces.spec.js tests/ui-ux/product-save-responsive.spec.js tests/ui-ux/product-color-gallery.spec.js --workers=1 --retries=0
npx --no-install firebase emulators:exec --only firestore --project demo-tintin-phase4 --config firebase.editor-workspaces.test.json 'FIRESTORE_EMULATOR_HOST=127.0.0.1:8089 node scripts/probar-privacidad-borradores.mjs'
```

Node final: 235/235 PASS local. Privacidad/sintaxis Rules: 21/21 PASS en emulador.
Navegador: tanda amplia 207 PASS/1 FAIL (mensaje de error de foto sobreescribía
confirmación de texto guardado). Corregido; repetición ampliada del flujo privado
13/13 PASS sin reintentos, incluyendo ese fallo, listado y bloqueo de doble acción.
No se presenta una tanda amplia de 208 PASS que no se ejecutó. Build Pages,
caché378/67, diagnóstico19 páginas y39 comandos preflight PASS local; recibo final
en CURRENT_STATE. Fixtures usan controlador/DOM/writer reales con identidad,
Firestore y servicios externos ficticios. Cubren recuperación, publicación,
versión pública intacta durante progreso, red, conflictos, archivo/restauración,
imágenes fallidas/reintento/cancelación, listado y responsive.
Los stubs DOM de pruebas antiguas se adaptaron al selector histórico; no se
relajaron validaciones productivas. Se corrigió transición visible del sidebar.

## Riesgos y Fase 5

Revisión de permisos y lecturas públicas en staging autorizado, validación en
hardware/Safari, revisión comercial de campos históricos, edición real Firestore,
política de retención/paginación de espacios/tombstones y archivos subidos pero
no aplicados. Conciliación de conflictos es manual, no hay fusión de inventario.
Sin intercambio de borradores entre administradoras en esta fase. Un cambio
real del producto exige partir de una nueva base antes de aplicar progreso viejo.

## Reversión

Revertir únicamente commits de Fase 4 en orden inverso, preservar fases anteriores
y datos privados del espacio. No borrar productos, inventario ni medios. Los
espacios son ignorados por consumidores comerciales anteriores. No revertir la
protección de lectura de borradores sin una alternativa revisada: recuperar la
UI anterior no justifica volver a exponer datos no publicados. Cualquier
despliegue/reversión de Rules requiere autorización separada.

SHA/PR final: ver recibo de continuidad en CURRENT_STATE y PR de esta rama.
