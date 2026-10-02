# Política de escalado del catálogo público

El catálogo actual tiene dos protecciones distintas:

1. las lecturas públicas están **acotadas**; no existen consultas sin límite (`products` tiene techo de 1.000 documentos y `collections` un techo menor),
2. el DOM se renderiza progresivamente por lotes mediante “Mostrar más productos”, por lo que no se crean cientos de tarjetas de una sola vez.

## Umbral operativo

Mientras el catálogo publicado permanezca por debajo de 800 productos, el modelo actual conserva filtros combinables, búsqueda local completa y actualización realtime con un costo predecible. Al alcanzar 800 productos publicados, el crecimiento queda bloqueado como deuda operativa: antes de superar el techo de 1.000 se debe migrar el listado a cursor/paginación server-side y mover búsqueda/filtros que requieran el conjunto completo a consultas indexadas o un índice de búsqueda.

El límite de 1.000 **no debe aumentarse** como solución de escalabilidad. Aumentar el número solo posterga el problema y vuelve a cargar todo el catálogo en cliente.

## Evidencia de frescura

`catalogo.html` muestra el estado de sincronización. Cada carga/actualización canónica exitosa debe registrar visualmente la fecha/hora de la última sincronización. Ante fallo de red sin datos utilizables se muestra `error`, no un catálogo vacío falso; si existe una copia anterior utilizable, se conserva y se informa que no pudo actualizarse.

## Criterio para la futura paginación

La migración a cursor debe preservar:

- enlaces canónicos de producto,
- filtros combinables,
- orden estable,
- favoritos,
- estado de stock,
- back/forward del navegador,
- ausencia de duplicados entre páginas.

Hasta esa migración, las auditorías deben fallar si desaparecen los límites explícitos o si se intenta ampliar el techo de 1.000 como sustituto de paginación.
