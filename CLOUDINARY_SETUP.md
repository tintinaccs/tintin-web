# Configuración gratuita de Cloudinary + Cloudflare Pages para Tintin

Esta arquitectura no usa Firebase Storage ni Netlify Functions. Firebase continúa en el plan Spark únicamente para Authentication y Firestore. Las imágenes se almacenan en Cloudinary y las operaciones sensibles se autorizan mediante Cloudflare Pages Functions.

## 1. Preparar la cuenta gratuita de Cloudinary

1. Entrá a Cloudinary con la cuenta que administrará Tintin.
2. Conservá el plan **Free**.
3. No agregues tarjeta, facturación ni un plan pago.
4. En **Settings → API Keys**, creá una clave específica para producción.
5. Usá un nombre claro, por ejemplo `Cloudflare Tintin Production`.
6. Copiá estos tres datos:

```text
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

El API Secret es confidencial. No lo pegues en HTML, JavaScript del navegador, GitHub, Cloud Shell, capturas ni mensajes.

Si una clave anterior quedó expuesta, creá una nueva, configurala primero en Cloudflare y después desactivá la clave comprometida.

No hace falta crear un upload preset público. El proyecto usa subidas firmadas para que nadie pueda cargar archivos sin autenticarse como Super Admin.

## 2. Crear el proyecto gratuito en Cloudflare Pages

1. Abrí el panel de Cloudflare.
2. Entrá a **Workers & Pages**.
3. Elegí **Create application → Pages → Connect to Git**.
4. Conectá GitHub y autorizá el repositorio `tintinaccs/tintin-web`.
5. Configurá el proyecto así:

```text
Project name: tintinaccesorios
Production branch: main
Framework preset: None
Build command: dejar vacío
Build output directory: .
Root directory: dejar vacío
```

6. Guardá y ejecutá el primer despliegue.

El sitio quedará disponible normalmente en:

```text
https://tintinaccesorios.pages.dev
```

Cloudflare detecta la carpeta raíz `functions/` y publica estas rutas:

```text
/api/cloudinary-sign-upload
/api/cloudinary-delete
/api/visitor-geo
```

El archivo `_routes.json` limita las invocaciones de Functions a esas tres rutas, de modo que los archivos estáticos no consumen solicitudes de Workers.

## 3. Agregar las variables y secretos en Cloudflare

Después de crear el proyecto:

1. Entrá al proyecto **tintinaccesorios**.
2. Abrí **Settings → Variables and Secrets**.
3. Agregá las tres claves:

```text
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
```

4. Aplicá los valores al entorno **Production**.
5. Agregalos también a **Preview** para que los pull requests puedan probar las funciones.
6. Marcá como **Encrypt** al menos `CLOUDINARY_API_SECRET`. También podés cifrar las otras dos.
7. Guardá los cambios.

No coloques estos valores en `package.json`, `_routes.json`, archivos JavaScript, variables del navegador ni archivos versionados.

## 4. Volver a desplegar Cloudflare Pages

Las variables nuevas se aplican en un despliegue posterior.

1. Entrá a **Deployments**.
2. Buscá el despliegue de `main`.
3. Elegí **Retry deployment** o iniciá un nuevo despliegue desde GitHub.
4. Esperá a que figure como exitoso.

La ruta pública de ubicación aproximada puede comprobarse abriendo:

```text
https://tintinaccesorios.pages.dev/api/visitor-geo
```

Debe responder JSON sin IP, coordenadas ni datos personales.

Las rutas de Cloudinary no se prueban abriéndolas con el navegador: aceptan únicamente solicitudes autenticadas desde el panel.

## 5. Desplegar únicamente las reglas de Firestore

Desde Google Cloud Shell, dentro de `~/tintin-web`, ejecutá:

```bash
git checkout main
git pull origin main
npm run deploy:rules
```

El comando despliega solamente:

```text
firestore:rules
```

No intenta activar Firebase Storage y no requiere el plan Blaze.

## 6. Probar el sistema completo

1. Abrí `https://tintinaccesorios.pages.dev/admin-images.html`.
2. Iniciá sesión con `tintinaccs@gmail.com`.
3. Subí una imagen de prueba.
4. Confirmá que:
   - se muestra la vista previa antes de subir;
   - la imagen se valida, redimensiona y optimiza;
   - se guarda en Cloudinary;
   - aparece en la Biblioteca multimedia;
   - aparece en el sitio público;
   - **Reemplazar** guarda la imagen nueva;
   - **Quitar** restaura el respaldo predeterminado;
   - **Borrar** funciona únicamente cuando la imagen ya no está en uso.

## 7. Comprobaciones en Cloudinary y Firestore

En Cloudinary, las imágenes quedan con esta estructura de public ID:

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

## Compatibilidad temporal

Si una copia del sitio continúa publicada en GitHub Pages o en el dominio antiguo de Netlify, el navegador enviará las solicitudes de imágenes al origen gratuito de Cloudflare Pages. La aplicación ya no necesita que Netlify ejecute Functions.

## Seguridad aplicada

- El API Secret existe únicamente como secreto cifrado de Cloudflare.
- El navegador recibe una firma temporal, nunca el secreto.
- Cloudflare envía el ID token a Firebase Auth para validar la sesión en el servidor.
- Solo el correo verificado `tintinaccs@gmail.com` puede solicitar firmas o borrar archivos.
- Los public IDs aceptados están restringidos a `tintin/media/`.
- Cloudinary invalida la caché al borrar una imagen.
- Firestore continúa protegido por sus reglas de Super Admin.
- La función de ubicación devuelve solo ciudad, región y país aproximados; nunca IP ni coordenadas.
