# UI/UX responsive compartida — 2026-10-22

Agente: Codex /root. Candidato local conciliado con main 0a719fabd (#1208). Alcance autorizado: tema, bordes, espacios y adaptación global de la interfaz. No cambia datos comerciales, permisos, autenticación ni servicios externos.

## Hallazgos y correcciones

| Estado / prioridad | Ubicación y evidencia | Impacto y corrección canónica |
| --- | --- | --- |
| PASS_LOCAL / HIGH | Catálogo móvil: el fondo de `.cat-hero` tenía 41px de extensión; las categorías intermedias quedaban dentro de esa pintura. Reproducción con datos públicos del sitio y geometría DOM. | `alternancia-secciones.js` extiende fondos sólo sobre huecos vacíos. Navegación o texto intermedios limitan ambos fondos; incluye aparición/ocultamiento de navegación sin modificar la alternancia rosa. |
| PASS_LOCAL / MEDIUM | Cuenta en móvil, tablet y escritorio: una foto personalizada blanca perdía su silueta contra el botón blanco. | El sistema compartido agrega un contorno oscuro fino al avatar existente; conserva la foto elegida por la persona y su prioridad frente a Google. Matriz de siete rutas y cinco anchos. |
| PASS_LOCAL / LOW | Altura inicial móvil: marca76px y hero111px antes de las categorías. | Marca68px y hero95px; la navegación sube24px en la comprobación390px. Conserva logo blanco, difuminado y área segura. |
| PASS_LOCAL / LOW | Formularios de Contacto, Perfil, Checkout, Login y panel: radios independientes8–17px y campos de14px en dispositivos táctiles. | Escala compartida: campos14px, superficies de texto16–20px según ancho, altura mínima44px y texto mínimo16px hasta1024px para evitar ampliación automática de Safari. Se conservan radios de fotografías/mapas, botones redondeados y colores de validación. |
| CORRECT | Producto y selección poblados; tarjetas largas de Catálogo/Colecciones; panel con sus secciones activadas; footer y accesos de Inicio. | Pruebas existentes verifican separación, contención, controles, orientación y borrador al rotar. No se añade otra capa de diseño ni se reescriben sus controladores. |

## Cobertura ejecutada

- Barrido público de11 rutas en17 tamaños:187/187 combinaciones PASS_LOCAL. Inicio, Catálogo, Colecciones, Nosotros, Contacto, términos, privacidad, envíos, cambios, preguntas frecuentes y404. Anchos320,360,390,430,480,481,767,768,769,820,900,1023,1024,1025,1280,1440,1920. Comprueba navegación correspondiente, geometría, paneles compartidos, privacidad y WhatsApp sin pisar controles. Informe reproducible: `node scripts/auditar-global-responsive-final.mjs`, artefacto local `artifacts/global-responsive/report.json`.
- Navegación global:35 Chromium; alternancia, máscaras, Perfil y tipografía en18 HTML:68 Chromium; muestra WebKit20. Sin reintentos. Las secciones no vuelven a medirse al insertar tarjetas sin cambio de tamaño.
- Regresiones de espacios:91 Chromium en `admin-all-devices`, `home-footer-spacing` y `public-spacing-product`. Incluye320–2560px, móvil horizontal, tablet vertical/horizontal, laptop, escritorio, puntos de transición, datos largos y selección poblada con cinco productos.
- Formulario real con sesión/transporte aislados:9 Chromium y9 WebKit, cuatro páginas por caso,320–2560px. Verifica campos dentro del contenedor, radios compartidos, tamaño táctil, foco visible y ausencia de intersecciones. La prueba abre el paso Datos del checkout sin crear pedidos ni guardar perfiles.
- Integridad CSS, shell público15 pantallas, tipografía37702 comprobaciones/18 páginas/10 WOFF2, caché364 archivos y9 contratos Node PASS_LOCAL. Bundles, CSP, rutas, protección y diagnóstico se generan desde las autoridades correspondientes.

Son212 casos Chromium y29 WebKit distintos (incluidos9 de marca móvil en13 rutas), además del barrido187 y9 Node; repetir una suite no suma casos nuevos. Las capturas se revisaron en390/1440; el catálogo también se comprobó con datos públicos reales y los cuatro recursos candidatos interceptados en un navegador independiente. Esa simulación no acredita publicación.

## Límites de la evidencia

La cobertura privada usa HTML/CSS reales y fixtures de sesión/datos: no equivale a comprobar todas las cuentas reales en producción. Chromium/WebKit son motores de prueba, no una inspección física de cada teléfono. Las dimensiones intermedias usan reglas fluidas; el informe enumera las dimensiones efectivamente verificadas, sin afirmar que se probaron todas las resoluciones posibles.

El editor superior y sus cantidades se conservan desde la entrega integrada #1208: esta revisión no reinicia Actions ni modifica PR de otro agente. La publicación del candidato global exige CI del SHA final, merge y comprobación posterior de los recursos públicos. Hasta entonces el estado es PASS_LOCAL, no PASS_PRODUCTION.

La expectativa histórica de76px de la suite de marca móvil se actualiza a68px, manteniendo las comprobaciones de dibujo completo, centrado, área táctil y contenido sin invasión. La vista previa de Cloudflare existe pero exige Cloudflare Access; no se elude esa protección ni se presenta como navegación validada. La comprobación remota de la interfaz se hará en el sitio público una vez integrado el candidato.
