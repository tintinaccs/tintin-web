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

## 5. Sesión, perfil, carrito y responsive (checklist manual)

Estos pasos requieren un navegador real con acceso a `https://tintinaccesorios.pages.dev`; no son ejecutables desde un entorno de automatización sin esa conectividad. Marcar cada paso con fecha y resultado (OK / falla + evidencia).

**Login Google**
- [ ] Iniciar sesión con una cuenta Google real desde `/` (botón de login).
- [ ] Confirmar que la sesión persiste tras recargar la página y tras cerrar/reabrir el navegador (persistencia explícita, no solo en memoria).
- [ ] Confirmar que `/perfil` deja de mostrar el guard de "sesión requerida" y carga los datos de la cuenta.

**Login email/password**
- [ ] Registrar o iniciar sesión con email/password.
- [ ] Confirmar mensajes de error correctos ante credenciales inválidas (sin filtrar si el email existe o no).
- [ ] Confirmar persistencia de sesión igual que con Google.

**Onboarding**
- [ ] Con una cuenta nueva, confirmar que el onboarding se dispara una sola vez y no se repite en sesiones posteriores.
- [ ] Confirmar que el estado de onboarding persiste (recargar no lo vuelve a mostrar).

**Perfil**
- [ ] Confirmar que datos de otra cuenta no son accesibles ni visibles (probar con dos cuentas distintas).
- [ ] Editar un campo del perfil y confirmar que persiste tras recargar.

**Carrito**
- [ ] Agregar productos sin sesión iniciada, luego iniciar sesión: confirmar que el carrito se sincroniza sin duplicar ni perder ítems.
- [ ] Cerrar sesión y confirmar el comportamiento esperado del carrito (según diseño: se vacía o se conserva local, pero sin mezclar con la cuenta siguiente).

**Logout**
- [ ] Cerrar sesión y confirmar que `/perfil` vuelve a exigir login.
- [ ] Confirmar que no queden datos de la cuenta anterior visibles tras el logout (perfil, carrito de cuenta).

**Responsive real**
- [ ] Desktop (≥1280px): navegación, hero único, checkout.
- [ ] Tablet (768–1024px): menú/nav adaptado, sin overlap ni scroll horizontal.
- [ ] Mobile (≤430px): menú hamburguesa, botones táctiles con tamaño adecuado, checkout usable con teclado virtual.
- [ ] Probar en al menos un dispositivo/navegador real (no solo devtools), si es posible.

## 6. Coincidencia de `SHEETS_ENGAGEMENT_SECRET` (sin exponer el valor)

El flujo es Cloudflare → Apps Script: Cloudflare adjunta el secreto en el header `X-Tintin-Sheets-Secret` al llamar al deployment de Apps Script, que lo valida contra su propio valor almacenado. Nunca copiar el valor completo fuera de esos dos paneles ni pegarlo en chats, tickets o código.

**Método recomendado — prueba funcional (no requiere ver el valor):**
1. Ejecutar manualmente `.github/workflows/drenar-cola-sync-catalogo.yml` (o esperar su corrida programada cada 15 min) y revisar el log del paso que llama a `/api/catalog-sheet-sync-drain`.
2. Si Apps Script responde éxito (200 y confirmación de escritura), el secreto coincide.
3. Si responde 401/403 o el log de Cloudflare muestra el webhook fallando por secreto inválido, no coincide o falta en alguno de los dos lados.

**Método alternativo — huella parcial (si la prueba funcional no es posible ahora):**
1. En Apps Script (Configuración del proyecto → Propiedades del script), anotar solo la longitud del valor y sus últimos 4 caracteres.
2. En Cloudflare Pages (Settings → Environment variables): si la variable está definida como texto plano, comparar longitud + últimos 4 caracteres con lo anotado. Si está definida como "Secret" (cifrada), Cloudflare no permite volver a leerla — en ese caso usar únicamente el método funcional, o regenerar un valor nuevo y cargarlo idéntico en ambos paneles a la vez (así la igualdad queda garantizada por construcción, no por lectura posterior).
3. No registrar el valor completo en ningún documento, log ni mensaje.
