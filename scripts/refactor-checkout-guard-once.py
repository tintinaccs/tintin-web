from pathlib import Path
import re


def replace_one(text: str, before: str, after: str, label: str) -> str:
    print(f'[stage] {label}')
    count = text.count(before)
    if count != 1:
        raise RuntimeError(f'{label}: se esperaba 1 coincidencia y se encontraron {count}')
    return text.replace(before, after, 1)


def sub_one(text: str, pattern: str, replacement: str, label: str) -> str:
    print(f'[stage] {label}')
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f'{label}: se esperaba 1 coincidencia y se encontraron {count}')
    return updated


checkout_path = Path('js/secure-checkout-order.js')
checkout = checkout_path.read_text(encoding='utf-8')
if "doc(db, 'checkoutGuards', uid)" not in checkout:
    checkout = replace_one(
        checkout,
        "    const userRef = doc(db, 'users', uid);\n    const productRefs = draft.cartLines.map(line => doc(db, 'products', line.id));",
        "    const userRef = doc(db, 'users', uid);\n    const guardRef = doc(db, 'checkoutGuards', uid);\n    const productRefs = draft.cartLines.map(line => doc(db, 'products', line.id));",
        'agregar referencia dedicada del guard de checkout',
    )
    checkout = replace_one(
        checkout,
        "      const settingsSnap = await transaction.get(settingsRef);\n      const userSnap = await transaction.get(userRef);\n      const productSnaps = [];",
        "      const settingsSnap = await transaction.get(settingsRef);\n      const userSnap = await transaction.get(userRef);\n      const guardSnap = await transaction.get(guardRef);\n      const productSnaps = [];",
        'leer guard dentro de la transacción',
    )
    checkout = replace_one(
        checkout,
        "      const userData = userSnap.data() || {};\n      const lastCheckoutAt = userData.lastCheckoutAt;",
        "      const userData = userSnap.data() || {};\n      const guardData = guardSnap.exists() ? guardSnap.data() || {} : {};\n      const lastCheckoutAt = guardData.lastCheckoutAt;",
        'usar guard pequeño para el intervalo entre pedidos',
    )
    checkout = replace_one(
        checkout,
        "      transaction.update(userRef, {\n        lastCheckoutAt: serverTimestamp(),\n        lastCheckoutOrderId: orderId,\n        updatedAt: serverTimestamp()\n      });",
        "      transaction.set(guardRef, {\n        userId: uid,\n        lastCheckoutAt: serverTimestamp(),\n        lastCheckoutOrderId: orderId,\n        updatedAt: serverTimestamp()\n      }, { merge: true });",
        'guardar guard sin escribir el perfil completo',
    )
    checkout_path.write_text(checkout, encoding='utf-8')
else:
    print('[stage] checkout ya usa guard dedicado')

rules_path = Path('firestore.rules')
rules = rules_path.read_text(encoding='utf-8')
if 'match /checkoutGuards/{userId}' not in rules:
    rules = replace_one(
        rules,
        "    function sparkOrderPath(orderId) {\n      return /databases/$(database)/documents/orders/$(orderId);\n    }",
        "    function sparkOrderPath(orderId) {\n      return /databases/$(database)/documents/orders/$(orderId);\n    }\n\n    function checkoutGuardPath(userId) {\n      return /databases/$(database)/documents/checkoutGuards/$(userId);\n    }",
        'agregar ruta del guard dedicado',
    )

    guard_helper = """

    function checkoutGuardWriteValid(userId) {
      let data = request.resource.data;
      return isSignedIn() &&
        request.auth.uid == userId &&
        data.keys().hasOnly([
          'userId', 'lastCheckoutAt', 'lastCheckoutOrderId', 'updatedAt'
        ]) &&
        data.userId == userId &&
        data.lastCheckoutAt == request.time &&
        data.updatedAt == request.time &&
        data.lastCheckoutOrderId is string &&
        data.lastCheckoutOrderId.size() >= 16 &&
        data.lastCheckoutOrderId.size() <= 260;
    }
"""
    rules = sub_one(
        rules,
        r"(    function checkoutGuardOnlyUpdate\(userId\) \{.*?\n    \}\n)",
        r"\1" + guard_helper,
        'agregar validación del documento checkoutGuards',
    )

    guard_match = """
    match /checkoutGuards/{userId} {
      allow get: if isSignedIn() && request.auth.uid == userId;
      allow create: if checkoutGuardWriteValid(userId);
      allow update: if checkoutGuardWriteValid(userId) &&
        (
          request.auth.token.email == "tintinaccs@gmail.com" ||
          !('lastCheckoutAt' in resource.data) ||
          request.time > resource.data.lastCheckoutAt + duration.value(90, 's')
        );
      allow delete: if false;
    }

"""
    rules = replace_one(
        rules,
        "    /* ============================================================\n       USERS\n       ============================================================ */\n\n    match /users/{userId} {",
        "    /* ============================================================\n       CHECKOUT GUARDS\n       ============================================================ */\n\n" + guard_match + "    /* ============================================================\n       USERS\n       ============================================================ */\n\n    match /users/{userId} {",
        'agregar reglas del guard antes de usuarios',
    )

    rules = replace_one(
        rules,
        "            loginMetadataOnlyUpdate() ||\n            checkoutGuardOnlyUpdate(userId)",
        "            loginMetadataOnlyUpdate()",
        'retirar el guard de la regla pesada del perfil',
    )

    rules = replace_one(
        rules,
        "      let userPath = /databases/$(database)/documents/users/$(request.auth.uid);\n      let userData = existsAfter(userPath)\n        ? getAfter(userPath).data\n        : null;",
        "      let userPath = /databases/$(database)/documents/users/$(request.auth.uid);\n      let userData = exists(userPath)\n        ? get(userPath).data\n        : null;\n      let guardPath = checkoutGuardPath(request.auth.uid);\n      let guardData = existsAfter(guardPath)\n        ? getAfter(guardPath).data\n        : null;",
        'leer perfil sin escritura y guard posterior dedicado',
    )

    rules = sub_one(
        rules,
        r"        \(\s*isSuperAdmin\(\) \|\|\s*\(\s*settings\.get\('storeOpen', false\) == true &&\s*\(userData == null \|\| userData\.get\('blocked', false\) != true\)\s*\)\s*\) &&\s*\(\s*isSuperAdmin\(\) \|\|\s*\(\s*userData != null &&\s*userData\.get\('blocked', false\) != true &&\s*userData\.lastCheckoutOrderId == orderId &&\s*userData\.lastCheckoutAt == request\.time\s*\)\s*\) &&",
        "        (\n          isSuperAdmin() ||\n          (\n            settings.get('storeOpen', false) == true &&\n            userData != null &&\n            userData.get('blocked', false) != true &&\n            guardData != null &&\n            guardData.userId == request.auth.uid &&\n            guardData.lastCheckoutOrderId == orderId &&\n            guardData.lastCheckoutAt == request.time\n          )\n        ) &&",
        'vincular pedido al guard dedicado',
    )

    rules_path.write_text(rules, encoding='utf-8')
else:
    print('[stage] reglas ya usan checkoutGuards')

test_path = Path('scripts/test-firestore-critical.mjs')
test = test_path.read_text(encoding='utf-8')
if "doc(db, 'checkoutGuards', 'u1')" not in test:
    test = replace_one(
        test,
        "    const userRef = doc(db, 'users', 'u1');\n    const productRef = doc(db, 'products', unrelated ? 'p2' : 'p1');\n    await transaction.get(orderRef);\n    await transaction.get(userRef);",
        "    const userRef = doc(db, 'users', 'u1');\n    const guardRef = doc(db, 'checkoutGuards', 'u1');\n    const productRef = doc(db, 'products', unrelated ? 'p2' : 'p1');\n    await transaction.get(orderRef);\n    await transaction.get(userRef);\n    await transaction.get(guardRef);",
        'actualizar prueba para leer checkoutGuards',
    )
    test = replace_one(
        test,
        "    transaction.update(userRef, {\n      lastCheckoutAt: serverTimestamp(),\n      lastCheckoutOrderId: orderId,\n      updatedAt: serverTimestamp()\n    });",
        "    transaction.set(guardRef, {\n      userId: 'u1',\n      lastCheckoutAt: serverTimestamp(),\n      lastCheckoutOrderId: orderId,\n      updatedAt: serverTimestamp()\n    }, { merge: true });",
        'actualizar prueba para escribir checkoutGuards',
    )
    test_path.write_text(test, encoding='utf-8')
else:
    print('[stage] pruebas ya usan checkoutGuards')

audit_path = Path('scripts/audit-critical-healing.js')
audit = audit_path.read_text(encoding='utf-8')
audit = audit.replace(
    "rules.includes('checkoutGuardOnlyUpdate(userId)') &&\n    rules.includes(\"duration.value(90, 's')\") &&\n    rules.includes('userData.lastCheckoutOrderId == orderId')",
    "rules.includes('checkoutGuardWriteValid(userId)') &&\n    rules.includes('match /checkoutGuards/{userId}') &&\n    rules.includes(\"duration.value(90, 's')\") &&\n    rules.includes('guardData.lastCheckoutOrderId == orderId')",
)
audit_path.write_text(audit, encoding='utf-8')

print('[done] guard de checkout dedicado preparado')
