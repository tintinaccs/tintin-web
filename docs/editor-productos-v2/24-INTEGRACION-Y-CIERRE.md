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
