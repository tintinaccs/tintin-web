# Arquitectura de Tintin Web

## Objetivo

El repositorio mantiene una sola fuente oficial de código, pero divide cada área en componentes pequeños y reconocibles. La separación evita que un arreglo de desktop modifique accidentalmente tablet o mobile, y evita duplicar la lógica de Buscar, Cuenta, Carrito y Colecciones.

## Regla principal

- La estructura visual específica de cada dispositivo vive en `desktop/`, `tablet/` o `mobile/`.
- La lógica que utilizan varios dispositivos vive en `shared/`.
- Los archivos antiguos que todavía son usados por páginas o auditorías quedan como adaptadores de compatibilidad pequeños. No deben recuperar lógica propia.
- `main` representa producción. La reorganización se prepara y prueba primero en una rama.

## Navegación pública

```text
js/components/navigation/
├── public-shell-entry.js
├── desktop/
│   ├── header-desktop.js
│   └── controller.js
├── tablet/
│   ├── header-tablet.js
│   └── controller.js
├── mobile/
│   ├── header-mobile.js
│   └── controller.js
└── shared/
    ├── account-drawer.js
    ├── assets.js
    ├── cart-drawer.js
    ├── collections-runtime.js
    ├── collections-sheet.js
    ├── config.js
    ├── footer-accordion.js
    ├── icons.js
    ├── route-state.js
    ├── router.js
    ├── runtime.js
    ├── search-panel.js
    ├── surface-controller.js
    └── surface-layer.js
```

```text
css/components/navigation/
├── desktop/header-desktop.css
├── tablet/header-tablet.css
├── mobile/header-mobile.css
└── shared/
    ├── navigation-transitions.css
    └── surfaces.css
```

## Responsabilidades

### Desktop

`header-desktop.js` contiene únicamente el HTML del header de escritorio. `header-desktop.css` controla únicamente medidas desde 1025 px. `controller.js` controla la píldora activa y la geometría visual de la navegación.

### Tablet

`header-tablet.js` contiene el header y el menú de tablet. `header-tablet.css` controla únicamente 768–1024 px. `controller.js` controla el cambio entre la vista principal y las colecciones.

### Mobile

`header-mobile.js` contiene únicamente la barra inferior. `header-mobile.css` controla únicamente 0–767 px. `controller.js` calcula el halo y el indicador activo.

### Shared

- `surface-controller.js`: apertura, cierre, Escape, foco, backdrop, bloqueo de scroll y cambio entre superficies.
- `search-panel.js`: estructura visual del buscador.
- `account-drawer.js`: estructura de Mi Cuenta.
- `cart-drawer.js`: estructura del carrito.
- `collections-sheet.js`: estructura de colecciones mobile.
- `collections-runtime.js`: datos e imágenes de colecciones con fallback.
- `runtime.js`: carga controlada de cuenta, carrito, productos y comportamientos.
- `route-state.js`: determina la página activa.
- `assets.js`: carga las hojas CSS del componente.

## Archivos de entrada y compatibilidad

`js/public-shell.js` es un bootstrap pequeño. Su única responsabilidad es cargar `js/components/navigation/public-shell-entry.js`.

`js/ui-navigation-controller.js` carga el controlador compartido modular.

Los siguientes archivos son adaptadores temporales:

```text
js/navigation-desktop.js
js/navigation-tablet.js
js/navigation-mobile.js
js/navigation-shared.js
js/nav-collections.js
css/navigation-desktop.css
css/navigation-tablet.css
css/navigation-mobile.css
css/navigation-shared.css
css/surface-controller.css
```

No se agrega lógica nueva a esos archivos. La fuente de verdad está en `components/`.

## Breakpoints oficiales

```text
Mobile:  0–767 px
Tablet:  768–1024 px
Desktop: 1025 px en adelante
```

No se deben crear nuevos cortes 769, 1023, 1025 o 1100 para decidir qué header existe. Se permiten cortes internos adicionales únicamente para ajustes visuales dentro de un dispositivo.

## Flujo de publicación

```text
rama de trabajo
→ auditorías automáticas
→ revisión de cambios
→ preview
→ pull request
→ merge a main
→ producción
```

La rama `main` no se usa para experimentar ni para mover archivos sin pruebas.
