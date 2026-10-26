# Integración y cierre de las seis fases — 26/10/2026

Responsable: Codex /root (GPT-6). La instrucción nueva de la titular autoriza
completar correcciones, comprobaciones e integración/merge. Sustituye la
restricción anterior de mantener PR separados sin fusionar. No autoriza ejecutar
manualmente despliegues de Rules, migraciones, cobros o eliminación de datos.

## Candidato único

El PR1241 se dirige ahora a main e incluye por ascendencia los cambios de
#1237–#1240, más Fases5–6. Base main comprobada:
`f9399a90c73398a18c877bcaf1985491d4085913`.
Los cuatro PR previos se consideran reemplazados sólo después del merge protegido
del candidato completo. No se mezclan #1228/#1231/#1233 ni otras ramas ajenas.
El plan de mantenimiento se recalcula contra main para cubrir todas las fases,
sin retirar gates ni autorizar cambios por SHA antiguo.

Los informes18–23 siguen siendo recibos históricos. Este documento y el último
apartado de CURRENT_STATE describen la continuación; consultar el PR para el
SHA exacto, resultados CI, merge y su fecha. Un resultado local no acredita
CI ni producción, y un merge no certifica hardware/Safari o proveedores reales.

## Correcciones de cierre

- **INT01, MEDIUM:** CI40303230270 falló en `audit:store-gate` porque el auditor
  exigía literalmente la regla antigua `allow get: if isStoreOpenOrAllowed();`.
  Fase4 agregó correctamente publicación/actividad y permiso staff para borradores.
  Se conserva esa regla y se actualiza `scripts/auditar-control-tienda.js` para
  exigir todas las guardas vigentes en el bloque de productos. Nueva prueba
  negativa rechaza quitar tienda abierta, actividad, publicación, límite o
  sustituir el permiso de borradores por acceso libre. No se debilitan Rules.
- **INT02, MEDIUM:** listado de progreso escaneaba hasta1000 documentos y mostraba
  sólo100 activos, dejando trabajos inaccesibles desde Borradores. Se reemplaza
  por páginas REST de100 bajo `productEditorWorkspaces/{uid}/items`, ordenadas
  por nombre de documento estable. El cursor es opaco, validado y no permite elegir
  otro propietario. El servidor reaplica rol, pertenencia, privacidad, permisos
  crear/editar y exclusión de trabajos cerrados en cada página.
  “Cargar más borradores” conserva páginas, evita duplicados y reintenta el mismo
  cursor después de fallo. Una página filtrada vacía conserva el acceso a la
  siguiente. El contrato anterior `firestoreAdminList` sigue devolviendo array.

## Conservación y conflictos

No hay caducidad automática del progreso: guardar conserva los datos hasta
continuar/aplicar o descartar explícitamente. Aplicar/descartar mantiene el
registro cerrado y su auditoría; este cierre no elimina documentos ni fotos.
La paginación permite recorrer también un historial grande sin el techo anterior.
No hace falta adoptar una política destructiva de retención para usar el editor.

La resolución de conflicto continúa explícita: CAS rechaza sobrescrituras; la
administradora debe reabrir y conciliar el progreso con la versión actual. No se
fusionan automáticamente precios, identidades de variantes o cantidades. Es el
contrato de integridad, no una operación incompleta.

## Verificación y entrega

Regresiones nuevas: auditor de tienda con mutaciones negativas; paginación REST
con cursor codificado, errores404/503 y respuesta inválida; listado backend
paginado con pertenencia/privacidad; prueba con emulador de205 trabajos y orden
estable; navegador móvil con segunda página, fallo, reintento y deduplicación.
Se repite la suite completa del workspace y la etapa commerce. Los resultados
reales de esta continuación y sus huellas se registran en el recibo JSON.

CI debe ejecutarse como pull_request contra main para el SHA final, con
Repository audit, CodeQL, Cloudflare y Protected flow maintenance. Se espera y
resuelve el resultado antes de fusionar, sin bypass ni force-push. Después se
comprueba main y sus gates; el estado exacto queda en el PR y la entrega del chat.

Siguen sin afirmarse pruebas de hardware físico, lector de pantalla real,
Safari nativo o transacciones con proveedores en producción. Las comprobaciones
automatizadas usan datos sintéticos y emuladores. Rules de producción sólo se
publican mediante su flujo manual autorizado, nunca como supuesto efecto de CI.

Recibo local final: `evidencias-integracion-cierre.json`, con huellas y comandos.
150 pruebas Node administrativas/auditor,13 integraciones REST/CAS reales,
paginación móvil final, build y39 controles preflight aprobados. La corrida
amplia de24 recorridos del workspace precede al refuerzo adicional de sesión;
CI repite el workspace completo sobre la cabeza final. Los checks y registro de
merge del PR conservan el estado remoto sin atribuirlo anticipadamente.

## Segunda pasada de integración

- **INT03, MEDIUM:** CI40307127833 aprobó comercio y Rules, pero administración
  detectó que el auditor de multimedia esperaba `prodGuardar()` sin argumentos.
  Fase4 usa `prodGuardar({commit=false}={})`; se acepta la firma parametrizada
  conservando la exigencia de operación central, inicio y resultado de guardado.
  Nueva prueba negativa elimina cada uno dentro del bloque y exige rechazo.
- **INT04, MEDIUM:** la regresión existente de fallo de montaje encontró que la
  respuesta de la lista privada llamaba `renderProducts` aunque el montaje
  hubiera fallado. Eso poblaba un shell no confirmado y alteraba el respaldo.
  La respuesta sólo vuelve a renderizar si la sección tiene la marca canónica
  de montaje confirmado. La prueba existente conserva listado original, shell
  vacío y ausencia de marca en13 tamaños,320–3840px. RED antes, GREEN después.
  Se publica una URL nueva del módulo administrativo (`editor-f56-4`), sin
  reutilizar la URL ya publicada con bytes nuevos.

Los resultados del SHA bd083237 no se heredan a la nueva cabeza: CI vuelve a
validar el conjunto. No se elimina ninguna prueba ni se oculta la regresión.

## Compatibilidad y última fixture de regresión

WebKit27.2 (Playwright1.64.1, build2370):46/46 pruebas reales de navegador en
reseñas, catálogo, administración y workspace. Sin cambios a la aplicación.
El entorno no permite instalar paquetes como root: bibliotecas Debian se
extrajeron en directorio de usuario y se validó su carga efectiva. El precheck
que consulta exclusivamente el caché global de ldconfig se omitió sólo en esta
corrida adicional; no reconoce bibliotecas de usuario. El motor ejecutó todas
las aserciones, sin reintentos ni omisiones de pruebas. CI conserva su instalación
y validación completas. Esto amplía la prueba de motor, sin certificar Safari
físico ni lectores de pantalla reales.

**INT05, LOW (fixture):** en418 recorridos responsive,417 aprobaron; el restante
omitía `productVariantStockBaseline` al construir un serializador aislado con
`new Function`. La variable existe en el controlador real desde Fase3. Se
inyecta null, como en un producto nuevo, y se conserva la prueba completa:
pendiente marca dirty, Cancelar abre confirmación, Permanecer conserva fotos,
no hay subida ni limpieza. Regresión dirigida GREEN; no se eliminan aserciones.
Los417 más el caso dirigido no se presentan como una ejecución única de418.
CI repite el archivo completo sobre la cabeza final.

Las27 comprobaciones administrativas posteriores a ese batch aprobaron,
incluidos26 recorridos de editor comercial y66 de workspace/galería. Build y39
comandos preflight sobre la fixture final aprobaron. Recibo completo y huellas
en evidencias-integracion-cierre.json. El registro de CI y el merge del SHA final
son la autoridad remota; no se atribuye PASS a un run cancelado ni a otra cabeza.
