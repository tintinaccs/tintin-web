# Capas CSS — mapa de propiedad

Este documento existe para responder una sola pregunta sin tener que abrir 34
archivos: **¿qué hoja manda sobre esta propiedad, y por qué?**

La regla operativa es simple: antes de agregar un `!important` nuevo, buscá acá
quién es el dueño de esa propiedad y cambiala ahí.

## Orden de carga (páginas públicas)

La cascada se resuelve de arriba hacia abajo; la última declaración con igual
especificidad gana.

| # | Hoja | De qué es dueña |
|---|---|---|
| 1 | `css/montserrat.css` | Declaraciones `@font-face` de Montserrat. Nada más. |
| 2 | `css/solid-ui-surfaces.css` | Fondos opacos forzados en superficies del checkout y del panel mientras el loader está visible. |
| 3 | `css/mobile-header-actions-solid.css` | Fondo opaco del tabbar y sus botones en mobile. |
| 4 | `css/loader-solid-background.css` | Color de fondo del loader y del splash inicial. |
| 5 | `css/color-tokens.css` | **Fuente de verdad de los tokens de color públicos** (`--color-*`). |
| 6 | `styles.css` | **Hoja base del sitio**: layout, componentes, tipografía, responsive. La más grande (120 KB) y la que define el comportamiento por defecto de casi todo. |
| 7 | `css/global-fit.css` | Adaptación fluida: que nada se salga del viewport ni dependa de un tamaño fijo. |
| 8 | `css/system-special-states.css` | Estados especiales del sistema (404, tienda cerrada, sin conexión). |
| 9 | `css/ui-quality.css` | Reset de calidad, foco visible, `prefers-reduced-motion`, ajustes de rendimiento (`content-visibility`). |
| 10 | `css/tintin-unified-theme.css` | Unificación de marca sobre componentes ya definidos (botones, enlaces, superficies). **Concentra 312 `!important`** — es la capa que gana casi siempre sobre `styles.css`. |
| 11 | `css/tintin-theme-cleanup.css` | Fondos sólidos obligatorios en la navegación pública. |
| 12 | `css/tintin-parity-safe.css` | Red de seguridad de paridad: garantiza que nada quede invisible por un `display`/`visibility` mal heredado. |

Después de estas van las hojas propias de cada página (`home-fit.css`,
`checkout.css`, `login.css`, `collections-page.css`, `product-extras.css`) y,
más tarde todavía, las que inyecta JavaScript (`navigation-*.css`,
`surface-controller.css`, `phase8-ui-ux.css`, `phase10-accessibility.css`,
`*-maintenance.css`). Al cargarse últimas, esas **ganan sobre todo lo anterior**.

## Panel de administración

`admin.html` carga la misma columna vertebral, pero intercala
`admin-color-tokens.css`, `tintin-tokens.css` y `admin.css` en el medio, y
**vuelve a aplicar** `global-fit.css` y `system-special-states.css` después de
`admin.css`.

Esa doble aplicación es intencional en su efecto: la segunda copia gana sobre
`admin.css`. No la deduplifiques sin verificar antes con el arnés de cascada
(ver abajo) que nada dependa de ese segundo pase.

## Por qué ya no hay `@import`

Hasta agosto de 2026, cuatro de estas hojas se cargaban con `@import` anidados
dentro de otras. El navegador no puede paralelizar eso: tiene que bajar y
parsear la hoja padre para recién descubrir a la hija. Medido con 60 ms de
latencia por request, la última hoja empezaba a descargarse **180 ms después**
de la primera oleada — y ese retraso es bloqueante para el primer pintado.

Ahora todas se declaran como `<link>` en el `<head>`, en el mismo orden que
tenía la cascada resuelta. El resultado visual es idéntico (verificado con el
arnés) y las descargas ocurren en paralelo.

**Al agregar una hoja nueva, va como `<link>` en la posición que le corresponda
en la tabla de arriba. No uses `@import`.**

## Arnés de regresión de cascada

Consolidar CSS es riesgoso porque ninguna auditoría estática ve el resultado
renderizado. Para eso está el arnés: captura los estilos computados de cada
elemento de cada página en cuatro viewports y compara dos corridas.

```
npm run audit:css-cascade -- antes            # con el código actual
# ... hacés el cambio ...
npm run audit:css-cascade -- despues antes    # compara y reporta diferencias
```

Cubre 9 páginas (una por cada combinación distinta de hojas) en 390, 768 y
1440 px, y compara ~500.000 propiedades computadas.

**Piso de ruido:** dos capturas del mismo código dan unas 2 diferencias, siempre
de `visibility` en botones que JavaScript alterna. Ese es el ruido esperado.
Cualquier diferencia de color, tipografía o geometría en elementos de contenido
es una regresión real y hay que revertirla.

Como referencia, el aplanado de los `@import` descrito arriba dio 5 diferencias
sobre 523.698 propiedades, todas de esa misma familia de botones — es decir,
dentro del ruido.

## Deuda conocida

- **1303 `!important`** repartidos en las capas. El grueso está en
  `tintin-unified-theme.css` (312), `solid-ui-surfaces.css` (115),
  `surface-controller.css` (93) y `tintin-parity-safe.css` (92). Reducirlos
  exige mover la declaración a la hoja dueña de esa propiedad según la tabla de
  arriba, no agregar otra capa encima.
- **`solid-ui-surfaces.css` carga en las 15 páginas públicas**, pero 13 de sus
  23 bloques son selectores del checkout (`.ck-*`). Moverlos a `checkout.css`
  cambiaría su posición en la cascada, así que hay que hacerlo con el arnés
  puesto y verificar cero diferencias.
- **Los breakpoints se declaran en 26 archivos distintos** (106 veces). La
  frontera acordada es 768/769 px; cualquier valor nuevo fuera de esa frontera
  es un error.
