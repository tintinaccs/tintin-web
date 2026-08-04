# Mapa de código

Este documento indica qué archivo abrir según el problema. No hace falta recorrer todo el repositorio.

## Header y navegación

| Necesidad | Archivo principal |
|---|---|
| Cambiar el header desktop | `js/components/navigation/desktop/header-desktop.js` |
| Cambiar estilos desktop | `css/components/navigation/desktop/header-desktop.css` |
| Cambiar la píldora activa desktop | `js/components/navigation/desktop/controller.js` |
| Cambiar el header o menú tablet | `js/components/navigation/tablet/header-tablet.js` |
| Cambiar estilos tablet | `css/components/navigation/tablet/header-tablet.css` |
| Cambiar transición menú/colecciones tablet | `js/components/navigation/tablet/controller.js` |
| Cambiar la barra mobile | `js/components/navigation/mobile/header-mobile.js` |
| Cambiar estilos mobile | `css/components/navigation/mobile/header-mobile.css` |
| Cambiar halo/indicador mobile | `js/components/navigation/mobile/controller.js` |

## Buscar, Cuenta, Carrito y Colecciones

| Necesidad | Archivo principal |
|---|---|
| Estructura del buscador | `js/components/navigation/shared/search-panel.js` |
| Tamaño y diseño del buscador | `css/components/navigation/shared/surfaces.css` |
| Estructura de Mi Cuenta | `js/components/navigation/shared/account-drawer.js` |
| Diseño sólido de Mi Cuenta | `css/components/navigation/shared/surfaces.css` |
| Estructura del carrito | `js/components/navigation/shared/cart-drawer.js` |
| Contenido y operaciones del carrito | `script.js` y `js/components/cart/cart-sync.js` hasta completar su extracción modular |
| Estructura de colecciones mobile | `js/components/navigation/shared/collections-sheet.js` |
| Carga e imágenes de colecciones | `js/components/navigation/shared/collections-runtime.js` |
| Abrir/cerrar cualquier panel | `js/components/navigation/shared/surface-controller.js` |
| Fondo oscuro y capas | `js/components/navigation/shared/surface-layer.js` y `css/components/navigation/shared/surfaces.css` |

## Inicio y rutas

| Necesidad | Archivo principal |
|---|---|
| Montaje general del shell | `js/components/navigation/public-shell-entry.js` |
| Página activa | `js/components/navigation/shared/route-state.js` |
| Navegación entre páginas | `js/components/navigation/shared/router.js` |
| Carga de runtimes | `js/components/navigation/shared/runtime.js` |
| Carga de CSS | `js/components/navigation/shared/assets.js` |
| Logo, versión y breakpoints | `js/components/navigation/shared/config.js` |
| Iconos y categorías base | `js/components/navigation/shared/icons.js` |

## Adaptadores que no deben editarse para cambios normales

Los siguientes archivos existen para no romper páginas antiguas, auditorías o imports existentes. No son la fuente principal:

```text
js/public-shell.js
js/ui-navigation-controller.js
js/components/navigation/legacy/navigation-desktop.js
js/components/navigation/legacy/navigation-tablet.js
js/components/navigation/legacy/navigation-mobile.js
js/components/navigation/legacy/navigation-shared.js
js/components/navigation/legacy/nav-collections.js
css/navigation-desktop.css
css/navigation-tablet.css
css/navigation-mobile.css
css/navigation-shared.css
css/surface-controller.css
```

Cuando un problema esté en navegación, abrir el archivo equivalente dentro de `js/components/navigation/` o `css/components/navigation/`.

## Áreas todavía en migración

El archivo `script.js` conserva funciones históricas de catálogo, carrito, búsqueda y elementos de páginas. No debe crecer. Las correcciones nuevas se colocan en módulos específicos y, cuando una sección se extraiga, `script.js` queda como adaptador temporal.

El panel administrativo tiene sus propios archivos y no debe mezclarse con componentes públicos.
