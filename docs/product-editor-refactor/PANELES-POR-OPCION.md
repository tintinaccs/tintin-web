# Fotos y disponibilidad en el lugar de edición

La opción tiene dos botones: Fotos y Disponibilidad. Abren un panel en la misma
fila. Sólo existe uno abierto; cambiar de opción traslada el editor canónico,
no crea otra matriz ni otros campos con los mismos IDs. Cerrar o Escape vuelve
al botón. Con variantes, el bloque inferior de stock queda retirado de la
interfaz; los accesos de navegación conducen al control de la opción.

Fotos muestra miniaturas, permite elegir varias y ordenar su portada propia.
Los selectores de otros atributos distinguen fotos comunes de una opción y
fotos de una combinación concreta. Agregar fotos despliega la carga múltiple
existente; conserva su límite de13. La galería general administra la portada y
los archivos. El antiguo recorrido de selección de fotos y asociación de colores
no se monta en paralelo. El campo textual original de opciones se conserva
oculto para el serializer; no ofrece una segunda carga avanzada.

Disponibilidad usa las cantidades originales de stock legado y el borrador
comercial v2. Su selector incluye las combinaciones de la opción, aunque
quedaran fuera de la primera página de25 filas. Los controles ocultos legados
se mantienen en su orden original de serialización. El total no es una segunda
cantidad editable. El precio general y el precio propio de una combinación son
configuraciones distintas y mantienen su contrato de herencia.

Guardar usa el escritor original. Un borrador privado no modifica el producto
oficial; activo, inactivo y archivado mantienen sus reglas. Las pruebas recorren
carga múltiple, edición, guardado, reapertura, referencias, cantidades, precio,
fotos y estados con datos ficticios. También conservan el destino de una cola
de fotos al salir de su panel antes de guardar. No certifican una compra real,
proveedores autenticados ni dispositivos físicos. La CI y publicación se
verifican separadamente por SHA.

Las pruebas de asociaciones comprueban que diez cambios de selección conservan
los nodos de imagen y checkbox, el foco y la posición. Se verifica ajuste en
móvil, orientación horizontal, tablet, laptop y escritorio hasta3840px, sin
reintentos ni eliminar los controles obligatorios de CI. Las pruebas de matriz,
edición múltiple y orden siguen ejecutándose en su fixture de componente; las
de formulario usan los nuevos accesos, conservando sus aserciones de datos.

## Cierre de iconos y regresión de administración

Los controles de portada/orden usan símbolos SVG de20px, centrados en un área
44px sin los círculos de la regla global. Las tres acciones comparten una fila;
la cuadrícula reserva el ancho necesario incluso en320px. Las cantidades usan
símbolos centrados y proporcionados. Se conservan nombre accesible, tooltip,
foco y acciones originales. Ocho tamaños320–3840 incluyen móvil horizontal,
tablet vertical/horizontal, laptop y desktop; se comprueba además guardar la
portada elegida. No se acredita hardware físico.

La CI40567497292 de a095770b falló14 casos de Administración: buscaban controles
de stock fuera del nuevo panel por opción. Los recorridos ahora abren
Disponibilidad de la opción correspondiente, conservando todas las aserciones
comerciales, de vista previa y geometría. Los14 aprobaron localmente. Se integra
main69c38967 sin retirar sus recibos ni confundir QA ficticio con acceso real.
La autorización actual incluye cierre, merge y seguimiento posterior.
