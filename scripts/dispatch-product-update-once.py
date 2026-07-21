from pathlib import Path
import re

rules_path = Path('firestore.rules')
rules = rules_path.read_text(encoding='utf-8')

admin_pattern = re.compile(
    r"    function adminInventoryStockUpdateValid\(productId\) \{.*?\n    \}\n\n\n    function productUpdateValid",
    re.S,
)
admin_replacement = """    function adminInventoryStockUpdateValid(productId) {
      let orderId = request.resource.data.get('lastInventoryOrderId', 'missing-order');
      let orderPath = sparkOrderPath(orderId);
      let beforeOrder = exists(orderPath) ? get(orderPath).data : {};
      let afterOrder = existsAfter(orderPath) ? getAfter(orderPath).data : {};
      let beforeItems = beforeOrder.get('items', []);
      let afterItems = afterOrder.get('items', []);
      let beforeQty = beforeItems.size() > 0 && orderStateReservesInventory(beforeOrder)
        ? sparkOrderQtyForProduct(beforeOrder, productId)
        : 0;
      let afterQty = afterItems.size() > 0 && orderStateReservesInventory(afterOrder)
        ? sparkOrderQtyForProduct(afterOrder, productId)
        : 0;
      return isSignedIn() &&
        (hasRole('admin') || hasRole('agent')) &&
        beforeItems.size() > 0 &&
        afterItems.size() > 0 &&
        beforeQty != afterQty &&
        request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'stock', 'lastInventoryOrderId', 'lastInventoryAction', 'updatedAt'
        ]) &&
        resource.data.stock is number &&
        request.resource.data.stock is number &&
        request.resource.data.stock == resource.data.stock + beforeQty - afterQty &&
        request.resource.data.stock >= 0 &&
        (
          (afterQty > beforeQty && request.resource.data.lastInventoryAction == 'reserve') ||
          (afterQty < beforeQty && request.resource.data.lastInventoryAction == 'release')
        ) &&
        request.resource.data.updatedAt == request.time;
    }


    function productUpdateValid"""
rules, count = admin_pattern.subn(admin_replacement, rules, count=1)
if count != 1:
    raise RuntimeError(f'adminInventoryStockUpdateValid: coincidencias {count}')

product_pattern = re.compile(
    r"    function productUpdateValid\(productId\) \{.*?\n    \}\n\n    /\* ============================================================\n       SETTINGS",
    re.S,
)
product_replacement = """    function productUpdateValid(productId) {
      let changed = request.resource.data.diff(resource.data).affectedKeys();
      return
        (
          changed.hasOnly(['stock', 'lastStockOrderId', 'updatedAt']) &&
          sparkStockUpdateValid(productId)
        ) ||
        (
          changed.hasOnly([
            'stock', 'lastInventoryOrderId', 'lastInventoryAction', 'updatedAt'
          ]) &&
          adminInventoryStockUpdateValid(productId)
        ) ||
        (
          !changed.hasAny([
            'lastStockOrderId', 'lastInventoryOrderId', 'lastInventoryAction'
          ]) &&
          (
            isSuperAdmin() ||
            (
              isStoreOpenOrAllowed() &&
              (isAdmin() || isAgent()) &&
              currentRolePermAllows('productos', 'editar')
            )
          )
        );
    }

    /* ============================================================
       SETTINGS"""
rules, count = product_pattern.subn(product_replacement, rules, count=1)
if count != 1:
    raise RuntimeError(f'productUpdateValid: coincidencias {count}')

rules_path.write_text(rules, encoding='utf-8')
print('[done] rutas de actualización de producto seguras y tolerantes a campos ausentes')
