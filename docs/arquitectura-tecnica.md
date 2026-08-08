# Arquitectura de Tintin Web

## Propósito

Este documento define límites y responsabilidades para evitar parches aislados, lógica duplicada y cambios que funcionen solo en una pantalla.

## Capas

### 1. Presentación

HTML y CSS de páginas públicas y administrativas. Debe consumir componentes, tokens y contratos compartidos. Ninguna vista debe recalcular por su cuenta precios, roles o estados que ya tengan una fuente central.

### 2. Aplicación

Módulos JavaScript en `js/` coordinan navegación, formularios, carrito, checkout, pedidos, administración, estados y accesibilidad. Cada módulo debe tener una responsabilidad clara y liberar listeners u observadores cuando deja de utilizarse.

### 3. Datos

Cloud Firestore es la fuente operativa de productos, colecciones, usuarios, carritos, pedidos, configuración, permisos, auditoría y contenido. Los documentos históricos de pedidos conservan una fotografía de los datos comerciales del momento de compra.

### 4. Identidad y autorización

Firebase Authentication identifica al usuario. Firestore Rules autorizan cada operación. Ocultar un botón nunca se considera control de seguridad.

El Super Admin se reconoce por la cuenta oficial. Los demás roles operativos se obtienen de documentos protegidos y permisos dinámicos. Una cuenta bloqueada no conserva poder administrativo.

### 5. Integraciones externas

- Cloudflare Pages Functions y Resend procesan los correos de pedidos con el
  remitente oficial `pedidos@tintinaccs.com`.
- Google Apps Script conserva únicamente integraciones operativas heredadas y
  la sincronización con Google Sheets; no es el remitente de pedidos.
- Google Apps Script mantiene el espejo operativo de catálogo y clientas en
  Google Sheets. Firestore sigue siendo la fuente de verdad: las ediciones de
  `Catálogo web` usan el valor capturado por el evento `onEdit`, no una lectura
  posterior de la celda, para que un refresco concurrente no restaure el stock
  anterior.
- `functions/` contiene adaptadores y documentación para funciones privadas opcionales.
- Las pasarelas de pago deben validar webhooks en infraestructura privada; GitHub Pages no puede custodiar secretos.

## Fuentes únicas de verdad

Deben centralizarse:

- roles y permisos;
- estados de pedidos y pagos;
- cálculo de precios y promociones;
- stock y movimientos de inventario;
- configuración de envíos y pagos;
- tokens visuales;
- rutas y nombres de colecciones;
- mensajes operativos reutilizados.

Un cambio en cualquiera de estos dominios obliga a buscar y revisar todos sus consumidores.

## Fronteras de seguridad

El navegador se considera un entorno no confiable. Puede solicitar acciones, pero no debe ser autoridad final para:

- aprobar pagos;
- asignar roles;
- alterar precios;
- descontar o restaurar stock sin validación;
- modificar auditoría;
- acceder a pedidos ajenos;
- decidir que una integración externa fue exitosa.

## Responsive

La adaptación no se resuelve solo con escalado. Se validan geometría, orden visual, interacción, teclado, scroll, modales, tablas, formularios, loaders y estados especiales en:

1920×1080, 1440×900, 1280×720, 1024×768, 768×1024, 390×844 y 320×568.

## Estados obligatorios

Los componentes con datos o acciones deben cubrir:

- inicial;
- cargando;
- éxito;
- vacío;
- error recuperable;
- permiso denegado;
- sesión vencida;
- conexión lenta o temporalmente no disponible;
- reintento idempotente.

El reintento no puede duplicar pedidos, correos, pagos ni movimientos de stock.

## Observabilidad

Los errores técnicos se registran con contexto suficiente y los usuarios reciben mensajes entendibles. No se registran contraseñas, tokens, direcciones completas, documentos ni datos sensibles.

Cada despliegue debe ser identificable por su versión o commit para relacionar errores con cambios concretos.

La planilla de inventario muestra un indicador fijo con los estados
`SINCRONIZANDO`, `SINCRONIZADO` y `NO SINCRONIZADO`. El indicador enlaza a
`Historial sync`, donde se registran origen, hoja, celda, valores anterior y
nuevo, resultado e identificador de cambio. El verde solo se establece después
de confirmar la escritura o lectura correspondiente en Firestore.

## Integración y despliegue

GitHub Actions verifica el repositorio y genera el manifiesto que acompaña al mismo árbol publicado. `main` es producción. Las ramas se integran mediante Pull Request después de auditorías verdes y revisión de impacto.

## Decisiones técnicas

Las decisiones que alteren arquitectura, datos, seguridad o contratos se documentan en el Pull Request y, si son permanentes, en este documento o en un ADR dentro de `docs/decisions/`.
