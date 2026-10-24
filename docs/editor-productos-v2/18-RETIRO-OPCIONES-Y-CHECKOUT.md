# Retirada de opciones y controles conectados

Base: main9312c832. Codex /root,24/10/2026. Alcance solicitado: quitar colores/opciones sin callejón sin salida y comprobar el circuito del editor hasta checkout, con pruebas aisladas.

## Comportamiento

- Quitar una opción guardada la retira de venta: conserva filas, claves, precio, fotos y cantidades para que pedidos/reservas anteriores sigan resolviéndose. Restaurar vuelve a habilitar las combinaciones de esa opción. No cambia el stock ni crea pedidos.
- Una opción nueva no guardada se puede quitar del borrador. El formato avanzado conserva el rechazo a destruir referencias ya guardadas; la acción segura está en Quitar/Restaurar y en Disponible de cada combinación.
- Una matriz legacy con referencias se prepara como matriz compatible desde el formulario, conservando claves/cantidades. Sólo se persiste con Guardar y por el escritor CAS autorizado. No se convierte stock agregado sin matriz ni se modifican datos reales automáticamente.
- Catálogo y ficha ocultan valores cuyas combinaciones están todas desactivadas; un agotado activo puede seguir viéndose como agotado. El cliente puede comprar las combinaciones que permanecen disponibles. El servidor sigue rechazando referencias inexistentes, retiradas y cantidades inválidas.
- Precio y stock de la vista previa usan el mismo motor; las variantes elegidas por color desde una tarjeta no se cambian por otro color al completar el talle.

## Cobertura revisada

| Controles o conexión | Evidencia |
| --- | --- |
| Agregar opción/paleta, Quitar, Restaurar, stock legacy y borrador | products-responsive-phase-one + editor-comercial-v2; pruebas negativas mantienen borrado histórico bloqueado |
| Precio/precio anterior/stock por fila, Disponible, lote y paginación | editor-comercial-v2, editor-comercial y writer/maestro-productos-controlador |
| Invertir atributos y conservar identidad/foto/precio | matriz comercial, variant-commerce-v2 y recorrido conectado |
| Galería/subida/confirmación/biblioteca/portada/orden/quitar foto | suite responsive existente, con uploads de fixture; ningún proveedor real |
| Guardar/Cancelar/borradores/duplicar/lote/publicación/permisos/CAS | controlador real en VM y escritor con IO aislado; no se declara CRUD productivo |
| Vista previa, volver a editar, tamaños y campos dentro de cada fila | 16 Chromium de matriz y102 responsive; nueva geometría rechaza inputs fuera del fieldset y superposición de filas/paginación |
| Catálogo/ficha/preferencia de color y variantes retiradas | pruebas de presentación, colores/tarjetas y comercio |
| Checkout, disponibilidad y navegación |59 Chromium con fixtures y Node comercial |
| Editor→pedido→reserva→retirada→otro color→cancelar→restaurar | retired-option-checkout reutilizado en memoria y Firestore demo/loopback |

No es una certificación de todos los botones de toda la plataforma. Cubre los controles y consumidores del circuito solicitado; la CI completa sigue siendo obligatoria para el candidato final.

## Límite de ejecución

No se usan pedidos, clientes, inventario, pagos ni correos reales. El flujo en memoria pasó; la descarga del emulador está bloqueada localmente por la política de red, por lo que Firestore emulado queda pendiente de CI. No se elimina, omite ni vuelve opcional esa prueba. El test usa proyecto demo fijo y rechaza hosts distintos de loopback. No se afirma una compra E2E real, Auth productivo, Safari o hardware físico. CI, publicación y SHA exacto se registran al cerrar.
