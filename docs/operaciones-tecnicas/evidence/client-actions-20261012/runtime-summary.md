# Inventario dinámico del cliente — navegación sin sesión

Aplicación ejecutada: `1836626558b81176bc1582650c50c61a3f911105`. Prueba: `tests/runtime/client-navigation-actions.spec.js`, SHA256 `b971cd3e5f64c6240edc1b0d57aa7dee1ff30d17657db079f0a9070c0d28ab68`.

54 contextos de navegación aprobados en Chromium escritorio, Pixel 7 y WebKit iPhone 13, incluidos tablet vertical/horizontal. Emulación, no dispositivos físicos. Login es una pantalla independiente: sus paneles públicos no aplican; volver a la tienda sí se ejecuta.

| Ruta | Contextos | Controles observados | Con escenarios parciales verificados | Completamente aprobados |
| --- | ---: | ---: | ---: | ---: |
| / | 3 | 108 | 9 | 0 |
| /404.html | 3 | 112 | 9 | 0 |
| /about | 3 | 104 | 9 | 0 |
| /cambios-devoluciones | 3 | 103 | 9 | 0 |
| /catalogo | 9 | 121 | 16 | 0 |
| /checkout | 3 | 161 | 9 | 0 |
| /collections | 3 | 111 | 9 | 0 |
| /contact | 3 | 112 | 9 | 0 |
| /envios | 3 | 103 | 9 | 0 |
| /login | 9 | 120 | 1 | 0 |
| /preguntas-frecuentes | 3 | 114 | 9 | 0 |
| /privacidad | 3 | 116 | 9 | 0 |
| /product?id=runtime-watch | 3 | 115 | 9 | 0 |
| /terminos | 3 | 117 | 9 | 0 |

Las aperturas/cierres por puntero, retorno desde login y menú tablet tienen aserciones. Encontrar controles interiores no prueba su comportamiento: siguen PENDING. Teclado, sesión cliente y estados comerciales requieren sus propios resultados. Este informe no representa 100% de descubrimiento o de cobertura.
