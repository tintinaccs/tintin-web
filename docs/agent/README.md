# Operación de agentes — Tintin Web

Este directorio es el punto de entrada operativo para agentes de código. No reemplaza los contratos técnicos del repositorio: los organiza y define cómo usarlos.

## Orden de autoridad

1. Código y configuración vigentes en la rama de trabajo.
2. `AGENTS.md` y `.claude/CLAUDE.md` para reglas de conducta y seguridad.
3. Este directorio para el protocolo de reparación y estado.
4. Contratos canónicos vigentes:
   - `docs/arquitectura-operativa-canonica.md`
   - `docs/arquitectura-tecnica.md`
   - `docs/contrato-logica-tienda.md`
   - `docs/contratos-comercio.md`
   - `docs/contratos-arquitectura-ci.md`
   - `docs/contratos-calidad.md`
   - `docs/autoridades-sincronizacion.md`
   - `docs/lista-impacto-cambios.md`
5. Documentación específica del subsistema afectado.
6. Informes de auditoría, cierres y documentos fechados: evidencia histórica, nunca prueba automática del estado actual.

Si dos documentos normativos se contradicen, no elegir silenciosamente. Verificar el código, los tests y la fecha/alcance; registrar la contradicción en `CURRENT_STATE.md` y resolverla con el cambio mínimo que restablezca una sola autoridad.

## Modos

### Auditoría
Solicitudes que solo pidan analizar, revisar, inspeccionar, diagnosticar, comparar o planificar son de solo lectura.

### Reparación
Cuando la solicitud incluya reparar, corregir, implementar o ejecutar reparación integral, seguir `AUTONOMOUS_REPAIR.md`.

La frase "reparación integral" significa continuar por todos los criterios aplicables de `ACCEPTANCE_MATRIX.md`; no significa ejecutar cambios destructivos, merge ni deploy.

## Estado persistente

`CURRENT_STATE.md` registra únicamente evidencia del commit/rama que se está verificando. Un PASS histórico no se hereda automáticamente a otro commit.

## Gates existentes

Preferir los mecanismos existentes. Entre otros:

- CSP: `npm run build:csp` / `npm run verify:csp`.
- Rutas: `npm run build:routes` / `npm run verify:routes`.
- Diagnóstico: `npm run build:diagnostics` / `npm run verify:diagnostics`.
- Caché: `npm run audit:cache-versioning`.
- Arquitectura: `npm run audit:architecture-contracts` y `npm run test:architecture-gates`.
- Cierre amplio: `npm run audit:final`.
- Cierre global manual: Diagnóstico Maestro.

No crear una segunda implementación si ya existe un contrato, generador, auditor o test canónico.
