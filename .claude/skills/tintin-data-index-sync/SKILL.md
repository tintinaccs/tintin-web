---
name: tintin-data-index-sync
description: "Use for Firestore data access, product search indexing, cross-page consistency, cache invalidation and canonical data synchronization in Tintín."
---

# Datos, indexación y sincronización
1. Determinar fuente canónica de cada dato; leer docs/autoridades-sincronizacion.md y docs/arquitectura-operativa-canonica.md.
2. No crear índices, colecciones, caches o escritores paralelos sin detectar consumidores existentes.
3. Revisar dependencias entre editor de productos, variantes, colección, tienda pública, inventario, pedidos y búsqueda.
4. Verificar coherencia de paginación, filtrado y búsquedas; no mostrar datos obsoletos como actuales.
5. Optimistic UI y stale-while-revalidate requieren invalidación y recuperación de errores por recurso.
6. Usar pruebas dirigidas: npm run test:products-sync, npm run audit:sync-contracts, npm run audit:architecture-contracts.
7. No borrar ni reindexar datos productivos sin autorización y plan seguro.
