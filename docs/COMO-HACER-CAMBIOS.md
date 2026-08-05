# Cómo hacer cambios sin romper producción

## 1. Abrir la copia local del repositorio

En Visual Studio Code abrir la carpeta local de `tintinaccs/tintin-web`. La ventana no debe mostrar `[GitHub]`, porque las herramientas que usan terminal necesitan acceso completo a los archivos locales.

## 2. Confirmar la rama

Antes de editar, revisar la rama mostrada por Visual Studio Code. Nunca reorganizar directamente en `main`.

Para este bloque de nombres se usa:

```text
orden/nombres-navegacion-espanol
```

## 3. Abrir solamente el componente afectado

Ejemplos:

```text
Tienda de escritorio no cierra
→ js/components/navigation/shared/surface-controller.js
→ css/components/navigation/escritorio/encabezado-escritorio.css

Logo de tableta muy grande
→ css/components/navigation/tableta/encabezado-tableta.css

Texto de la barra móvil
→ js/components/navigation/movil/encabezado-movil.js

Tamaño del buscador
→ css/components/navigation/shared/surfaces.css
```

## 4. No editar adaptadores

No agregar arreglos en los archivos antiguos de compatibilidad. Un arreglo colocado ahí puede duplicarse o perderse después.

## 5. Revisar la diferencia

Antes de confirmar un cambio, abrir **Control de código fuente** y revisar:

- archivos modificados;
- líneas agregadas;
- líneas eliminadas;
- rutas e importaciones;
- nombres de identificadores usados por JavaScript.

## 6. Ejecutar auditorías

Comandos principales cuando exista un entorno con terminal:

```bash
npm run audit:public-shell
npm run audit:responsive-navigation
npm run audit:all-navigation-surfaces
npm run audit:headers
```

Una auditoría estática correcta no reemplaza la prueba visual. Escritorio, tableta y móvil deben revisarse de forma separada.

## 7. Confirmar cambios pequeños

Cada commit debe representar una sola intención. Ejemplos:

```text
fix(escritorio): cerrar Tienda al tocar afuera
fix(tableta): corregir navegación de colecciones
fix(movil): mantener espacio seguro de la barra inferior
refactor(navegacion): separar buscador compartido
```

Evitar commits como `cambios`, `arreglos varios` o `todo listo`.

## 8. Revisar antes de publicar

No fusionar con `main` mientras exista cualquiera de estos problemas:

- errores de consola;
- panel que no abre o no cierra;
- contenido que desborda;
- desplazamiento bloqueado después de cerrar;
- foco perdido con teclado;
- pruebas automáticas fallidas;
- importación o archivo 404;
- comportamiento distinto entre recarga y navegación.

## 9. Volver atrás

Si un cambio falla, revertir el commit completo en lugar de agregar más CSS encima. El historial de GitHub permite recuperar la versión anterior sin borrar el repositorio.

## 10. Regla de producción

```text
editar rama
→ probar
→ revisar
→ pull request
→ fusionar a main
```

No editar producción como método de prueba.
