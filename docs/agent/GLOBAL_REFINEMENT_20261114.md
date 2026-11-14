# Revisión y refinamiento global de Tintín — 14/11/2026

Autor: Codex /root. Base: `21ea083825f3280585123b2e4db8411495a83e6a`.
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

## Skills y herramientas

Leídos/aplicados manualmente: audit-tintin (diagnóstico),
tintin-design-quality, tintin-responsive-a11y, emil-animation-performance,
tintin-security-hardening y tintin-search-seo; web-perf para priorización
basada en evidencia. Sites se consultó para identificar el flujo; este repo
usa su publicación Cloudflare existente, no hosting Sites. No hay herramienta
de trazas DevTools disponible; no se inventa una puntuación Lighthouse.
Chromium de Playwright se descargó con su instalador oficial existente para
los scripts que necesitan el navegador del runner; manifiesto/lock intactos.
