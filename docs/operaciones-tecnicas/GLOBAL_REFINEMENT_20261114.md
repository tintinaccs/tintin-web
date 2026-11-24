# Revisión y refinamiento global de Tintín — 14/11/2026

Autor: herramienta de desarrollo anterior /root. Base: `21ea083825f3280585123b2e4db8411495a83e6a`.
Solicitud: implementación global, incluidos Maestro, seguridad, comercio,
responsive, accesibilidad, rendimiento y descubrimiento en Google.

## Cambios y hallazgos acreditados

| Nivel | Fuente | Evidencia e impacto | Corrección |
| --- | --- | --- | --- |
| MEDIUM | `css/theme/sistema-superficies-tintin.css` | La elevación `:hover` no distingue touch ni movimiento reducido. En móvil puede persistir tras tocar y con reduced motion sigue desplazando la tarjeta. | Restringir elevación a puntero fino con hover y movimiento permitido. |
| MEDIUM | `js/quality/revelado-desplazamiento-global.js` | Iniciar con movimiento reducido devuelve antes de registrar eventos y MutationObserver. Al habilitar movimiento después, nuevas secciones no se registran. | Instalar observación una sola vez; suspender escaneos mientras se solicita movimiento reducido. |
| LOW | Mismo módulo | El feedback de pulsación sólo se libera con pointerup/cancel; perder la ventana deja el estado pulsado. `aria-disabled` recibe feedback activo. | Liberar en blur, ocultación y cambio de preferencia; excluir acciones deshabilitadas. |
| LOW | `css/pages/perfil.css`, `css/quality/movimiento.css` | `transition:all` en botones de perfil y transiciones de sombras en tarjetas añaden trabajo de pintura. | Propiedades explícitas; conservar movimiento ligero con transform y opacity. |
| Mejora solicitada | Superficies compartidas | Contornos y sombras repetidos, cinco tarjetas dentro de Contacto y difuminados cortos endurecen la composición. | Bordes de menor peso, sombras más suaves, continuidad de fondo fluida88–176px; datos de contacto agrupados sin cinco marcos. |

Se preservan los tokens publicados, Montserrat, logos planos, arte original,
foco visible, controles de44px y contraste del texto. El difuminado se aplica
al fondo, no al contenido ni a paneles que deben ser opacos. No se agregan
dependencias a la aplicación, proveedores, fuentes ni una segunda capa visual.
Las URLs inmutables y bundles se regeneran desde las autoridades existentes.

## Verificación reproducible

Evidencia de ejecución local: `artifacts/global-20261114/` y `artifacts/master/`.
Los estados se actualizan al recibir resultados; una ejecución en curso no es PASS.

- PASS_LOCAL: cinco regresiones nuevas en Chromium para touch, hover, reduced
  motion dinámico, incorporación de contenido y liberación de pulsación.
- PASS_LOCAL: auditoría npm completa,710 dependencias,0 vulnerabilidades.
- PASS_LOCAL: suite Maestro de seguridad,8/8 comprobaciones (autorización,
  cuentas, actividad, CSP, App Check, sesión y dependencias productivas).
- PASS_PRODUCTION de la base publicada, excepción de lectura directa: salud
  y smoke Maestro2/2. Origen `https://tintinaccs.com`; no acredita publicación
  de este candidato. La primera ejecución sin proxy falló por conexión;
  repetida con `NODE_USE_ENV_PROXY=1` aprobó sin cambios de producto.
- IN_PROGRESS: build/generadores, auditoría final, regresiones amplias,
  emuladores y suites restantes del Diagnóstico Maestro.
- NOT_VERIFIED: hardware físico, Safari/WebKit, lectores de pantalla, CWV
  de tráfico real, sesiones reales de proveedores y guardado administrativo
  autenticado. No se realizan pedidos, cobros ni modificaciones comerciales
  reales como parte de las pruebas.

## recursos de desarrollo y herramientas

Leídos/aplicados manualmente: audit-tintin (diagnóstico),
tintin-design-quality, tintin-responsive-a11y, emil-animation-performance,
tintin-security-hardening y tintin-search-seo; web-perf para priorización
basada en evidencia. Sites se consultó para identificar el flujo; este repo
usa su publicación Cloudflare existente, no hosting Sites. No hay herramienta
de trazas DevTools disponible; no se inventa una puntuación Lighthouse.
Chromium de Playwright se descargó con su instalador oficial existente para
los scripts que necesitan el navegador del runner; manifiesto/lock intactos.

## Cierre del primer candidato y reparación del Maestro

PR1399, head209dc648b6ef676faf5b2e257a7dce8938903308: CI43589388485/1
SUCCESS; mantenimiento protegido43591370208/1 SUCCESS; integrado como
cfe530d90b705c58f3b7bad55014dc858552ddb0. Salud posterior43591407154/1
SUCCESS. No confundir esos resultados con el candidato siguiente.

Maestro43589398231/1 terminó FAIL:5 áreas aprobadas y3 fallidas. Sus logs
completos se leyeron al terminar; no se oculta ese resultado. audit:final y
el barrido profundo aprobaron. Las causas restantes acreditadas fueron:

- MEDIUM, Catálogo:100vw cuenta la reserva de scrollbar y saca la fila de
  categorías del ancho útil. El gutter fluido real pasa a una sola variable
  compartida con su contenedor. Se conservan scroll, expansión, filtros y
  cambio de colección. El auditor reconoce el scroller sólo con overflow
  realmente desplazable;8 pruebas comprueban límites y acceso por teclado.
- MEDIUM, Estadísticas: las7 columnas mínimas del gráfico reservan410px
  también cuando sólo existe «Esperando datos». El estado vacío usa una
  pista flexible; al recibir datos vuelven las7 pistas.2 pruebas en280/390px
  verifican ambos estados.
- LOW, auditor administrativo: exigía abrir un lateral retirado deliberadamente
  en la app móvil. Ahora ejecuta el controlador real de Más, comprueba apertura,
  geometría, cierre y retorno de foco en todos los tamaños móviles. No se
  reactiva navegación antigua ni se modifica la guardia de autenticación.
- LOW, auditor de búsqueda:404 falso de/api/instagram-feed en su servidor
  interno. Se usa el handler real con env vacío: sin credenciales ni llamadas
  a Meta. Corregido en el auditor de búsqueda; se conserva el trabajo separado
  de PR1397 sobre el servidor de smoke.
- LOW, nombres: se conservan DESIGN.md/PRODUCT.md como contexto contractual de
  recursos de desarrollo, documentando la excepción. Los4 informes internos y el servidor de
  previsualización pasan a nombres coherentes; se actualizan sus consumidores.
  Un control negativo comprueba que otros nombres inválidos siguen fallando.

Base de la reparación:cfe530d9. Evidencia local adicional:270 combinaciones
(18 páginas×15 tamaños) de global fit PASS tras corregir Catálogo;46 estados
administrativos y2 estados de Imágenes en la sonda de280/390px PASS;12 anchos,
13 rutas y ciclos de navegación PASS; búsqueda desktop/mobile PASS; nombres
PASS y control negativo correcto. Las sondas acotadas no se presentan como
la ejecución completa de15 viewports: ésta se conserva en el Maestro canónico.

La reparación se entrega mediante la rama rama histórica: global-maestro-repair-20261114,
con nuevos build/plan/CI/Maestro propios. Los recibos terminales de sus checks
son la autoridad de cierre; los resultados del primer head no se heredan.
