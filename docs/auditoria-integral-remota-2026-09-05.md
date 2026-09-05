# Auditoría técnica integral remota — Tintin

**Fecha de corte:** 2026-09-05  
**Repositorio:** \`tintinaccs/tintin-web\`  
**Versión candidata:** PR #692 en borrador; consultar su HEAD y los checks del mismo commit.  
**Producción observada:** \`https://tintinaccesorios.pages.dev\` (rama \`main\`)

## Alcance

El alcance solicitado comprende el repositorio completo, no solo el PR #666: páginas públicas, checkout, autenticación, perfil, panel administrativo, Cloudflare Functions, Firestore, Cloudinary, Sheets/Apps Script, CI/CD, artefactos generados, seguridad, accesibilidad, responsive, SEO, rendimiento, sincronización y observabilidad. La revisión sigue en curso: este documento no certifica cobertura funcional exhaustiva ni ausencia de defectos.

No se eliminó una función de negocio por apariencia o duplicación. Los cambios se contrastaron con rutas, consumidores, contratos y artefactos generados. Producción y operaciones destructivas no fueron modificadas.

## Estado ejecutivo

| Área | Estado | Evidencia o límite |
|---|---|---|
| Código candidato | Incompleto | Persisten defectos de conservación de fotos e identidad pública |
| CI/CD | Consultar por commit | Los checks de commits anteriores no validan automáticamente el HEAD actual |
| Navegación | Verificado automáticamente | Smoke de 18 páginas aprobado |
| Responsive/UI | Verificado automáticamente | Viewports, geometría y UI aprobados |
| Seguridad/Firestore | Verificado en código y emulador | Reglas adversariales aprobadas |
| Auth real | Pendiente de prueba | Requiere credenciales y cuentas reales |
| Compra real | Pendiente de prueba | Requiere ejecución controlada |
| Producción | Sin cambios | \`main\` no fue fusionada ni desplegada |

## Fuentes de verdad

| Dominio | Autoridad canónica | Proyección/consumidor |
|---|---|---|
| Identidad y acceso | Firebase Auth | UI, backend y perfil |
| Roles y permisos | Firestore/backend | Panel, endpoints y visibilidad |
| Usuarios, pedidos y fidelidad | Firestore/backend | Admin, cliente y Apps Script |
| Binarios de fotos | Cloudinary | URL transformada en UI |
| Metadatos y moderación de fotos | Firestore | Admin y auditoría |
| Historial inmutable | \`auditLog\` | Diagnóstico |
| Operación tabular | Google Sheets | Espejo/reconciliación |
| Automatización | Apps Script | Puente controlado al backend |

Sheets no debe competir con Firestore ni crear una segunda identidad. La sincronización debe ser dirigida, idempotente y auditable; copiar todo en todo produciría ciclos y conflictos.

## Cambios incorporados al candidato, sujetos a validación funcional

- Persistencia local de Firebase Auth y espera antes de redirects protegidos.
- Coordinación de actividad entre pestañas, expiración de cuentas regulares y excepción permanente del Super Admin.
- OTP sin sesgo modular y rechazo de OTP para cuentas Google.
- Mensajes diferenciados para popup bloqueado, Google, OTP vencido, almacenamiento no disponible y sesión inválida.
- Identidad pública segura y anonimización de clientes según rol.
- Permisos server-side para respuestas de staff.
- Fotos con Cloudinary, metadatos Firestore, moderación, reemplazo administrativo y auditoría append-only.
- Reconciliación de perfiles sin documentos duplicados.
- Fidelidad basada solo en compras válidas; cancelados y reembolsados excluidos.
- Niveles configurables; notificaciones de ascenso al cliente y administrador. Las bajadas solo avisan al administrador.
- Cambios de pago administrativo protegidos por autorización del servidor.
- Favicon de libélula y referencias cache-versionadas.
- Manifesto diagnóstico reproducible y CI dividido en etapas observables.
- Retiro del workflow temporal que fallaba sin jobs.

## Hallazgos y riesgos

### H1 — Producción aún no contiene la versión auditada

**Severidad:** alta operativa.  
**Causa:** #692 sigue abierto y no hubo merge/deploy.  
**Impacto:** los arreglos todavía no están activos para clientes reales.  
**Solución:** resolver primero los bloqueantes H7–H9 y completar pruebas del candidato; solo después considerar una fusión autorizada y smoke autenticado.  
**Riesgo:** medio; requiere ventana controlada y rollback.

### H2 — Auth real multi-entorno sin evidencia empírica

**Severidad:** alta de validación.  
**Causa:** CI sin credenciales no puede probar Google, OTP, cookies ni restricciones de cada navegador.  
**Impacto:** popup/redirect, pestaña nueva, Brave, móvil, incógnito y cambio de red siguen sin certificación real.  
**Solución:** ejecutar \`docs/prueba-compra-real.md\` y registrar resultados sin secretos.

### H3 — Proveedores externos requieren comprobación operativa

**Severidad:** alta de continuidad.  
**Causa:** el repositorio no puede leer secretos, cuotas, 2FA, webhooks ni backups privados.  
**Impacto:** configuración externa incorrecta puede producir 401/403/502 aunque el código sea correcto.  
**Solución:** seguir \`docs/inventario-recuperacion-servicios.md\` y \`docs/recuperacion-firestore.md\`.

### H4 — Candidatos antiguos abiertos en GitHub

**Severidad:** media de gobernanza.  
**Causa:** propuestas históricas no fueron cerradas al consolidar.  
**Impacto:** riesgo de fusionar una versión vieja o interpretar varias fuentes activas.  
**Solución:** cerrar después los PR absorbidos con trazabilidad; no borrar ramas automáticamente.

### H5 — Dependencia transitoria vulnerable en tooling

**Severidad:** media, limitada a desarrollo.  
**Causa:** \`firebase-tools\` aún solicita un rango antiguo de \`stream-json\`; el override global rompe imports internos.  
**Impacto:** riesgo potencial al procesar entradas anidadas durante tooling, no un módulo servido al navegador.  
**Solución:** actualizar Firebase CLI cuando publique un rango compatible y probarlo antes de cambiar el lockfile.

### H6 — Ruido histórico del navegador

**Severidad:** baja/no confirmada.  
**Evidencia:** \`requestStorageAccess\`, \`browsing-topics\` y el SVG fueron reportados; el SVG fue normalizado en el candidato.  
**Solución:** repetir en producción después del deploy y clasificar cada mensaje por request y reproducción.

### H7 — Historial de fotos sin conservación de los archivos

**Severidad:** alta; bloquea la aprobación del candidato.  
**Evidencia:** `functions/api/profile-avatar-upload.js` y `profile-avatar-admin-upload.js` reutilizan un identificador con `overwrite: true`; `profile-avatar-moderate.js` llama a la destrucción del recurso. Guardar URLs en `profilePhotoHistory` no conserva el binario eliminado o sobrescrito.  
**Causa raíz:** identidad del recurso mutable, compartida entre distintas revisiones de foto.  
**Impacto:** pérdida del historial solicitado; una retirada concurrente puede afectar un reemplazo reciente.  
**Solución pendiente:** revisiones inmutables, archivo privado con acceso administrativo, validación del recurso en servidor y transición versionada. La retirada pública debe conservar el archivo de auditoría sin mantenerlo públicamente accesible.  
**Dependencias y riesgo:** comprobar capacidades/configuración de Cloudinary antes de migrar recursos. No ejecutar borrados ni migraciones masivas en producción.

### H8 — Identidad pública copiada en registros históricos

**Severidad:** alta de consistencia/privacidad.  
**Evidencia:** `cloudflare/participacion-clientes.js` conserva nombres y fotos en registros de participación; todavía falta probar su actualización al cambiar o retirar una foto y al modificar un rol.  
**Impacto:** reseñas o comentarios antiguos pueden mostrar identidad desactualizada; la identidad oficial y de staff no está certificada en todos los flujos.  
**Solución pendiente:** separar identidad actual autorizada de la evidencia histórica privada; revisar proyecciones y consumidores, evitando publicar datos que solo debe ver el staff.  
**Dependencias y riesgo:** contrato de permisos, UID canónico y estrategia de fotos H7; migración compatible y pruebas por rol antes de publicar.

### H9 — Cobertura automática insuficiente para afirmar finalización

**Severidad:** alta de validación.  
**Evidencia:** varias pruebas de perfiles solo buscan cadenas en archivos. Las suites de perfiles y fidelidad no estaban incluidas explícitamente en el workflow principal.  
**Corrección del candidato:** incorporadas ambas suites a CI; ocho pruebas nuevas ejecutan el manejador real de reconciliación con Auth/Firestore simulados. Comprueban retirada, compatibilidad heredada, fallo de Auth, ausencia de perfil, reconciliaciones antiguas y escritura versionada con auditoría.  
**Resultado local:** 22 pruebas de perfiles y fidelidad aprobadas. No equivale a una prueba con proveedores reales.  
**Pendiente:** pruebas funcionales de carga/moderación concurrente, propagación pública y login entre pestañas con proveedores reales.

### H10 — Validación parcial de URL al guardar fotos

**Severidad:** alta de integridad de identidad.

**Evidencia y causa raíz:** ambos endpoints de commit aceptaban una URL si su ruta contenía el nombre del almacenamiento y el identificador esperado. Una URL de otro almacenamiento, con esos fragmentos dentro de una carpeta, cumplía la condición. La prueba `profile-avatar-url.test.mjs` reproduce la aceptación anterior y el rechazo nuevo.

**Corrección del candidato:** validación compartida de origen, almacenamiento, tipo de recurso, versión y nombre de archivo completo. Se rechazan credenciales, parámetros, fragmentos, transformaciones arbitrarias, sufijos y subcarpetas. Se conserva el formato de `secure_url` que usan los dos flujos de subida existentes, conforme a la [respuesta de subida de Cloudinary](https://cloudinary.com/documentation/upload_images#upload_response).

**Pruebas:** 35 casos nuevos de URL y metadatos; suites de perfiles y fidelidad: 57 aprobados localmente, con respuestas del proveedor simuladas.

**Comprobación adicional:** ambos commits consultan ahora los metadatos del recurso en la [Admin API de Cloudinary](https://cloudinary.com/documentation/admin_api) antes de escribir el perfil. Exigen identificador, URL actual, tipo imagen/upload, formato autorizado y tamaño real entre 1 byte y 5 MB. Un recurso inexistente o no verificable no se consolida. La consulta tiene timeout, no sigue redirecciones y no expone detalles de errores del proveedor.

**Dependencias y límites:** verificar las credenciales/permisos y la cuota de Admin API en preview con una cuenta de prueba; cada intento de consolidación autorizado realiza una consulta adicional. Sigue pendiente limitar abuso/reintentos con una autorización de subida de un solo uso. Verificar metadatos no impide una sobrescritura posterior del identificador mutable: H7 continúa abierto. No se migraron ni borraron archivos existentes.

## Mapa de reparación

\`\`\`text
PR #691 (base sobre main)
        ↓
PR #692 (borrador: resolver H7–H9)
        ↓
CI + CodeQL + Cloudflare Pages
        ↓
merge autorizado a main
        ↓
deploy de producción
        ↓
smoke Auth real + compra controlada
        ↓
revalidación de Firebase/Cloudinary/Sheets/Apps Script
        ↓
cierre de PRs absorbidos
\`\`\`

## Evidencia automatizada

Commits anteriores obtuvieron checks aprobados de build, contratos, emulador y navegador. El resultado del HEAD debe verificarse por separado en GitHub. Las pruebas estáticas y de interfaz no sustituyen pruebas funcionales de integraciones ni garantizan que cada requisito esté implementado.

Las suites locales cubren cuentas, login/perfil, checkout, carrito, push, imágenes, arquitectura, roles, sincronización, engagement, fidelidad, pedidos y diagnósticos.

## Orden recomendado de cierre

1. Resolver H7–H9 y ejecutar la matriz autenticada real con cuenta Google, cuenta OTP y cuenta bloqueada.
2. Solo con evidencia suficiente y autorización, fusionar #691 y #692 en ese orden.
3. Confirmar deploy y repetir navegación, admin, sesión multi-pestaña y compra controlada.
4. Confirmar logs de Cloudflare, Firebase, Cloudinary, Sheets y Apps Script.
5. Cerrar PRs absorbidos con trazabilidad.
6. Resolver \`stream-json\` mediante actualización compatible y pruebas de Firebase CLI.
7. Completar 2FA, backups independientes, cuotas, webhooks y revisión externa/legal.

## Criterio de cierre

Checks verdes no bastan. El cierre exige que el commit desplegado coincida con el candidato, Auth y compra real funcionen, no haya duplicados, los roles se respeten en backend/UI y cada pendiente manual tenga evidencia segura o una decisión explícita.
