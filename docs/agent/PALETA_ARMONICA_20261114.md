# Paleta armónica Tintín — 14 de noviembre de 2026

Solicitud: continuar la entrega global, armonizar todo el repositorio sin
cambiar fotografías y resolver los Actions rojos relacionados. Base cb1383a2,
PR1400 integrada; Maestro43592676471/1 SUCCESS, ocho suites correctas.

Se aplica el Skill local `.agents/skills/better-colors/SKILL.md`, leído como
referencia profesional, junto con los tokens e identidad canónicos existentes.
No se instala una biblioteca de color ni se añade otro matiz a la marca.
Referencia editorial aportada por la titular:
https://www.juancmejia.com/marketing-digital/psicologia-del-color-utilice-los-colores-para-aumentar-sus-ventas-online-y-offline/
Se usa para coherencia visual; no se atribuyen resultados comerciales universales.

## Cambios y razones

- MEDIUM: Inicio tenía un rosa fluorescente local en el título, distinto del
  sistema global. Hero, fondo y título usan los roles de marca/texto existentes.
  Con #222222 se midieron contrastes 8.78:1 sobre #F8AACA, 13.98:1 sobre
  #FDECF2 y 15.91:1 sobre blanco. Se verifican en navegador contra los tres
  extremos del sistema; la fuente manuscrita, fotografía y logo siguen iguales.
- LOW: badges de roles/pedidos/correos/imágenes/conexiones, superficies de
  participación, Maestro, notificaciones y perfil mezclaban violetas/azules
  decorativos. Ahora consumen los roles rosados y neutros canónicos. Los
  gráficos mantienen tres series distinguibles y su adaptación oscura.
- LOW: tablero de pedidos conservaba varias familias decorativas. Sus cinco
  etapas mantienen fondos distintos: blanco, rosa claro, mezcla rosa, rosa
  y éxito funcional; conservan nombres, selección y comportamiento.
- LOW: fondo de404 y enlace de soporte del bloqueo usaban acentos ajenos.
  Se alinean con la marca. Avisos legales usan los roles de advertencia.
- CORRECT: se conservan colores semánticos discretos de avisos y WhatsApp,
  según la respuesta expresa de la titular; también las marcas de proveedores,
  controles de tono y swatches que describen colores reales de productos.
  Ningún archivo de imagen/fuente se modifica.
- No verificado en runtime: `flujo-decisiones-admin.css` no tiene consumidor
  activo encontrado. Se armoniza su fuente sin afirmar que sea una pantalla
  actualmente visible ni introducir un nuevo consumidor.

## Action rojo y parche reutilizado

Auditoría visual43594710557/1, headcb1383a2: el smoke local falló por404 en
/api/instagram-feed. La ruta pública sí existe. Se revisó y reutilizó sólo el
parche de servidor y su prueba de PR1397 (head22c0fee6), sin importar sus
artefactos generados antiguos. El servidor de smoke ejecuta el handler real
con env vacío; no necesita credenciales ni solicita Meta. Las demás rutas y
peticiones inesperadas siguen fallando. El nuevo workflow sobre el nuevo
head debe acreditar la corrección; el resultado histórico no se borra.

## Evidencia local y cierre

- Auditorías de color (153 tokens globales,36 administrativos) y estilos PASS.
- Cuatro casos de paleta PASS:15 plantillas públicas en390/1440px, control
  negativo violeta, contraste del hero, badges/series y modo oscuro admin.
  Las plantillas se cargan sin JS comercial para aislar CSS; no sustituyen
  las suites de comportamiento del Maestro.
-98 casos relacionados en navegador PASS: hero, tablero de pedidos y panel
  móvil. Incluyen el contrato de identidad de las imágenes del hero.
- Versiones inmutables y bundles se regeneran mediante sus autoridades.
  Build, plan protegido y checks de este head se registran en la PR de entrega.
- CI/Maestro, merge y comprobaciones posteriores de esta entrega requieren
  sus propios recibos terminales; no heredan PASS de PR1399/1400.

No se simulan compras ni se alteran permisos, usuarios o datos comerciales.
La matriz automatizada no equivale a probar cada dispositivo físico ni
acredita posiciones de Google o métricas privadas de Search Console.

La primera ejecución local del smoke tras armonizar Inicio detectó dos
expectativas antiguas del degradado del header; no detectó el404 de Instagram.
Se actualizaron las expectativas precisas del smoke, del auditor de hero y
del layout público al rosa claro canónico solicitado. Se conserva ese primer
FAIL; la repetición se identifica como palette-smoke-final.log. Auditor del
hero7/7 PASS tras la actualización, sin relajar controles de transparencia,
bordes, recursos, loaders o errores JavaScript.

CI43596174694/1 falló en tipografía: la clave JavaScript `font` de una prueba
se interpretaba como shorthand CSS. Se renombra a `family` manteniendo la
comparación de fuente real. Auditor tipográfico49.584 comprobaciones PASS,
caso de actualización de líneas del editor PASS y `npm run ci:preflight`
completo PASS después de corregirlo. El nuevo commit requiere CI/Maestro
propios; los runs del anterior quedan identificados como reemplazados.
Smoke final18 rutas PASS, incluido Instagram y degradado canónico del header.

CI43596539477/1 aprobó preflight y detectó en cuentas una expectativa del azul
anterior #005fcc en el enlace de soporte. Se actualiza únicamente a su rol
canónico de enlace, conservando subrayado, URL, correo escapado y mensaje.
El fallo no modifica bloqueo/autorización ni exige cambiar lógica comercial.
Auditoría visual43596177163/1 SUCCESS sobre el candidato9e17123e: acredita
la reparación del404 de Instagram y las geometrías; el cierre del nuevo head
sigue requiriendo sus propios checks. Los19 casos de layout público PASS.

## Revisión de contraste oscuro antes de integrar

CI43596897104/1 SUCCESS sobre751afaf8. Mantenimiento43599278210/1 FAIL:
GitHub rechazó el mergeHTTP405 por dos conversaciones de revisión abiertas;
no por una divergencia de hashes/plan. La revisión automática detectó dos
problemas reales de contraste en modo oscuro móvil. Se reproducen con el
CSS de ese head y el controlador real de tema: etapa enviada1.53:1 y nombre/
metadatos de reseña1.19:1. Después de corregirlos se miden8.78:1 y14.56:1,
respectivamente. Se conservan las fotos y el mismo sistema de colores.

Pedidos conserva su texto oscuro sobre el relleno rosa de marca. Los índices
usan el par invertido de cada etapa, y una regla acotada preserva los pares
de los estados frente al binding administrativo global con !important.
Participación migra también fondos de tarjetas, filtros, menús, tablas,
conversaciones, detalle y modales a las superficies adaptativas existentes;
texto y fondo se actualizan juntos. No se habilita un modo oscuro nuevo en
escritorio: se prueba el modo real en390/768px y el claro en390/1440px.
Cuatro regresiones miden el contraste efectivo de más de80 textos de esos
componentes en cada modo; se anexan los pares a los resultados de Playwright.

Maestro43596892634/1 FAIL global por los dos checks protegidos fallidos que
siguieron al405. Sus ocho suites de producto sí terminaron correctamente,
incluidos5/5 checks estructurales (audit:final/deep/names/build/preflight).
Ese resultado parcial no se presenta como Maestro global PASS. El nuevo
head corrige los hallazgos, resuelve las conversaciones sólo tras validarlos
y necesita sus propias ejecuciones completas y cierre protegido.

La medición ampliada detectó además que el tema público forzaba el fondo de
section y badges con !important: se conserva el par de cada etapa también
en columnas y etiquetas mediante reglas acotadas a Pedidos. Paleta/contraste
final8/8 PASS; cada combinación verifica80+ textos, incluidos índices,
contadores, métricas, encabezados, badges y reseñas/menús. Participación72/72
pruebas Node PASS. La primera variante ampliada tuvo2 FAIL de contraste;
se conservan como reproducción, no como resultado final.
