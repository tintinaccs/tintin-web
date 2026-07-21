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

rules = sub_one(
    rules,
    r"    function sparkItemValid\(item, orderId\) \{.*?\n    \}\n\n    function sparkItemAtValid",
    "    function sparkItemValid(item, orderId) {\n      let productId = item.id;\n      let productPath = sparkProductPath(productId);\n      let product = exists(productPath) ? get(productPath).data : null;\n      let productAfter = existsAfter(productPath) ? getAfter(productPath).data : null;\n      return item is map &&\n        item.id is string && item.id.size() > 0 && item.id.size() <= 180 &&\n        item.name is string && item.name.size() > 0 && item.name.size() <= 180 &&\n        item.price is number && item.price >= 0 &&\n        item.qty is int && item.qty >= 1 && item.qty <= 99 &&\n        product != null &&\n        product.get('active', true) != false &&\n        product.price == item.price &&\n        item.name == product.get('name', product.get('title', product.get('Title', 'Producto'))) &&\n        (\n          product.get('stock', null) == null ||\n          (\n            product.stock is number &&\n            product.stock >= item.qty &&\n            productAfter != null &&\n            productAfter.stock is number &&\n            productAfter.stock == product.stock - item.qty &&\n            productAfter.lastStockOrderId == orderId\n          )\n        );\n    }\n\n    function sparkItemAtValid",
    'exigir stock posterior exacto desde el pedido',
)

if 'function sparkOrderHasProduct(data, productId)' not in rules:
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
    'evitar aritmética duplicada en products',
)

rules = sub_one(
    rules,
    r"orderedQty > 0 &&",
    "orderHasProduct &&",
    'rechazar productos ajenos al pedido',
)

rules = sub_one(
    rules,
    r"request\.resource\.data\.stock == resource\.data\.stock - orderedQty &&",
    "request.resource.data.stock < resource.data.stock &&",
    'dejar la igualdad exacta solo en sparkItemValid',
)

rules = sub_one(
    rules,
    r"allow update: if isSuperAdmin\(\) \|\|\s*sparkStockUpdateValid\(productId\) \|\|\s*adminInventoryStockUpdateValid\(productId\) \|\|",
    "allow update: if sparkStockUpdateValid(productId) ||\n        adminInventoryStockUpdateValid(productId) ||\n        isSuperAdmin() ||",
    'evaluar primero la ruta acotada de stock',
)

rules_path.write_text(rules, encoding='utf-8')

critical_path = Path('scripts/audit-critical-healing.js')
critical = critical_path.read_text(encoding='utf-8')
critical = re.sub(
    r"check\(\n  'Cada ítem del pedido obliga el stock posterior exacto',.*?\n\);\n",
    "check(\n  'Cada ítem del pedido obliga el stock posterior exacto',\n  rules.includes('productAfter.stock == product.stock - item.qty') &&\n    rules.includes('productAfter.lastStockOrderId == orderId'),\n  'sparkItemValid debe comprobar el estado posterior exacto del producto.'\n);\n",
    critical,
    count=1,
    flags=re.S,
)
critical = re.sub(
    r"check\(\n  'Cada baja de stock está ligada al producto y cantidad del pedido',.*?\n\);\n",
    "check(\n  'Cada baja de stock solo puede tocar un producto del pedido',\n  rules.includes('sparkOrderHasProduct(orderData, productId)') &&\n    rules.includes('orderHasProduct &&') &&\n    rules.includes('request.resource.data.stock < resource.data.stock'),\n  'La regla del producto debe rechazar productos ajenos y cualquier aumento.'\n);\n",
    critical,
    count=1,
    flags=re.S,
)
critical_path.write_text(critical, encoding='utf-8')

secure_path = Path('scripts/audit-secure-orders.js')
secure = secure_path.read_text(encoding='utf-8')
secure = re.sub(
    r"check\(\n  'Las reglas exigen el descuento exacto y vinculado al pedido',.*?\n\);",
    "check(\n  'Las reglas exigen el descuento exacto y vinculado al pedido',\n  rules.includes('productAfter.stock == product.stock - item.qty') &&\n    rules.includes('sparkOrderHasProduct(orderData, productId)') &&\n    rules.includes('orderHasProduct &&') &&\n    rules.includes('request.resource.data.stock < resource.data.stock'),\n  'El pedido obliga la cantidad exacta y products rechaza productos ajenos.'\n);",
    secure,
    count=1,
    flags=re.S,
)
secure_path.write_text(secure, encoding='utf-8')

print('[done] stock exacto exigido por pedido y pertenencia exigida por producto')
