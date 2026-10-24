# Preservación44–58 — fase5

Datos sintéticos; no datos comerciales reales. E1 ejecuta la función real de apertura/serialización/guardado con transacción/SDK ficticios; E5 usa REST/CAS real sólo en emulador para pedidos/reglas. No confundir ambas evidencias. Ninguna prueba acredita el guardado del editorv2: su guardia lo bloquea y se verifica expresamente.

| Nº | Función conservada | Campo/autoridad | Evidencia nueva | Estado/límite |
| --- | --- | --- | --- | --- |
| 44 | Material | material | E1: abrir, serializar y guardar; E3: secciones conservan borrador | PASS_LOCAL legado; editorv2 bloqueado. |
| 45 | Medidas | measurements | E1: abrir, serializar y guardar; E3: secciones conservan borrador | PASS_LOCAL legado; editorv2 bloqueado. |
| 46 | Color/acabado | colorFinish | E1: abrir, serializar y guardar; E3: secciones conservan borrador | PASS_LOCAL legado; editorv2 bloqueado. |
| 47 | Cuidados | care | E1: abrir, serializar y guardar; E3: secciones conservan borrador | PASS_LOCAL legado; editorv2 bloqueado. |
| 48 | Resistencia al agua | waterResistance | E1: abrir, serializar y guardar; E3: secciones conservan borrador | PASS_LOCAL legado; editorv2 bloqueado. |
| 49 | Garantía | warranty | E1: abrir, serializar y guardar; E3: secciones conservan borrador | PASS_LOCAL legado; editorv2 bloqueado. |
| 50 | Talle/ajuste | sizeFit | E1: abrir, serializar y guardar; E3: secciones conservan borrador | PASS_LOCAL legado; editorv2 bloqueado. |
| 51 | Contenido del paquete | packageContents | E1: abrir, serializar y guardar; E3: secciones conservan borrador | PASS_LOCAL legado; editorv2 bloqueado. |
| 52 | Cantidades compradas | productInventory.purchased | E1: persiste en productInventory y excluye del producto público; E5: reglas | PASS_LOCAL privado; sin exposición pública observada. |
| 53 | Stock mínimo | productInventory.stockMinimum | E1: persiste en productInventory y excluye del producto público; E5: reglas | PASS_LOCAL privado; sin exposición pública observada. |
| 54 | Notas internas | productInventory.internalNotes | E1: persiste en productInventory y excluye del producto público; E5: reglas | PASS_LOCAL privado; sin exposición pública observada. |
| 55 | Destacado | destacado | E1: abrir, serializar y guardar; E3: secciones conservan borrador | PASS_LOCAL legado; editorv2 bloqueado. |
| 56 | Distintivos | badge/oferta | E1 badge/destacado y regresiones generales; E2/E3 indicadores/oferta | PASS_LOCAL legado; no inventar promociones. |
| 57 | Cero/no controlado | stock:0/null | E1 null se mantiene al guardar; E4 cero/null/mixto; E5 reservas | PASS_LOCAL dominio y compatibilidad. |
| 58 | Fotos por variante/combinación | variantMedia/imageUrl/imagesExtra | E3 portada/galería/asociación/reordenación/metadata; E4/E5 selección canónica | PASS_LOCAL fixtures; Cloudinary real NOT_VERIFIED. |

No se afirma que todos los campos desconocidos de todo producto histórico estén cubiertos: se comprueban estos15 requisitos, reglas y máscaras parciales existentes. Costo/notas/compras/mínimo siguen en almacenamiento privado. Subidas fallidas, conflicto y guardado parcial recuperable tienen pruebas, sin prometer atomicidad distribuida.
