# Bitácora de agentes

## 2026-10-23 — Codex /root — fase0

- Base leída: `6ac1fdf2546fa859412399f88eccf207991880de`. Rama: codex/documentacion-editor-v2-20261023.
- Pedido: documentación permanente y PR documental. Se leyó íntegramente el PROMPT0 adjunto y protocolo del repositorio.
- Trabajo: nueve documentos de esta carpeta; entrada de continuidad en docs/agent/CURRENT_STATE.md. Archivos funcionales afectados: ninguno.
- Evidencia: lectura de formulario/guardado/maestro, variantes/inventario, fotos/vista previa, contratos comerciales y sincronización; revisión de Git/PR abiertos.
- Verificación documental: resultados finales en [matriz](05-MATRIZ-DE-PRUEBAS.md) y [relevo](08-ESTADO-Y-RELEVO.md).
- No ejecutado: suites funcionales, navegador, compras, CRUD, migraciones, merge y publicación.
- Pendientes: revisión del PR documental; autorización explícita antes de fase1. No hay certificación de implementación completa del editorv2.
- Primer commit documental: ed438c660; PR [#1216](https://github.com/tintinaccs/tintin-web/pull/1216) en borrador. Actualización posterior sólo de referencias de relevo. No usar el SHA base como commit documental.


## 2026-10-23 — Codex /root — fase1 autorizada

- Entrada: pedido «FASE1: AUDITORÍA INTEGRAL Y PLAN MAESTRO». Leídos AGENTS, protocolo y toda la carpeta maestra antes de actuar. Skill audit-tintin usado para investigación; actualización documental expresamente autorizada por la titular.
- Base funcional6ac1fdf2546fa859412399f88eccf207991880de, HEAD documental de entrada f5a905dc1. Árbol propio limpio al inicio. PR1216 OPEN/draft y sin auto-merge; PR1213 ajeno abierto, sin modificarlo.
- Alcance inspeccionado: editor/Firestore, variantes/precios/stock/fotos, API/ficha, carrito local/remoto, checkout/servidor, pedidos/reservas/cancelaciones/devoluciones, Sheets/Apps Script/importaciones, roles/auditoría, SEO/estadísticas/plantillas y CI. Diez rutas solicitadas vigentes, dependencias reales añadidas al mapa.
- Modificaciones: nueve documentos maestros actualizados, nuevo09-AUDITORIA-FASE-1.md y resumen en CURRENT_STATE. Ningún archivo funcional o configuración modificado.
- Evidencia nueva: ocho suites Node PASS_LOCAL con comando completo en matriz; H2/H3/H4 reproducidos en funciones reales aisladas; revisión GitHub de #1214/mainCI y cron health. Hallazgos H1–H6, con evidencia/impacto/propuesta mínima. No se arreglaron defectos en esta fase.
- Entrega: contrato propuesto, matriz43 (23existentes/9parciales/1faltante/10NO), diseño responsive, fases2–6, aceptación/pruebas/reversión y decisiones de la titular. Histórico fase0 preservado.
- No ejecutado: emuladores, navegador, compras/CRUD reales, importaciones, datos/infraestructura/producción, merge/deploy. Producción comercial NOT_VERIFIED. No se inicia fase2.
- Referencia de commit: consultar HEAD del PR1216; el primer commit documental fue ed438c660 y el relevo fase0 f5a905dc1. El commit de fase1 se registra en historial Git para evitar referencias circulares.

- Cierre documental fase1 PASS_LOCAL: enlaces relativos resueltos, diez rutas solicitadas vigentes, filas1–58 consecutivas,33SÍ/10NO y clasificación23/9/1/10; diff exclusivo de Markdown y git diff --check. Fuentes funcionales idénticas a la base. CI del commit documental pendiente, sin heredar los controles de6ac1.

## 2026-10-23 — Codex /root — fase2 comercial autorizada

- Preparación: AGENTS/protocolo/maestros leídos; instrucción expresa FASE2 registrada como aprobación de fase1 en D014. Fuentes reales contrastadas con6ac1; main sin avances funcionales nuevos al iniciar. Worktree separado variant-engine-v2, rama codex/motor-comercial-variantes-v2. PR documental1216 y trabajo visual ajeno1213 intactos; checkout principal sucio no modificado.
- Commits revisables:41c5551a5 aprobación; e0ea8e65f motor;040564e3a servidor/reglas/emulador;14cfc963f referencias/consumidores;14c69e381 presentación; a0e33f849 preflightWindows; adc6cc966 guardGS;6e9f4b633 tarjeta/búsqueda;52766b2a7 negativosTTLWindows;5a9168b1e cancelación multicombinación;1d3106ca8 protección de edición histórica;f6c2b4e98 gate exacto de URL canónica con negativos (consultar Git para SHA exacto). Referencias transitivas y derivados se cierran en un commit separado.
- Autoridad existente inventario-variantes ampliada, variantCommerceVersion2 opt-in, clave persistente/atributos por nombre, precio entero override/fallback/descuento y totalnullable. Servidor recalcula desde Firestore, snapshot histórico, CAS e idempotencia; consumidores ficha/carrito/catálogo/checkout/pedido/fotos/SEO adaptados. Sin colecciones, motor alternativo, dependencias ni SKU obligatorio.
- Guardas contra pérdida: editor/bulk/duplicado SDK antiguos, reglas, borrado y Sheets no reemplazanv2; GS creador antiguo bloquea v2; constructor Shopify opcional no expuesto en pipeline. Productos/carritosv1 conservados.
- Evidencia fresca:454commerce,406compatibilidad,84fast+1Chromium,51Chromiumselección+1tarjeta/búsqueda,213controlesreglas+6integración emulada. Conteos solapados, comandos/entorno/fallos corregidos en05. Cancelación60+60 se reprodujo fallando y quedó verde también en Firestore local real.
- Contrato implementado10, decisiones015–021 y delta del mapa/plan actualizados. H5/H6 y capacidades editoriales/visuales futuras no se declaran terminadas. V2 no habilitado en productos reales; falta escritor/editor compatible antes de activación. No se inicia fase3 ni se publica código/reglas/GS.
- Entrega: rama/PR en borrador para revisión; CI del SHA final se informa separada de PASS_LOCAL. No hubo compras, migraciones, sesiones ni datos productivos de prueba. No se heredan PASS históricos.

- Cierre de entrega: [PR1217](https://github.com/tintinaccs/tintin-web/pull/1217) creado en borrador y adjunto al chat; autoMergeRequest=null. fc5b29479 derivados/versiones y a3243b2e1 contratos/evidencia; el presente relevo registra PR/controles. Protección78/544, plan67/68 y build/diagnóstico19páginas/caché364/67 PASS_LOCAL,36architecture-gates, contenido/fase6 y diffcheck correctos. CI remoto del HEAD final PENDING.

- Seguimiento CI1217: dos cabezas iniciales fallaron sólo en el control literal de identidad legacy audit:integral; se inspeccionaron ambos logs.965cd1f07 preserva la llamada original para legacy sin tocar el auditor. Tag2 nuevo evita reutilizar bytes del preview1.39comandos preflight canónico local,454commerce y5Chromium finales PASS; se exige CI propia del nuevo HEAD, sin ocultar fallos previos.
