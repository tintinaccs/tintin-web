# Tablet y aviso único de guardado

Continuación de la versión canónica de seis fases sobre main
51e5e7376a355902a1eafdba78a3ffbb74ef58c6 (#1256), 27/10/2026.
Autor de la verificación: Codex /root.

La foto recibida muestra el mismo fallo de guardado en cabecera y cuerpo,
y toda la galería antes de los campos en tablet. Reproducción con el botón
Guardar real: tres fallos de regresión (duplicación en768/820 y geometría768).
El controlador exterior volvía a escribir el error que el workspace ya mostraba.

La cabecera tiene una sola región de estado y su Reintentar asociado mediante
aria-describedby. El controlador delega el fallo al workspace y limpia el aviso
antiguo del cuerpo al iniciar Guardar. Las validaciones del escritor conservan
su ubicación original. Reintentar conserva campos y respaldo privado; no publica
el producto por sí solo. Respuestas HTML, HTTP fallido o JSON sin confirmación
siguen siendo errores: no se relaja el parser ni se anuncia un guardado falso.

Desde720px, galería y campos comparten dos columnas, con más espacio para datos.
Por debajo, se apilan sin scroll lateral. La navegación de secciones conserva
su selector en tablet; preview sigue plegada al final. Reintentar ya no ocupa
la fila de acciones principales. Los cambios de presentación se limitan al
editor: no modifican catálogo, checkout, inventario, permisos ni datos reales.

## Evidencia del candidato

Matriz33 tamaños entre320×568 y3840×2160, orientación y área
reducida, pruebas del botón Guardar con respuesta inválida y reintento,
regresiones de las seis suites existentes del editor en Chromium; matriz de
espacio/workspaces en WebKit con emulación táctil de iPad. Los comandos, logs y
capturas locales se conservan fuera del código en artifacts/editor-tablet-20261027.
Resultados finales se registran en CURRENT_STATE; no se heredan PASS anteriores.
Una corrida intermedia detectó una carrera del fixture: al restablecer la red antes
del clic, el backoff podía completar y ocultar Reintentar. Ahora el transporte
ficticio se recupera en la fase de captura del clic, para verificar ese botón
sin carreras con la recuperación automática. No se desactiva el backoff real.
También se reprodujo una falla real al pasar del nombre enfocado al botón:
el evento change del blur volvía a marcar pendiente la misma instantánea y
ocultaba Reintentar antes del click. El workspace conserva la firma del fallo
y no reemplaza ese estado ante eventos sin cambios; una edición nueva sí vuelve
a programar el guardado. La regresión mantiene el nombre enfocado hasta tocar
Reintentar para cubrir la interacción original.

WebKit requirió bibliotecas Debian en /tmp porque este contenedor no permite
instalación como root. Se omite únicamente la comprobación previa de paquetes
host con PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS; el navegador y todas las
aserciones se ejecutan realmente, sin cambiar CI ni dependencias del proyecto.

No se certifica hardware físico, teclado nativo ni Safari instalado mediante
emulación. La respuesta del servidor al guardar el producto real de la foto
sigue NOT_VERIFIED: sin control de una sesión administrativa conectada no se reproduce una
escritura en producción. La regresión usa transporte y datos ficticios con el
escritor canónico; comprueba recuperación, no la salud de aquel POST real.

La titular solicitó iniciar sesión fuera de TinyFish. Se proporcionó el acceso
directo y se solicitó abrir admin.html en Codex; el control del navegador de la
titular no está expuesto en esta sesión. No se usan perfiles de TinyFish para
inspeccionar la cuenta ni se solicitan credenciales por chat.

## Cierre local sobre main conciliado

Se incorpora1467835415f7cf4ecc432b809bc118acb0b6197e (#1255), preservando sus
cambios de Checkout/bienvenida. La entrega final aprueba144/144 Chromium en
las seis suites del editor,12/12 WebKit dirigidos,29/29 Node y78/78 admin-sync,
sin reintentos de Playwright. Preflight oficial39/39 aprobado. Las corridas
intermedias con fallos de fixture/blur quedan conservadas como evidencia; no se
cuentan como PASS ni se suman corridas solapadas como casos únicos.

Build Pages final, plan y diagnóstico se regeneran después de conciliar. El
recibo local por SHA y el PR registran CI/merge/monitor de producción. Ningún
monitor público sustituye el POST administrativo real ni una prueba física.
