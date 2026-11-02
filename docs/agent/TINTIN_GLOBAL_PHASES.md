# Tintín — seguimiento global permanente, fases 00 a 09

Actualizado: 2026-11-01 America/Asuncion. Responsable: Codex /root, GPT-6.
Este plan global reemplaza la numeración de la tarea particular de Skills/CI;
aquella evidencia se conserva en [TINTIN_SKILLS_CI_20261101.md](TINTIN_SKILLS_CI_20261101.md).
La titular solicitó explícitamente que 01 corresponda a auditoría global y arquitectura.

## Base y estados

- Base estable auditada: **085953dc0b700e91f95fc8c84dd8e17f4627a70c**.
- #1307 MERGED; head cdb464c04c7bd85d0be7b78bee9b5253f3804d90. CI de main
  [41361909966/1](https://github.com/tintinaccs/tintin-web/actions/runs/41361909966),
  CodeQL41361910183/1 y comprobación de producción41361911653/1 SUCCESS.
- #1305 MERGED en7dfe8c9f, CI final41355599089/1 SUCCESS. El fallo post-merge
  de protección41357878092/1 fue corregido por #1307; no se borra su historial.
- #1306 OPEN, head976601a99772e5390448b8da2edda79d9d6c1429, CI41358865966/1
  FAILURE: pérdida de comunicación del runner125006122914, logsBlobNotFound/404.
  Además necesita conciliar el main actual y regenerar plan/derivados, preservando
  la eliminación del job de escritura de #1307. Su rama no se modificó.
- Los PASS se refieren al criterio y SHA citados. Un informe terminado no prueba
  que sus hallazgos estén corregidos ni certifica todas las operaciones reales.
- Esta fase permite diagnóstico no funcional mientras sigue bloqueada la
  observación nativa de Skills. No se declara resuelto ese bloqueo del host.

## Fases y dependencias

| Fase | Alcance | Estado / evidencia | SHA / PR | Pendiente y siguiente fase |
| --- | --- | --- | --- | --- |
| 00 | Baseline y estabilidad Skills/CI | PASS_CI del circuito del repositorio; BLOCKED de activación nativa | 085953dc / #1305 y #1307 | 45 Skills por ruta y4compat válidos; catálogo executor vacío. Nueva sesión con catálogo/invocación observables. Diagnóstico01 autorizado sin cambio funcional |
| 01 | Auditoría global y arquitectura real | PASS_LOCAL de entregables diagnósticos; hallazgos de cumplimiento abiertos, no PASS global de la tienda | Base085953dc; PR documental se enlaza en el recibo de esta fase | Informe, inventario y reproducciones completos. Siguiente:02 |
| 02 | Seguridad, permisos y autoridades de escritura | PENDING; F01-RULES y F04-LEGACY HIGH demostrados en código/entorno aislado | Base085953dc; reparación sin PR todavía | Corregir autorización de inventory* y resolver creador Apps Script tras comprobar deployment/callers. Depende01 |
| 03 | Comercio: catálogo, variantes, precios, stock, carrito, checkout, pedidos y pagos | PENDING; dominio canónico y consumidores mapeados | Base085953dc; sin PR funcional | Regresiones V1/V2, idempotencia, reservas/liberación y todas las entradas. Depende02 |
| 04 | Persistencia, índices, consultas, relaciones, sincronización y caché | PENDING; F02-STATS MEDIUM reproducido | Base085953dc; sin PR funcional | Eliminar truncamiento de resumen y publicación fuera de orden; comprobar frescura entre ventanas e índices reales. Depende02/03 |
| 05 | Administración, notificaciones, correos y procesamiento | PENDING; fuentes/colas mapeadas, ciclo de imports documentado como riesgo | Base085953dc; sin PR funcional | Ver permisos, estados, recuperación y side effects sin duplicados. Depende03/04 |
| 06 | UI pública/admin, rutas, JS/CSS, componentes y estado compartido | PENDING; smoke18rutas y geometría144casos aprobados como diagnóstico de base | Base085953dc; sin PR funcional | Validar contenido real por rol/dispositivo y estados; preservar identidad y drafts. Depende03/04 |
| 07 | Responsive, accesibilidad, rendimiento y SEO medidos | PENDING; 5tests del helper a11y PASS, cobertura manual/campo pendiente | Base085953dc; sin PR funcional | Matriz real, teclado/lector, hardware, WebKit y CWV de campo. Depende05/06 |
| 08 | Build, publicación, Actions, dependencias, monitoreo y mantenimiento | PENDING; F03-FALLBACK/F05-DEPS MEDIUM y F06-CONTRACTS/F07-INDEX LOW | Base085953dc; sin PR funcional | Artefacto fallback completo, toolchain, contratos y extractor. Preparación puede avanzar tras01/02; cierre revalida03–07 |
| 09 | Aceptación global y entrega | BLOCKED por HIGH abiertos y verificaciones externas enumeradas | Sin release de cierre | Requiere02–08 y evidencia aplicable; no declarar terminado con pruebas pendientes |

## Entregables de la Fase 01

- [Informe completo](PHASE01_GLOBAL_ARCHITECTURE_AUDIT.md): inventario de páginas,
  arquitectura, fuentes de verdad, siete hallazgos, clasificación, evidencia,
  impacto, solución mínima, riesgos y matriz entre fases.
- [Inventario y grafo](evidence/phase01-20261101/inventory.json): 19HTML, 58API,
  446módulos de ejecución y961aristas estáticas/literales. No declarar un archivo
  muerto sólo por no aparecer como alcanzable en este grafo.
- [Validación](evidence/phase01-20261101/validation.json): ocho gates seleccionados,
  642pruebas de dominios, 38de arquitectura, 3operativas, 18rutas smoke,
  144combinaciones de geometría y5pruebas del helper de accesibilidad. Conteos
  solapados; no sumarlos como cobertura única.
- [Reproducciones](evidence/phase01-20261101/README.md): Rules en emulador demo,
  resumen truncado/carrera, fallback incompleto y creador legado con variante agotada.
- No se aplicaron reparaciones funcionales. Un probe que termina0 porque confirmó
  una vulnerabilidad no significa que el criterio de seguridad haya aprobado.

## Prioridad de continuación

1. Leer el informe y recertificar la base vigente por SHA antes de empezar02.
2. Resolver F01-RULES primero: agent sin permiso de pedidos no debe modificar
   inventoryState/inventoryRevision saltándose el dominio y la auditoría.
3. Verificar la versión de Apps Script instalada y sus callers; cerrar F04
   preservando el espejo y probando paridad de stock/variantes.
4. Atender integridad comercial y de proyecciones (03/04) antes de ajustes visuales.
5. Mantener generadores canónicos, protección y seguimiento terminal de CI.
   Esta auditoría no autoriza Rules deploy, compras, emails/push reales ni
   migraciones/destrucción de datos comerciales.

El estado terminal de la PR documental y su SHA se registra en el recibo de GitHub
que acompaña este cambio. La auditoría se refiere a085953dc, no hereda PASS a su
propia documentación ni al código de las fases siguientes.
