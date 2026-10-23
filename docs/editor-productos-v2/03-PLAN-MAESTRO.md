# Plan maestro — seis fases propuestas

**Sólo está autorizada la fase 0 documental.** El prompt solicita seis fases pero no describe su contenido; la secuencia siguiente es una propuesta técnica, no una aprobación de implementación ni un calendario. Mantener las 43 decisiones confirmadas; preguntar únicamente por ambigüedades funcionales que el código/contratos no resuelvan.

| Fase | Objetivo propuesto | Entrada / criterio de aceptación antes de cerrar |
| --- | --- | --- |
| 1 — Inventario y diseño | Confirmar brechas por cada decisión y diseño del editor Tintin usando lo existente. | Autorización de fase; mapa de consumidores, campos y permisos; prototipo revisable; matriz SÍ/NO conservada y sin nueva dependencia Shopify. |
| 2 — Información y medios | Integrar información, galería, orden y vista previa sin perder datos propios. | Alta/edición/duplicado preservan 44–58, imágenes doradas/plateadas y asociaciones; fallo de carga no guarda un blob local ni borra fotos. |
| 3 — Variantes, precios e inventario | Completar opciones, combinaciones, orden, precio y edición de variantes. | Contrato único de identidad/precio; stock cero distinto de no controlado; suma correcta; competencia por última unidad y reintentos seguros; consumidores migrados conjuntamente. |
| 4 — Gestión y presentación | Estados, SEO, plantillas, estadísticas y edición masiva según alcance aprobado. | Reutilizar capacidades existentes; definir estados/transiciones y semántica de plantillas/estadísticas antes de añadir campos; SKU sólo general; NO no se incorporan como funciones nuevas. |
| 5 — Integración y regresión | Validar catálogo, carrito, checkout, pedidos, Sheets, permisos y todos los tamaños. | Matriz de pruebas con evidencia del SHA; lectura pública sin campos privados; versiones/generadores canónicos; pruebas aisladas, sin compras ni cambios comerciales reales. |
| 6 — Preparación de entrega | Revisar compatibilidad, diff, evidencias, recuperación y relevo. | CI exacta del candidato, revisión final, riesgos explícitos; autorización separada para merge/deploy. Verificar producción sólo después de despliegue autorizado. |

No dar una fase por terminada por existir una pantalla parecida ni por PASS de un informe anterior. No iniciar automáticamente la fase siguiente. Ante avance de main, revisar impacto y reconciliar sin force-push ni pérdida de trabajo ajeno.
