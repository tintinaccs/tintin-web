# Decisiones del dueño (cuestionario 2026-10-01) vs. estado del repo

Fuente: respuestas del dueño en la sesión del 2026-10-01. Estado = lo que se pudo comprobar leyendo el código en `main`; **ninguno está probado en producción**.
Leyenda: HECHO (hay código que lo cumple) · FALTA (no se encontró implementación) · REVISAR (no comprobado todavía) · DECIDIDO-ANTES (ya resuelto en otra sesión).

## Pedidos, pagos y envío
| Decisión | Estado |
|---|---|
| Transferencia nunca se cancela sola; el admin marca "pagado" | REVISAR (no se encontró cancelación automática; falta confirmar el botón admin de pago) |
| Pago por transferencia a cuenta bancaria; datos en pantalla y por email | REVISAR |
| Efectivo contra entrega solo en delivery propio | REVISAR (hay lógica efectivo/delivery en `checkout.html`) |
| Encomienda: producto pagado antes, flete a destino | HECHO (existe `checkout-encomienda.js`; confirmar texto) |
| Ubicación: mapa y texto | HECHO (selector de ubicación en checkout y perfil) |
| Sin cambio de dirección tras ordenar | REVISAR |
| Estados: pendiente, preparando, listo_retiro, en_camino, entregado, cancelado | HECHO (`ORDER_ADMIN_STATUSES`) |
| Email al cliente: pedido recibido + **cada cambio de estado** | FALTA el email por cambio de estado (solo existe `sendOrderEmails` al crear/reenviar) |
| Aviso de pedido nuevo al admin: email + push + WhatsApp | REVISAR (email y push existen; WhatsApp no confirmado) |
| Sin método de pago preseleccionado | REVISAR |
| Stock se descuenta al confirmar el pago; última unidad gana quien confirma | FALTA alinear: hoy se descuenta al crear el pedido (ver Área 1 en CURRENT_STATE) |
| PayPal oculto hasta activarlo; tipo de cambio fijo configurable | HECHO/REVISAR (`paypal-seguro.js`, `paypal-rate-refresh.js`) |
| Total siempre calculado en servidor | HECHO (`audit:secure-orders`) |
| Precio que cambia en el carrito: se recalcula y se avisa | REVISAR (`pedido-checkout-seguro.js` recalcula; aviso al cliente no confirmado) |

## Cupones
| Decisión | Estado |
|---|---|
| Cupón de **envío gratis**, límite por cupón y por cliente, inicio/fin, acumulable con precios rebajados, sin mínimo de compra | **FALTA todo** (no existe ningún código de cupones) |

## Catálogo y tienda
| Decisión | Estado |
|---|---|
| Producto agotado visible con etiqueta "Agotado" | HECHO (según auditorías previas) |
| No mostrar aviso de poco stock (≤3) | REVISAR |
| Precio anterior tachado + porcentaje | FALTA (no hay `line-through` en el repo) |
| Ocultar/archivar productos sin borrar | REVISAR |
| Historial de cambios de precio/stock (quién y cuándo) | FALTA (no se encontró) |
| Horario de atención en pie de página y contacto | PARCIAL (`contact.html`; pie de página no confirmado) |
| Solo español | HECHO |

## Cuentas, reseñas, favoritos
| Decisión | Estado |
|---|---|
| Favoritos requieren cuenta | HECHO (`participacion-clientes.js`, rules) |
| Reseñas: cualquier cliente con cuenta, moderación previa | HECHO (PR #986) |
| Login solo Google + OTP; teléfono obligatorio | HECHO (Área 2) |
| Hasta 5 direcciones | HECHO local (PR #989; regla sin publicar) |
| Eliminar cuenta | DIFERIDO por el dueño |
| Sesión de cliente hasta cerrar sesión; admin sin límite de inactividad | REVISAR |
| Carrito guardado en cuenta y dispositivo | HECHO (`sincronizacion-carrito.js`) |

## Operación y calidad
| Decisión | Estado |
|---|---|
| App Check / reCAPTCHA | HECHO |
| Datos de pedidos indefinidos | HECHO (no hay purga automática de pedidos) |
| Soporte por WhatsApp | HECHO (botón/enlaces) |
| Google Sheets solo espejo | REVISAR |
| Push a todos los dispositivos del admin; aviso sonoro/visual de pedido nuevo | REVISAR |
| Un solo admin (Super Admin) | HECHO |
| Pruebas solo locales/emulador | Se cumple |
| Rendimiento móvil alto, accesibilidad (contraste/teclado/etiquetas), SEO por producto | REVISAR por área |
