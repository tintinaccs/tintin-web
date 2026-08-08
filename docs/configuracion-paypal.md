# PayPal: arquitectura y activación

Estado: **preparado en backend y desactivado**. La tienda cobra en PYG, pero PYG no figura entre las monedas admitidas por PayPal Checkout REST; por eso Tintin no muestra PayPal hasta que la propietaria defina una tasa PYG/USD.

## Contrato implementado

- Cloudflare conserva Client Secret, Webhook ID y cuenta de servicio; el navegador nunca los recibe.
- El pedido se crea primero con el contrato seguro de Apps Script y su total server-side.
- `/api/paypal-create-order` vuelve a leer ese pedido desde Firestore, comprueba UID, total y estado, convierte una sola vez y usa `PayPal-Request-Id` estable.
- `/api/paypal-capture-order` y `/api/paypal-webhook` concilian contra `paypalOrders/{providerOrderId}` y solo marcan `pagado` si moneda e importe coinciden.
- El webhook se valida mediante `verify-webhook-signature`; una redirección del navegador nunca confirma el pago.

## Pendientes antes de activar

1. Decidir la tasa comercial PYG por USD, responsable de actualizarla y vigencia máxima de siete días.
2. Crear app Sandbox/Live y cargar en secretos de Cloudflare: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` y `PAYPAL_WEBHOOK_ID`.
3. Registrar `https://<dominio>/api/paypal-webhook` para `PAYMENT.CAPTURE.COMPLETED`.
4. Cargar `PAYPAL_PYG_PER_USD`, `PAYPAL_RATE_UPDATED_AT`, mantener `PAYPAL_SETTLEMENT_CURRENCY=USD` y recién entonces usar `PAYPAL_ENABLED=true`.
5. Completar la UI de aprobación con JavaScript SDK y probar sandbox: aprobado, rechazado, cancelado, repetido, delivery, encomienda y retiro.

No se publica un botón PayPal todavía: faltan credenciales y una decisión comercial, por lo que hacerlo aparentaría una integración operativa que aún no puede verificarse.
