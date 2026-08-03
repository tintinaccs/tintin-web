# Estilo de código

## Código puro

Los archivos llevan código, no explicaciones.

Prohibido:

- Comentarios que narren el razonamiento, la historia del cambio o la medición
  que lo justificó.
- Títulos, encabezados o banners decorativos dentro de archivos de código.
- Frases del tipo "según lo solicitado" o cualquier referencia a la
  conversación o el pedido que originó el cambio.
- Marcas de autoría de herramientas de asistencia automática, en código,
  comentarios, documentación, mensajes de commit, descripciones de pull request
  o nombres de rama. La auditoría de confiabilidad lo verifica y falla si
  aparecen.

Permitido: un comentario corto, de una línea, cuando el código no se explica
solo. Si hace falta un párrafo para entender una línea, el problema es la
línea.

El razonamiento largo, las mediciones y el contexto van en la descripción del
pull request, nunca dentro del archivo.

## Commits y pull requests

- Mensajes cortos e informativos: qué cambió y por qué, en pocas líneas.
- Sin firmas de coautoría ni pies de página de herramientas.
- Autor: `tintinaccs <tintinaccs@gmail.com>`.

## Antes de tocar CSS

`css/` tiene capas que se pisan entre sí a propósito. Leé `docs/CSS_LAYERS.md`
para saber qué hoja manda sobre qué antes de agregar una regla o un
`!important` nuevo.

Todo cambio de CSS se verifica con:

```
npm run audit:css-cascade -- antes
npm run audit:css-cascade -- despues antes
```

Piso de ruido esperado: 2 a 4 diferencias de `visibility` en botones. Cualquier
diferencia de color, tipografía o geometría es una regresión.

## Antes de cerrar un cambio

```
npm run audit:final
```
