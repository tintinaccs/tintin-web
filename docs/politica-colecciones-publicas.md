# Política de colecciones públicas

## Colecciones vacías

Una colección `visible !== false` sigue siendo una colección publicada aunque en ese momento tenga cero productos comprables. Debe conservar:

- URL canónica navegable (`/catalogo?cat=<slug>`),
- nombre/título,
- tarjeta en la página de colecciones,
- estado vacío explícito en el catálogo.

No se debe reemplazar una colección vacía por “Todos” ni mostrar productos de otra categoría. Los productos inactivos/eliminados no cuentan para decidir si una colección tiene contenido.

## Slugs inválidos o inexistentes

El slug se normaliza para navegación. Si la URL solicita una colección que no existe o dejó de estar publicada, el catálogo elimina ese filtro fantasma y vuelve a `Todos`; nunca conserva un título de una colección inexistente sobre productos ajenos.

## Slugs duplicados

Dos documentos publicados que normalizan a la misma URL son un conflicto de operación. Ejemplos históricos: `bags`/`bolsos`, `ear-cuff`/`earcuff`.

La superficie pública aplica una regla determinista: ordena por `order` y nombre, conserva el primer documento de cada slug canónico y descarta los duplicados de la renderización pública, registrando una advertencia de consola. El Admin debe corregir el dato fuente; el cliente no inventa una segunda URL ni duplica tarjetas.

## Productos eliminados u ocultos

Una colección solo contabiliza productos con nombre válido y `active !== false`. Un producto eliminado/inactivo no puede:

- incrementar el contador de la colección,
- impedir el estado vacío,
- usarse como producto visible de la colección.

Firestore sigue siendo la autoridad; esta política solo evita estados públicos obsoletos o ambiguos.
