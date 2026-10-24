## D016 — Continuidad autorizada y candidato de editor

23/10/2026. El pedido actual autoriza continuar y corregir lo pendiente. Se reutilizan Actual y Galería ampliada; se mantienen active/draft/archived, sin No listado indefinido. Métricas brutas de líneas pagadas con límites visibles; no inventar ingresos netos. La conversión real de inventario agregado queda protegida hasta revisar reservas. No altera las diez decisiones NO. Detalle y evidencia actual en14.

# Registro de decisiones

| ID / fecha | Decisión | Motivo | Consecuencia |
| --- | --- | --- | --- |
| D001 / 2026-10-23 | Conservar literalmente 33 aprobaciones y 10 exclusiones del PROMPT 0 | Alcance de la titular | No transformar una aprobación en afirmación de implementación; NO no borra legado. |
| D002 / 2026-10-23 | Enlazar autoridades actuales en lugar de sustituirlas | Evitar contradicciones y sistemas paralelos | Modelo de datos y negocio siguen en código/contratos canónicos; actualizar referencias al cambiar base. |
| D003 / 2026-10-23 | Seis fases propuestas, sólo fase0 autorizada | El prompt no define las seis etapas | No ejecutar fases1–6 automáticamente ni tratar esta secuencia como decisión funcional adicional. |
| D004 / 2026-10-23 | Documentar soporte parcial/no acreditado | Inspección estática no es prueba de integración | Precio por variante, estados, SEO editable, plantillas y estadísticas necesitan verificación específica. |
| D005 / 2026-10-23 | PR documental en borrador, sin auto-merge | No publicar ni afectar producción por esta tarea | La revisión de documentos queda disponible sin iniciar fase1. |
| D006 / 2026-10-23 | Numerar44–58 en el orden del prompt | Quince conceptos propios enumerados sin numeración individual | Correspondencia explícita de campos públicos/privados, sin inventar una migración. |

Cambios futuros: añadir ID, fecha, autor, evidencia, alternativa descartada si influye, consecuencias y PR. No borrar decisiones válidas por diferencias de agente.


## Decisiones y propuestas registradas durante fase1

- D007 /2026-10-23: autorización explícita de la titular para auditar y planificar. Sustituye el estado «fase1 no autorizada» del relevo inicial; no autoriza fase2, merge ni producción. Se mantiene PR documental #1216 en borrador.
- D008 /2026-10-23: inspección ampliada distingue funciones existentes, parciales, faltantes y NO; «existente» no acredita producción. Se corrige clasificación insuficiente de estadísticas: hay ranking y contadores, pero ranking por nombre y sin ficha completa por ID.
- D009 /2026-10-23, PROPUESTA: evolucionar autoridad existente con IDs estables, precio por combinación y stock nullable; proyecciones v1 derivadas. No crear colección, checkout, carrito o sync alternativos. Riesgo: todos los escritores deben actualizarse antes de activación.
- D010 /2026-10-23, PROPUESTA: separar orden visual/etiqueta de identidad y preservar claves históricas de reservas. Motivo: reproducciones H2/H3/H4. No hacer backfill destructivo ni convertir stock a0 para reordenar.
- D011 /2026-10-23, PROPUESTA: matriz mixta produce totalnull; desactivación conserva inventario; precio anterior no se hereda engañosamente con override. Requiere aprobación de la titular antes de implementar.
- D012 /2026-10-23: no cerrar HTTP422 por inferencia. #1214 integrado y CI verde, regresiones locales ejecutadas; flujo autenticado y bytes publicados NOT_VERIFIED en esta fase. Se conserva el informe histórico con sus límites.
- D013 /2026-10-23, PROPUESTA: rollback comercial compatible, no simple vuelta a lector v1 que ignore precios v2. No restaurar datos/pedidos de producción sin autorización.


- D014 /2026-10-23: la titular entregó expresamente «FASE2: MOTOR COMERCIAL Y COMPATIBILIDAD» después de la entrega/aprobación solicitada de fase1. Se registra como aprobación y autorización para implementar el motor, reemplazando la fase2 visual propuesta por este alcance explícito. No autoriza fase3 ni publicación.


- D015 /2026-10-23: formato ejecutable variantCommerceVersion2 reutiliza variantInventory y una referencia variantKey a la fila inmutable, con attributes explícitos. Reemplaza la propuesta más amplia de IDs/configuración separada; menos cambios de esquema, misma autoridad compartida.
- D016 /2026-10-23: precio ausente/null hereda general; anterior ausente sólo hereda si el precio también hereda; anteriornull explícito elimina descuento. Total de matriz mixta esnull; disponibilidad no destruye cantidades.
- D017 /2026-10-23: activar sólo por marcador persistido, sin escritor ni migración automática. UI/SDK antiguos y borrado v2 protegidos; importador con opción interna false por defecto. Nueva fase3 y publicación no autorizadas.
- D018 /2026-10-23: snapshots/carritos/reservas incorporan variantKey opcional. Los nombres/orden actuales no son referencia comercial. Los legacy se conservan y su correspondencia se comprueba, sin reescribir pedidos históricos.
- D019 /2026-10-23: creador GS heredado falla cerrado para v2 y remite al motor servidor; no duplicar la lógica de precio en Apps Script.
- D020 /2026-10-23: preflight Windows necesitó ejecutar npm mediante shell del sistema con comando/argumentos constantes. Dos mutadores negativos de TTL normalizan separadores de ruta para ejecutarse realmente en Windows. No se cambian umbrales, suites, permisos ni workflows.
- D021 /2026-10-23: límite99 por combinación; los agregados de varias combinaciones pueden superarlo. Se corrige la cancelación y el reporte de revisión usando la autoridad existente, con regresión RED/verde y prueba REST/CAS en emulador. No se amplía el límite por línea ni se permiten alias para eludirlo.

- D022 /2026-10-23: el gate de imports Shopify reutiliza la versión exacta del baseline canónico en vez de una fecha histórica literal. Negativos nuevos prueban rechazo de URL sin versión/obsoleta; no se modifica el auditor ni su cobertura. Edición de pedidos legacy identifica filas históricas por la referencia original antes de interpretar el orden actual.

- D023 /2026-10-23: fase5 explícita autoriza reevaluación con evidencia nueva y correcciones pequeñas. No acredita fases3/4 inexistentes ni autoriza ampliar contratos, publicar o quitar guardas. La evaluación es NO APTO.
- D024 /2026-10-23: ranking existente agrupa por ID y aplica la misma statisticsOrderIsValid que otras métricas; no se define una política neta nueva de reembolsos/test/devoluciones. Los legados sin ID conservan fallback, sin exactitud inventada. Las métricas completas de42 siguen pendientes de definición/implementación.
- D025 /2026-10-23: JSON-LD v2 toma stock de productStockTotal compartido; no se recalcula con otra fórmula. La prueba UI ya no permite borrar una referencia histórica al llegar a0. Gate level2 se conserva íntegro y el código expone la rama legacy real. No cambian auditores, umbrales, permisos ni workflows.
