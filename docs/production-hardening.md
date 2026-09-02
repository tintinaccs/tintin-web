# Endurecimiento de producción — Tintin Web

Este documento define el contrato operativo mínimo antes de publicar cambios en producción.

## 1. Observabilidad

- Todas las páginas HTML cargan `js/quality/observability.js` desde el middleware de Cloudflare.
- Los eventos se envían a `/api/telemetry` en lotes pequeños.
- Solo se aceptan categorías y métricas conocidas.
- El backend sanitiza email, teléfonos, tokens, parámetros sensibles y querystrings antes de registrar o reenviar datos.
- Cloudflare conserva el registro operativo. `OBSERVABILITY_WEBHOOK_URL` permite duplicar eventos sanitizados a un proveedor HTTPS externo.

Eventos cubiertos: errores JavaScript, promesas rechazadas, recursos que no cargan, respuestas API erróneas, pérdida/recuperación de conectividad, LCP, CLS y latencia de requests.

## 2. Antiabuso

El middleware aplica límites best-effort por IP/agente para mutaciones sensibles: autenticación OTP, participación social, checkout/pagos, Push, uploads y endpoints administrativos.

Este límite protege cada instancia de Cloudflare y complementa App Check, autenticación, reglas de Firestore y permisos de SuperAdmin. Si se requiere cuota global estricta entre regiones/instancias, migrar el contador a Cloudflare Rate Limiting, Durable Objects o KV con una estrategia atómica.

## 3. Backups

El workflow `Backup Firestore` ejecuta una exportación diaria versionada por timestamp.

Configuración requerida en GitHub Environment `production-backup`:

- `FIREBASE_SERVICE_ACCOUNT_JSON`: cuenta de servicio con permisos mínimos para exportar Firestore y escribir en el bucket.
- `FIRESTORE_BACKUP_BUCKET`: bucket dedicado, por ejemplo `gs://tintin-production-backups`.

Recomendaciones del bucket:

- ubicación compatible con Firestore;
- versionado/retención configurados;
- acceso exclusivo para cuentas operativas;
- lifecycle para eliminar copias antiguas según la política de conservación;
- alertas de costo y fallos del workflow.

## 4. Restauración

La restauración nunca se ejecuta automáticamente.

Prueba del comando sin modificar datos:

```bash
FIREBASE_PROJECT_ID=tintin-accesorios \
FIRESTORE_RESTORE_SOURCE=gs://bucket/ruta/snapshot \
node scripts/restore-firestore.mjs --dry-run
```

Restauración real:

```bash
FIREBASE_PROJECT_ID=tintin-accesorios \
FIRESTORE_RESTORE_SOURCE=gs://bucket/ruta/snapshot \
TINTIN_RESTORE_CONFIRM=RESTORE:tintin-accesorios \
node scripts/restore-firestore.mjs
```

Antes de restaurar producción:

1. confirmar el snapshot y su fecha;
2. registrar el motivo del incidente;
3. tomar un backup de emergencia del estado actual;
4. probar primero la importación en un proyecto aislado cuando sea posible;
5. validar catálogo, inventario, pedidos, usuarios, configuración y contenido;
6. recién entonces ejecutar la restauración de producción;
7. correr `npm run monitor:production` y las auditorías críticas.

La prueba de recuperación debe realizarse periódicamente en un proyecto aislado. Un backup que nunca se probó no se considera recuperación validada.

## 5. Historial y reversión

El editor visual ya conserva snapshots versionados y usa escrituras transaccionales con control de versión para publicar/restaurar. Las modificaciones administrativas críticas deben seguir el mismo patrón: actor, fecha, entidad, versión previa, versión nueva y resultado.

## 6. Gate de cambios críticos

`.github/workflows/e2e-critical.yml` ejecuta en cada PR a `main`:

- sanitización y rate limit;
- contrato de backup/restauración en modo dry-run;
- cuentas, login y aislamiento de sesión;
- carrito, checkout e inventario;
- Web Push y participación;
- seguridad, App Check y roles;
- navegación responsive;
- accesibilidad;
- SEO;
- rendimiento.

Un PR de producción no debe fusionarse si este gate o las auditorías existentes fallan.

## 7. Salud operativa

El panel/endpoint de salud existente debe ser la autoridad para Firebase, catálogo, inventario, pedidos, usuarios, reseñas, likes, correo, contenido, Visual Builder, Resend, Cloudinary, Apps Script y sincronización con Sheets.

Luego de cada despliegue comprobar como mínimo:

```bash
npm run monitor:production
npm run audit:system-health
npm run audit:performance-regressions
npm run audit:phase10
npm run audit:phase11
```

## 8. Rendimiento

Mantener módulos de página bajo demanda y CSS específico por viewport/página. No volver a concentrar funcionalidad nueva en `styles.css` ni en un único bundle inicial. Toda reducción adicional del CSS monolítico debe hacerse por secciones con pruebas visuales y presupuesto de regresión, no con eliminación automática de selectores.

## 9. Accesibilidad y SEO

Los gates de fase 10 y fase 11 son obligatorios. Toda página nueva debe conservar navegación por teclado, foco visible, contraste, objetivos táctiles adecuados, mensajes de error comprensibles, canonical, robots, sitemap y metadata estructurada cuando corresponda.

## 10. Criterio de finalización

Una mejora se considera operativamente terminada cuando puede:

1. detectarse si falla;
2. reproducirse mediante prueba o auditoría;
3. limitar abuso;
4. recuperarse sin pérdida evitable;
5. revertirse cuando modifica estado crítico;
6. verificarse antes y después del despliegue.
