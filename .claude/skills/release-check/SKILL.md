---
name: release-check
description: Verificación final de Tintin antes de release o producción usando las comprobaciones existentes y evitando trabajo duplicado.
---

# Release Check

Determina si el estado actual está listo para release/producción sin modificar código salvo petición explícita.

## Estrategia
1. Revisa primero git diff/status, configuración y alcance de los cambios.
2. Selecciona las verificaciones existentes que cubran realmente las áreas afectadas.
3. Comprueba como mínimo, cuando aplique: lógica comercial, datos, seguridad, Firebase/Firestore, catálogo/carrito/pedidos, responsive, performance, accesibilidad, SEO e integraciones.
4. Usa tests y auditorías dirigidas antes de suites amplias.
5. Ejecuta `audit:final` solo para readiness integral cuando su coste esté justificado.
6. No repitas tests equivalentes ni vuelvas a leer resultados sin cambios.
7. No declares éxito si una comprobación requerida falló o no pudo ejecutarse.

## Salida
Devuelve uno de estos estados: READY, BLOCKED o READY WITH NON-BLOCKING ISSUES.

Lista primero bloqueadores reales, luego advertencias y finalmente las verificaciones que pasaron. Sé breve y basado en evidencia.
