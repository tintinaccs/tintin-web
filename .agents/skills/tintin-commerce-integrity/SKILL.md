---
name: tintin-commerce-integrity
description: "Use for cart, orders, checkout, pricing, variants, inventory and payment flows in Tintín; preserve transactional correctness and idempotency."
---

# Integridad comercial: catálogo a pedido confirmado
1. Leer docs/contratos-comercio.md, docs/contrato-logica-tienda.md y las implementaciones canónicas tocadas.
2. Precios, stock, cantidades y totales: usar autoridad real; no confiar en precio enviado por cliente.
3. Evitar pedidos duplicados y doble pago con validaciones transaccionales/idempotencia en los puntos existentes.
4. Estado optimista solo para acciones reversibles y con rollback verificable; un pedido no está confirmado sin éxito de backend.
5. Checkout completado no debe permitir volver inadvertidamente a un estado de compra activo; conservar historial y confirmación.
6. Verificar delivery, encomienda, retiro, transferencias y condiciones según configuración real; nunca agregar opciones inventadas.
7. Usar npm run test:checkout-contract, npm run test:cart-persistence, npm run audit:secure-orders y test de productos en alcance.
8. Prohibido ejecutar compras reales o modificar pedidos productivos para probar.
