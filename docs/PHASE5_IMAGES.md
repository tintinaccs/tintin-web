# Fase 5 — Imágenes

## Propiedad de cada imagen

| Tipo | Fuente de verdad |
|---|---|
| Producto | `products/{id}.imageUrl` |
| Colección | `collections/{slug}.image` |
| Hero, editoriales, Nosotros y logo | `settings/images` |
| Respaldo | `assets-tintin/images/` |

## Comportamiento

- El navegador muestra primero una copia local saneada cuando existe y abre un listener en tiempo real a Firestore.
- Una URL inválida se descarta antes de llegar a un renderer público.
- Quitar una personalización restaura los archivos responsive de escritorio, tablet y celular.
- Los espacios antiguos de productos, colecciones e íconos no se muestran en Super Admin → Imágenes y no se borran de la base.
- No se incorporó Firebase Storage ni se modificaron reglas: el panel continúa trabajando con URLs `http/https`.
- Desde entonces se agregó un widget de carga (`js/image-upload-widget.js`) y una biblioteca multimedia (`js/admin-media-library-ui.js`, `js/media-library.js`) que suben el archivo a Cloudinary (firmado vía `functions/api/cloudinary-sign-upload.js`, borrado vía `functions/api/cloudinary-delete.js`) y guardan la URL resultante en los mismos campos de esta tabla — sigue sin ser Firebase Storage, pero ya no es solo "pegar una URL a mano".

## Prueba manual

1. Abrir `admin-images.html` como Super Admin.
2. Confirmar que solo aparezcan Hero, Editorial, Nosotros y Branding.
3. Guardar una URL de prueba en Hero Desktop, Tablet y Mobile.
4. Abrir la portada en los tres anchos y verificar la imagen correspondiente.
5. Cambiar una editorial y comprobar la actualización sin recargar.
6. Quitar la URL y confirmar que vuelve la imagen base.
7. Cambiar el logo y revisar encabezado, pie y loader.
8. Intentar guardar una URL con comillas o un esquema distinto de HTTP/HTTPS; debe rechazarse.

## Auditoría automática

```bash
npm run audit:images
```
