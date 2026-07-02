# Imágenes de Tintin Accesorios — Guía para cambiar fotos sin tocar código

Esta carpeta (`assets-tintin/images/`) es el **único lugar** donde tenés que
tocar algo para cambiar una foto del sitio. No hace falta abrir ni entender
ningún archivo de código: solo tenés que **subir un archivo nuevo con el
mismo nombre exacto**, en el lugar correcto, y reemplazar al anterior.

Regla de oro: **el nombre del archivo nunca cambia, solo el contenido de la
imagen.** El sitio ya sabe buscar esos nombres — si subís un archivo con el
nombre correcto, la foto nueva aparece sola, en tiempo real, sin que nadie
toque una línea de código.

---

## 1. Formato obligatorio: WEBP

Todas las imágenes de esta carpeta tienen que ser **`.webp`** (no `.png`,
no `.jpg`, no `.jpeg`). WEBP pesa mucho menos que esos formatos con la misma
calidad visual, lo que hace que el sitio cargue más rápido — muy importante
para que las clientas no se vayan por una carga lenta, sobre todo en el
celular.

Si tenés una foto en JPG o PNG, convertila a WEBP antes de subirla. Hay
convertidores gratuitos online (buscá "convertir a webp online") donde solo
arrastrás el archivo y lo descargás ya convertido. Elegí calidad alta
(80–90%) para que se vea bien.

---

## 2. Cómo reemplazar una imagen (paso a paso, sin código)

1. Andá al repositorio del sitio en GitHub, dentro de la carpeta
   `assets-tintin/images/...` correspondiente (ver mapa de secciones abajo).
2. Hacé clic en el archivo que querés reemplazar (por ejemplo
   `hero-banner-desktop.webp`).
3. Hacé clic en el ícono de lápiz (editar) o en "Upload files" / "Add file"
   según la vista, y subí tu nuevo archivo **con el mismo nombre exacto**.
4. Confirmá el cambio ("Commit changes").
5. Esperá 1–2 minutos a que GitHub Pages actualice el sitio publicado, y
   refrescá la página (a veces hace falta un refresco "forzado":
   Ctrl+Shift+R en la compu, o simplemente cerrar y abrir el navegador en el
   celular).

Eso es todo. No hay que avisarle a nadie ni pedir que se "suba" nada más —
el sitio lee la imagen directamente de esa carpeta.

**Importante:** si subís el archivo con otro nombre (por ejemplo
`hero-nuevo.webp` en vez de `hero-banner-desktop.webp`), el sitio no lo va a
encontrar y va a seguir mostrando la imagen vieja o el placeholder. El
nombre tiene que ser idéntico, letra por letra, incluyendo mayúsculas/
minúsculas y guiones.

---

## 3. Mapa de secciones — qué imagen va en cada lugar

### 🏠 Página de Inicio (`index.html`)

**Banner principal (hero) — la foto grande de arriba de todo**
Carpeta: `assets-tintin/images/home/hero-banner/`

| Archivo | Se usa en | Tamaño recomendado |
|---|---|---|
| `hero-banner-desktop.webp` | Pantallas de PC/notebook (1024px de ancho o más) | Horizontal, mínimo 1920×1080px |
| `hero-banner-tablet.webp` | Tablets (768px–1023px de ancho) | Mínimo 1024×1366px |
| `hero-banner-mobile.webp` | Celulares (menos de 768px de ancho) | Mínimo 750×1000px, formato vertical |

Esta es la única imagen del sitio que carga con máxima prioridad
(`fetchpriority="high"`) porque es lo primero que ve la clienta — por eso es
importante que pese poco (una buena foto en WEBP de calidad 85% no debería
pesar más de 300–400KB).

**Sección editorial "Bags"**
Carpeta: `assets-tintin/images/home/editorial-bolsos/`
Archivos: `editorial-bolsos-desktop.webp`, `editorial-bolsos-tablet.webp`,
`editorial-bolsos-mobile.webp`
Tamaño recomendado: formato vertical/retrato, mínimo 1200×1400px.

**Sección editorial "Relojes" (Nueva colección)**
Carpeta: `assets-tintin/images/home/editorial-relojes/`
Archivos: `editorial-relojes-desktop.webp`, `editorial-relojes-tablet.webp`,
`editorial-relojes-mobile.webp`
Tamaño recomendado: igual que arriba, mínimo 1200×1400px.

### 🛍️ Colecciones (tarjetas de categoría en Inicio y en la página Colecciones)

Carpeta: `assets-tintin/images/collections/`

Cada categoría tiene **una sola imagen** (no hace falta versión
desktop/tablet/mobile porque son fotos cuadradas que se adaptan solas).
Tamaño recomendado: cuadrada, mínimo 800×800px.

| Categoría | Archivo exacto |
|---|---|
| Bags | `col-bags.webp` |
| Collares | `col-collares.webp` |
| Earcuff | `col-earcuff.webp` |
| Gafas | `col-gafas.webp` |
| Brazaletes | `col-brazaletes.webp` |
| Aros | `col-aros.webp` |
| Armcuff | `col-armcuff.webp` |
| Anillos | `col-anillos.webp` |
| Joyeros | `col-joyeros.webp` |
| Pulseras | `col-pulseras.webp` |
| Relojes | `col-relojes.webp` |
| Tobilleras | `col-tobilleras.webp` |
| — (imagen genérica de respaldo) | `col-placeholder.webp` |

**Si esta imagen te la maneja Super Admin (Colecciones):** si en el panel
Super Admin, sección Colecciones, le cargás una foto propia a una
colección, esa foto tiene prioridad y tapa la de esta carpeta. Esta carpeta
es el "plan B" que se usa cuando no cargaste nada en Super Admin.

### ➕ Cómo agregar la imagen de una colección NUEVA (que vos creaste en Super Admin)

Si en el panel Super Admin creás una colección nueva que no está en la
lista de arriba (por ejemplo "Broches"), tenés dos opciones, y podés usar
cualquiera de las dos o ambas:

- **Opción A (recomendada, sin tocar nada más):** en Super Admin →
  Colecciones, al crear/editar la colección, subí la foto ahí mismo en el
  campo de imagen. Listo, no hace falta tocar esta carpeta.
- **Opción B:** subí un archivo a esta carpeta con el nombre
  `col-<slug-de-la-colección>.webp` (el "slug" es el mismo texto que usás en
  la URL del catálogo, por ejemplo `catalogo.html?cat=broches` → el archivo
  sería `col-broches.webp`).

Si no hacés ninguna de las dos cosas, esa colección va a mostrar
automáticamente `col-placeholder.webp` — nunca se va a ver una imagen rota.

### 👤 Página Nosotros (`about.html`)

Carpeta: `assets-tintin/images/nosotros/foto-principal/`
Archivos: `foto-principal-desktop.webp`, `foto-principal-tablet.webp`,
`foto-principal-mobile.webp`
Tamaño recomendado: formato vertical/retrato, mínimo 1100×1300px. Ideal
para una foto de las dueñas, del local, o de un flat-lay de productos.

### 🔤 General (logo y elementos de marca)

Carpeta: `assets-tintin/images/general/`

| Archivo | Dónde se usa | Recomendación |
|---|---|---|
| `logo-tintin.webp` | Logo en el header de todas las páginas | Fondo transparente, formato vertical/cuadrado, no hace falta más de 1000px de ancho |
| `logo-splash.webp` | Logo animado que aparece un instante al entrar a Inicio | Fondo transparente, cuadrado, ~400×400px |
| `placeholder-section.webp` | Imagen de respaldo general — **no la reemplaces**, es la red de seguridad que aparece si alguna otra imagen no carga | — |

---

## 4. ¿Qué pasa si una imagen no aparece?

El sitio está armado para que **nunca se vea un ícono de imagen rota.**
Así funciona la cadena de respaldo, de la más específica a la más genérica:

1. Si existe la imagen exacta que corresponde (por ejemplo
   `hero-banner-mobile.webp` en celular) → se muestra esa.
2. Si falta la versión de un tamaño (tablet o mobile) pero existe la de
   escritorio → en secciones con `<picture>` (hero, editoriales, foto de
   Nosotros) el navegador ya elige automáticamente la fuente disponible; si
   el archivo específico da error de carga, se reemplaza al instante por
   `general/placeholder-section.webp`, nunca queda roto.
3. En las tarjetas de colección, si no existe `col-<slug>.webp` (por
   ejemplo, para una colección recién creada), se muestra automáticamente
   `col-placeholder.webp`.
4. Si después de todo eso seguís sin ver el cambio: revisá que el nombre del
   archivo sea idéntico (mayúsculas, guiones, extensión `.webp`) y que
   hayas confirmado el cambio en GitHub. Un refresco forzado del navegador
   (Ctrl+Shift+R) también ayuda, porque a veces el navegador guarda la
   imagen vieja en caché.

**Nunca vas a "romper" el sitio por subir una imagen mal.** En el peor caso,
lo único que puede pasar es que se vea el placeholder genérico en vez de tu
foto — nunca un ícono roto ni un espacio en blanco.

---

## 5. Slots del Super Admin que hoy no tienen efecto visual (información, no acción)

En el panel Super Admin → Imágenes vas a ver algunas opciones que **no
hacen nada visible en el sitio todavía**, porque quedaron de versiones
anteriores del catálogo y no están conectadas a ninguna sección real hoy:

- `Reloj Alissia`, `Reloj Allegra`, ... hasta `Reloj Anabella` (8 en total) —
  eran para un catálogo de productos fijo que ya no se usa; ahora los
  productos se manejan 100% desde Super Admin → Productos.
- Los íconos de "Envío", "Calidad", "Pago" y "Soporte" — esa franja del
  sitio usa íconos de diseño fijos, no fotos.
- `Editorial — Collares` — no existe hoy una tercera sección editorial de
  collares en la página de Inicio (solo Bags y Relojes). Si en algún
  momento agregás esa sección al diseño, avisame y la conecto.

No pasa nada si cargás una imagen ahí — simplemente no se va a ver en
ningún lado por ahora. No los vas a "romper" tocándolos, es solo que están
inactivos.

---

## 6. Resumen rápido — reglas para no olvidarte

- Formato: siempre `.webp`.
- Nombre del archivo: siempre igual al que ya existe, nunca lo inventes.
- No hace falta editar código ni avisar a nadie — solo subir el archivo.
- Si algo falta, el sitio muestra un respaldo, nunca una imagen rota.
- Para colecciones nuevas: usá Super Admin (más fácil) o el nombre
  `col-<slug>.webp` en esta carpeta.
