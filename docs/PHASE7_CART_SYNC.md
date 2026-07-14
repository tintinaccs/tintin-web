# Fase 7 — Carrito y sincronización entre dispositivos

## Objetivo

El carrito debe conservarse correctamente al:

- cambiar de página;
- abrir otra pestaña;
- iniciar o cerrar sesión;
- entrar desde otro teléfono o computadora;
- agregar dos variantes del mismo producto;
- finalizar un pedido.

## Identidad del carrito

Se mantienen espacios separados:

```text
Invitada: tt_cart_guest
Cuenta:   tt_cart_user_{uid}
Remoto:   users/{uid}/cart/{lineId}
```

`lineId` se calcula con el ID del producto y la variante. Por eso dos colores o modelos del mismo producto ya no se sobrescriben entre sí.

## Inicio de sesión

Cuando una clienta agrega productos antes de entrar a su cuenta:

1. El carrito de invitada queda intacto.
2. Al iniciar sesión se carga el carrito remoto.
3. Ambos se combinan.
4. La combinación se guarda en Firestore.
5. El carrito de invitada se limpia solo después de completar esa sincronización.

La migración del carrito anterior se realiza una sola vez por cuenta.

## Sincronización

- Firestore se escucha mediante `onSnapshot`.
- Los cambios de otra pestaña o dispositivo aparecen automáticamente.
- Las escrituras rápidas se agrupan durante unos milisegundos.
- Las operaciones se ejecutan en orden para evitar que una cantidad vieja llegue después de una nueva.
- Un snapshot remoto no pisa cambios locales pendientes.
- Si se pierde internet, el carrito continúa guardado en el dispositivo y se reintenta al volver la conexión.

## Datos visuales y seguridad

El documento remoto puede guardar nombre, imagen y precio para mostrar el carrito rápidamente. Estos datos no son autoritativos.

Al confirmar el pedido, el checkout seguro vuelve a leer cada producto desde Firestore y valida:

- existencia;
- estado activo;
- precio vigente;
- stock disponible;
- subtotal y total.

## Compatibilidad

El código histórico todavía usa:

```js
localStorage.getItem('tt_cart')
localStorage.setItem('tt_cart', ...)
```

La Fase 7 conserva esa interfaz, pero la redirige únicamente dentro de `localStorage` hacia la identidad activa. `sessionStorage` no se modifica.

También se interceptan los controles antiguos del drawer y del checkout para operar por `lineId`, evitando que dos variantes compartan el mismo botón de cantidad o eliminación.

## Indicador

El drawer muestra uno de estos estados:

- Guardado en este dispositivo.
- Cargando tu carrito.
- Guardando cambios.
- Carrito sincronizado.
- Sin conexión, guardado localmente.

## Despliegue

Esta fase utiliza las reglas de carrito que ya existen y no modifica Cloud Functions ni reglas de Firestore.

No requiere Cloud Shell, Blaze ni una publicación manual en Firebase. Al fusionar el Pull Request, GitHub Pages publica el código.

## Prueba manual recomendada

1. Abrir la tienda sin sesión y agregar un producto.
2. Iniciar sesión y comprobar que sigue allí.
3. Abrir la misma cuenta en otro navegador o dispositivo.
4. Cambiar la cantidad y comprobar que se actualiza en el otro.
5. Agregar dos variantes del mismo producto y modificar cada una por separado.
6. Eliminar una línea y confirmar que no reaparece.
7. Finalizar un pedido y comprobar que el carrito queda vacío en ambos dispositivos.
