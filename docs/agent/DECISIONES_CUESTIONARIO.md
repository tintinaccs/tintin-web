# Decisiones del dueño (cuestionario 2026-10-01) vs. estado del repo

Fuente: respuestas del dueño en la sesión del 2026-10-01. Estado = lo comprobado leyendo el código en `main` (revisión final 2026-10-01). **Nada de esto está probado en producción**: no se hicieron compras, cobros ni correos reales.
Leyenda: HECHO (hay código que lo cumple) · LIMITE (no se implementa sin una decisión o servicio externo) · DIFERIDO (el dueño lo pospuso).

## Pedidos, pagos y envío
| Decisión | Estado |
|---|---|
| Transferencia nunca se cancela sola; el admin marca "pagado" | HECHO (no hay cancelación automática; `updatePayStatus` en `js/admin/admin-app.js` → `/api/admin-order-mutation` `updatePayment`) |
| Pago por transferencia a cuenta bancaria; datos en pantalla y por email | HECHO (pantalla: `applyBankAccounts` en `checkout.html`; correo: PR #997) |
| Pago contra entrega ("Sí, en delivery propio") | HECHO (efectivo bloqueado en encomienda en cliente y servidor: `politica-checkout-publico.js`; únicamente en delivery; encomienda admite sólo transferencia previa del producto y pago separado del envío a la transportadora al recibir) |
| Encomienda: producto pagado antes, flete a destino | HECHO (`checkout-encomienda.js`) |
| Ubicación: mapa y texto | HECHO |
| Sin cambio de dirección tras ordenar | HECHO (`firestore.rules`: la clienta no puede modificar `orders`; sólo staff/servidor) |
| Estados: pendiente, preparando, listo_retiro, en_camino, entregado, cancelado | HECHO (`ORDER_ADMIN_STATUSES`) |
| Email al cliente: pedido recibido + cada cambio de estado | HECHO (PR #993; sin cola de reintento si el envío falla) |
| Aviso de pedido nuevo al admin: email + push + WhatsApp | HECHO email y push. WhatsApp automático: LIMITE (requiere cuenta de WhatsApp Business API; hoy sólo enlaces `wa.me` manuales) |
| Sin método de pago preseleccionado | HECHO (`checkout-metodos-pago.js` sólo marca lo que eligió la clienta) |
| Stock se descuenta al confirmar el pago; gana quien confirma | HECHO (PR #994) |
| PayPal oculto hasta activarlo; tipo de cambio fijo configurable | HECHO (`nucleo-metodos-pago.js`, `paypal-rate-refresh.js`; sólo Sandbox) |
| Total siempre calculado en servidor | HECHO (`audit:secure-orders`) |
| Precio que cambia en el carrito: se recalcula y se avisa | HECHO (servidor recalcula; aviso en carrito PR #998) |

## Cupones
| Decisión | Estado |
|---|---|
| Envío gratis, límite por cupón y por cliente, inicio/fin, acumulable, sin mínimo | HECHO (PR #992; reglas de Firestore a publicar a mano; cancelar un pedido no devuelve el uso del cupón) |

## Catálogo y tienda
| Decisión | Estado |
|---|---|
| Producto agotado visible con etiqueta "Agotado" | HECHO |
| No mostrar aviso de poco stock (≤3) | HECHO (la tienda no muestra avisos de poco stock; sólo el panel cuenta "stock bajo") |
| Precio anterior tachado + porcentaje | HECHO (PR #991 catálogo/ficha; PR #998 búsqueda/carrito) |
| Ocultar/archivar productos sin borrar | HECHO (`active: false`, pestaña "Inactivos" en admin) |
| Historial de cambios de precio/stock (quién y cuándo) | HECHO (`auditLog` con correo, rol y fecha; visible en Auditoría). Activar/desactivar desde el botón rápido ahora también queda registrado. Ediciones hechas desde Sheets quedan en la hoja "Historial sync", no en `auditLog` |
| Horario de atención en pie de página y contacto | HECHO (PR #991, `tt-footer-hours`) |
| Solo español | HECHO |

## Cuentas, reseñas, favoritos
| Decisión | Estado |
|---|---|
| Favoritos requieren cuenta | HECHO |
| Reseñas: cualquier cliente con cuenta, moderación previa | HECHO (PR #986) |
| Login solo Google + OTP; teléfono obligatorio | HECHO (Área 2) |
| Hasta 5 direcciones | HECHO (PR #989; regla a publicar a mano) |
| Eliminar cuenta | DIFERIDO por el dueño |
| Sesión de cliente hasta cerrar sesión; admin sin límite de inactividad | HECHO (`browserLocalPersistence`; no existe cierre por inactividad) |
| Carrito guardado en cuenta y dispositivo | HECHO (`sincronizacion-carrito.js`) |

## Operación y calidad
| Decisión | Estado |
|---|---|
| App Check / reCAPTCHA | HECHO |
| Datos de pedidos indefinidos | HECHO |
| Soporte por WhatsApp | HECHO |
| Google Sheets solo espejo | LIMITE: Firestore ya es la fuente de verdad y los pedidos se reflejan en Sheets, pero la hoja `Productos` todavía puede editar el catálogo vía `sheets-products-webhook.js`. Cortar esa vía rompería el flujo de carga actual del dueño, así que no se desactivó sin su confirmación |
| Push a todos los dispositivos del admin; aviso sonoro/visual | HECHO (`adminPushDevices`, envío a todos los habilitados en `servicio-push.js`; sonido en `notificaciones-push-maestro.js`) |
| Un solo admin (Super Admin) | HECHO |
| Pruebas solo locales/emulador | Se cumple |
| Rendimiento, accesibilidad y SEO | Cubiertos por las auditorías del repo (`audit:*`); sin medición en producción |
