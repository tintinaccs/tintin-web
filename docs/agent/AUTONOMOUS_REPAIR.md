# Protocolo de reparación integral autónoma

## Objetivo

Llevar la rama de trabajo al cumplimiento de todos los criterios aplicables de `ACCEPTANCE_MATRIX.md` sin confundir "código modificado" con "problema cerrado".

## Ciclo obligatorio

Para cada criterio no cerrado:

1. Identificar el síntoma y el alcance.
2. Reproducirlo o reunir evidencia suficiente.
3. Identificar la causa raíz y la fuente canónica afectada.
4. Revisar `docs/lista-impacto-cambios.md` y determinar superficies relacionadas.
5. Aplicar el cambio mínimo coherente con la arquitectura existente.
6. Ejecutar primero la verificación específica del dominio.
7. Si hay interfaz, verificar con navegador en los viewports/estados relevantes cuando el entorno lo permita.
8. Revisar el diff para detectar cambios accidentales, duplicación, código muerto y artefactos generados.
9. Ejecutar regresiones relacionadas.
10. Actualizar `CURRENT_STATE.md` con evidencia.
11. Continuar con el siguiente criterio. No detenerse solo porque el primer problema quedó corregido.

## Estados permitidos

- `PENDING`: todavía no evaluado para el commit actual.
- `IN_PROGRESS`: diagnóstico o reparación activa.
- `PASS_LOCAL`: verificación específica local aprobada.
- `PASS_CI`: CI aplicable aprobada para el commit.
- `PASS_PRODUCTION`: evidencia no destructiva en producción aprobada.
- `NOT_VERIFIED`: no existe evidencia suficiente desde el entorno actual.
- `BLOCKED`: dependencia externa concreta impide continuar.
- `FAIL`: falla reproducible vigente.

Los estados avanzan por evidencia del mismo criterio: `PASS_CI` requiere `PASS_LOCAL`, y `PASS_PRODUCTION` requiere `PASS_CI`. Excepción: una verificación directa, no destructiva, en producción puede justificar `PASS_PRODUCTION` sin esos estados previos únicamente si la excepción, el criterio y la evidencia quedan documentados explícitamente.

Nunca convertir `NOT_VERIFIED` o `BLOCKED` en PASS por inferencia. Un PASS de un informe histórico tampoco es evidencia del commit actual.

Para una corrección puntual de un dominio, limitar el ciclo a los criterios afectados; el skill `fix-bug`, cuando esté disponible en el entorno, puede guiar ese ciclo pero no cambia este alcance ni prevalece sobre este protocolo. Actualizar `CURRENT_STATE.md` y recorrer la matriz completa cuando la tarea cruce dominios o el usuario solicite explícitamente "reparación integral".

## Estrategia de pruebas

No usar `audit:final` como bucle después de cada edición.

Orden preferido:

```
test/audit específico
→ regresiones del dominio
→ build/generadores relacionados
→ pruebas de navegador si aplica
→ suites transversales
→ audit:final
→ Diagnóstico Maestro cuando corresponda al cierre global
```

Si un gate amplio falla, aislar la falla con el test más pequeño posible antes de modificar código.

## Artefactos generados

CSP, rutas, manifiestos, caché/versionado y cualquier otro artefacto generado deben actualizarse desde su fuente canónica. No parchear a mano un derivado para silenciar CI.

## Autonomía

Se permiten decisiones técnicas reversibles y de bajo riesgo dentro del alcance solicitado. Resolver causas raíz y regresiones directamente relacionadas sin pedir autorización por cada archivo.

Requieren autorización explícita:

- merge a `main`;
- deploy/publicación;
- operaciones destructivas sobre datos reales;
- compras, cobros, pedidos, correos reales o creación de usuarios de prueba en producción;
- force-push o reescritura destructiva de historial;
- decisiones de producto que no puedan inferirse de contratos existentes.

Nunca imprimir, copiar ni commitear secretos, tokens, cookies o credenciales. Nunca debilitar seguridad, App Check, CSP, reglas o caché para hacer pasar una prueba.

## Criterio de cierre

La reparación integral termina únicamente cuando:

- todos los criterios aplicables están cerrados con evidencia apropiada; o
- los restantes están marcados `NOT_VERIFIED`/`BLOCKED` con una causa externa concreta y el siguiente paso exacto;
- se revisó el diff final;
- las verificaciones introducidas o afectadas no presentan fallas conocidas.

No afirmar "todo funciona" cuando una operación manual, una sesión autenticada o producción no fue verificada.
