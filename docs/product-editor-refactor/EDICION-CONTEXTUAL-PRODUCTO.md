# Edición contextual sobre la única versión de seis fases

26/10/2026 · Codex /root · base899a6851100b9560e6e3520e71ea3100babaa9fb.
Rama: codex/editor-bloque-contextual-completo-20261026.

La petición es editar el producto completo junto a sus fotografías, con colores
por selección y opciones pertinentes a su categoría. Se reorganiza el mismo
formulario de las seis fases; no hay otro editor ni selector de diseños.

## Comportamiento implementado

- Selección de una o varias fotos, miniaturas y colores/atributos encima de la
  galería. Asociar agrega las fotos seleccionadas; quitar afecta sólo las
  asociaciones elegidas. Se conservan portada global y portadas por combinación.
- Un bloque contiene galería, nombre, descripción, categoría, opciones, importes,
  stock, costo privado, material, medidas, cuidados, garantía y publicación.
  En escritorio las fotos quedan junto a los campos. En móvil los accesos por
  sección desplazan al control original. No se filtra ni recrea el formulario.
- Trece familias ofrecen materiales, detalles y grupos de variantes adecuados:
  bolsos/carteras, billeteras, relojes, aros, collares, anillos, earcuffs,
  tobilleras, pulseras/brazaletes, gafas, cabello, llaveros y organizadores.
  Las categorías propias mantienen edición libre. Las propuestas requieren clic
  y nunca sustituyen valores, asignan existencias ni afirman propiedades solas.
- El precio general se distingue del precio propio de cada combinación. Las
  cantidades se editan en la matriz existente y mantienen su autoridad comercial.
- Un reemplazo pendiente se protege al intentar cambiar de asociación. Quitar
  su fotografía cancela ese reemplazo para que no reaparezca al guardar.
- Las asociaciones emiten el evento de cambio al workspace para que el progreso
  privado refleje la selección aplicada. Seleccionar fotos no ensucia el producto.

## Compatibilidad y límites

Se mueven los nodos originales. Los campos pertenecen a un panel estable del
formulario, fuera de la raíz de galería que se destruye al reabrir. Se conservan
IDs únicos, serializer, CAS, workspace, permisos y V1/V2. No cambia el esquema,
checkout, pagos, pedidos, reservas, Rules ni fuentes de Perfil.

Las pruebas de navegador usan controladores reales con almacenamiento/servicios
ficticios; no prueban una cuenta administrativa real ni proveedores en producción.
Teclados físicos/virtuales de dispositivos reales, safe areas de hardware y
sesión autenticada siguen NO EJECUTADOS. No se hacen pagos ni pedidos reales.

## Evidencia y estado

| Prueba propia | Resultado | Evidencia |
| --- | --- | --- |
| Core comercial, editorial, workspace y13 categorías | APROBADA local58/58 | Node, cuatro archivos dirigidos; sin omisiones |
| Editor único, ciclo editorial y nuevo bloque contextual | APROBADA local30/30 | product-editor-final, product-editor-single-version, product-photo-context; Chromium sin reintentos |
| Último CSS:320/390/600/768/1024/1440; selector móvil | APROBADA local8/8 | Repetición responsive-final,12capturas actuales |
| Quitar asociación actualiza borrador por autoguardado y conserva público | APROBADA local1/1 | autosave-final, sin llamar manualmente a save |
| Precio/stock por combinación, IDs estables y producto simple | APROBADA local | Incluidos en30/30; importes propios y total6 comprobados |
| Reemplazo pendiente al asociar/quitar foto | APROBADA local | Incluido en30/30; no reaparece la foto eliminada |
| Matriz inicial de340 casos | FALLIDA329/340 |11fallos durante implementación; no se declara PASS |
| Repetición ampliada de142 casos |141aprobados/1fallido | Selector320 cargó CSS previo; corregido y repetido en8/8 y2/2 específicos |
| Inspección visual320/1440 | APROBADA local | Capturas seleccion-320/1440 revisadas; columnas sin superposición comprobadas por bounding boxes |
| Build, caché, diagnóstico, protección y preflight | APROBADA local | Generadores canónicos,39/39 comandos de preflight; diff sin errores |
| Cuenta real/proveedores y hardware físico | NO EJECUTADA | Sin autenticación ni dispositivos físicos; no se simula como PASS |

Las repeticiones se enumeran por separado; no se suman como una sola suite.
La aserción inicial de autoguardado esperaba ausencia total de filas vacías,
pero el contrato conserva filas Color con imageUrls vacías. Se corrigió para
comprobar su semántica real, la persistencia automática y el público intacto.
No requirió alterar el contrato ni el almacenamiento.

Evidencia compacta: [resultados.json](evidencias-contextuales/resultados.json).
Las capturas usan servicios ficticios: las fotos de color son fixtures.

## Rendimiento reproducible

Antes: galería de899a685. Después: galería de esta continuación. Mismo test
`product-editor-final.spec.js`, cinco fotos,100eventos sin cambios y cinco
muestras de20eventos con requestAnimationFrame. En ambos casos0nodos retirados
y mismas tarjetas: se conserva la mejora previa. Medianas descriptivas77,3ms
antes y84,0ms después. Son muestras locales con concurrencia, sin umbral ni
conclusión de aceleración; no representan latencia de red/proveedores.
Chromium real151.0.7922.173, Playwright1.64.1; el user-agent del fixture emula156.

```sh
EDITOR_MEASURE_BASELINE_REF=899a6851100b9560e6e3520e71ea3100babaa9fb npx playwright test tests/ui-ux/product-editor-final.spec.js --grep 'eventos sin cambios' --workers=1 --retries=0 --reporter=json
npx playwright test tests/ui-ux/product-editor-final.spec.js --grep 'eventos sin cambios' --workers=1 --retries=0 --reporter=json
npx playwright test tests/ui-ux/product-photo-context.spec.js tests/ui-ux/product-editor-single-version.spec.js tests/ui-ux/product-editor-final.spec.js --workers=2 --retries=0
```

CI/merge/monitor: PENDING hasta obtener evidencia del candidato exacto. La entrega
se completa mediante el flujo protegido autorizado, sin bypass. El recibo externo
de la PR registra estos resultados después del merge para no certificar un SHA
futuro dentro del mismo commit.
