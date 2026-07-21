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
    rules, 'sparkDeliveryValid', 'sparkEncomiendaValid',
    """    function sparkDeliveryValid(data, settings) {
      let shipping = data.shipping;
      let index = shipping.rateIndex;
      return settings.get('deliveryCities', []) is list &&
        index is int && index >= 0 && index < settings.get('deliveryCities', []).size() &&
        sparkRateValueValid(
          settings.get('deliveryCities', [])[index],
          settings.get('deliveryCost', 0),
          shipping.city,
          data.shippingCost,
          data.shippingPending
        );
    }"""
)

rules = replace_function(
    rules, 'sparkEncomiendaValid', 'sparkShippingValid',
    """    function sparkEncomiendaValid(data, settings) {
      let shipping = data.shipping;
      let index = shipping.rateIndex;
      return settings.get('encomiendaCities', []) is list &&
        index is int && index >= 0 && index < settings.get('encomiendaCities', []).size() &&
        sparkRateValueValid(
          settings.get('encomiendaCities', [])[index],
          settings.get('encomiendaCost', 0),
          shipping.city,
          data.shippingCost,
          data.shippingPending
        );
    }"""
)

rules = replace_function(
    rules, 'sparkShippingValid', 'sparkOrderCreateValid',
    """    function sparkShippingValid(data, settings) {
      let shipping = data.shipping;
      return shipping is map &&
        shipping.method is string &&
        shipping.city is string &&
        (
          (
            shipping.method == 'retiro' &&
            shipping.city == 'San Lorenzo (retiro)' &&
            shipping.rateIndex == -1 &&
            data.shippingCost == 0 &&
            data.shippingPending == false
          ) ||
          (shipping.method == 'delivery' && sparkDeliveryValid(data, settings)) ||
          (shipping.method == 'encomienda' && sparkEncomiendaValid(data, settings))
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
        settings.get('storeOpen', false) == true &&
        userData != null &&
        userData.get('blocked', false) != true &&
        guardData != null &&
        guardData.userId == request.auth.uid &&
        guardData.lastCheckoutOrderId == orderId &&
        request.time <= guardData.lastCheckoutAt + duration.value(5, 'm') &&
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
        data.status == 'pendiente' &&
        data.notificationStatus == 'pending' &&
        data.inventoryState == 'reserved' &&
        data.inventoryRevision == 1 &&
        data.inventoryUpdatedAt == request.time &&
        data.createdAt == request.time &&
        data.updatedAt == request.time;
    }"""
)

path.write_text(rules, encoding='utf-8')
print('[done] contrato de pedido reducido a cuenta, precio, tarifa, total y stock')
