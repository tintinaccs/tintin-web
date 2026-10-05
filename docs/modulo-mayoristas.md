# Pedidos mayoristas (cotizaciones)

Para clientas que revenden (emprendedoras): piden **cotizaciones** con productos y cantidades, sin pagar. Tintin pone el precio mayorista y la aprueba o la rechaza. Al aprobarla, la cuenta queda como **mayorista aprobada** y el pago/entrega se coordinan por WhatsApp.

## Flujo

1. **Clienta** (Perfil → *Compras por mayor*): emprendimiento, WhatsApp, ciudad, productos del catálogo con cantidad y variante opcional, notas → *Enviar cotización*.
2. **`POST /api/wholesale-quote`** (`functions/api/wholesale-quote.js` → `cloudflare/mayoristas.js`): exige sesión con correo verificado y cuenta no bloqueada; arma las líneas con nombre/imagen/precio minorista **leídos del catálogo** (la clienta no manda precios); numera `MAY-000001…` con `settings/wholesaleSequence`; guarda `wholesaleQuotes/{WQ_uid_requestId}` (idempotente: reintentar no duplica) y marca el perfil `wholesaleStatus: 'solicitado'`, todo en un commit atómico con auditoría.
3. **Avisos** (`cloudflare/mayoristas-avisos.js`, después del commit): notificación del panel + **push como pedido nuevo** (`order.created`) al Super Admin; notificación "Recibimos tu cotización" en la campanita de la clienta; fila en la pestaña **Mayoristas** de la planilla.
4. **Super Admin** (Panel → *Pedidos mayoristas*, solo `tintinaccs@gmail.com`): lista en vivo con badge de pendientes, detalle con precio mayorista por línea, *Guardar precios*, *Aprobar* (exige precio en todas las líneas) o *Rechazar*, nota opcional y botón para escribir por WhatsApp.
5. **`POST /api/admin-wholesale`**: valida precios (enteros en guaraníes), evita pisar cambios de otra pestaña (`expectedRevision`), y al aprobar marca el perfil `wholesaleStatus: 'aprobado'`.
6. **Al aprobar**: notificación "Cotización confirmada" en la campanita (todos los dispositivos) y **correo** confirmando que se aceptó y que una agente la contacta por WhatsApp en instantes. Al rechazar: notificación con la nota de Tintin.

## Seguridad

- `firestore.rules`: `wholesaleQuotes` no se escribe desde ningún navegador (ni Super Admin); la clienta solo lee las suyas; los campos `wholesale*` del perfil están protegidos.
- Rate limit de `/api/wholesale-quote` en el grupo *checkout* de `functions/_middleware.js`; `/api/admin-wholesale` en el grupo *admin*.

## Pasos manuales después de mergear

1. Publicar Apps Script (se agregó `apps-script/Mayoristas.gs` y una línea en `doPost`) para que aparezca la pestaña **Mayoristas**. Si no se publica, todo funciona igual y solo falta el espejo en la planilla.
2. Nada más: no hay secretos nuevos (usa `RESEND_API_KEY` y `SHEETS_ENGAGEMENT_SECRET` existentes).
