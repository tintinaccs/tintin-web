from pathlib import Path
import re


def replace_function(text: str, name: str, next_name: str, body: str) -> str:
    pattern = re.compile(
        rf"    function {re.escape(name)}\(.*?\) \{{.*?\n    \}}\n\n    function {re.escape(next_name)}",
        re.S,
    )
    updated, count = pattern.subn(body + f"\n\n    function {next_name}", text, count=1)
    if count != 1:
        raise RuntimeError(f'{name}: coincidencias {count}')
    return updated


path = Path('firestore.rules')
rules = path.read_text(encoding='utf-8')

rules = replace_function(
    rules, 'sparkItemValid', 'sparkItemAtValid',
    """    function sparkItemValid(item, orderId) {
      let productId = item.id;
      let product = exists(sparkProductPath(productId))
        ? get(sparkProductPath(productId)).data
        : null;
      return item is map &&
        item.id is string && item.id.size() > 0 && item.id.size() <= 180 &&
        item.name is string && item.name.size() > 0 && item.name.size() <= 180 &&
        item.price is number && item.price >= 0 &&
        item.qty is int && item.qty >= 1 && item.qty <= 99 &&
        product != null &&
        product.get('active', true) != false &&
        product.price == item.price &&
        item.name == product.get('name', product.get('title', product.get('Title', 'Producto'))) &&
        (
          product.get('stock', null) == null ||
          (product.stock is number && product.stock >= item.qty)
        );
    }"""
)

rules = replace_function(
    rules, 'sparkOrderCreateValid', 'sparkStockUpdateValid',
    """    function sparkOrderCreateValid(orderId) {
      let data = request.resource.data;
      let settingsPath = /databases/$(database)/documents/settings/general;
      let settings = exists(settingsPath) ? get(settingsPath).data : {};
      let userPath = /databases/$(database)/documents/users/$(request.auth.uid);
      let userData = exists(userPath) ? get(userPath).data : null;
      let guardPath = checkoutGuardPath(request.auth.uid);
      let guardData = exists(guardPath) ? get(guardPath).data : null;
      let items = data.items;
      return request.auth != null &&
        request.auth.token.email != null &&
        request.auth.token.email_verified == true &&
        (
          isSuperAdmin() ||
          (
            settings.get('storeOpen', false) == true &&
            userData != null &&
            userData.get('blocked', false) != true &&
            guardData != null &&
            guardData.userId == request.auth.uid &&
            guardData.lastCheckoutOrderId == orderId &&
            request.time <= guardData.lastCheckoutAt + duration.value(5, 'm')
          )
        ) &&
        orderId == request.auth.uid + '_' + data.requestId &&
        data.userId == request.auth.uid &&
        data.userEmail.lower() == request.auth.token.email.lower() &&
        data.source == 'spark-checkout-v1' &&
        items is list && items.size() >= 1 && items.size() <= 4 &&
        sparkItemsUnique(items) &&
        sparkItemAtValid(items, 0, orderId) &&
        sparkItemAtValid(items, 1, orderId) &&
        sparkItemAtValid(items, 2, orderId) &&
        sparkItemAtValid(items, 3, orderId) &&
        data.subtotal ==
          sparkLineTotal(items, 0) +
          sparkLineTotal(items, 1) +
          sparkLineTotal(items, 2) +
          sparkLineTotal(items, 3) &&
        data.shippingCost is number && data.shippingCost >= 0 &&
        data.total == data.subtotal + data.shippingCost &&
        sparkShippingValid(data, settings) &&
        (data.payment.method == 'efectivo' || data.payment.method == 'transferencia') &&
        settings.get('paymentMethods', {}).get(data.payment.method, true) != false &&
        data.payment.status == 'pendiente' &&
        data.paymentStatus == 'pendiente' &&
        data.status == 'inventory_pending' &&
        data.notificationStatus == 'pending' &&
        data.inventoryState == 'pending' &&
        data.inventoryRevision == 0 &&
        data.inventoryUpdatedAt == request.time &&
        data.createdAt == request.time &&
        data.updatedAt == request.time;
    }"""
)

rules = replace_function(
    rules, 'sparkStockUpdateValid', 'orderStateReservesInventory',
    """    function sparkStockUpdateValid(productId) {
      let orderId = request.resource.data.get('lastStockOrderId', 'missing-order');
      let orderPath = sparkOrderPath(orderId);
      let orderData = exists(orderPath) ? get(orderPath).data : null;
      let orderedQty = orderData != null
        ? sparkOrderQtyForProduct(orderData, productId)
        : 0;
      return isSignedIn() &&
        orderData != null &&
        orderData.source == 'spark-checkout-v1' &&
        orderData.userId == request.auth.uid &&
        orderData.status == 'inventory_pending' &&
        orderData.inventoryState == 'pending' &&
        orderId == request.auth.uid + '_' + orderData.requestId &&
        orderedQty > 0 &&
        request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'stock', 'lastStockOrderId', 'updatedAt'
        ]) &&
        resource.data.stock is number &&
        request.resource.data.stock is number &&
        request.resource.data.stock == resource.data.stock - orderedQty &&
        request.resource.data.stock >= 0 &&
        request.resource.data.updatedAt == request.time;
    }

    function sparkReservedItemValid(item, orderId) {
      let productAfter = existsAfter(sparkProductPath(item.id))
        ? getAfter(sparkProductPath(item.id)).data
        : null;
      return productAfter != null &&
        (
          productAfter.get('stock', null) == null ||
          productAfter.lastStockOrderId == orderId
        );
    }

    function sparkReservedItemAtValid(items, index, orderId) {
      return items.size() <= index || sparkReservedItemValid(items[index], orderId);
    }

    function sparkInventoryReserveValid(orderId) {
      let before = resource.data;
      let after = request.resource.data;
      let items = before.items;
      return isSignedIn() &&
        before.userId == request.auth.uid &&
        before.source == 'spark-checkout-v1' &&
        before.status == 'inventory_pending' &&
        before.inventoryState == 'pending' &&
        after.diff(before).affectedKeys().hasOnly([
          'status', 'inventoryState', 'inventoryRevision',
          'inventoryUpdatedAt', 'inventoryUpdatedBy', 'updatedAt'
        ]) &&
        after.status == 'pendiente' &&
        after.inventoryState == 'reserved' &&
        after.inventoryRevision == 1 &&
        after.inventoryUpdatedAt == request.time &&
        after.inventoryUpdatedBy == request.auth.token.email &&
        after.updatedAt == request.time &&
        sparkReservedItemAtValid(items, 0, orderId) &&
        sparkReservedItemAtValid(items, 1, orderId) &&
        sparkReservedItemAtValid(items, 2, orderId) &&
        sparkReservedItemAtValid(items, 3, orderId);
    }

    function sparkPendingOrderDeleteValid() {
      return isSignedIn() &&
        resource.data.userId == request.auth.uid &&
        resource.data.source == 'spark-checkout-v1' &&
        resource.data.status == 'inventory_pending' &&
        resource.data.inventoryState == 'pending';
    }

    function orderStateReservesInventory"""
)

product_match = re.compile(
    r"      allow update: if productUpdateValid\(productId\);",
    re.S,
)
product_rules = """      allow update: if sparkStockUpdateValid(productId);
      allow update: if adminInventoryStockUpdateValid(productId);
      allow update: if isSuperAdmin() ||
        (
          isStoreOpenOrAllowed() &&
          (isAdmin() || isAgent()) &&
          currentRolePermAllows('productos', 'editar')
        );"""
rules, count = product_match.subn(product_rules, rules, count=1)
if count != 1:
    raise RuntimeError(f'product allow update: coincidencias {count}')

order_match = re.compile(
    r"    match /orders/\{orderId\} \{.*?\n    \}\n\n    /\* ============================================================\n       AUDIT / PERMISSIONS",
    re.S,
)
order_rules = """    match /orders/{orderId} {
      allow create: if sparkOrderCreateValid(orderId);

      allow read: if isSuperAdmin() ||
        (
          isStoreOpenOrAllowed() &&
          (
            (
              (isAdmin() || isAgent() || isViewer()) &&
              currentRolePermAllows('pedidos', 'ver')
            ) ||
            isOwnOrderByUidOrEmail()
          )
        );

      allow update: if sparkInventoryReserveValid(orderId) ||
        isSuperAdmin() ||
        (
          isStoreOpenOrAllowed() &&
          (hasRole('admin') || hasRole('agent')) &&
          request.resource.data.diff(resource.data).affectedKeys().hasOnly([
            'status', 'payment', 'paymentStatus', 'resendCount',
            'lastResendAt', 'notificationStatus',
            'inventoryState', 'inventoryRevision', 'inventoryUpdatedAt',
            'inventoryUpdatedBy', 'updatedAt'
          ]) &&
          (
            !request.resource.data.diff(resource.data).affectedKeys().hasAny(['status']) ||
            currentRolePermAllows('pedidos', 'cambiarEstado')
          ) &&
          staffOrderInventoryTransitionValid(orderId) &&
          (
            !request.resource.data.diff(resource.data).affectedKeys().hasAny(['payment', 'paymentStatus']) ||
            currentRolePermAllows('pedidos', 'cambiarPago')
          ) &&
          (
            !request.resource.data.diff(resource.data).affectedKeys().hasAny([
              'resendCount', 'lastResendAt', 'notificationStatus'
            ]) ||
            currentRolePermAllows('pedidos', 'reenviarCorreo')
          )
        );

      allow delete: if isSuperAdmin() || sparkPendingOrderDeleteValid();
    }

    /* ============================================================
       AUDIT / PERMISSIONS"""
rules, count = order_match.subn(order_rules, rules, count=1)
if count != 1:
    raise RuntimeError(f'orders match: coincidencias {count}')

path.write_text(rules, encoding='utf-8')
print('[done] reglas de pedido pendiente y reserva final preparadas')
