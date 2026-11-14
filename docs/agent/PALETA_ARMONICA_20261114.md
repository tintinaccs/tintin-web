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
