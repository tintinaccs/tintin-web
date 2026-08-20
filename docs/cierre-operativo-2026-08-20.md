# Cierre operativo — 20/08/2026

Este documento separa lo comprobable desde el repositorio/CI de lo que requiere acceso directo a cuentas externas. No se considera aprobada una tarea externa solo porque exista documentación sobre ella.

## Decisiones de esta ronda

- **Compra real: diferida.** No se ejecuta ni se usa como requisito de esta etapa.
- Se utiliza `docs/prueba-e2e-sin-cobro.md` para validación controlada sin cobro ni mutación de stock/pedidos reales.
- **No ejecutar todavía el cutover de `tintinaccs.com`.**
- No cambiar secretos, DNS, planes, 2FA, usuarios ni permisos externos sin una sesión autorizada y revisión explícita.

## Estado comprobado desde GitHub

| Área | Estado | Evidencia / observación |
| --- | --- | --- |
| Node | OK | `package.json` exige Node >=22 y los workflows recientes usan Node 22. |
| Dependabot config | OK en código | `.github/dependabot.yml` existe. La activación de Dependabot Alerts/secret scanning en Settings requiere verificación externa. |
| CI reciente | OK | Auditorías de comercio, seguridad, integración, responsive, SEO y smoke público han pasado en ejecuciones recientes. |
| Checkout/inventario | OK a nivel de contratos y pruebas | Hay cobertura de idempotencia, transacción de pedido+stock, liberación de inventario y reglas Firestore en emulador. |
| Redirects Shopify en preview | OK en CI reciente | El gate de Cloudflare verificó redirects canónicos en el preview. Esto no equivale al cutover del dominio principal. |
| Backup del repositorio dentro de GitHub | OK | Existe workflow semanal que crea bundle, verifica y simula restauración. Sigue faltando una copia independiente fuera de GitHub. |
| Auditor SEO en Windows | Corregido en esta rama | Se normalizan CRLF/LF antes de comprobar `robots.txt`. |
| Warning ESM puntual | Corregido en esta rama | `functions/js` declara ESM de forma local, sin convertir los scripts CommonJS del root. |
| Auditoría npm trazable | Agregada en esta rama | Workflow semanal/manual/PR guarda JSON completo y de producción durante 30 días y bloquea severidades por encima de la política definida. |
| Deuda CSS | Pendiente de baja prioridad | No se refactoriza en este cierre para evitar regresiones innecesarias. |

## Firestore: corrección importante al listado anterior

La documentación del propio proyecto registra una verificación contra infraestructura real realizada el **08/08/2026**. Según ese registro:

- PITR activo con 7 días;
- respaldo diario con 30 días de retención;
- respaldo semanal con 84 días;
- exportación completa de 960 documentos;
- importación de prueba 960/960 en `restauracion-prueba`;
- conteos coincidentes para productos, pedidos, usuarios, colecciones y settings;
- protección contra borrado habilitada en la base productiva.

Por lo tanto, el pendiente ya no debe formularse como “`orders`, `users`, `auditLog` y `emailLogs` no tienen respaldo”. El riesgo real documentado es otro: **los respaldos siguen dependiendo de la misma cuenta de Google y falta una copia externa independiente con una política operativa mantenida**.

Esta ronda no puede revalidar la consola actual de Google/Firebase porque no tiene acceso autenticado a esa cuenta. El registro del 08/08/2026 se trata como evidencia histórica, no como lectura en vivo del 20/08/2026.

## Dependencias: estado actual

El issue histórico de dependencias está parcialmente desactualizado: Node 22 y Dependabot ya están presentes.

En una ejecución CI reciente, `npm ci` informó **3 vulnerabilidades moderadas** en el árbol completo. No se observaron altas/críticas en ese log. La nueva auditoría guarda los JSON completos para que el resultado deje de depender de un texto histórico del issue.

Política de la nueva CI:

- árbol completo: falla con vulnerabilidades **high/critical**;
- dependencias de producción: falla con vulnerabilidades **moderate/high/critical**;
- conserva `npm-audit-full.json` y `npm-audit-production.json` 30 días.

No se ejecuta `npm audit fix --force` automáticamente.

## Pendientes externos que NO pueden cerrarse desde este repositorio

### Seguridad de cuentas — HIGH

Requiere entrar a las cuentas reales y revisar:

- GitHub Apps y OAuth Apps;
- webhooks;
- deploy keys y tokens;
- Actions secrets/environments;
- sesiones y dispositivos activos;
- 2FA/passkeys;
- códigos de recuperación guardados fuera de los equipos principales;
- Google/Firebase;
- Cloudflare;
- proveedor de correo/Resend;
- registrador del dominio;
- Cloudinary.

**Hallazgo de esta ronda:** el repositorio `tintinaccs/tintin-web` figura actualmente como **público**. No se cambia su visibilidad automáticamente. Debe decidirse expresamente si eso es intencional.

### Copias fuera del proveedor — HIGH

Todavía hay que comprobar operativamente:

- bundle Git cifrado almacenado fuera de GitHub;
- exportación Firestore copiada fuera de la misma cuenta de Google, si la política elegida lo requiere;
- originales de Cloudinary en una segunda ubicación;
- registro de fecha/checksum/responsable;
- prueba periódica de recuperación desde esas copias independientes.

### Operación y cuotas — MEDIUM

Requiere acceso a dashboards reales para definir/verificar:

- responsable de alertas;
- revisión mensual;
- restauración trimestral;
- cuotas/alertas de Firebase;
- Cloudflare;
- Cloudinary;
- Resend/correo;
- presupuesto o alertas de facturación si correspondiera.

### Pre-cutover — BLOQUEADO

Antes de mover `tintinaccs.com` hay que verificar con cuentas/dispositivos reales:

- Firebase Auth;
- Google Login escritorio;
- Google Login móvil;
- App Check enforcement;
- CSP real;
- Cloudinary;
- correo;
- redirects Shopify;
- Search Console;
- DNS;
- certificado TLS;
- smoke autenticado sin mutaciones;
- decisión explícita sobre la compra real diferida.

Hasta completar lo anterior, **no ejecutar el cambio de dominio**.

### Revisión externa — MEDIUM

No puede autodeclararse como completada por el mismo repositorio:

- auditoría de seguridad independiente;
- revisión jurídica profesional de privacidad, términos, envíos, cambios y devoluciones.

## Orden operativo actualizado

1. Fusionar únicamente cambios técnicos de bajo riesgo después de CI verde.
2. Resolver la decisión sobre visibilidad pública/privada del repositorio.
3. Verificar seguridad de cuentas y recuperación de accesos.
4. Crear/confirmar copias cifradas independientes fuera de los proveedores principales.
5. Revalidar Firestore/Cloudinary y hacer la prueba periódica de recuperación correspondiente.
6. Ejecutar el smoke autenticado **sin mutaciones**.
7. Revisar cuotas, alertas y responsables.
8. Completar checklist pre-cutover.
9. Autorizar explícitamente el cutover cuando todo lo anterior esté aprobado.
10. Dejar deuda CSS, PayPal, Web Push y funciones experimentales para después del cierre.

## Criterio de avance

Un ítem solo se marca como `OK` cuando existe evidencia verificable. Si depende de una consola o cuenta no accesible desde la sesión actual, debe quedar como `PENDIENTE EXTERNO`, aunque el código esté preparado para ello.
