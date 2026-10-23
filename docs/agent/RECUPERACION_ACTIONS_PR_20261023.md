# Recuperación de Actions y PR — 23/10/2026

Solicitud: corregir fallos vigentes de Actions/PR, excluyendo el job120608130701 de la ejecución40009824667. El job corresponde a Comercio crítico del PR #1214, rama fix/checkout-variantes-catalogo-20261023. Se preserva esa rama y no se cancelan, reejecutan ni modifican sus jobs. Trabajo: Codex /root.

## Inventario inicial

Se consultaron los207 registros de workflows de GitHub y los12 YAML que siguen presentes en main. Se revisaron100 ejecuciones recientes, una segunda página para contexto, los100 fallos recientes y ambos PR abiertos. Los registros de workflows sin YAML vigente y los fallos de commits anteriores son históricos; no se borran ni se reinterpretan como aprobados.

| Workflow vigente | Última ejecución consultada en main | Estado inicial |
| --- | --- | --- |
| CI Tintin — contrato único | [40010223731](https://github.com/tintinaccs/tintin-web/actions/runs/40010223731) | in_progress |
| Backup — repositorio | [39623887321](https://github.com/tintinaccs/tintin-web/actions/runs/39623887321) | success |
| Fallback manual — GitHub Pages | [33648370915](https://github.com/tintinaccs/tintin-web/actions/runs/33648370915) | success |
| Mantenimiento — ramas | [39114066033](https://github.com/tintinaccs/tintin-web/actions/runs/39114066033) | success |
| Diagnóstico Maestro Tintin | [39877487774](https://github.com/tintinaccs/tintin-web/actions/runs/39877487774) | success |
| Mantenimiento — dependencias y flujos protegidos | [40010165516](https://github.com/tintinaccs/tintin-web/actions/runs/40010165516) | success |
| Operación — sincronización catálogo a Sheets | [39988816426](https://github.com/tintinaccs/tintin-web/actions/runs/39988816426) | success |
| Backup Firestore | [39936007479](https://github.com/tintinaccs/tintin-web/actions/runs/39936007479) | success |
| Operación — auditoría visual consolidada | [39938893460](https://github.com/tintinaccs/tintin-web/actions/runs/39938893460) | success |
| Operación — salud de producción | [40010226399](https://github.com/tintinaccs/tintin-web/actions/runs/40010226399) | success |
| Publicar reglas Firestore | [38974257566](https://github.com/tintinaccs/tintin-web/actions/runs/38974257566) | success |
| Operación — reintento de correos de pedido | [40009207521](https://github.com/tintinaccs/tintin-web/actions/runs/40009207521) | success |

## Fallo vigente y reparación

PR #1213: los checks Protected flow maintenance120571218353 e integrity120571221160 fallan con «CI obligatorio ausente, pendiente o fallido: Repository audit». La ejecución39988953497 del headc86201bf quedó cancelada; además, la rama tiene conflictos con main. El fallo anterior39978762259 pertenece al head previo3e074b37. Sus logs originales, obtenidos con el conector GitHub, localizan el error en la primera comprobación de #public-action (línea118), antes del resize: se esperaba rgb(232,175,194) y se recibía el hover rgb(216,148,175). La corrección c86201bf sólo retiraba el puntero después del resize; no cubría ese estado inicial.

Se incorpora mainb3997c7c (#1215) mediante merge normal, sin force-push. Se combinan únicamente los bloques de documentación y las referencias del shell; las fuentes de tema de c86201bf y las fuentes de encabezados/dropup/Checkout de main se conservan. Bundles, caché, plan protegido, CSP y diagnóstico se reconstruyen con sus generadores. No se retiran controles ni se alteran permisos, reglas o datos comerciales.

Los últimos runs de mantenimiento40010165516 y40010018214 aprobaron; las cruces de runs anteriores no prueban un fallo de mainb3997c7c. El monitor de producción40010226399 aprobó ese main. La auditoría de main40010223731 sigue en curso durante el inventario; no se presenta como PASS.

## Verificación actual

PASS_LOCAL:20/20 WebKit de formularios, esquema publicado en cuatro anchos, gate denegado/permitido, hover, foco, resize y primera pintura;18/18 contratos de readiness administrativa, recuperación de color y paleta. Auditorías de colores153 tokens/36 alias, Apariencia15, shell público9 y CSS aprobadas. Las231 regresiones Chromium de la conciliación aprobaron sin reintentos, incluidos encabezados, Checkout, formularios, primera pintura y superficies/espaciado. El build completo aprobó:38 rutas CSP,19 páginas de diagnóstico y caché364/67. Plan protegido27 archivos/39 registros y78 registros/544 archivos de protección verificados. La corrección focal del fixture aprobó40/40 Chromium (10 repeticiones por ancho) y20/20 WebKit (5 por ancho), sin reintentos. La CI del candidato conciliado sigue pendiente al registrar. No certifica hardware físico ni operaciones comerciales reales.

## Reproducción y corrección del estado inicial

Una copia temporal del test c86201bf con el puntero colocado explícitamente en Comprar reprodujo la misma aserción fallida de CI, antes de cualquier resize. El test vigente ahora establece ese hover inicial de forma deliberada, publica el esquema y exige el color hover actualizado. Después mueve el puntero fuera del botón, comprueba que :hover sea falso y exige el color de reposo original. Mantiene las comprobaciones separadas de hover en ambos botones, peligro, campos/foco y resize. No modifica CSS, colores esperados ni controles de publicación.

La sección histórica de TEMA_TINTIN_UNICO_20261023.md atribuía el fallo al resize; esta evidencia de logs corrige esa atribución. Los20 WebKit iniciales y las231 regresiones corresponden a la conciliación; la verificación focal posterior cubre el cambio adicional del fixture.
