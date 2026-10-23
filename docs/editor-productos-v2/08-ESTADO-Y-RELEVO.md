# Estado y relevo — fase2 comercial

2026-10-23, Codex /root. **Motor implementado y validado localmente; entrega para revisión, no publicación. Fase3 NO iniciada.** La instrucción expresa de FASE2 aprueba la continuación del plan de fase1 (D014) y reemplaza su propuesta visual de fase2.

## Referencias actuales

- Worktree: C:/Users/Windows/.codex/worktrees/variant-engine-v2/tintinaccs.
- Rama: codex/motor-comercial-variantes-v2. Consultar su HEAD al retomar; no usar SHA de fase1 como validación funcional.
- Base funcional6ac1fdf2546fa859412399f88eccf207991880de; documentación heredada a0f89051f de PR1216. El PR documental queda intacto; la nueva entrega incluye esos documentos y depende de su revisión.
- Fuentes del motor en commits separados, listados en07. [PR1217](https://github.com/tintinaccs/tintin-web/pull/1217) OPEN/en borrador, sin auto-merge. GitHub verificó autoMergeRequest=null; CI del HEAD final pendiente. Consultar Git al retomar, no heredar CI de otra cabeza.
- Checkout principal sucio y rama visual1213 ajenos: no tocarlos. No activar automations antiguas de publicación para esta fase.

## Resultado comprobado

Contrato real en10-MOTOR-COMERCIAL-FASE-2: opt-in variantCommerceVersion2, variant inmutable/variantKey opcional, atributos por nombre, precio entero override/fallback, descuento explícito y stocknull/0/finito. Lógica existente compartida con servidor, consumidores y reserva/liberación. No SKU obligatorio ni colección paralela. Snapshot de pedido conserva precio; CAS/changeId evita doble descuento/devolución.

PASS_LOCAL:454 Node comerciales;406 compatibilidad/import/sync/catálogo;84 fast+1Chromium imports;51Chromium carrito/ficha y1tarjeta/búsqueda, sin reintentos. Emulador loopback/demo:213controlesreglas+6tests integración con REST/CAS real, incluida carrera última unidad y cancelación60+60/replay. Conteos solapados; comandos/logs/límites en05. Generación de caché/CSP/rutas/diagnóstico y controles afectados se registran al cierre, sin heredar pruebas de otro SHA.

La última regresión encontrada fue rechazo al cancelar120 unidades de dos combinaciones válidas: corregida a límite99 por combinación, también en revisión de reservas;64pruebas dirigidas y emulador final verdes. La tarjeta inline de Catálogo quedó conectada al resolvedor común. No queda un fallo crítico conocido en las ejecuciones locales enumeradas.

## Activación y riesgos pendientes

- Formato nuevo **no expuesto** en editor/importaciones reales. Las guardas impiden que el escritor antiguo borre metadatosv2. Falta editor/escritor confiable compatible, autorización y CI del SHA antes de habilitar productos reales.
- No migrar automáticamente. Reservas antiguas sólo agregadas requieren revisión antes de asignarles variantes; no inventar distribución. Reordenación legacy ambigua queda bloqueada;v2 mantiene claves explícitas.
- Sheets parcial preserva campos; stock/opciones/deletev2 rechazados. GS creador legacy falla cerrado; antes de usarlo con nuevos productos requiere adaptación autorizada, no quitar guardas.
- CI remoto, Node22 remoto, Auth y carrito multidispositivo reales, Sheets/GS desplegados, pagos, producción y dispositivos físicos NOT_VERIFIED en esta entrega local. No afirmar compra real ni desplegar reglas.
- H5guardado distribuido general/H6ranking por nombre no resueltos; funciones editoriales/estadísticas/plantillas futuras no se consideran completas. Fase2 no es rediseño visual.
- Rollback: antes de cualquier activación revisar10. No volver a lectoresv1 que ignoren overrides ni borrar campos/historial. No tocar producción.

## Próximo paso

Revisión del PR en borrador y CI de su HEAD exacto. Corregir sólo defectos comprobados dentro de alcance. No merge/deploy, no migraciones ni fase3 sin nuevo pedido. Mantener contrato, pruebas y protección; si main cambia, comparar fuentes antes de incorporar avances.

---

## Archivo histórico de fase1 — superado sólo en autorización/alcance por D014

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

Cierre local: build Pages/CSP/rutas/diagnóstico19páginas, caché364/67 y protección78registros/544archivos PASS; plan canónico67archivos/68registros contra6ac1. audit:architecture-contracts,36architecture-gates,contenido/fase6 y diffcheck PASS. PR1217 sólo revisión: no publicar ni iniciar fase3.

Seguimiento de CI:40039955108/a3243 y40040078842/fa485 fallaron por control literal de identidad legacy.965cd1f07 mantiene la llamada antigua junto con referencia v2 sin tocar el auditor;39comandos de ci:preflight completos,454commerce y5Chromium dirigidos PASS_LOCAL tras el arreglo. Nuevo tag2; no reutilizar URL1 del preview. La cabeza final debe aprobar su propia CI. No cerrar la fase como aprobada remotamente mientras esté pendiente o haya un fallo crítico vigente.
