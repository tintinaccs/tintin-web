# Tintin — contrato funcional integral de la tienda

Este documento define cómo debe comportarse la tienda completa. No describe una pantalla aislada: establece una sola lógica para Firestore, Google Sheets, panel administrativo, catálogo, portada, ficha, búsqueda, carrito y checkout.

## 1. Fuentes de verdad

- **Firestore** es la base operativa de productos, colecciones, clientas, pedidos, configuración, stock y permisos.
- **TINTIN INVENTARIO 2026** es el panel sincronizado para edición y control. No reemplaza a Firestore ni mantiene una lógica paralela.
- El sitio público nunca debe inventar productos, precios, stock ni estados cuando una lectura falla.
- Caché y respaldos aceleran la carga, pero deben ser temporales y reconciliarse con Firestore en tiempo real.

## 2. Producto visible y producto comprable

Un producto es visible cuando:

- tiene ID, nombre, categoría y precio válido;
- está activo;
- su colección está visible;
- no contiene datos inseguros o incompletos.

Un producto es comprable cuando, además de ser visible:

- su stock es ilimitado (`null`) o mayor que cero;
- las variantes requeridas son válidas.

Stock cero no significa ocultar. Significa mostrar **Agotado**, bloquear la compra y moverlo al final.

## 3. Orden único de merchandising

La regla predeterminada en catálogo, categorías, resultados y relacionados es:

1. disponibles;
2. actividad más reciente;
3. orden manual de colección como desempate;
4. nombre e ID como desempate estable;
5. agotados al final, ordenados con la misma lógica interna.

La actividad del producto usa, en este orden, la fecha más reciente entre:

- `catalogActivityAt`;
- `restockedAt`;
- `updatedAt`;
- `createdAt`.

Crear, editar, cambiar precio, imagen, descripción, categoría, oferta, destacado o reponer stock promueve el producto. El orden no depende de la pestaña, del dispositivo ni de una memoria temporal del navegador.

Los ordenamientos explícitos por precio, nombre o stock se aplican dentro de disponibles y agotados. Nunca mezclan un agotado entre productos disponibles.

## 4. Producto nuevo

- Un producto lleva etiqueta **Nuevo** durante cinco días completos desde `createdAt`.
- La etiqueta expira automáticamente; no queda guardada para siempre.
- Agotado tiene prioridad visual sobre Nuevo.
- Oferta u otra etiqueta se muestra cuando ya no corresponde Nuevo, salvo una decisión comercial explícita posterior.

## 5. Tiempo real

- Cambios de Firestore deben reflejarse sin recargar en catálogo, categoría abierta, ficha y carrito.
- Una reposición de stock mueve el producto al bloque disponible y lo promueve por actividad.
- Al agotarse, baja al final y se bloquean sus botones de compra.
- Los listeners se instalan una sola vez y se cierran al abandonar la página.
- Un error permanente de permisos no debe generar reintentos infinitos.

## 6. Portada y recomendaciones

- Portada, destacados y combinaciones muestran solamente productos comprables.
- Dentro de ese conjunto respetan el orden de actividad.
- No se usan productos ficticios como respaldo.
- Los relacionados priorizan productos disponibles y recientes de la misma categoría.

## 7. Búsqueda y filtros

- La búsqueda considera nombre, categoría, descripción, etiquetas y variantes.
- El resultado debe ser estable y consistente con la política del catálogo.
- Filtros no modifican la fuente de datos; solamente reducen el conjunto visible.
- Limpiar filtros restaura la política predeterminada.
- Una categoría inexistente vuelve a Todo el catálogo sin mostrar datos bajo un título incorrecto.

## 8. Carrito

- No se puede agregar un producto agotado, inactivo o inexistente.
- La cantidad nunca supera el stock real.
- El carrito se reconcilia con precio, nombre, imagen, variante y stock actuales.
- Si el producto deja de ser comprable, se elimina o bloquea de manera explícita antes del checkout.
- Varias pestañas comparten el mismo estado sin bucles de eventos.

## 9. Checkout y pedido

- El checkout vuelve a validar todos los productos antes de crear el pedido.
- Precio y total se calculan desde datos vigentes, no desde valores manipulables del navegador.
- Un doble clic o reintento de red no crea pedidos duplicados.
- Los estados de pedido y pago usan una única lista de valores.
- El stock y el pedido cambian de forma coherente o la operación falla completa.

## 10. Sincronización con Google Sheets

- Solamente se usa **TINTIN INVENTARIO 2026**.
- ID Firestore identifica la fila y no se reemplaza por nombre o posición.
- Una edición desde Sheets actualiza `updatedAt` y la web en tiempo real.
- Conflictos no deben duplicar productos ni borrar campos no editados.
- Historial sync registra éxito, error, dirección y detalle suficiente para diagnóstico.

## 11. Diseño y experiencia

- El diseño no cambia de ancho durante carga o actualización.
- Skeleton, cargando, vacío y error conservan la geometría de la pantalla.
- Desktop, tablet y móvil comparten jerarquía, contenido y acciones; cambia la distribución, no la lógica.
- Botones bloqueados explican el estado y no aparentan ser interactivos.
- Contraste, foco, teclado, etiquetas y regiones en vivo deben ser accesibles.

## 12. Rendimiento

- No se duplica la lectura completa del catálogo para resolver orden o diseño.
- El orden se calcula una vez por actualización y se reutiliza.
- Imágenes se entregan redimensionadas, comprimidas y con carga diferida fuera de la primera vista.
- Caché nunca conserva un catálogo vacío como resultado válido prolongado.
- No se agregan timers, observers o listeners duplicados para corregir problemas que deben resolverse en la fuente.

## 13. Seguridad y fallos

- Ocultar un botón no reemplaza permisos de Firestore.
- El sitio distingue: vacío real, no encontrado, sin permiso, red lenta y error.
- Bloqueadores del navegador no deben romper el diseño ni iniciar ciclos de escritura.
- Datos del usuario, pedidos y permisos no se exponen en el catálogo público.

## 14. Criterio para cualquier cambio futuro

Antes de integrar una función se debe comprobar:

1. qué fuente de verdad utiliza;
2. cómo afecta stock, orden y visibilidad;
3. cómo se comporta en tiempo real;
4. qué ocurre en móvil, tablet y desktop;
5. cómo falla sin red o sin permisos;
6. si duplica lecturas, listeners o lógica existente;
7. si cuenta con una auditoría que falle cuando se rompe el contrato.
