# Operación de agentes — Tintin Web

> Versión: 2026-09-28. Antes de iniciar un ciclo de reparación, verificar que esta versión coincide con la vigente en la rama base; si cambió durante el ciclo, releer este directorio antes de cerrar.

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
Cuando la solicitud incluya reparar, corregir o implementar, seguir el ciclo de reparación pertinente de `AUTONOMOUS_REPAIR.md` para los criterios afectados. La matriz completa se recorre únicamente cuando el usuario pide explícitamente la frase exacta "reparación integral".

La frase exacta "reparación integral" significa continuar por todos los criterios aplicables de `ACCEPTANCE_MATRIX.md`; no significa ejecutar cambios destructivos, merge ni deploy.

## Estado persistente

`CURRENT_STATE.md` registra únicamente evidencia del commit/rama que se está verificando. Un PASS histórico no se hereda automáticamente a otro commit.

## Circuito de edición y vista previa

Para iterar en bloques/estilos sin esperar un merge, usar la rama
`edicion/vista-previa`, `npm run dev` y los perfiles de `npm run dev:check`.
El enlace visual aislado se actualiza por push, sin abrir un PR por cada intento.
Ver [el procedimiento y sus límites](../edicion-vista-previa.md).
Abrir el PR contra main cuando el candidato esté listo: ese paso conserva todas
las fases y reglas obligatorias de publicación. El preview no acredita compra,
sesión ni escrituras comerciales y nunca sustituye Repository audit.

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
