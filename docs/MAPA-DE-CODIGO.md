# Mapa de código

Este documento indica qué archivo abrir según el problema. No hace falta recorrer todo el repositorio.

## Encabezado y navegación

| Necesidad | Archivo principal |
|---|---|
| Cambiar el encabezado de escritorio | `js/components/navigation/escritorio/encabezado-escritorio.js` |
| Cambiar estilos de escritorio | `css/components/navigation/escritorio/encabezado-escritorio.css` |
| Cambiar el indicador activo de escritorio | `js/components/navigation/escritorio/indicador-navegacion-escritorio.js` |
| Cambiar el encabezado o menú de tableta | `js/components/navigation/tableta/encabezado-tableta.js` |
| Cambiar estilos de tableta | `css/components/navigation/tableta/encabezado-tableta.css` |
| Cambiar la transición menú/colecciones de tableta | `js/components/navigation/tableta/control-menu-tableta.js` |
| Cambiar la barra móvil | `js/components/navigation/movil/encabezado-movil.js` |
| Cambiar estilos móviles | `css/components/navigation/movil/encabezado-movil.css` |
| Cambiar el halo o indicador móvil | `js/components/navigation/movil/indicador-navegacion-movil.js` |

## Buscar, Cuenta, Carrito y Colecciones

| Necesidad | Archivo principal |
|---|---|
| Estructura del buscador | `js/components/navigation/compartido/panel-busqueda.js` |
| Control, resultados y teclado del buscador | `js/components/navigation/compartido/control-busqueda.js` |
| Tamaño y diseño del buscador | `css/components/navigation/compartido/paneles.css` |
| Estructura de Mi Cuenta | `js/components/navigation/compartido/panel-cuenta.js` |
| Diseño sólido de Mi Cuenta | `css/components/navigation/compartido/paneles.css` |
| Estructura del carrito | `js/components/navigation/compartido/panel-carrito.js` |
| Contenido y operaciones del carrito | `script.js` y `js/components/cart/cart-sync.js` hasta completar su extracción modular |
| Estructura de colecciones móvil | `js/components/navigation/compartido/panel-colecciones.js` |
| Carga e imágenes de colecciones | `js/components/navigation/compartido/carga-colecciones.js` |
| Acordeón del pie de página móvil | `js/components/navigation/compartido/acordeon-pie-pagina.js` |
| Abrir o cerrar cualquier panel | `js/components/navigation/compartido/control-paneles.js` |
| Fondo oscuro y capas | `js/components/navigation/compartido/capas-paneles.js` y `css/components/navigation/compartido/paneles.css` |

## Inicio y rutas

| Necesidad | Archivo principal |
|---|---|
| Montaje general de la navegación | `js/components/navigation/public-shell-entry.js` |
| Página activa | `js/components/navigation/compartido/estado-ruta.js` |
| Navegación entre páginas | `js/components/navigation/compartido/enrutador.js` |
| Carga de procesos | `js/components/navigation/compartido/carga-navegacion.js` |
| Carga de CSS | `js/components/navigation/compartido/recursos-navegacion.js` |
| Logo, versión y cortes por dispositivo | `js/components/navigation/compartido/configuracion.js` |
| Iconos y categorías base | `js/components/navigation/compartido/iconos.js` |

## Adaptadores que no deben editarse para cambios normales

Los siguientes archivos existen para no romper páginas antiguas, auditorías o importaciones existentes. No son la fuente principal:

```text
js/public-shell.js
js/ui-navigation-controller.js
js/components/navigation/legacy/navigation-desktop.js
js/components/navigation/legacy/navigation-tablet.js
js/components/navigation/legacy/navigation-mobile.js
js/components/navigation/legacy/navigation-shared.js
js/components/navigation/legacy/nav-collections.js
css/components/navigation/legacy/navigation-desktop.css
css/components/navigation/legacy/navigation-tablet.css
css/components/navigation/legacy/navigation-mobile.css
css/components/navigation/legacy/navigation-shared.css
css/components/navigation/compartido/control-paneles.css
```

Cuando un problema esté en navegación, abrir el archivo equivalente dentro de `js/components/navigation/` o `css/components/navigation/`.

## Áreas todavía en migración

El archivo `script.js` conserva funciones históricas de catálogo, carrito, búsqueda y elementos de páginas. No debe crecer. Las correcciones nuevas se colocan en módulos específicos y, cuando una sección se extraiga, `script.js` queda como adaptador temporal.

El panel administrativo tiene sus propios archivos y no debe mezclarse con componentes públicos.
