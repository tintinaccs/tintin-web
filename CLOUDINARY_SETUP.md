# Configuración de Cloudinary Free para Tintin

Esta migración elimina Firebase Storage por completo. Firebase continúa en el plan Spark únicamente para Authentication y Firestore. Las imágenes se almacenan en Cloudinary y las operaciones sensibles se autorizan mediante Netlify Functions.

## 1. Crear la cuenta gratuita de Cloudinary

1. Abrí el sitio oficial de Cloudinary desde el navegador.
2. Elegí el plan **Free**.
3. Registrate con el correo que administrará Tintin.
4. No agregues tarjeta, facturación ni un plan pago.
5. Al entrar al panel, verificá que el producto/environment aparezca activo.

No hace falta crear un upload preset público. Este proyecto usa subidas firmadas para que nadie pueda subir archivos sin autenticarse como Super Admin.

## 2. Copiar las tres credenciales

En el Dashboard de Cloudinary buscá la sección de credenciales del producto/environment y copiá:

- **Cloud name** → `CLOUDINARY_CLOUD_NAME`
- **API Key** → `CLOUDINARY_API_KEY`
- **API Secret** → `CLOUDINARY_API_SECRET`

El API Secret es confidencial. No lo pegues en archivos HTML, JavaScript del navegador, GitHub, Cloud Shell ni mensajes públicos.

## 3. Cargar las variables en Netlify

1. Abrí Netlify en el navegador.
2. Entrá al sitio **tintinaccesorios**.
3. Abrí **Project configuration**.
4. Entrá a **Environment variables**.
5. Creá estas tres variables, una por una:

```text
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
```

6. Cuando Netlify permita elegir alcance, asegurate de incluir **Functions**.
7. Aplicá las variables al contexto de **Production**. Podés agregarlas también a Deploy Previews si querés probar la rama antes del merge.
8. Marcá `CLOUDINARY_API_SECRET` como valor secreto/sensible cuando la interfaz lo ofrezca.

No coloques estas variables en `netlify.toml`, porque ese archivo queda público en GitHub.

## 4. Volver a desplegar Netlify

Las variables nuevas se aplican después de un despliegue.

1. En Netlify abrí **Deploys**.
2. Elegí **Trigger deploy**.
3. Ejecutá **Deploy site** o **Clear cache and deploy site**.
4. Esperá a que el despliegue figure como **Published**.

Las funciones que deben quedar publicadas son:

- `/.netlify/functions/cloudinary-sign-upload`
- `/.netlify/functions/cloudinary-delete`

No deben abrirse manualmente con GET: aceptan POST autenticado desde el panel.

## 5. Desplegar únicamente las reglas de Firestore

Desde Google Cloud Shell, dentro de `~/tintin-web`, actualizá el repositorio y ejecutá:

```bash
git checkout main
git pull origin main
npm run deploy:rules
```

El comando ahora despliega solamente:

```text
firestore:rules
```

Ya no intenta activar Firebase Storage y no requiere el plan Blaze.

## 6. Probar el sistema

1. Abrí el sitio publicado en Netlify.
2. Iniciá sesión con `tintinaccs@gmail.com`.
3. Entrá a `/admin-images.html`.
4. Subí una imagen de prueba.
5. Confirmá que:
   - se muestra la vista previa antes de subir;
   - la imagen se optimiza y se guarda;
   - aparece en la Biblioteca multimedia;
   - aparece en el sitio público;
   - **Reemplazar** guarda la nueva imagen;
   - **Quitar** restaura el respaldo predeterminado;
   - **Borrar** desde la biblioteca funciona únicamente cuando la imagen ya no está en uso.

## 7. Comprobaciones en Cloudinary y Firestore

En Cloudinary, las imágenes quedan dentro de public IDs con esta estructura:

```text
tintin/media/<mediaId>/full
tintin/media/<mediaId>/thumb
```

En Firestore, la colección `media` conserva únicamente metadata administrativa:

- `provider`
- `publicId`
- `thumbPublicId`
- `url`
- `thumbUrl`
- `originalName`
- `alt`
- `section`
- `slotKey`
- `format`
- `width`
- `height`
- `bytes`
- `uploadedBy`
- `uploadedByUid`
- `uploadedAt`
- `updatedAt`

## Seguridad aplicada

- El API Secret existe solo en Netlify.
- El navegador recibe una firma temporal, nunca el secreto.
- Netlify valida la firma, audiencia, emisor y vencimiento del token de Firebase.
- Solo el correo Super Admin `tintinaccs@gmail.com` puede solicitar firmas o borrar archivos.
- Los public IDs aceptados están restringidos a la carpeta `tintin/media/`.
- Cloudinary invalida la caché al borrar una imagen.
- Firestore continúa protegido por sus reglas de Super Admin.
