# Tema Tintín único — 23 de octubre de 2026

Petición: un tema y un esquema de colores para toda la plataforma, con diseño
minimalista propio de Tintín y coherencia en móvil, tablet y escritorio.

## Criterio visual

- Identidad: libélula y fotografía original, Montserrat, rosa Tintín #F8AACA,
  rosa claro #FDECF2, blanco #FFFFFF y texto oscuro #222222.
- Se conservan los fondos difuminados de marca y su alternancia aprobada.
  Los contenidos y controles permanecen nítidos.
- Superficies blancas, bordes finos, esquinas de 14px en campos y una escala
  de 16–20px en tarjetas; no se añaden recuadros a la firma ni a las acciones
  de la ficha de producto.
- Una misma elevación discreta para tarjetas. Sin sombras decorativas en
  botones. El estado de foco sigue siendo visible con teclado.
- Las alertas, errores, peligro, stock y WhatsApp conservan significado y
  contraste; una paleta de marca no convierte todos los estados en rosa.

## Una autoridad de color

`GLOBAL_TOKENS` y el esquema activo `activeGlobalSchemeId` se utilizan también
en administración. Los nombres `--admin-color-*` son alias de compatibilidad
de `--color-*`, con respaldos locales seguros. La entrada administrativa conserva
su gate de Auth/App Check antes de cargar el motor compartido.

El editor deja de ofrecer un esquema independiente para Super Admin y no
crea/carga/activa `default-admin`. Los documentos anteriores no se borran ni se
reescriben. Los borradores globales, contraste, confirmación de publicación,
historial, importación y guardia de cambios pendientes conservan su funcionamiento.

Esto sustituye la separación histórica de paletas pública/administrativa descrita
en comentarios antiguos: la solicitud actual del propietario exige un solo esquema.
No cambia roles, permisos ni datos comerciales.

## Evidencia del candidato

PASS_LOCAL. Codex /root:

- Barrido geométrico: 187/187 combinaciones, 11 rutas públicas × 17 dimensiones,
  incluidas transiciones de móvil/tablet/escritorio. Reporte local:
  `artifacts/global-responsive/report.json`. El último ajuste posterior sólo
  conecta colores de botones con sus tokens; no altera geometría.
- 84 Chromium de navegación, primera pintura y formularios aprobados. Después de
  completar la conexión de estados, 33 Chromium de formularios, publicación del
  esquema, teclado/validación/editor, movimiento reducido y aviso de versión
  aprobados sin reintentos. Son suites solapadas, no 117 casos distintos.
- 54 regresiones adicionales aprobadas de módulos administrativos, Nosotros,
  alternancia, capas y editor. Una expectativa antigua de primera pintura
  esperaba rosa fuerte: se reprodujo que main y candidato usan el mismo rosa
  claro sin módulos; se actualizó la expectativa al contrato actual. Los siete
  casos de primera pintura pasan después en Chromium y WebKit.
- 20/20 WebKit finales: cuatro formularios a nueve tamaños, esquema único en
  vivo a cuatro anchos y siete casos de primera pintura. Incluye gate denegado,
  cambio de esquema publicado, hover real, peligro, resize y caché compartida.
- Auditorías de color (153 tokens y 36 alias), contenido/apariencia, Apariencia
  unificada, tipografía, Fases 8/10, caché, CSS, rutas y CSP aprobadas. 8 contratos
  de gate administrativo, 20 de paleta/readiness/aviso y 5 de shell/bundle pasan.
- Cuatro capturas locales de Contacto/Configuración a 390 y 1440px revisadas.
  Evidencia fuera del repositorio: `outputs/tema-contacto-*.png` y
  `outputs/tema-admin-*.png` en el directorio de esta tarea.

La inspección privada utiliza HTML/CSS reales con sesión y transporte simulados;
no acredita sesiones reales ni hardware físico. No se publican esquemas ni se
modifican datos comerciales durante las pruebas. CI, merge y publicación del
tema requieren evidencia posterior del SHA aprobado.

## Conciliación con #1212

Mientras se subía #1213, main avanzó a a2bd6fada (#1212). Se incorporan sus
fuentes sin cambios: escala de espacios, retiro de reservas duplicadas,
dashboard-control y regresiones de espaciado. El único conflicto de fuente
combina el padding administrativo de #1212 con los colores semánticos de este
tema. Los derivados se regeneran; la superficie compartida utiliza una URL
nueva `tintin-20261023-tema-unico-2`, sin reutilizar la URL anterior.

PASS_LOCAL de la combinación: 98/98 Chromium de superficies y formularios,
21/21 WebKit de esquema vivo y matriz de espaciado de 18 páginas/23 módulos,
incluidos 17 tamaños. Sin reintentos. Los cuatro contratos de autoridades y
consumidores, Apariencia, el gate estricto y caché vuelven a aprobar. Capturas
de Contacto/Configuración renovadas y revisadas. Esto actualiza la evidencia
del candidato conciliado; no hereda una publicación del primer candidato.
La PR tiene auto merge solicitado; CI/merge/producción del nuevo SHA pendientes.

## Corrección del control de hover tras resize

La auditoría 39978762259 aprobó el contrato estático completo, cuentas/sync,
reglas y Super Admin. En el lote visual final hubo 291 aprobados y un fallo:
el control del esquema en 390px esperaba reposo después de resize y recibió
el color hover correcto. El puntero ahora se retira al fondo de la nueva vista
tras cambiar su ancho; se exige explícitamente que el botón no coincida con
:hover antes de verificar su color de reposo. No cambia CSS ni expectativas de
color, y la comprobación de hover real se mantiene.

PASS_LOCAL de la corrección: 40/40 Chromium (10 repeticiones en cuatro anchos)
y 20/20 WebKit (cinco repeticiones), sin reintentos. La auditoría del nuevo SHA
y su publicación siguen pendientes; el resultado fallido anterior no se omite.
