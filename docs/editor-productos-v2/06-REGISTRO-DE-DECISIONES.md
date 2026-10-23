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
