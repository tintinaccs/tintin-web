/* =============================================================
   TINTIN — MIGRACIÓN SEGURA DE IDENTIDAD + SNAPSHOTS

   Requisitos:
   - mismo proyecto Apps Script que Seguridad.gs / CrearPedido.gs /
     SyncCuentas.gs;
   - Firestore es la fuente de verdad;
   - nunca inventa username, DOB, CI ni datos de facturación;
   - nunca reasigna customerId existente;
   - es idempotente: repetirla no vuelve a cambiar datos ya canónicos.
   ============================================================= */

var TINTIN_MIGRATION_VERSION_ = 1;
var TINTIN_MIGRATION_CI_PATTERN_ = /^\d{5,8}$/;

function tintinMigrationFetch_(relativePath) {
  var response = UrlFetchApp.fetch(FIRESTORE_DOCUMENTS_URL_ + relativePath, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  var code = response.getResponseCode();
  if (code === 404) return null;
  if (code < 200 || code >= 300) throw new Error('Firestore GET falló HTTP ' + code + ': ' + relativePath);
  var body = JSON.parse(response.getContentText() || '{}');
  return phase3DecodeFields_(body.fields || {});
}

function tintinMigrationCreateIfMissing_(relativePath, data) {
  var response = UrlFetchApp.fetch(
    FIRESTORE_DOCUMENTS_URL_ + relativePath + '?currentDocument.exists=false',
    {
      method: 'patch',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      payload: JSON.stringify({ fields: phase4EncodeFields_(data) }),
      muteHttpExceptions: true
    }
  );
  var code = response.getResponseCode();
  if (code >= 200 && code < 300) return { ok: true, created: true };
  if (code === 409 || code === 412) return { ok: true, created: false };
  throw new Error('Firestore create-if-missing falló HTTP ' + code + ': ' + relativePath);
}

function tintinMigrationOrderSnapshot_(orderId, data, nowIso) {
  var shipping = data.shipping && typeof data.shipping === 'object' ? data.shipping : {};
  var payment = data.payment && typeof data.payment === 'object' ? data.payment : {};
  var invoice = data.invoice && typeof data.invoice === 'object' ? data.invoice : {};
  var items = Array.isArray(data.items) ? data.items : [];
  return {
    schemaVersion: TINTIN_MIGRATION_VERSION_,
    orderId: orderId,
    capturedAt: tintinSyncDate_(data.createdAt) || nowIso,
    source: 'migration-existing-order',
    customer: {
      customerId: tintinSyncClean_(data.customerId, 180),
      userId: tintinSyncClean_(data.userId, 180),
      email: tintinSyncClean_(data.userEmail, 254),
      contactEmail: tintinSyncClean_(data.contactEmail, 254),
      name: tintinSyncClean_(data.userName, 160),
      phone: tintinSyncClean_(data.userPhone, 50),
      ci: tintinSyncClean_(data.ci, 20)
    },
    items: items.map(function (item) {
      item = item && typeof item === 'object' ? item : {};
      return {
        productId: tintinSyncClean_(item.id, 180),
        nameAtCheckout: tintinSyncClean_(item.name, 180),
        categoryAtCheckout: tintinSyncClean_(item.cat || item.category, 120),
        unitPriceAtCheckout: Number(item.price || 0),
        quantityAtCheckout: Number(item.qty || 0),
        variantAtCheckout: tintinSyncClean_(item.variant, 160),
        imageUrlAtCheckout: tintinSyncClean_(item.imageUrl || item.image, 1000)
      };
    }),
    totals: {
      subtotal: Number(data.subtotal || 0),
      shippingCost: Number(data.shippingCost || 0),
      shippingPending: data.shippingPending === true,
      total: Number(data.total || 0)
    },
    shipping: {
      method: tintinSyncClean_(shipping.method, 50),
      encomiendaMode: tintinSyncClean_(shipping.encomiendaMode || shipping.mode, 50),
      city: tintinSyncClean_(shipping.city, 160),
      departamento: tintinSyncClean_(shipping.departamento, 100),
      address: tintinSyncClean_(shipping.address, 500),
      referencia: tintinSyncClean_(shipping.referencia || shipping.reference, 500)
    },
    payment: {
      method: tintinSyncClean_(payment.method, 50),
      statusAtCheckout: tintinSyncClean_(payment.status || data.paymentStatus, 50)
    },
    invoice: {
      wanted: invoice.wanted === true,
      razonSocial: tintinSyncClean_(invoice.razonSocial, 220),
      ruc: tintinSyncClean_(invoice.ruc, 30)
    }
  };
}

function tintinMigrationLogConflict_(type, entityId, message, changeId) {
  try {
    tintinSyncWriteMeta_(type, entityId, '', changeId || '', 'conflict', String(message || '').slice(0, 1000));
  } catch (error) {
    console.error('[TintinMigration] No se pudo registrar conflicto:', error);
  }
}

function tintinMigrationAuditSummary_(summary, changeId, nowIso) {
  var eventId = 'EVT_' + Utilities.getUuid().replace(/-/g, '');
  tintinMigrationCreateIfMissing_('auditLog/' + eventId, {
    eventId: eventId,
    timestamp: nowIso,
    createdAt: nowIso,
    customerId: '',
    actorId: 'apps-script-migration',
    actorEmail: Session.getEffectiveUser().getEmail() || '',
    actorRole: 'superadmin',
    action: 'migrar_identidad_canonica',
    entityType: 'sistema',
    entityId: 'accounts-v' + TINTIN_MIGRATION_VERSION_,
    before: null,
    after: summary,
    origin: 'apps-script',
    result: summary.conflicts > 0 ? 'partial' : 'success',
    changeId: changeId
  });
}

function tintinMigrateCanonicalData_() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var nowIso = new Date().toISOString();
  var changeId = tintinSyncChangeId_('MIGRATION');
  var summary = {
    usersScanned: 0,
    usersPatched: 0,
    ciReservationsCreated: 0,
    ordersScanned: 0,
    ordersPatched: 0,
    snapshotsCreated: 0,
    conflicts: 0
  };

  try {
    var users = tintinSyncFirestoreList_('users');
    summary.usersScanned = users.length;

    users.forEach(function (record) {
      var uid = record.id;
      var data = record.data || {};
      var expectedCustomerId = 'CUS_' + uid;
      var existingCustomerId = tintinSyncClean_(data.customerId, 180);
      if (existingCustomerId && existingCustomerId !== expectedCustomerId) {
        summary.conflicts += 1;
        tintinMigrationLogConflict_('user', uid, 'customerId existente no coincide con CUS_<uid>', changeId);
        return;
      }

      var patch = {};
      if (!existingCustomerId) patch.customerId = expectedCustomerId;
      if (!data.identityVersion) patch.identityVersion = 1;
      if (!data.profileStatus) patch.profileStatus = 'legacy';
      if (Object.keys(patch).length) {
        patch.updatedAt = nowIso;
        patch.lastChangeId = changeId;
        tintinSyncFirestorePatch_('users', uid, patch);
        summary.usersPatched += 1;
        data = Object.assign({}, data, patch);
      }

      var ci = tintinSyncClean_(data.ci, 8);
      if (ci && TINTIN_MIGRATION_CI_PATTERN_.test(ci)) {
        var reservation = tintinMigrationFetch_('ciReservations/' + encodeURIComponent(ci));
        if (reservation && String(reservation.uid || '') !== uid) {
          summary.conflicts += 1;
          tintinMigrationLogConflict_('ci', ci, 'La CI aparece vinculada a más de un UID; no se reasignó.', changeId);
        } else if (!reservation) {
          var created = tintinMigrationCreateIfMissing_('ciReservations/' + encodeURIComponent(ci), {
            uid: uid,
            customerId: expectedCustomerId,
            createdAt: nowIso,
            source: 'migration'
          });
          if (created.created) summary.ciReservationsCreated += 1;
        }
      }
    });

    var orders = tintinSyncFirestoreList_('orders');
    summary.ordersScanned = orders.length;
    orders.forEach(function (record) {
      var orderId = record.id;
      var data = record.data || {};
      var patch = {};
      var uid = tintinSyncClean_(data.userId, 180);
      var customerId = tintinSyncClean_(data.customerId, 180);

      if (!customerId && uid) {
        patch.customerId = 'CUS_' + uid;
        customerId = patch.customerId;
      }
      if (!data.checkoutSnapshot) {
        var snapshotInput = Object.assign({}, data, { customerId: customerId });
        patch.checkoutSnapshot = tintinMigrationOrderSnapshot_(orderId, snapshotInput, nowIso);
        patch.snapshotVersion = TINTIN_MIGRATION_VERSION_;
        summary.snapshotsCreated += 1;
      }
      if (Object.keys(patch).length) {
        patch.updatedAt = data.updatedAt || nowIso;
        patch.lastChangeId = changeId;
        tintinSyncFirestorePatch_('orders', orderId, patch);
        summary.ordersPatched += 1;
      }
    });

    tintinMigrationAuditSummary_(summary, changeId, nowIso);
    tintinSyncWriteMeta_('system', 'migration-v' + TINTIN_MIGRATION_VERSION_, nowIso, changeId, summary.conflicts ? 'partial' : 'synced', summary.conflicts ? String(summary.conflicts) + ' conflicto(s); revisar SyncMeta' : '');
    return { ok: summary.conflicts === 0, changeId: changeId, summary: summary };
  } finally {
    lock.releaseLock();
  }
}

function tintinEnsureOrderSnapshots_() {
  var orders = tintinSyncFirestoreList_('orders');
  var nowIso = new Date().toISOString();
  var count = 0;
  orders.forEach(function (record) {
    var data = record.data || {};
    if (data.checkoutSnapshot) return;
    var uid = tintinSyncClean_(data.userId, 180);
    var customerId = tintinSyncClean_(data.customerId, 180) || (uid ? 'CUS_' + uid : '');
    var patch = {
      checkoutSnapshot: tintinMigrationOrderSnapshot_(record.id, Object.assign({}, data, { customerId: customerId }), nowIso),
      snapshotVersion: TINTIN_MIGRATION_VERSION_,
      lastChangeId: tintinSyncChangeId_('SNAPSHOT')
    };
    if (!data.customerId && customerId) patch.customerId = customerId;
    tintinSyncFirestorePatch_('orders', record.id, patch);
    count += 1;
  });
  return { ok: true, created: count };
}
