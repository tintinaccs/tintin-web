from pathlib import Path
import re

rules_path = Path('firestore.rules')
rules = rules_path.read_text(encoding='utf-8')

item_pattern = re.compile(
    r"    function sparkItemValid\(item, orderId\) \{.*?\n    \}\n\n    function sparkItemAtValid",
    re.S,
)
item_replacement = """    function sparkItemValid(item, orderId) {
      let productId = item.id;
      let productPath = sparkProductPath(productId);
      let product = exists(productPath) ? get(productPath).data : null;
      let productAfter = existsAfter(productPath) ? getAfter(productPath).data : null;
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
          (
            product.stock is number &&
            product.stock >= item.qty &&
            productAfter != null &&
            productAfter.lastStockOrderId == orderId
          )
        );
    }

    function sparkItemAtValid"""
rules, count = item_pattern.subn(item_replacement, rules, count=1)
if count != 1:
    raise RuntimeError(f'sparkItemValid: se esperaba 1 coincidencia y se encontraron {count}')

stock_pattern = re.compile(
    r"    function sparkStockUpdateValid\(productId\) \{.*?\n    \}\n\n    function orderStateReservesInventory",
    re.S,
)
stock_replacement = """    function sparkStockUpdateValid(productId) {
      let orderId = request.resource.data.get('lastStockOrderId', '');
      let orderPath = sparkOrderPath(orderId);
      let orderData = orderId != '' && existsAfter(orderPath)
        ? getAfter(orderPath).data
        : null;
      let orderedQty = orderData != null
        ? sparkOrderQtyForProduct(orderData, productId)
        : 0;
      return isSignedIn() &&
        orderId is string &&
        orderId.size() > 0 &&
        !exists(orderPath) &&
        orderData != null &&
        orderData.source == 'spark-checkout-v1' &&
        orderData.userId == request.auth.uid &&
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

    function orderStateReservesInventory"""
rules, count = stock_pattern.subn(stock_replacement, rules, count=1)
if count != 1:
    raise RuntimeError(f'sparkStockUpdateValid: se esperaba 1 coincidencia y se encontraron {count}')

rules_path.write_text(rules, encoding='utf-8')

critical_path = Path('scripts/audit-critical-healing.js')
critical = critical_path.read_text(encoding='utf-8')
critical = re.sub(
    r"check\(\n  'Cada ítem del pedido obliga el stock posterior exacto',.*?\n\);\n",
    "check(\n  'Cada ítem obliga una escritura de stock marcada por el pedido',\n  rules.includes('productAfter.lastStockOrderId == orderId') &&\n    rules.includes('product.stock >= item.qty'),\n  'El pedido no puede crearse sin que el producto quede marcado por ese pedido.'\n);\n",
    critical,
    count=1,
    flags=re.S,
)
critical = re.sub(
    r"check\(\n  'Cada baja de stock.*?\n\);\n",
    "check(\n  'Cada baja de stock está ligada al producto y cantidad exacta',\n  rules.includes('sparkOrderQtyForProduct(orderData, productId)') &&\n    rules.includes('request.resource.data.stock == resource.data.stock - orderedQty') &&\n    rules.includes('orderedQty > 0'),\n  'La regla del producto debe calcular la baja exacta desde el pedido.'\n);\n",
    critical,
    count=1,
    flags=re.S,
)
critical_path.write_text(critical, encoding='utf-8')

secure_path = Path('scripts/audit-secure-orders.js')
secure = secure_path.read_text(encoding='utf-8')
secure = re.sub(
    r"check\(\n  'Las reglas exigen el descuento exacto y vinculado al pedido',.*?\n\);",
    "check(\n  'Las reglas exigen el descuento exacto y vinculado al pedido',\n  rules.includes('productAfter.lastStockOrderId == orderId') &&\n    rules.includes('sparkOrderQtyForProduct(orderData, productId)') &&\n    rules.includes('request.resource.data.stock == resource.data.stock - orderedQty') &&\n    rules.includes('orderedQty > 0'),\n  'El pedido exige la escritura y products calcula la cantidad exacta.'\n);",
    secure,
    count=1,
    flags=re.S,
)
secure_path.write_text(secure, encoding='utf-8')

print('[done] pedido exige marca; producto exige cantidad exacta')
