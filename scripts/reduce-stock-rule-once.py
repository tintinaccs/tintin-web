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
    "    function sparkItemValid(item, orderId) {\n      let productId = item.id;\n      let product = exists(sparkProductPath(productId))\n        ? get(sparkProductPath(productId)).data\n        : null;\n      return item is map &&\n        item.keys().hasOnly([\n          'id', 'name', 'cat', 'price', 'qty', 'variant', 'imageUrl'\n        ]) &&\n        item.id is string && item.id.size() > 0 && item.id.size() <= 180 &&\n        item.name is string && item.name.size() > 0 && item.name.size() <= 180 &&\n        item.cat is string && item.cat.size() <= 120 &&\n        item.price is number && item.price >= 0 &&\n        item.qty is int && item.qty >= 1 && item.qty <= 99 &&\n        item.variant is string && item.variant.size() <= 120 &&\n        item.imageUrl is string && item.imageUrl.size() <= 900 &&\n        product != null &&\n        product.get('active', true) != false &&\n        product.price == item.price &&\n        item.name == product.get('name', product.get('title', product.get('Title', 'Producto'))) &&\n        (\n          !('stock' in product) ||\n          product.stock == null ||\n          (product.stock is number && product.stock >= item.qty)\n        );\n    }\n\n    function sparkItemAtValid",
    'retirar getAfter duplicado de sparkItemValid',
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
    "check(\n  'La baja de stock exacta queda autorizada solo por el producto del pedido',\n  rules.includes('sparkOrderQtyForProduct(orderData, productId)') &&\n    rules.includes('request.resource.data.stock == resource.data.stock - orderedQty') &&\n    rules.includes('orderedQty > 0'),\n  'sparkStockUpdateValid debe amarrar producto y cantidad al pedido creado.'\n);\n",
    critical,
    count=1,
    flags=re.S,
)
critical_path.write_text(critical, encoding='utf-8')

secure_path = Path('scripts/audit-secure-orders.js')
secure = secure_path.read_text(encoding='utf-8')
secure = re.sub(
    r"check\(\n  'Las reglas exigen el descuento exacto y vinculado al pedido',.*?\n\);",
    "check(\n  'Las reglas exigen el descuento exacto y vinculado al pedido',\n  rules.includes('sparkOrderQtyForProduct(orderData, productId)') &&\n    rules.includes('request.resource.data.stock == resource.data.stock - orderedQty') &&\n    rules.includes('orderedQty > 0'),\n  'Un pedido debe descontar exactamente su cantidad y no puede tocar productos ajenos.'\n);",
    secure,
    count=1,
    flags=re.S,
)
secure_path.write_text(secure, encoding='utf-8')

print('[done] validación exacta conservada en products')
