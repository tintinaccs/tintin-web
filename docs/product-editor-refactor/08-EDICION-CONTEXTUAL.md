# Edición contextual desde las fotografías

Continuación del pedido aclarado el 26/10/2026: reunir las fotos con opciones,
importes, cantidades y datos del producto en un espacio de edición continuo.
Base: `899a6851100b9560e6e3520e71ea3100babaa9fb` (#1248).

## Implementación

La galería canónica incorpora selección múltiple mediante casillas accesibles.
El panel superior aplica o quita una asociación de atributos al conjunto elegido.
La portada sigue en `imageUrl`; las asociaciones continúan en `variantMedia`.
Seleccionar fotos es estado temporal del editor y no cambia portada ni variantes.
Un reemplazo abierto debe terminarse o cancelarse antes de abrir asociaciones u
otro reemplazo, para preservar el archivo pendiente.

El organizador existente coloca la galería en la columna izquierda y mantiene
los campos originales en la derecha en escritorio. En tamaños menores usa una
columna. Nombre, descripción, precios, opciones, inventario, material y demás
detalles se mantienen accesibles en el mismo recorrido. El selector existente
actúa como acceso rápido: desplaza y enfoca un campo, sin ocultar los demás.
Los permisos continúan ocultando la sección privada.

Las sugerencias por familia ofrecen atributos de bolsos/carteras, relojes,
collares, anillos, pulseras y aros. Preparan el constructor existente y requieren
`Agregar opción`; no crean opciones ni cambian garantías o materiales por sí
solas. Categorías desconocidas conservan la entrada manual.

## Autoridades y alcance

Se reutilizan `galeria-unificada.js`, `interfaz-productos-adaptable.js`,
`sugerencias-producto-core.mjs`, `sugerencias-producto-interfaz.js` y el CSS
administrativo. Se renuevan sus referencias y derivados desde los generadores.
No se reemplazan serializer, escritores, CAS, inventario ni contratos comerciales.
Los cambios antiguos del otro worktree quedan conservados sin incorporarlos.

## Evidencia local

- Seis recorridos de asociación múltiple y guardado en 320/390/600/768/1024/1440:
  aprobados en Chromium.
- Seis regresiones de workspace: creación/recuperación, error de escritura,
  publicación en vuelo, conflicto, fotos pendientes y archivo/restauración:
  aprobadas.
- 44 pruebas Node de dominio comercial, editorial y workspace: aprobadas.
- Build Pages y versionado de caché: aprobados en la primera generación.

Cierre dirigido adicional: 26 recorridos Chromium de versión única/editor final/
contexto aprobados; 8 recorridos contextuales finales aprobados, incluidos Bags
y conservación del reemplazo pendiente, con aserción de ambas URLs en la
asociación persistida. Son ejecuciones parcialmente solapadas, no 34 casos únicos.
`npm ci --prefer-offline --no-audit --no-fund` instaló los 671 paquetes del
lockfile actual. El preflight inicial con dependencias heredadas se rechazó por
versiones Firebase/CLI anteriores: ese entorno se sustituyó por instalación propia.

Cierre con dependencias exactas: 14/14 Chromium de contexto y versión única,
sin reintentos, y el stage oficial `node scripts/ci-stage.mjs preflight` completo
aprobaron. Build Pages final, CSP, rutas, diagnóstico y caché aprobaron.

Las pruebas usan identidad y proveedores ficticios. CI, dispositivos físicos y
proveedores reales requieren evidencia propia del candidato final.

## Corrección de regresiones de presentación

CI 40399508881 sobre d2aaaa17 aprobó preflight, comercio, reglas, CodeQL y calidad;
Administración detectó 35 expectativas anteriores al recorrido continuo, con
383 recorridos aprobados. Se actualizaron los selectores de estructura/foco:
no se exige ocultar precio/fotos al navegar, Categoría pertenece al cuerpo de
campos y el acceso rápido enfoca el destino en lugar de volver al principio.
El botón Producto se consulta dentro de su sección para distinguirlo de la
sugerencia del contenido del paquete. Se preservan las pruebas de permisos,
contención, datos, acciones y foco. Repetición dirigida: 35/35 Chromium aprobados.
La siguiente CI debe validar el nuevo commit; no se hereda su resultado global.
