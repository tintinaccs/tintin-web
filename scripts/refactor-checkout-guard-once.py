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
if 'async function reserveCheckoutGuard(draft)' not in checkout:
    guard_function = """

  async function reserveCheckoutGuard(draft) {
    const user = auth.currentUser;
    const uid = user.uid;
    const email = text(user.email).toLowerCase();
    const orderId = `${uid}_${draft.requestId}`;
    const guardRef = doc(db, 'checkoutGuards', uid);

    return runTransaction(db, async transaction => {
      const guardSnap = await transaction.get(guardRef);
      const guardData = guardSnap.exists() ? guardSnap.data() || {} : {};
      const lastCheckoutAt = guardData.lastCheckoutAt;
      const lastCheckoutMs = typeof lastCheckoutAt?.toMillis === 'function'
        ? lastCheckoutAt.toMillis()
        : Number(new Date(lastCheckoutAt || 0));
      const sameOrder = text(guardData.lastCheckoutOrderId) === orderId;

      if (
        !sameOrder &&
        email !== SUPER_ADMIN_EMAIL &&
        Number.isFinite(lastCheckoutMs) &&
        Date.now() - lastCheckoutMs < CHECKOUT_COOLDOWN_MS
      ) {
        const remaining = Math.max(1, Math.ceil((CHECKOUT_COOLDOWN_MS - (Date.now() - lastCheckoutMs)) / 1000));
        throw appError('checkout_cooldown', 'Esperá un momento antes de crear otro pedido.', { remaining });
      }

      transaction.set(guardRef, {
        userId: uid,
        lastCheckoutAt: serverTimestamp(),
        lastCheckoutOrderId: orderId,
        updatedAt: serverTimestamp()
      }, { merge: true });

      return { orderId };
    }, { maxAttempts: 2 });
  }
"""
    checkout = replace_one(
        checkout,
        "\n  async function createOrderWithSparkTransaction(draft) {",
        guard_function + "\n  async function createOrderWithSparkTransaction(draft) {",
        'agregar transacción previa del guard',
    )

    cooldown_pattern = r"      const userData = userSnap\.data\(\) \|\| \{\};\n      const lastCheckoutAt = userData\.lastCheckoutAt;.*?      if \(email !== SUPER_ADMIN_EMAIL && settings\.storeOpen !== true\) \{"
    cooldown_replacement = "      const userData = userSnap.data() || {};\n      if (email !== SUPER_ADMIN_EMAIL && settings.storeOpen !== true) {"
    checkout = sub_one(
        checkout,
        cooldown_pattern,
        cooldown_replacement,
        'retirar cooldown del commit de pedido y stock',
    )

    checkout = replace_one(
        checkout,
        "      transaction.update(userRef, {\n        lastCheckoutAt: serverTimestamp(),\n        lastCheckoutOrderId: orderId,\n        updatedAt: serverTimestamp()\n      });\n",
        "",
        'retirar escritura del perfil en checkout',
    )

    checkout = replace_one(
        checkout,
        "      const draft = await buildDraft();\n      const result = await createOrderWithSparkTransaction(draft);",
        "      const draft = await buildDraft();\n      await reserveCheckoutGuard(draft);\n      const result = await createOrderWithSparkTransaction(draft);",
        'reservar guard antes de crear pedido',
    )
    checkout_path.write_text(checkout, encoding='utf-8')
else:
    print('[stage] checkout ya separa el guard')

rules_path = Path('firestore.rules')
rules = rules_path.read_text(encoding='utf-8')
if 'match /checkoutGuards/{userId}' not in rules:
    rules = replace_one(
        rules,
        "    function sparkOrderPath(orderId) {\n      return /databases/$(database)/documents/orders/$(orderId);\n    }",
        "    function sparkOrderPath(orderId) {\n      return /databases/$(database)/documents/orders/$(orderId);\n    }\n\n    function checkoutGuardPath(userId) {\n      return /databases/$(database)/documents/checkoutGuards/$(userId);\n    }",
        'agregar ruta checkoutGuards',
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
        'agregar validación checkoutGuards',
    )

    guard_match = """
    match /checkoutGuards/{userId} {
      allow get: if isSignedIn() && request.auth.uid == userId;
      allow create: if checkoutGuardWriteValid(userId);
      allow update: if checkoutGuardWriteValid(userId) &&
        (
          request.auth.token.email == "tintinaccs@gmail.com" ||
          request.resource.data.lastCheckoutOrderId == resource.data.lastCheckoutOrderId ||
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
        'agregar match checkoutGuards',
    )

    rules = replace_one(
        rules,
        "            loginMetadataOnlyUpdate() ||\n            checkoutGuardOnlyUpdate(userId)",
        "            loginMetadataOnlyUpdate()",
        'retirar guard de users update',
    )

    rules = replace_one(
        rules,
        "      let userPath = /databases/$(database)/documents/users/$(request.auth.uid);\n      let userData = existsAfter(userPath)\n        ? getAfter(userPath).data\n        : null;",
        "      let userPath = /databases/$(database)/documents/users/$(request.auth.uid);\n      let userData = exists(userPath)\n        ? get(userPath).data\n        : null;\n      let guardPath = checkoutGuardPath(request.auth.uid);\n      let guardData = exists(guardPath)\n        ? get(guardPath).data\n        : null;",
        'leer guard ya reservado',
    )

    rules = sub_one(
        rules,
        r"        \(\s*isSuperAdmin\(\) \|\|\s*\(\s*settings\.get\('storeOpen', false\) == true &&\s*\(userData == null \|\| userData\.get\('blocked', false\) != true\)\s*\)\s*\) &&\s*\(\s*isSuperAdmin\(\) \|\|\s*\(\s*userData != null &&\s*userData\.get\('blocked', false\) != true &&\s*userData\.lastCheckoutOrderId == orderId &&\s*userData\.lastCheckoutAt == request\.time\s*\)\s*\) &&",
        "        (\n          isSuperAdmin() ||\n          (\n            settings.get('storeOpen', false) == true &&\n            userData != null &&\n            userData.get('blocked', false) != true &&\n            guardData != null &&\n            guardData.userId == request.auth.uid &&\n            guardData.lastCheckoutOrderId == orderId &&\n            request.time <= guardData.lastCheckoutAt + duration.value(5, 'm')\n          )\n        ) &&",
        'vincular pedido a guard reciente',
    )

    rules_path.write_text(rules, encoding='utf-8')
else:
    print('[stage] reglas ya separan checkoutGuards')

test_path = Path('scripts/test-firestore-critical.mjs')
test = test_path.read_text(encoding='utf-8')
if 'async function reserveGuard(requestId)' not in test:
    reserve_test = """

async function reserveGuard(requestId) {
  const db = testEnv.authenticatedContext('u1', clientClaims).firestore();
  const orderId = `u1_${requestId}`;
  return runTransaction(db, async transaction => {
    const guardRef = doc(db, 'checkoutGuards', 'u1');
    await transaction.get(guardRef);
    transaction.set(guardRef, {
      userId: 'u1',
      lastCheckoutAt: serverTimestamp(),
      lastCheckoutOrderId: orderId,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }, { maxAttempts: 1 });
}
"""
    test = replace_one(
        test,
        "\nasync function checkoutTransaction({ requestId, decrement = 2, updateProduct = true, unrelated = false }) {",
        reserve_test + "\nasync function checkoutTransaction({ requestId, decrement = 2, updateProduct = true, unrelated = false }) {",
        'agregar reserva de guard en pruebas',
    )
    test = replace_one(
        test,
        "  const item = { id: 'p1', name: 'Producto 1', cat: 'aros', price: 50000, qty: 2, variant: '', imageUrl: '' };\n  return runTransaction(db, async transaction => {",
        "  const item = { id: 'p1', name: 'Producto 1', cat: 'aros', price: 50000, qty: 2, variant: '', imageUrl: '' };\n  await reserveGuard(requestId);\n  return runTransaction(db, async transaction => {",
        'reservar guard antes del commit probado',
    )
    test = replace_one(
        test,
        "    transaction.update(userRef, {\n      lastCheckoutAt: serverTimestamp(),\n      lastCheckoutOrderId: orderId,\n      updatedAt: serverTimestamp()\n    });\n",
        "",
        'retirar escritura de usuario de pruebas',
    )
    test_path.write_text(test, encoding='utf-8')
else:
    print('[stage] pruebas ya separan guard')

audit_path = Path('scripts/audit-critical-healing.js')
audit = audit_path.read_text(encoding='utf-8')
audit = audit.replace(
    "rules.includes('checkoutGuardOnlyUpdate(userId)') &&\n    rules.includes(\"duration.value(90, 's')\") &&\n    rules.includes('userData.lastCheckoutOrderId == orderId')",
    "checkout.includes('reserveCheckoutGuard(draft)') &&\n    rules.includes('checkoutGuardWriteValid(userId)') &&\n    rules.includes('match /checkoutGuards/{userId}') &&\n    rules.includes(\"duration.value(90, 's')\") &&\n    rules.includes('guardData.lastCheckoutOrderId == orderId')",
)
audit_path.write_text(audit, encoding='utf-8')

print('[done] guard separado preparado')
