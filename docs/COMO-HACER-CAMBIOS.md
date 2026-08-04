# Cómo hacer cambios sin romper producción

## 1. Abrir el repositorio remoto

En Visual Studio Code usar **Open Remote Repository** y abrir `tintinaccs/tintin-web`. No hace falta clonar para leer o editar archivos pequeños.

## 2. Confirmar la rama

Antes de editar, revisar la rama mostrada por VS Code. Nunca reorganizar directamente en `main`.

Para la reorganización actual se usa:

```text
refactor/modular-site-20260804
```

## 3. Abrir solamente el componente afectado

Ejemplos:

```text
Tienda desktop no cierra
→ js/components/navigation/shared/surface-controller.js
→ css/components/navigation/desktop/header-desktop.css

Logo tablet muy grande
→ css/components/navigation/tablet/header-tablet.css

Texto de la barra mobile
→ js/components/navigation/mobile/header-mobile.js

Tamaño del buscador
→ css/components/navigation/shared/surfaces.css
```

## 4. No editar adaptadores

No agregar arreglos en los archivos antiguos de compatibilidad. Un arreglo colocado ahí puede duplicarse o perderse después.

## 5. Revisar la diferencia

Antes de confirmar un cambio, abrir **Source Control** y revisar:

- archivos modificados;
- líneas agregadas;
- líneas eliminadas;
- rutas e imports;
- nombres de IDs usados por JavaScript.

## 6. Ejecutar auditorías

Comandos principales cuando exista un entorno con terminal:

```bash
npm run audit:public-shell
npm run audit:responsive-navigation
npm run audit:all-navigation-surfaces
npm run audit:headers
```

Una auditoría estática correcta no reemplaza la prueba visual. Desktop, tablet y mobile deben revisarse de forma separada.

## 7. Confirmar cambios pequeños

Cada commit debe representar una sola intención. Ejemplos:

```text
fix(desktop): cerrar Tienda al tocar afuera
fix(tablet): corregir navegación de colecciones
fix(mobile): mantener espacio seguro de la tabbar
refactor(navigation): separar buscador compartido
```

Evitar commits como `cambios`, `arreglos varios` o `todo listo`.

## 8. Revisar antes de publicar

No fusionar con `main` mientras exista cualquiera de estos problemas:

- errores de consola;
- panel que no abre o no cierra;
- contenido que desborda;
- scroll bloqueado después de cerrar;
- foco perdido con teclado;
- pruebas automáticas fallidas;
- import o archivo 404;
- comportamiento distinto entre recarga y navegación.

## 9. Volver atrás

Si un cambio falla, revertir el commit completo en lugar de agregar más CSS encima. El historial de GitHub permite recuperar la versión anterior sin borrar el repositorio.

## 10. Regla de producción

```text
editar rama
→ probar
→ revisar
→ pull request
→ merge a main
```

No editar producción como método de prueba.
