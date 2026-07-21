from pathlib import Path
import re

rules_path = Path('firestore.rules')
rules = rules_path.read_text(encoding='utf-8')

if 'function productUpdateValid(productId)' not in rules:
    marker = """    function adminInventoryStockUpdateValid(productId) {
"""
    start = rules.index(marker)
    settings = rules.index("    /* ============================================================\n       SETTINGS", start)
    helper = """
    function productUpdateValid(productId) {
      let changed = request.resource.data.diff(resource.data).affectedKeys();
      return changed.hasOnly(['stock', 'lastStockOrderId', 'updatedAt'])
        ? sparkStockUpdateValid(productId)
        : changed.hasOnly([
            'stock', 'lastInventoryOrderId', 'lastInventoryAction', 'updatedAt'
          ])
          ? adminInventoryStockUpdateValid(productId)
          : (
              isSuperAdmin() ||
              (
                isStoreOpenOrAllowed() &&
                (isAdmin() || isAgent()) &&
                currentRolePermAllows('productos', 'editar')
              )
            );
    }

"""
    rules = rules[:settings] + helper + rules[settings:]

pattern = re.compile(
    r"      allow update: if sparkStockUpdateValid\(productId\) \|\|\s*"
    r"adminInventoryStockUpdateValid\(productId\) \|\|\s*"
    r"isSuperAdmin\(\) \|\|\s*"
    r"\(\s*isStoreOpenOrAllowed\(\) &&\s*"
    r"\(isAdmin\(\) \|\| isAgent\(\)\) &&\s*"
    r"currentRolePermAllows\('productos', 'editar'\)\s*\);",
    re.S,
)
rules, count = pattern.subn(
    "      allow update: if productUpdateValid(productId);",
    rules,
    count=1,
)
if count != 1 and 'allow update: if productUpdateValid(productId);' not in rules:
    raise RuntimeError(f'No se pudo reemplazar la actualización de productos: {count}')

rules_path.write_text(rules, encoding='utf-8')
print('[done] productUpdateValid separa Checkout, inventario administrativo y edición normal')
