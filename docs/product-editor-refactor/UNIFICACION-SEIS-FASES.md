# Unificación de la versión de seis fases

26/10/2026. Base e78a9de2f; rama codex/editor-version-unica-seis-fases-20261026.
La titular pide mantener únicamente la entrega de seis fases. La referencia es
`00-VERSION-UNICA.md`, con formulario/controladores/estilos/galería originales y
las correcciones de integridad posteriores.

Se parte nuevamente de main, sin incorporar la propuesta#1247 ni sus archivos,
pruebas, capturas o modificaciones de distribución. Esa PR está cerrada y sin merge;
su CI40381454264 fue cancelada y su rama remota retirada. Los dos documentos de propuestas visuales anteriores
se eliminan y sus referencias llevan a la entrada única. El índice anterior pasa
a señalar esa entrada, sin otra especificación de diseño.

Se retiran ocho reglas de una guía ya eliminada y su recorrido de selección sin
consumidores. Se conservan los steppers de cantidades: no pertenecen a esa guía.
No cambian precios, stock, serializer, fotografías, IDs, permisos, CAS, publicación,
backend, checkout, pagos, pedidos o reservas. Perfil conserva sus bytes de main.

## Resultado local propio

| Prueba | Estado | Evidencia |
| --- | --- | --- |
|44 casos Chromium, sin reintentos |APROBADA44/44 |evidencias-version-unica/navegador.log |
|44 casos Node del editor/workspace/comercial |APROBADA44/44 |evidencias-version-unica/node.log |
|39 comandos de preflight |APROBADA39/39 |evidencias-version-unica/preflight.json |
|Build, caché y diagnóstico |APROBADA |Generadores canónicos;378 recursos y67 cargas dinámicas |
|320,390,600,768,1024,1440px |APROBADA en los6 recorridos nuevos |12 capturas de fotos/variantes en evidencias-version-unica |
|Sesión productiva autenticada/proveedores/dispositivos físicos |NO EJECUTADA |Sin datos productivos ni pagos reales |
|CI y monitor de la unificación |PENDIENTES al publicar |Recibo remoto se añade al PR |

Los casos nuevos quedan registrados en la etapa C de CI y abren tres veces el mismo producto y exigen un solo formulario,
layout y galería. Editan, guardan una vez, recuperan el mismo producto y conservan
sus cantidades y variantes. También se repiten cancelación, draft, fallos, fotos,
archivo/restauración, orientación, zoom y teclado con los fixtures existentes.
Se inspeccionaron las capturas de la presentación canónica. Se retiran16 capturas
anteriores del editor para que no vuelvan a utilizarse como propuesta de diseño;
las12 actuales tienen su propia ejecución y no sustituyen pruebas históricas.

La entrega local no equivale a aprobación remota. La limpieza del árbol vigente no
reescribe el historial de Git ni altera datos productivos.


## Continuidad general

La secuencia vigente sigue los pedidos finales:1estabilización,2fotografías,
3variantes/inventario,4simplificación,5borradores/guardado y6auditoría. La
numeración anterior de propuestas se retira de los índices vigentes.
El informe aportado sobre pendientes generales ya está conciliado en
[SEGUIMIENTO_PENDIENTES_20261026](../agent/SEGUIMIENTO_PENDIENTES_20261026.md):
Perfil integrado por#1246; arquitectura/IA históricos cerrados; ocho ejecuciones
antiguas canceladas; PayPal, Push, backups y aceptación real siguen identificados
sin activar servicios ni recuperar ramas antiguas.
