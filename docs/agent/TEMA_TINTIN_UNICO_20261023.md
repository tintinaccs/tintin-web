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


## Cierre de CI y conciliación con encabezados publicados

Conciliación final con main b3997c7cc (#1211/#1215): se conservan sus encabezados y Checkout. CI 39988953497 terminó cancelado al cumplir 75 minutos durante la matriz canónica, después de aprobar estático/cuentas/reglas/Super Admin y las suites del navegador ejecutadas; el caso hover ya aprobó. La auditoría conserva todos sus gates y dispone de 120 minutos. El control de 48px mantiene el mínimo CSS y admite sólo 0.001px de redondeo geométrico (50/50 repetidos PASS). La conciliación aprobó 224 Chromium; WebKit dio 36 PASS y detectó escape del foco al tabular desde Cuenta, reproducido tres veces. Se corrige el recorrido dentro del panel/barra/privacidad, excluyendo tabindex negativo: 3/3 repeticiones por motor y 14/14 regresiones de paneles por motor, sin reintentos. Versiones del controlador/compatibilidad tema-unico-3; superficie visual sigue tema-unico-2. Plan 30 archivos/43 registros con base b3997c7cc991f3c7a45f4f650146fbdbad2015a4. CI/merge/producción del nuevo árbol pendientes.

La primera tanda de 499 regresiones con servidor local disponible aprobó sin reintentos sobre c86201bf; no se presenta como prueba del árbol conciliado posterior. El candidato nuevo conserva esa implementación de tema y verifica específicamente las superficies afectadas por los encabezados/foco. Las capturas/sesiones privadas siguen siendo fixtures, sin datos comerciales reales.

## 2026-10-23 — Contraste con los logs y conciliación final

La revisión de Actions obtiene el log original del job120500210905: el fallo era la primera comprobación del color de #public-action, línea118, antes del resize. Recibía el color hover correcto mientras la prueba esperaba reposo. La sección anterior atribuía el problema al resize; el ajuste de c86201bf sólo estabilizaba ese estado posterior y no cubría el origen mostrado en el log.

Se reproduce de forma determinista colocando el puntero en Comprar antes de publicar el esquema. El fixture conserva ese caso: verifica el color hover actualizado durante la publicación, retira el puntero, exige ausencia real de :hover y verifica el color de reposo. Conserva los controles posteriores de hover, peligro, foco y resize; no cambia CSS ni tokens esperados. La rama incorpora mainb3997c7c por merge normal y preserva sus fuentes de encabezados/dropup y reservas de Checkout. Inventario de Actions, excepción del job del otro agente y verificación actual: RECUPERACION_ACTIONS_PR_20261023.md.

Verificación de la conciliación:231/231 Chromium y20/20 WebKit, más18/18 contratos de permisos/color/paleta. Corrección focal posterior:40/40 Chromium y20/20 WebKit repetidos sin reintentos. Los lotes focales se solapan con la matriz y no se suman como casos únicos. CI nueva del SHA final requerida.


Se conserva íntegra la revisión remota 6184a0d3 (conciliación y fixture de hover inicial), incluido RECUPERACION_ACTIONS_PR_20261023.md. El esquema combinado aprobó 4/4 Chromium y 4/4 WebKit sin reintentos. Los ajustes adicionales de foco de paneles, precisión de 48px y presupuesto CI120min permanecen locales hasta resolver quién continúa la PR; no se cancela ni se reejecuta la auditoría iniciada por el otro agente.

## 2026-10-24 — Candidato conciliado y revisión de Actions (Codex /root)

Se preservan remoto872095114 y main6ac1fdf25 sin reescritura. El workflow de main por fases reemplaza íntegro la ampliación local del workflow monolítico: no se mantiene CI120min ni se omiten gates. Tres runtimes combinados reciben tema-conciliado-1; foco/compatibilidad conservan tema-unico-3 y superficies tema-unico-2. PASS_LOCAL actual:119/119 Chromium y18/18 WebKit sin reintentos;41 contratos de mantenimiento/cuenta y11 de CI/aislamiento; colores153/36, Apariencia15, arquitectura, niveles1/2, Parte2H19, CSS, rutas/CSP38, caché364/67 y protección78/544. La prueba negativa de fases de CI se normaliza a LF al leer el YAML para ejecutar las mismas mutaciones en Windows; se reprodujo fallo antes y11/11 después. No se cambia el resolvedor ni el workflow. Fixtures privados y motores emulados, sin certificación de hardware físico ni escrituras comerciales. CI/merge/producción del candidato: PENDING.

Inventario200 ejecuciones de Actions (22–24oct UTC): sólo tres últimas combinaciones workflow/rama seguían fallidas. #1216/run40033424599: deriva en diagnostic-manifest/site-version de un borrador documental; #1217/run40040433474: auditor nivel2 rechaza la identidad de la línea del carrito. Ambos borradores pertenecen a la secuencia del editorv2, cuyo candidato activo es #1219 y preparación de reglas #1220. #1220/run40048688688 falló por deriva de generados y ya tiene sustituto40048914158 con preflight/comercio/admin/reglas aprobados y calidad/browser aún en curso. No se modifican esas ramas ni sus Actions. Mantenimiento40048791984 falla al exigir Repository audit de candidatos no aprobados: no demuestra caída de producción y no se relaja ese rechazo. CI de main40015443643 aprobó; salud40046127645, correo40045901163 y Sheets40037942420 aprobaron como jobs, sin afirmar envíos/escrituras/cobros reales. Los fallos históricos permanecen como evidencia; no se borran ni se cuentan cancelaciones reemplazadas como defectos actuales.
