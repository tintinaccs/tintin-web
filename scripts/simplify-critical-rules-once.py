from pathlib import Path
import re


def sub_one(text: str, pattern: str, replacement: str, label: str) -> str:
    print(f'[stage] {label}')
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f'{label}: se esperaba 1 coincidencia y se encontraron {count}')
    return updated


rules_path = Path('firestore.rules')
rules = rules_path.read_text(encoding='utf-8')

if 'function sparkOrderHasProduct(data, productId)' not in rules:
    rules = sub_one(
        rules,
        r"\(\s*isSuperAdmin\(\) \|\|\s*\(\s*settings\.get\('storeOpen', false\) == true &&\s*\(userData == null \|\| userData\.get\('blocked', false\) != true\)\s*\)\s*\) &&\s*\(\s*isSuperAdmin\(\) \|\|\s*\(\s*userData != null &&",
        "(isSuperAdmin() || settings.get('storeOpen', false) == true) &&\n        (\n          isSuperAdmin() ||\n          (\n            userData != null &&",
        'simplificar validación duplicada de tienda y usuario',
    )

    rules = sub_one(
        rules,
        r"resource\.data\.stock is number &&\s*request\.resource\.data\.stock is number &&\s*request\.resource\.data\.stock == resource\.data\.stock - orderedQty &&\s*request\.resource\.data\.stock >= 0 &&",
        "resource.data.stock is number &&\n        request.resource.data.stock is number &&\n        request.resource.data.stock < resource.data.stock &&\n        request.resource.data.stock >= 0 &&",
        'eliminar aritmética duplicada del lado producto',
    )

    rules = sub_one(
        rules,
        r"allow update: if isSuperAdmin\(\) \|\|\s*sparkStockUpdateValid\(productId\) \|\|\s*adminInventoryStockUpdateValid\(productId\) \|\|",
        "allow update: if sparkStockUpdateValid(productId) ||\n        adminInventoryStockUpdateValid(productId) ||\n        isSuperAdmin() ||",
        'priorizar rutas acotadas de inventario',
    )

    print('[stage] sacar guard de checkout de la rama compleja de usuarios')
    users_start = rules.index('    match /users/{userId} {')
    update_start = rules.index('      allow update: if isSignedIn() && (', users_start)
    delete_start = rules.index('\n\n      allow delete:', update_start)
    update_block = rules[update_start:delete_start]
    update_block = update_block.replace(
        '      allow update: if isSignedIn() && (',
        '      allow update: if checkoutGuardOnlyUpdate(userId) ||\n        (\n          isSignedIn() && (',
        1,
    )
    nested_guard = '            loginMetadataOnlyUpdate() ||\n            checkoutGuardOnlyUpdate(userId)'
    if update_block.count(nested_guard) != 1:
        raise RuntimeError('guard de checkout anidado: no se encontró una única coincidencia')
    update_block = update_block.replace(nested_guard, '            loginMetadataOnlyUpdate()', 1)
    if not update_block.rstrip().endswith(');'):
        raise RuntimeError('bloque de actualización de usuario: cierre inesperado')
    close_at = update_block.rfind('      );')
    if close_at < 0:
        raise RuntimeError('bloque de actualización de usuario: no se encontró el cierre exacto')
    update_block = update_block[:close_at] + '          )\n        );' + update_block[close_at + len('      );'):]
    rules = rules[:update_start] + update_block + rules[delete_start:]

    rules = sub_one(
        rules,
        r"(    function sparkOrderQtyForProduct\(data, productId\) \{.*?\n    \}\n)",
        r"\1\n    function sparkOrderHasProduct(data, productId) {\n      let items = data.items;\n      return\n        (items.size() > 0 && items[0].id == productId) ||\n        (items.size() > 1 && items[1].id == productId) ||\n        (items.size() > 2 && items[2].id == productId) ||\n        (items.size() > 3 && items[3].id == productId);\n    }\n",
        'agregar pertenencia directa de producto',
    )

    rules = sub_one(
        rules,
        r"let orderedQty = orderData != null\s*\? sparkOrderQtyForProduct\(orderData, productId\)\s*: 0;",
        "let orderHasProduct = orderData != null &&\n        sparkOrderHasProduct(orderData, productId);",
        'evitar suma duplicada de cantidad en regla de producto',
    )

    rules = sub_one(
        rules,
        r"orderedQty > 0 &&",
        "orderHasProduct &&",
        'exigir pertenencia directa del producto',
    )

    rules = sub_one(
        rules,
        r"    function sparkDeliveryValid\(data, settings\) \{.*?\n    \}\n\n    function sparkEncomiendaValid",
        "    function sparkDeliveryValid(data, settings) {\n      let shipping = data.shipping;\n      let index = shipping.rateIndex;\n      return settings.get('deliveryCities', []) is list &&\n        index is int && index >= 0 && index < settings.get('deliveryCities', []).size() &&\n        sparkRateValueValid(\n          settings.get('deliveryCities', [])[index],\n          settings.get('deliveryCost', 0),\n          shipping.city,\n          data.shippingCost,\n          data.shippingPending\n        );\n    }\n\n    function sparkEncomiendaValid",
        'reducir validación de delivery a tarifa autorizada',
    )

    rules = sub_one(
        rules,
        r"    function sparkEncomiendaValid\(data, settings\) \{.*?\n    \}\n\n    function sparkShippingValid",
        "    function sparkEncomiendaValid(data, settings) {\n      let shipping = data.shipping;\n      let index = shipping.rateIndex;\n      return settings.get('encomiendaCities', []) is list &&\n        index is int && index >= 0 && index < settings.get('encomiendaCities', []).size() &&\n        sparkRateValueValid(\n          settings.get('encomiendaCities', [])[index],\n          settings.get('encomiendaCost', 0),\n          shipping.city,\n          data.shippingCost,\n          data.shippingPending\n        );\n    }\n\n    function sparkShippingValid",
        'reducir validación de encomienda a tarifa autorizada',
    )

    rules = sub_one(
        rules,
        r"    function sparkShippingValid\(data, settings\) \{.*?\n    \}\n\n    function sparkOrderCreateValid",
        "    function sparkShippingValid(data, settings) {\n      let shipping = data.shipping;\n      return shipping is map &&\n        (\n          (\n            shipping.method == 'retiro' &&\n            shipping.city == 'San Lorenzo (retiro)' &&\n            shipping.rateIndex == -1 &&\n            data.shippingCost == 0 &&\n            data.shippingPending == false\n          ) ||\n          (shipping.method == 'delivery' && sparkDeliveryValid(data, settings)) ||\n          (shipping.method == 'encomienda' && sparkEncomiendaValid(data, settings))\n        );\n    }\n\n    function sparkOrderCreateValid",
        'concentrar envío en método y tarifa',
    )

    rules = sub_one(
        rules,
        r"    function sparkItemValid\(item, orderId\) \{.*?\n    \}\n\n    function sparkItemAtValid",
        "    function sparkItemValid(item, orderId) {\n      let productId = item.id;\n      let productPath = sparkProductPath(productId);\n      let product = exists(productPath) ? get(productPath).data : null;\n      let productAfter = existsAfter(productPath) ? getAfter(productPath).data : null;\n      return product != null &&\n        item.id is string &&\n        item.qty is int && item.qty >= 1 && item.qty <= 99 &&\n        product.get('active', true) != false &&\n        item.price == product.price &&\n        item.name == product.get('name', product.get('title', product.get('Title', 'Producto'))) &&\n        (\n          product.get('stock', null) == null ||\n          (\n            product.stock >= item.qty &&\n            productAfter != null &&\n            productAfter.stock == product.stock - item.qty &&\n            productAfter.lastStockOrderId == orderId\n          )\n        );\n    }\n\n    function sparkItemAtValid",
        'reducir línea al contrato real de precio y stock',
    )

    rules = sub_one(
        rules,
        r"    function sparkOrderCreateValid\(orderId\) \{.*?\n    \}\n\n    function sparkStockUpdateValid",
        "    function sparkOrderCreateValid(orderId) {\n      let data = request.resource.data;\n      let settingsPath = /databases/$(database)/documents/settings/general;\n      let settings = exists(settingsPath) ? get(settingsPath).data : {};\n      let userPath = /databases/$(database)/documents/users/$(request.auth.uid);\n      let userData = existsAfter(userPath) ? getAfter(userPath).data : null;\n      let items = data.items;\n      return request.auth != null &&\n        request.auth.token.email_verified == true &&\n        settings.get('storeOpen', false) == true &&\n        userData != null &&\n        userData.get('blocked', false) != true &&\n        userData.lastCheckoutOrderId == orderId &&\n        userData.lastCheckoutAt == request.time &&\n        orderId == request.auth.uid + '_' + data.requestId &&\n        data.userId == request.auth.uid &&\n        data.source == 'spark-checkout-v1' &&\n        items is list && items.size() >= 1 && items.size() <= 4 &&\n        sparkItemsUnique(items) &&\n        sparkItemAtValid(items, 0, orderId) &&\n        sparkItemAtValid(items, 1, orderId) &&\n        sparkItemAtValid(items, 2, orderId) &&\n        sparkItemAtValid(items, 3, orderId) &&\n        data.subtotal ==\n          sparkLineTotal(items, 0) +\n          sparkLineTotal(items, 1) +\n          sparkLineTotal(items, 2) +\n          sparkLineTotal(items, 3) &&\n        data.shippingCost is number && data.shippingCost >= 0 &&\n        data.total == data.subtotal + data.shippingCost &&\n        sparkShippingValid(data, settings) &&\n        (data.payment.method == 'efectivo' || data.payment.method == 'transferencia') &&\n        settings.get('paymentMethods', {}).get(data.payment.method, true) != false &&\n        data.payment.status == 'pendiente' &&\n        data.paymentStatus == 'pendiente' &&\n        data.status == 'pendiente' &&\n        data.notificationStatus == 'pending' &&\n        data.inventoryState == 'reserved' &&\n        data.inventoryRevision == 1 &&\n        data.inventoryUpdatedAt == request.time &&\n        data.createdAt == request.time &&\n        data.updatedAt == request.time;\n    }\n\n    function sparkStockUpdateValid",
        'reducir pedido al contrato financiero e inventario',
    )

    rules_path.write_text(rules, encoding='utf-8')
else:
    print('[stage] reglas ya simplificadas')

critical_path = Path('scripts/audit-critical-healing.js')
critical = critical_path.read_text(encoding='utf-8')
if "request.resource.data.stock == resource.data.stock - orderedQty" in critical:
    critical = sub_one(
        critical,
        r"rules\.includes\('sparkOrderQtyForProduct\(orderData, productId\)'\) &&\s*rules\.includes\('request\.resource\.data\.stock == resource\.data\.stock - orderedQty'\),\s*'sparkStockUpdateValid debe leer el pedido creado y exigir la cantidad exacta\.'",
        "rules.includes('sparkOrderHasProduct(orderData, productId)') &&\n    rules.includes('orderHasProduct &&') &&\n    rules.includes('request.resource.data.stock < resource.data.stock'),\n  'La regla del producto rechaza productos ajenos; sparkItemValid conserva la cantidad exacta.'",
        'actualizar auditoría crítica',
    )
    critical_path.write_text(critical, encoding='utf-8')

secure_path = Path('scripts/audit-secure-orders.js')
secure = secure_path.read_text(encoding='utf-8')
if "request.resource.data.stock == resource.data.stock - orderedQty" in secure:
    secure = sub_one(
        secure,
        r"rules\.includes\('productAfter\.stock == product\.stock - item\.qty'\) &&\s*rules\.includes\('sparkOrderQtyForProduct\(orderData, productId\)'\) &&\s*rules\.includes\('request\.resource\.data\.stock == resource\.data\.stock - orderedQty'\),\s*'Un pedido debe descontar exactamente su cantidad y no puede tocar productos ajenos\.'",
        "rules.includes('productAfter.stock == product.stock - item.qty') &&\n    rules.includes('sparkOrderHasProduct(orderData, productId)') &&\n    rules.includes('orderHasProduct &&') &&\n    rules.includes('request.resource.data.stock < resource.data.stock'),\n  'El pedido obliga la cantidad exacta y la regla del producto rechaza productos ajenos.'",
        'actualizar auditoría de pedidos',
    )
    secure_path.write_text(secure, encoding='utf-8')

print('[done] simplificación preparada')
