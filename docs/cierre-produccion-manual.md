# Cierre manual de producción

Este checklist contiene únicamente controles que no se pueden certificar desde el repositorio. No reemplaza las auditorías automáticas.

## 1. Recuperación fuera de la misma cuenta

- Mantener PITR, copia diaria, copia semanal y delete protection de Firestore activos.
- Después de una exportación administrada completa, conservar una copia cifrada fuera de la misma cuenta principal de Google (cuenta separada o almacenamiento offline controlado).
- No exportar pedidos/usuarios a JSON desde el navegador: contienen datos personales.
- Registrar fecha, tamaño/conteo y ubicación de la copia externa en el inventario de recuperación.

## 2. Acceso a infraestructura

Verificar 2FA/passkey y códigos de recuperación para Google/Firebase, GitHub y Cloudflare. Guardar los códigos fuera de la misma sesión/dispositivo que protege la cuenta. Revisar sesiones activas y eliminar las que no se reconozcan.

## 3. Compra transaccional controlada

Hacer una compra real de importe mínimo con un producto de prueba o de stock conocido. Confirmar, en este orden: creación del pedido, descuento exacto de stock, correo recibido, pedido visible para operación, transición de estado y datos de entrega/facturación. Luego revertir o cerrar el pedido de prueba siguiendo el flujo normal, sin editar Firestore a mano.

## 4. Evidencia

Guardar fecha, ID del pedido de prueba, resultado del correo, stock antes/después y cualquier incidencia. Si un paso falla, no repetir compras en bucle: corregir primero la causa.
