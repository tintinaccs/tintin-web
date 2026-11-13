# Estudio de Reels de Tintín — punto para continuar

Última actualización: 2026-11-13 (Claude Code, rama `claude/hopeful-turing-2owvv4`).

## Cómo retomar en un chat nuevo

Abrí un chat nuevo de Claude Code sobre el repositorio `tintinaccs/tintin-web` y escribí:

> Seguimos con el Estudio de Reels: leé `docs/reels/CONTINUAR.md` de la rama `claude/hopeful-turing-2owvv4` y trabajemos sobre esa rama. Ahora toca Instagram y lo que sigue.

Después volvé a subir en ese chat los archivos que **no** se guardan en el repositorio (ver más abajo).

## Qué queremos lograr

Un sistema propio para preparar reels de Tintín con material propio, revisarlos y, cuando la titular lo autorice, programarlos y publicarlos con las herramientas oficiales de Instagram.

- **Etapa 1 (de punta a punta, local):** material propio → análisis → guion → montaje real → vista previa → revisión → exportación.
- **Etapa 2 (con autorizaciones):** programación, publicación y métricas (24 h, 72 h y 7 días).

## Decisiones ya tomadas por la titular

| Tema | Decisión |
| --- | --- |
| Voz | Voz propia clonada (con consentimiento). La muestra todavía **no** está aprobada. |
| Material | Videos propios grabados y fotos propias nuevas. Las fotos del catálogo no se modifican. |
| Ritmo | 3 reels por semana, de **relojes** y **bolsos**. |
| Estilo | El de la cuenta @tintinaccs: estética rosa, título tipo «de él para ella», subtítulos blancos en minúscula de 2–3 palabras, historia de envoltorio de regalo y cierre tipo «Chicas, mándenle este video a sus novios como una indirecta bien directa». |
| Idioma | Español de Paraguay con voseo, en la voz de Barbi. |
| Zona horaria | America/Asuncion. |

## Estado actual

Significado: **local** = funcionó en la computadora de trabajo; **producción** = nada de esto está en el sitio ni publica en Instagram.

| Pieza | Archivo | Estado |
| --- | --- | --- |
| Transcripción con tiempos por palabra (faster-whisper, local) | `scripts/reels/transcribir.py` | Probado local |
| Fuentes Montserrat 800/600 (licencia OFL) | `scripts/reels/fuentes/` | Probado local |
| Carpeta de trabajo fuera de Git (`reels-trabajo/` o `REELS_DIR`), escrituras seguras, registro de ejecuciones | `scripts/reels/lib/almacen.mjs` | Implementado |
| Proyectos, estados, versiones, revisión (aprobar / aprobar y programar / pedir cambios / rechazar) y huella de aprobación (video + texto + cuenta + horario) | `scripts/reels/lib/proyectos.mjs` | Implementado, sin pruebas automáticas todavía |
| Montaje MP4 9:16 1080×1920 con audio, transiciones, textos, subtítulos palabra por palabra, encuadre «contener» con fondo rosa, portada y SRT | `scripts/reels/lib/render.mjs`, `scripts/reels/lib/subtitulos.mjs` | Probado local (H.264 High, yuv420p, 30 fps, AAC 48 kHz, −14 LUFS) |
| Voz clonada local (Chatterbox multilingüe, MIT) con consentimiento obligatorio y marca de agua inaudible | `scripts/reels/voz_clonada.py` | Probado local; la titular escuchó la prueba, falta que apruebe o rechace la muestra |

Lo que falta, en este orden:

1. **Aprobación de la muestra de voz** por la titular. Hasta entonces `muestraAprobada` queda en `false` y no se usa la voz en reels reales.
2. **Guion** con criterios propios y editables (`config/reels/criterios-guion.json`):
   - Sólo datos confirmados del catálogo público (`/api/public-catalog?resource=products`): producto activo, precio y disponibilidad. Usar `js/core/store/inventario-variantes.mjs` (`productDefaultPrice`, `hasProductStock`, `variantStockLimit`).
   - El precio del producto va separado del delivery.
   - Nunca inventar materiales, resistencia al agua, promociones, testimonios, urgencia ni resultados.
3. **Referencias**: fuente, fecha, creador, métricas y motivo de elección; comparar contra la mediana del creador. Si falta un dato: «No disponible» o «Datos insuficientes».
4. **Panel de revisión** que funcione en celular, tablet y computadora, vertical y horizontal. Debe permitir:
   - Editar guion, texto de la publicación, escenas y textos.
   - Aprobar, pedir cambios o rechazar.
   - Descargar el video.
   - Editar algo aprobado lo devuelve a revisión.
5. **Calendario y programador** persistente, con historial de ejecuciones.
   - Estados: Borrador, Preparando, Listo para revisar, Aprobado, Programado, Publicado, Error.
6. **Conexión con Instagram** (ver abajo):
   - Modo prueba señalado como tal.
   - Antes de reintentar, se verifica el estado para no publicar dos veces.
   - «Publicado» sólo con el ID o enlace real de Instagram.
7. **Métricas** a las 24 h, 72 h y 7 días, separando hipótesis de conclusión comprobada.
8. **Pruebas automáticas** (node:test y Playwright), un **reel de muestra real** con material propio, y el **informe final**.

## Lo que no está en el repositorio (hay que volver a subirlo)

El repositorio se publica, así que **nunca** se guardan en Git:

- El video con la voz original.
- Las muestras de voz.
- El registro de consentimiento.
- Las fotos y videos propios.
- Las claves de Instagram.

La carpeta temporal de esta sesión se borra sola. En el chat nuevo:

- **Volvé a subir el video con tu voz original** (el de WhatsApp del 13/11). Sin él no se puede clonar la voz.
- **Confirmá de nuevo el consentimiento** y, si ya la aprobaste, la muestra.
- Subí las fotos y videos propios del reel que quieras hacer.

## Preparar la computadora de trabajo (lo hace Claude)

Necesita ffmpeg (ya viene en la nube), Node 22 y Python 3.13. Las librerías van en entornos aparte, fuera del repositorio, sin tocar `package.json`.

```bash
python3 -m venv "$TMPDIR/venv-reels" && "$TMPDIR/venv-reels/bin/pip" install faster-whisper==1.2.1
```

```bash
python3 -m venv "$TMPDIR/venv-voz" && "$TMPDIR/venv-voz/bin/pip" install chatterbox-tts==0.1.7 "setuptools<81"
```

Sobre estos entornos:

- `setuptools<81` es necesario para que funcione la marca de agua de Chatterbox. No se desactiva la marca.
- La instalación de la voz pesa varios GB y en la nube tarda unos minutos.
- Generar dos frases tarda alrededor de 90 segundos en CPU.

## Darle acceso a Instagram de forma segura

Hoy el sitio usa una conexión **sólo de lectura** (`instagram_basic`) para mostrar el feed (`docs/configuracion-instagram.md`). Para programar y publicar reels hacen falta más permisos. Pasos:

1. En el panel de la app de Meta, en la configuración de «API con inicio de sesión unificado», agregá estos permisos:
   - `instagram_content_publish` (publicar).
   - `instagram_manage_insights` (métricas).
   - `pages_read_engagement` y los demás que el panel pida para esa configuración.
2. Generá un **token nuevo y separado** para el Estudio de Reels. No reemplaces el token del sitio: el feed público debe seguir con permisos de sólo lectura.
3. **Nunca pegues el token en el chat.** Claude abre un formulario seguro para la dirección `graph.facebook.com`. El token queda guardado como secreto del entorno, Claude nunca ve su valor y no se escribe en Git.
4. Pasale a Claude sólo el **ID numérico** de la cuenta profesional (no es secreto).
5. La primera conexión se prueba sólo con lecturas, por ejemplo el límite de publicaciones disponibles. No se publica nada real sin tu autorización expresa para cada reel o para el calendario aprobado.

Límites oficiales a tener en cuenta (Graph API v27):

- 100 publicaciones por cuenta cada 24 h.
- Los contenedores de video vencen a las 24 h.
- El video necesita H.264, de 3 s a 15 min, hasta 300 MB.
- Las métricas pueden demorar hasta 48 h.
- Los «reels de prueba» (sólo para no seguidores) se verifican al conectar. Si la API no los permite para la cuenta, se hacen a mano y el sistema no finge que los automatiza.

## Reglas que no cambian

- No se habilitan gastos, conexiones nuevas ni publicaciones reales sin autorización expresa de la titular.
- No se usan pedidos privados ni datos de clientas para probar.
- Los modos de prueba se marcan como prueba. Nunca se muestran publicaciones ni estadísticas ficticias como reales.
- No se inventan métricas ni «veces mejor que…».
- La música y el material externo deben tener derechos de uso.
- Se trabaja en la rama propia y se respeta el trabajo de otros agentes.
- Sin push, merge ni deploy si la titular no lo pide.
