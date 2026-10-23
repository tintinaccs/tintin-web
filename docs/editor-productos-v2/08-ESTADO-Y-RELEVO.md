# Estado y relevo — fase1

Fecha2026-10-23; Codex /root. **Fase1 aprobada mediante instrucción expresa de FASE2. Fase2 motor comercial IN_PROGRESS; sin autorización de publicación o fase3.**

## Referencias exactas

- Base funcional auditada:6ac1fdf2546fa859412399f88eccf207991880de (main al iniciar; #1214).
- Rama: codex/documentacion-editor-v2-20261023.
- [PR1216](https://github.com/tintinaccs/tintin-web/pull/1216), documental en borrador, sin auto-merge.
- Primer commit documental ed438c660; relevo fase0 f5a905dc1; commit final fase1: consultar HEAD e historial del PR (no confundir con base funcional).
- #1213 tema global sigue siendo trabajo ajeno al inicio de esta fase; verificar situación remota antes de retomar y no reescribir su rama.

## Resultado y pendientes

Mapa real y matriz43 ampliados;23 existentes,9 parciales,1 faltante,10 no incorporadas. Las15 funciones propias44–58 siguen preservadas en contrato. Seis hallazgos documentados: H1precio por variante no autoritativo, H2reordenación bloqueada con stock, H3fallback de fotos por posición, H4identidad de carrito posicional, H5guardado por etapas, H6ranking por nombre.

H2/H3/H4 reproducidos con fixtures y funciones reales; ocho suites Node aprobadas. Se documentó #1214 MERGED/CI de su SHA, sin declarar compra ni producción comercial verificada. Ver [hallazgos](09-AUDITORIA-FASE-1.md) y [pruebas](05-MATRIZ-DE-PRUEBAS.md).

Propuestos contrato versionado aditivo, identidad estable, stock no controlado, precio override/fallback y compatibilidad; diseño Tintin; fases2–6 con aceptación y reversión. **No implementado**. No código, datos reales, infraestructura ni producción modificados. No navegador/emulador/pedidos reales ejecutados.

## Próximo paso autorizado

Presentar el plan a la titular y pedir aprobación. Confirmar estados editoriales, alcance de plantillas/estadísticas, semántica de precio heredado/rangos y stock mixto antes de implementar esas decisiones. No iniciar fase2 hasta respuesta explícita; no confundir aprobar el plan con autorizar merge/deploy o migraciones reales.

Al recibir aprobación: leer00/01/03/08 y protocolo, verificar Git/main/PR abiertos, comparar nuevas fuentes con6ac1, conservar avances ajenos y resolver conflictos sólo documentales primero. Ejecutar la fase autorizada con pruebas proporcionales; cerrar riesgos con evidencia del SHA, no con PASS históricos.

## Verificación y límites

PASS_LOCAL: ocho suites dirigidas; reproducciones aisladas H2/H3/H4. Verificación documental: conteos, enlaces, rutas, Markdown exclusivo y diffcheck se registran al cierre en la bitácora. CI del nuevo commit documental PENDING; no se hereda de #1214. NOT_VERIFIED: UI completa, compras reales, datos activos actuales, configuración desplegada de reglas/Apps Script y paridad de bytes comerciales en producción.

## Continuidad histórica

Fase0 creada por PROMPT0: nueve documentos y entrada CURRENT_STATE, sin funcionalidades; seis fases inicialmente propuestas porque ese prompt no las definía. Su autorización limitaba a documentación y PR. El pedido posterior de FASE1 amplió sólo investigación/plan. El registro de decisiones y bitácora conserva esa transición; no existe autorización implícita de fases posteriores.


Rama de implementación separada: codex/motor-comercial-variantes-v2, parte de a0f89051f (documentación fase1) con fuentes funcionales idénticas a main6ac1. No hubo cambios funcionales de main entre auditoría e inicio. PR documental1216 permanece intacto.
