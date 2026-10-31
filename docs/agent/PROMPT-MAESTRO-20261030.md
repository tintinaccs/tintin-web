# Prompt maestro — revisión de capturas del 30 de octubre de 2026

Agente: Codex /root. Base c1baeb4d, rama codex/prompt-maestro-20261030.
Los seis adjuntos tienen el mismo SHA256; se ejecuta una sola solicitud.
Sin PR abiertos al iniciar. Worktree aislado; no se alteran datos comerciales.

## Fase 1 — diagnóstico

Arquitectura comprobada: HTML/CSS y módulos ES, Cloudflare Pages/Functions,
Auth/Firestore con App Check y Rules, backend administrativo y pedidos
transaccionales. Firestore es autoridad; Sheets su espejo. No nueva dependencia.

- HIGH: cloudflare/contactos-pedido.mjs inserta una descripción fija de empaque,
  omite productos/número y comunica cobro cero incluso con transferencia.
  Consumidores: panel comercial y correo administrativo. Corrección en esa
  autoridad única usando el snapshot del pedido, sin consultar catálogo actual.
- HIGH: notificaciones-clientes.js y notificaciones-admin.js invocan lectura
  masiva al abrir y en cada snapshot. El requisito nuevo exige lectura voluntaria.
  API existente ya ofrece lectura individual/masiva y aísla UID y Super Admin.
- MEDIUM: búsqueda CSS fuerza 780px aunque exista un resultado; input search
  mezcla apariencia nativa con borde de marca. Corregir hoja canónica, conservar
  superficie móvil estable y teclado/cierre/estados del controlador existente.
- MEDIUM: descripción posee altura mínima, sin ajuste al contenido ni límite
  de viewport. Tres líneas caben en Chromium; el recorte exacto de Safari de la
  captura no se acredita por inferencia. Ajuste al contenido con scroll limitado,
  padding y line-height explícitos; conservar texto y scroll del editor.
- CORRECT en código: encomienda sólo transferencia y efectivo sólo delivery,
  con validación server-side. Retiro no admite efectivo; conserva transferencia
  y sólo pasarelas ya habilitadas por configuración. No se habilita PayPal.
- CORRECT en código: guardias de confirmación y solicitud idempotente;
  recuperación de ticket por UID, pasos anteriores bloqueados tras confirmar,
  popstate dirige a Inicio. Verificar runtime, no reemplazar con otro flujo.

## Fase 2

Regresión del mensaje falla antes del cambio. Autoridad corregida con número,
productos/variantes/cantidades/precios, subtotal/entrega/total y estados separados.
Sólo efectivo pendiente solicita monto de cobro; parcial no inventa saldo.
Observaciones de cada pedido, sin arrastre. No se envió WhatsApp real.
364 pruebas de checkout/pedidos/carrito/pagos PASS_LOCAL. 15 recorridos Chromium
del ticket, limpieza del carrito, reintentos y pagos en 320–1920px PASS_LOCAL.

## Fase 3

Búsqueda de escritorio ajusta altura al contenido y respeta visualViewport;
el campo usa una sola apariencia de foco y resultados compactos. La superficie
móvil estable, lista completa, estados y teclado se conservan. La prueba de
teclado simulado descubrió una regresión del límite desktop: corregida en la
hoja canónica y comprobada en 1180/1440/3840px sin reintentos.
Descripción crece hasta 55% del viewport / 420px y conserva scroll interno;
cache de geometría evita realimentar su MutationObserver. Campos/nodos,
serializador y borradores no se sustituyen. Pestañas se reparten por ancho real,
sin cortar palabras. 33 recorridos del editor (seis pasos, publicación ficticia,
variantes y geometría) PASS_LOCAL; 13 viewports de 320 a 1920, incluyendo 360,
375 y tablet vertical/horizontal. El corte de Safari de la captura permanece
NOT_VERIFIED físicamente; la accesibilidad del texto completo sí se prueba.

## Fase 4

Se retiran autolectura al abrir/snapshot y texto explicativo en ambas bandejas.
Acciones individuales/masivas usan la API existente; se esperan confirmaciones,
se conservan alertas ante fallo y se cercan cambios de sesión durante reintentos.
Grupos históricos marcan cada fila real; no inventan contadores. Las cifras de
la bandeja corresponden a su lista cargada; en cliente se indica cuando hay
historial anterior fuera de esa ventana. No se afirma un total global desconocido.
La lectura masiva conserva su presupuesto 3000 por solicitud y continúa por
cursor hasta terminar. Sólo actualiza read/updatedAt con precondición de versión,
sin sobrescribir contenido concurrente; fuentes sociales se marcan después del
commit. No cambian Rules, proveedores ni permisos.
Logo oficial blanco sobre rosa para remitente Tintin, foto o alternativa de
cliente y emisor del sistema identificado. Un único helper reemplaza los dos
renderers de iconos. Estados reales de preparación/listo/envío/entregado/incidencia
se distinguen; el cambio exclusivo de pago identifica confirmación sólo cuando
el backend la registró. Fecha completa y acción al destino existente.
68 pruebas de participación/lectura/aislamiento PASS_LOCAL; 12 Chromium de ambas
bandejas (320–1440) incluyendo fallo de lectura PASS_LOCAL.

## Fase 5 — validación local completa; CI pendiente

433 pruebas de comercio/participación, 85 controles de Super Admin, estilos y
colores PASS_LOCAL. El fixture de cutover se adaptó a importar la autoridad
compartida de estados; se comprobó cutover/rollback de WhatsApp sin datos reales.
Auditoría responsive pública de 11 rutas ×17 viewports: 187/187 PASS_LOCAL.
El auditor existente se amplía a 375, 1180 y 1366px: 33/33 casos adicionales
PASS_LOCAL. Total: 220 combinaciones de 11 rutas y 20 anchos/alturas.
15 recorridos finales de ticket/retroceso PASS_LOCAL; el harness antes excluía
el listener popstate real y ahora también lo ejecuta. Los 14 recorridos de
formularios/perfil/acceso/checkout y 12 de notificaciones del árbol final pasan.
Búsqueda completa: 29/29 PASS_LOCAL sin reintentos. Total de navegador: 103
recorridos (33 editor +29 búsqueda +15 ticket +14 formularios +12 notificaciones).
La matriz global comprueba geometría del shell sin Auth; las integraciones
comerciales se prueban en fixtures con datos ficticios, sin pedidos reales.
Build, caché, preflight y plan protegido: PASS_LOCAL; 32 archivos /50 registros
derivados canónicamente, sin reducir scopes ni gates. CI/merge/publicación PENDING por SHA propio.

 No se heredan PASS históricos. Safari físico, teclado virtual real,
sesión comercial y proveedores externos permanecen NOT_VERIFIED hasta evidencia.
