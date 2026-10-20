# Revisión global — 2026-10-20

Autor: Codex /root. Base: main `c99289a9362f96a449934c4063dae3df7b238e01`. Este ciclo retoma el trabajo descrito por el titular y verifica el código actual, sin heredar cifras ni cierres de otra conversación. Inventario: [mapa-global-fase-1.md](mapa-global-fase-1.md).

## Hallazgos y correcciones

| Clasificación | Ubicación y evidencia | Efecto y corrección mínima |
| --- | --- | --- |
| MEDIUM | `checkout.html`, enlace «Ver catálogo completo»: estilos reales miden 1,811:1 antes del cambio | Texto blanco forzado sobre rosa claro. Se usan juntos los tokens de fondo y texto del botón primario. Contraste ≥4,5:1 con paleta rosa y oscura; destino y teclado conservados en ocho dimensiones. |
| MEDIUM | `js/theme/alternancia-secciones.js`: quitar `html.login-auth-pending` no repinta las superficies sin un resize | El observer sólo observa `body`. Se observan también atributos de la raíz, conservando batching, filtros e idempotencia. Ocultar y revelar dos veces conserva los fondos sin duplicados ni desbordes en ocho dimensiones. |
| MEDIUM, desarrollo | `npm audit`: Hono 4.13.7, GHSA-5r4p-p66f-jhc7 | Se actualiza sólo el nodo transitivo del lock a 4.13.13. Sin dependencias nuevas ni cambios del runtime de Pages. Auditoría completa y sin dev: cero vulnerabilidades conocidas después del cambio. |
| CORRECT | `js/pages/profile/pedidos-perfil.js`, arreglo integrado por PR1174 | El pedido enlazado recibe foco con `preventScroll:true`; se conserva. |
| LOW, pruebas | Cinco expectativas anteriores en contratos de métricas, colección, inventario UI y caché | Se reconocen el corte confirmado de ventas, colección paginada, cuatro accesos directos más Más, sesiones filtradas y favicon revalidable. Se añade una prueba del renderer real ante fallo y recuperación de pedidos, además de revalidación de iconos. No se modifica lógica correcta ni se relajan límites. |
| NOT APPLICABLE, logotipo | El barrido de contraste marcó únicamente letras del wordmark decorativo del cargador en Admin/Imágenes/Login | WCAG 1.4.3 excluye logotipos. El auditor reconoce sólo ese elemento no interactivo. Una contraprueba ejecuta el scanner real y exige detectar el CTA blanco/rosa, texto común incluso con aria-hidden, y controles. La marca se conserva. |

Referencia oficial de la excepción de logotipos: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html#logos. No se extiende la excepción a los textos o botones de la identidad visual.

La comprobación CSP del primer barrido se ejecutó antes de regenerar el derivado del script inline modificado. `build:csp` y nueve regresiones CSP aprobaron después. No se omitió ese control.

## Verificación por fases

| Fase | Evidencia del candidato |
| --- | --- |
| 1. Mapa | PASS_LOCAL: 19 HTML raíz, 14 páginas públicas/cliente principales, 404, dos administrativas y dos técnicas/redirección; 23 secciones estáticas Admin; 57 archivos API; 358 archivos de pruebas/soporte, 256 Node y 95 specs. Consulta pública: 215 productos y 11 colecciones devueltos. |
| 2. Funcionamiento y seguridad | PASS_LOCAL: repetición amplia 1.717/1.717 Node más cuatro pruebas nuevas de la matriz de permisos, 1.721 distintas en total. Cubre contratos de cuentas, autorización, catálogo, importes, stock, carrito, pedidos, sincronización, concurrencia y recuperación. Las acciones con documento de permisos ausente, parcial, error y recuperación se prueban con el código real. Las reglas adversariales y del servidor se exigen además en CI del SHA final. Dependencias: cero vulnerabilidades conocidas. |
| 3. Experiencia y presentación | PASS_LOCAL: 82 Chromium de superficies/UI/variantes, más la contraprueba del auditor; 126/126 combinaciones canónicas y 187/187 ampliadas. Accesibilidad/SEO: 11/11. Capturas reales de login y carrito revisadas en móvil y escritorio, con servicios aislados. Tipografía: 36.004 comprobaciones; colores e integridad CSS aprobados. El primer barrido global de contraste sólo señaló el wordmark exento; su repetición con clasificación corregida sigue en ejecución al preparar este documento. |
| 4. Resistencia y rendimiento | PASS_LOCAL: 65/65 pruebas de rendimiento, incluyendo carga, estabilidad, recursos, offline y recuperación. Los 11 casos de accesibilidad/SEO más estos 65 completan 76 verificaciones de ese bloque. Las suites Node cubren sesiones tardías, lecturas fallidas, reintentos, idempotencia y concurrencia. El renderer de métricas conserva «—» ante datos no confirmados y recupera cifras cuando se confirman. |
| 5. Cierre | PENDING antes de publicar: generación canónica y diff; CI completa del SHA; controles protegidos; merge autorizado; revisión pública y bytes del despliegue exacto. El monitor público del main anterior aprobó 31 respuestas en sólo lectura: no se atribuye ese resultado al candidato todavía no publicado. |

El runtime tiene una URL nueva propagada por su generador para respetar caché immutable. CSP, diagnóstico, caché y plan protegido se generan desde sus fuentes. No se modifican presupuestos, protecciones, Rules, datos ni permisos para hacer pasar pruebas. Los resultados finales del ciclo se registran en CURRENT_STATE; esta tabla documenta la preparación del candidato.

## Límites y siguiente comprobación concreta

- Emulador local de Firestore: BLOCKED al descargar el binario desde `storage.googleapis.com`, destino no habilitado por el entorno. No se cambia esa política. CI ejecuta identidad, límites y reglas adversariales con el emulador; su aprobación del candidato es obligatoria.
- Guardados, compras, pagos y correos reales; Google OAuth real; recepción push física; paridad privada de Sheets: NOT_VERIFIED con sesión productiva autenticada. Las suites usan fixtures/emuladores y la publicación se verifica con lecturas. La prueba real requiere la sesión y los proveedores del titular; no se generan operaciones comerciales para aparentar cobertura.
- PayPal deshabilitado en sandbox es configuración vigente, no una falla inventada.
- Cantidad de páginas personalizadas publicadas y permisos concretos configurados en producción: NOT_VERIFIED sin lectura administrativa autenticada. Se distinguen de la matriz local de acciones y sus defaults/errores, que sí se comprobó.

## Estado del otro paquete solicitado

Los PR1175 (editor minimalista), PR1179 (destino exacto después del login push) y PR1183 (iconos) están integrados en main. PR1182 (edición rápida de tarjetas, feed Instagram e historia) sigue abierto, con conflictos frente a main. CI39467397854 falló en «Canonical integrations and authority map»: `/api/instagram-feed` no figura en `_routes.json`. El feed real requiere además conectar Meta según su documentación. Este ciclo verifica ese estado y no modifica esa rama.
