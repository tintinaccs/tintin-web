# Editar, revisar y publicar

## Durante la edición

La rama `edicion/vista-previa` es el espacio de trabajo para iterar sin merge.
No abrir un PR de publicación por cada intento: los PR contra main ejecutan
la validación completa obligatoria existente. Los pushes de `edicion/**` tienen
el workflow separado **Edición — controles rápidos**, con preflight y pruebas
del componente. Ese workflow no se llama Repository audit y no habilita merges.

```sh
npm ci
npm run dev
# Abrir http://127.0.0.1:4190/checkout
# Guardar HTML/CSS y recargar. Node reinicia al cambiar los módulos importados.
```

El servidor lee los documentos y CSS fuente del repositorio en cada petición;
no exige build, tags de caché, push ni merge para ver cambios locales. Los
bundles de Inicio/Nosotros se reemplazan por sus fuentes sólo en la vista previa.
Los archivos canónicos y generados para producción no se modifican al editar.

El enlace compartido estable es **https://tintin-edicion.pages.dev**. Cada push
a `edicion/vista-previa` actualiza ese proyecto Cloudflare independiente; no
espera las auditorías de publicación. El build usa `npm ci --ignore-scripts && npm run preview:build`
y sólo sube `node_modules/.cache/tintin-preview`. Se fijan `NODE_VERSION=22` y
`SKIP_DEPENDENCY_INSTALL=1` para instalar una sola vez; el bundle visual no
requiere compiladores ni emuladores. La dirección no cambia entre revisiones. El archivo
`/preview-version.json` identifica el SHA publicado. Se puede consultar el
estado en Cloudflare Pages, proyecto `tintin-edicion`.

Es una **vista previa visual** de los documentos reales y los renderers canónicos
del encabezado. Permite revisar bloques, texto, estilos, tamaños y los cinco
paneles de Checkout desde el selector. El enlace conserva el paso en la URL.
No carga controladores comerciales ni Firebase: no simula una compra completa,
no muestra datos privados ni valida sesiones, catálogo remoto, pagos o guardado.
Los bloques que dependen de datos remotos pueden estar vacíos. Los cambios de
lógica se comprueban con sus pruebas de componente y emuladores existentes.

El worker rechaza todas las mutaciones y APIs. La CSP impide conexiones externas,
formularios, frames, scripts externos y service workers; sólo se sirve el
controlador de la propia vista previa. Se permiten imágenes públicas por HTTPS.
El proyecto no hereda secretos, datos ni bindings de la tienda; no mover dominios
existentes ni copiar las variables de producción. No usar el preview comercial
automático de `tintinaccesorios` como si tuviera este aislamiento.

## Feedback antes de enviar

```sh
npm run dev:check                   # preflight, sin navegador ni emulador
npm run dev:check -- checkout       # además contratos/pagos y navegador de Checkout
npm run dev:check -- header         # además navegador del encabezado
npm run dev:check -- catalogo       # además sincronización y persistencia del carrito
npm run dev:check -- inicio         # además paridad del CSS de Inicio en seis tamaños
npm run test:preview                # límites y sanitizado del preview
npm run test:preview:browser        # aislamiento real y selector responsive
```

Los perfiles con navegador necesitan `npx playwright install --with-deps chromium`.
El runner inicia y termina un servidor propio en loopback4191, fija los orígenes
locales y propaga los fallos. No usar la tienda como baseURL. La selección
automática del workflow es feedback parcial; cambios compartidos o en varias
áreas requieren ejecutar explícitamente los perfiles afectados. Ningún resultado
de edición equivale a la validación completa del candidato.

## Cuando la versión esté lista

1. Revisar el diff, preservar main concurrente, regenerar los artefactos canónicos
   y el plan protegido contra la base vigente. Ejecutar controles afectados.
2. Preparar la rama de publicación y abrir su PR contra main. Congelar el
   candidato revisado mientras corre el CI completo. No incluir ensayos ajenos.
3. Exigir Repository audit y todos los controles/reglas existentes para ese SHA.
   No reutilizar PASS de commits anteriores. El flujo rápido no modifica estas reglas.
4. Integrar sólo con autorización vigente, sin bypass, y verificar por lectura
   el SHA/artefacto de Cloudflare. Un preview verde no es publicación de la tienda.

Esta separación no requiere migrar el repositorio fuera de GitHub. El PR1214
se conserva sin nuevas ediciones ni reinicios por este cambio de herramientas.
