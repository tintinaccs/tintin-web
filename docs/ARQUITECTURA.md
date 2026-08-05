# Arquitectura de Tintin Web

## Objetivo

El repositorio mantiene una sola fuente oficial de código, pero divide cada área en componentes pequeños y reconocibles. La separación evita que un arreglo de escritorio modifique accidentalmente tableta o móvil, y evita duplicar la lógica de Buscar, Cuenta, Carrito y Colecciones.

## Regla principal

- La estructura visual específica de cada dispositivo vive en `escritorio/`, `tableta/` o `movil/`.
- La lógica que utilizan varios dispositivos vive temporalmente en `shared/` hasta que ese bloque se revise por separado.
- Los archivos antiguos que todavía son usados por páginas o auditorías quedan como adaptadores de compatibilidad pequeños. No deben recuperar lógica propia.
- `main` representa producción. La reorganización se prepara y prueba primero en una rama.
- Los nombres de archivos internos se escriben en español, en minúsculas, sin tildes y separados por guiones.

## Navegación pública

```text
js/components/navigation/
├── public-shell-entry.js
├── escritorio/
│   ├── encabezado-escritorio.js
│   └── indicador-navegacion-escritorio.js
├── tableta/
│   ├── encabezado-tableta.js
│   └── control-menu-tableta.js
├── movil/
│   ├── encabezado-movil.js
│   └── indicador-navegacion-movil.js
└── shared/
    ├── panel-cuenta.js
    ├── assets.js
    ├── panel-carrito.js
    ├── collections-runtime.js
    ├── panel-colecciones.js
    ├── config.js
    ├── acordeon-pie-pagina.js
    ├── icons.js
    ├── register-surfaces.js
    ├── route-state.js
    ├── router.js
    ├── runtime.js
    ├── control-busqueda.js
    ├── panel-busqueda.js
    ├── surface-controller.js
    └── surface-layer.js
```

```text
css/components/navigation/
├── escritorio/encabezado-escritorio.css
├── tableta/encabezado-tableta.css
├── movil/encabezado-movil.css
└── shared/
    ├── navigation-transitions.css
    ├── search.css
    └── surfaces.css
```

## Responsabilidades

### Escritorio

`encabezado-escritorio.js` contiene únicamente el HTML del encabezado de escritorio. `encabezado-escritorio.css` controla únicamente medidas desde 1025 px. `indicador-navegacion-escritorio.js` controla la píldora activa y la geometría visual de la navegación.

### Tableta

`encabezado-tableta.js` contiene el encabezado y el menú de tableta. `encabezado-tableta.css` controla únicamente 768–1024 px. `control-menu-tableta.js` controla el cambio entre la vista principal y las colecciones.

### Móvil

`encabezado-movil.js` contiene únicamente la barra inferior. `encabezado-movil.css` controla únicamente 0–767 px. `indicador-navegacion-movil.js` calcula el halo y el indicador activo.

### Compartido

- `surface-controller.js`: apertura, cierre, Escape, foco, fondo, bloqueo de desplazamiento y cambio entre superficies.
- `register-surfaces.js`: conecta el controlador cuando el HTML modular ya existe y registra Tienda, Buscar, Cuenta y Carrito.
- `panel-busqueda.js`: estructura visual del buscador.
- `control-busqueda.js`: índice reutilizable, coincidencias, teclado, estados de carga y error.
- `search.css`: presentación de resultados, selección y reintento.
- `panel-cuenta.js`: estructura de Mi Cuenta.
- `panel-carrito.js`: estructura del carrito.
- `panel-colecciones.js`: estructura de colecciones móvil.
- `collections-runtime.js`: datos e imágenes de colecciones con respaldo.
- `runtime.js`: carga controlada de cuenta, carrito, productos y comportamientos.
- `route-state.js`: determina la página activa.
- `assets.js`: carga las hojas CSS del componente antes de mostrar la navegación.
- `acordeon-pie-pagina.js`: mejora el pie de página móvil con secciones desplegables.

## Archivos de entrada y compatibilidad

`js/public-shell.js` es un archivo de inicio pequeño. Su única responsabilidad es cargar `js/components/navigation/public-shell-entry.js`.

`js/ui-navigation-controller.js` carga el controlador compartido modular.

Los siguientes archivos son adaptadores temporales:

```text
js/components/navigation/legacy/navigation-desktop.js
js/components/navigation/legacy/navigation-tablet.js
js/components/navigation/legacy/navigation-mobile.js
js/components/navigation/legacy/navigation-shared.js
js/components/navigation/legacy/nav-collections.js
css/components/navigation/legacy/navigation-desktop.css
css/components/navigation/legacy/navigation-tablet.css
css/components/navigation/legacy/navigation-mobile.css
css/components/navigation/legacy/navigation-shared.css
css/components/navigation/shared/surface-controller.css
```

No se agrega lógica nueva a esos archivos. La fuente principal está en `components/`.

## Cortes oficiales por dispositivo

```text
Móvil:      0–767 px
Tableta:    768–1024 px
Escritorio: 1025 px en adelante
```

No se deben crear nuevos cortes 769, 1023, 1025 o 1100 para decidir qué encabezado existe. Se permiten cortes internos adicionales únicamente para ajustes visuales dentro de un dispositivo.

## Flujo de publicación

```text
rama de trabajo
→ auditorías automáticas
→ revisión de cambios
→ vista previa
→ pull request
→ fusión a main
→ producción
```

La rama `main` no se usa para experimentar ni para mover archivos sin pruebas.
