# Revisión de alertas CodeQL — 2026-10-13

Codex principal inspeccionó 48 alertas abiertas del main df86fc68: 13 apuntan a producción y 35 a auditorías/fixtures. Un check CodeQL correcto no implica cero alertas. No se han descartado alertas en GitHub ni reducido sus reglas.

## Problemas reproducidos y corregidos

- HIGH — functions/pages/[slug].js: un href java&#x73;cript sobrevivía al filtro regex. El HTML básico ahora pasa por parse5, ya presente en el lockfile: lista de elementos/atributos, URL normalizada después de decodificar entidades, eliminación de eventos/namespaces y contenido activo. Conserva títulos, listas, enlaces e imágenes legítimos; límite del editor100000, profundidad64/nodos5000.
- HIGH — js/admin/admin-app.js, historial/dashboard Correos: admin/agent con permiso reenviarCorreo puede crear emailLogs según Rules; type se interpolaba sin escape. También id de los datos podía reemplazar el ID canónico. Se escapan etiquetas/atributos, argumentos inline con el helper existente, y se conserva el ID real de Firestore. Payloads hostiles se muestran como texto y las acciones reciben el ID literal.
- LOW — functions/api/email-otp-send.js: el módulo1e6 de un uint32 añade un pequeño sesgo. Se rechaza la cola >=4294000000 antes del módulo; cada resultado tiene4294 fuentes, seis dígitos conservados. Las cuotas/expiración existentes siguen intactas.
- MEDIUM — functions/_middleware.js y renderizadores públicos: product/products/pages realizan consultas de Firestore, por lo que se añaden a la cuota pública compartida60/min/IP; aliases, HEAD y slash final se agrupan. Static assets y proxy Auth no cambian.

## Alertas restantes de producción: alcance corroborado

| Ruta | Resultado de la revisión |
|---|---|
| functions/product.js, stripHtml | CORRECT en el trust boundary revisado: salida de texto vuelve a escaparse en meta/title/canonical; JSON-LD escapa <. No se utiliza como autorización para HTML arbitrario. |
| js/core/auth/utilidades-seguridad.js | CORRECT en consumidores revisados: descripción usa textContent en tienda.js y especificaciones escapeHtml. El helper por sí solo no debe tratarse como sanitizer HTML. |
| js/admin/content/control-bienvenida-admin.js | CORRECT en el sink revisado: asigna src a un img creado por el editor; títulos/textos se escapan. No construye HTML a partir de ese valor ni autoriza scripts. |
| js/core/firebase/origen-funciones.js | NOT APPLICABLE como comprobación de autorización de dominio: selector de origen cliente/config global confiable; backend conserva CORS, JWT y roles. |
| cloudflare/servir-admin-con-csp.js | NOT APPLICABLE como validación de URL entrante: includes es una aserción sobre la política generada/protegida de dos superficies fijas; no selecciona un host aportado por el usuario. |
| js/admin/proteccion-cambios-pendientes-admin.js | NOT APPLICABLE como barrera de seguridad: guardia de navegación pendiente de un editor; no habilita un permiso del backend. No debe utilizarse para sanear URLs de contenido. |
| cloudflare/seguridad-cloudinary.js | NOT_VERIFIED como explotación: alerta agregada sobre helper JSON; no se devuelve stack literal en Functions/cloudflare y tests de errores de Auth/diagnóstico excluyen stack/clave/RSA/autorización. No se declara resuelta automáticamente esta advertencia estática. |

Las 35 alertas de scripts/fixtures de auditoría no son sanitizadores del contenido publicado. Se mantienen las comprobaciones de CSP, arquitectura y evidencias; no se parchean auditorías para ocultar alertas.

## Evidencia

Reproducción anterior en artifacts/security-codeql-reproduction.json. 74 pruebas dirigidas de límites, OTP, indexación y contenido y18 casos de navegador Chromium escritorio/móvil/WebKit PASS_LOCAL. Las nuevas pruebas entran en runners existentes de operaciones/runtime. CI del nuevo SHA y prueba pública posterior al merge pendientes; no se hereda el PASS completo del candidato65251992. CPU de Worker real y restauración de datos reales aislada no se acreditan desde Node.
