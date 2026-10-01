# Decisiones del dueño (cuestionario 2026-10-01) vs. estado del repo

Fuente: respuestas del dueño en la sesión del 2026-10-01. Estado = lo que se pudo comprobar leyendo el código en `main`; **ninguno está probado en producción**.
Leyenda: HECHO (hay código que lo cumple) · FALTA (no se encontró implementación) · REVISAR (no comprobado todavía) · DECIDIDO-ANTES (ya resuelto en otra sesión).

## Pedidos, pagos y envío
| Decisión | Estado |
|---|---|
| Transferencia nunca se cancela sola; el admin marca "pagado" | HECHO (`updatePayment` canónico + permiso `cambiarPago`; no hay cancelación automática) |
| Pago por transferencia a cuenta bancaria; datos en pantalla y por email | HECHO (checkout y correo de transferencia) |
| Efectivo contra entrega solo en delivery propio | HECHO (checkout oculta efectivo para encomienda y el servidor lo rechaza) |
| Encomienda: producto pagado antes, flete a destino | HECHO (existe `checkout-encomienda.js`; confirmar texto) |
| Ubicación: mapa y texto | HECHO (selector de ubicación en checkout y perfil) |
| Sin cambio de dirección tras ordenar | REVISAR |
| Estados: pendiente, preparando, listo_retiro, en_camino, entregado, cancelado | HECHO (`ORDER_ADMIN_STATUSES`) |
| Email al cliente: pedido recibido + **cada cambio de estado** | HECHO (`correo-estado-pedido.js` + cola/reintentos) |
| Aviso de pedido nuevo al admin: email + push + WhatsApp | HECHO/PENDIENTE OPERATIVO (email/push y enlace WhatsApp disponibles; falta validar credenciales/producción) |
| Sin método de pago preseleccionado | HECHO (ningún radio `ck-pay` inicia marcado; el servidor exige selección) |
| Stock se descuenta al confirmar el pago; última unidad gana quien confirma | HECHO (`order-admin-domain.js`, transacción/precondición y tests de carrera) |
| PayPal oculto hasta activarlo; tipo de cambio fijo configurable | HECHO/REVISAR (`paypal-seguro.js`, `paypal-rate-refresh.js`) |
| Total siempre calculado en servidor | HECHO (`audit:secure-orders`) |
| Precio que cambia en el carrito: se recalcula y se avisa | HECHO (PR #998) |

## Cupones
| Decisión | Estado |
|---|---|
| Cupón de **envío gratis**, límite por cupón y por cliente, inicio/fin, acumulable con precios rebajados, sin mínimo de compra | HECHO (PR #992; falta publicar/verificar reglas en producción) |

## Catálogo y tienda
| Decisión | Estado |
|---|---|
| Producto agotado visible con etiqueta "Agotado" | HECHO (según auditorías previas) |
| No mostrar aviso de poco stock (≤3) | HECHO (el público muestra agotado, no alerta de poco stock; el KPI es solo interno del admin) |
| Precio anterior tachado + porcentaje | HECHO (PR #998) |
| Ocultar/archivar productos sin borrar | HECHO (campo `active`; desactivar conserva el documento y sincroniza el espejo) |
| Historial de cambios de precio/stock (quién y cuándo) | HECHO en esta revisión: `auditLog.productHistory` conserva antes/después, actor y `createdAt` |
| Horario de atención en pie de página y contacto | HECHO (shell público y `contact.html`) |
| Solo español | HECHO |

## Cuentas, reseñas, favoritos
| Decisión | Estado |
|---|---|
| Favoritos requieren cuenta | HECHO (`participacion-clientes.js`, rules) |
| Reseñas: cualquier cliente con cuenta, moderación previa | HECHO (PR #986) |
| Login solo Google + OTP; teléfono obligatorio | HECHO (Área 2) |
| Hasta 5 direcciones | HECHO local (PR #989; falta publicar/verificar reglas en producción) |
| Eliminar cuenta | DIFERIDO por el dueño |
| Sesión de cliente hasta cerrar sesión; admin sin límite de inactividad | HECHO por contrato de sesión; falta prueba final en producción |
| Carrito guardado en cuenta y dispositivo | HECHO (`sincronizacion-carrito.js`) |

## Operación y calidad
| Decisión | Estado |
|---|---|
| App Check / reCAPTCHA | HECHO |
| Datos de pedidos indefinidos | HECHO (no hay purga automática de pedidos) |
| Soporte por WhatsApp | HECHO (botón/enlaces) |
| Google Sheets solo espejo | HECHO (`docs/runbook-conciliacion-checkout.md` y autoridad Firestore) |
| Push a todos los dispositivos del admin; aviso sonoro/visual de pedido nuevo | HECHO en código; falta validar configuración y entrega real en producción |
| Un solo admin (Super Admin) | HECHO |
| Pruebas solo locales/emulador | Se cumple |
| Rendimiento móvil alto, accesibilidad (contraste/teclado/etiquetas), SEO por producto | REVISAR por área |
