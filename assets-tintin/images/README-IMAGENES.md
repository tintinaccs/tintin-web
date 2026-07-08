# Imágenes de Tintin Accesorios — Guía para cambiar fotos sin tocar código

Esta carpeta (`assets-tintin/images/`) es el lugar donde se guardan las imágenes base del sitio.

Regla de oro: **el nombre del archivo nunca cambia, solo el contenido de la imagen.** El sitio ya sabe buscar esos nombres; si subís un archivo con el nombre correcto, la foto nueva aparece sola después de actualizar la página.

---

## 1. Formato recomendado

Para fotos grandes del sitio, usá **WEBP** porque pesa menos y carga más rápido.

Para el logo principal del loader/header, usá:

```text
assets-tintin/images/general/logo.png
```

Ese archivo debe ser PNG, idealmente con fondo transparente.

---

## 2. Cómo reemplazar una imagen

1. Entrá al repositorio en GitHub.
2. Andá a la carpeta correspondiente dentro de `assets-tintin/images/...`.
3. Subí el archivo nuevo con el mismo nombre exacto.
4. Confirmá el cambio.
5. Esperá 1–2 minutos y refrescá con Ctrl+Shift+R.

---

## 3. Mapa de imágenes principales

### Inicio (`index.html`)

Carpeta: `assets-tintin/images/home/hero-banner/`

| Archivo | Se usa en | Tamaño recomendado |
|---|---|---|
| `hero-banner-desktop.webp` | PC/notebook | mínimo 1920×1080px |
| `hero-banner-tablet.webp` | Tablet | mínimo 1024×1366px |
| `hero-banner-mobile.webp` | Celular | mínimo 750×1000px |

### Editorial Bags

Carpeta: `assets-tintin/images/home/editorial-bolsos/`

Archivos:

```text
editorial-bolsos-desktop.webp
editorial-bolsos-tablet.webp
editorial-bolsos-mobile.webp
```

### Editorial Relojes

Carpeta: `assets-tintin/images/home/editorial-relojes/`

Archivos:

```text
editorial-relojes-desktop.webp
editorial-relojes-tablet.webp
editorial-relojes-mobile.webp
```

### Colecciones

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
| Respaldo | `col-placeholder.webp` |

### Nosotros

Carpeta: `assets-tintin/images/nosotros/foto-principal/`

Archivos:

```text
foto-principal-desktop.webp
foto-principal-tablet.webp
foto-principal-mobile.webp
```

### General

Carpeta: `assets-tintin/images/general/`

| Archivo | Dónde se usa |
|---|---|
| `logo.png` | Logo real del loader y respaldo global |
| `placeholder-section.webp` | Imagen de respaldo si falta una foto |

---

## 4. Qué pasa si una imagen no aparece

El sitio está armado para evitar imágenes rotas. Primero intenta cargar la imagen exacta; si no existe, cae a una imagen de respaldo. Si después de subir una imagen nueva seguís viendo la anterior, hacé Ctrl+Shift+R.

---

## 5. Slots del Super Admin sin efecto visual actual

En el panel Super Admin → Imágenes pueden aparecer opciones antiguas que hoy no están conectadas a una sección visible. No rompen nada, simplemente no se muestran hasta que se conecten en el diseño.

---

## 6. Resumen rápido

- Fotos grandes: WEBP.
- Logo real: `assets-tintin/images/general/logo.png`.
- No cambies nombres de archivos existentes.
- Para colecciones nuevas: usá Super Admin o `col-<slug>.webp`.
