// Diagnostico acotado: no imprime secretos ni datos de clientes.
function tintinDiagnosticarFlujosProtegidos() {
  var r = tintinRevisarConfiguracionTintin();
  var p = r.products || {};
  var w = r.webhook || {};
  console.log(JSON.stringify({ok:r.ok,superAdminProtected:r.superAdminProtected,products:{ok:p.ok,usersSheet:p.usersSheet,historySheet:p.historySheet,dispatcherTriggers:p.dispatcherTriggers,reconciliationTriggers:p.reconciliationTriggers},webhook:{ok:w.ok,status:w.status,revision:w.revision}}));
}

// Usa la prueba canonica existente, que exige canary inactivo y stock cero.
function tintinConfirmarCanaryFlujos() {
  var r = tintinProbarEdicionCatalogo();
  console.log(JSON.stringify({ok:r.ok,error:r.error,destructive:r.destructive,productId:r.productId,row:r.row,inactive:r.inactive,zeroStock:r.zeroStock,actionCleared:r.actionCleared,historyRecorded:r.historyRecorded}));
}
