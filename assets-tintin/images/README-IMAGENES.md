# Imágenes de Tintin Accesorios — Guía para cambiar fotos sin tocar código

Esta carpeta (`assets-tintin/images/`) contiene las imágenes base y de respaldo del sitio. Desde la Fase 5 también existe un panel para reemplazar determinadas imágenes mediante URL, sin modificar estos archivos.

## Regla principal: una sola fuente por tipo de imagen

- **Fotos de productos:** Super Admin → Productos. Se guardan en `products/{id}.imageUrl`.
- **Portadas de colecciones:** Super Admin → Colecciones. Se guardan en `collections/{slug}.image`.
- **Hero, editoriales, Nosotros y logo:** Super Admin → Imágenes. Se guardan en `settings/images`.
- **Archivos de esta carpeta:** funcionan como respaldo cuando un espacio del panel no tiene una URL configurada o esa URL falla.

No vuelvas a crear fotos de productos o colecciones dentro de `settings/images`: esas opciones antiguas ya no aparecen en el panel y se ignoran para evitar duplicaciones.

---

## 1. Formato recomendado

Para fotos grandes del sitio, usá **WEBP** porque pesa menos y carga más rápido.

Para el logo principal de respaldo, usá:

```text
assets-tintin/images/general/logo.png
```

Ese archivo debe ser PNG, idealmente con fondo transparente.

---

## 2. Cambiar una imagen desde Super Admin

1. Entrá en **Super Admin → Imágenes**.
2. Elegí Hero, Editorial, Nosotros o Branding.
3. Pegá una URL `https://` válida.
4. En Hero también podés elegir tamaño y posición.
5. Guardá. El cambio se sincroniza en tiempo real en las páginas abiertas.

Cuando quitás una URL, el sitio vuelve automáticamente a los archivos de respaldo indicados abajo.

---

## 3. Reemplazar un archivo de respaldo en GitHub

1. Entrá al repositorio en GitHub.
2. Andá a la carpeta correspondiente dentro de `assets-tintin/images/...`.
3. Subí el archivo nuevo con el mismo nombre exacto.
4. Confirmá el cambio.
5. Esperá unos minutos y refrescá con `Ctrl + Shift + R`.

---

## 4. Mapa de imágenes principales

### Inicio — Hero

Carpeta: `assets-tintin/images/home/hero-banner/`

| Archivo | Se usa en | Tamaño recomendado |
|---|---|---|
| `hero-banner-desktop.webp` | PC/notebook | mínimo 1920×1080px |
| `hero-banner-tablet.webp` | Tablet | mínimo 1024×1366px |
| `hero-banner-mobile.webp` | Celular | mínimo 750×1000px |

### Editorial Bags

Carpeta: `assets-tintin/images/home/editorial-bolsos/`

```text
editorial-bolsos-desktop.webp
editorial-bolsos-tablet.webp
editorial-bolsos-mobile.webp
```

### Editorial Relojes

Carpeta: `assets-tintin/images/home/editorial-relojes/`

```text
editorial-relojes-desktop.webp
editorial-relojes-tablet.webp
editorial-relojes-mobile.webp
```

### Colecciones

Las portadas personalizadas se administran desde **Colecciones**. Estos archivos quedan como respaldo automático:

Carpeta: `assets-tintin/images/collections/`

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
| Respaldo general | `col-placeholder.webp` |

### Nosotros

Carpeta: `assets-tintin/images/nosotros/foto-principal/`

```text
foto-principal-desktop.webp
foto-principal-tablet.webp
foto-principal-mobile.webp
```

### General

Carpeta: `assets-tintin/images/general/`

| Archivo | Dónde se usa |
|---|---|
| `logo.png` | Logo de respaldo para loader, encabezados y pie |
| `placeholder-section.webp` | Respaldo si una foto no puede cargarse |

---

## 5. Seguridad y fallos

- Solo se aceptan direcciones `http://` o `https://` sin comillas ni código.
- Si una URL guardada deja de funcionar, aparece la imagen base correspondiente.
- Al quitar una personalización, el sitio restaura la versión responsive de escritorio, tablet y celular.
- El caché local acelera la primera vista, pero Firestore vuelve a comprobar el valor y actualiza todas las pestañas.

## 6. Resumen rápido

- Producto → Productos.
- Colección → Colecciones.
- Hero/editoriales/Nosotros/logo → Imágenes.
- Fotos grandes → WEBP.
- Logo de respaldo → PNG transparente.
- Después de modificar archivos en GitHub → `Ctrl + Shift + R`.
