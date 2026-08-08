---
name: fix-bug
description: Diagnostica y corrige bugs de Tintin con causa raíz, cambio mínimo y verificación dirigida.
---

# Fix Bug

Resuelve el bug solicitado de punta a punta con el menor cambio correcto posible.

## Flujo
1. Reproduce o identifica evidencia concreta del fallo.
2. Localiza la causa raíz antes de editar.
3. Revisa solo los archivos y dependencias relevantes.
4. Implementa la corrección mínima, robusta y coherente con la arquitectura existente.
5. No hagas refactors no relacionados.
6. Ejecuta primero la prueba/auditoría más específica disponible.
7. Amplía a lint, tests, build u otras verificaciones solo si el impacto lo justifica.
8. Revisa el diff final y corrige regresiones introducidas.

## Resultado
Informa brevemente: causa raíz, archivos cambiados, solución y verificación real ejecutada. Si algo no pudo verificarse, indícalo explícitamente.

No preguntes si debes continuar cuando el siguiente paso sea necesario y seguro para resolver el bug.
