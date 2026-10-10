# Revisión de las tandas de WhatsApp — 10/10/2026

Solicitud: analizar las capturas y corregir el sitio en celular, tablet y escritorio. Las correcciones se aplican a los componentes compartidos y a sus fuentes generadoras, además de las páginas específicas. No se publicó ni se hicieron compras, registros o envíos reales.

## Cambios

| Pedido de las capturas | Implementación |
| --- | --- |
| Catálogo móvil, contacto y márgenes | Menú de categorías con dos columnas, tarjetas separadas, acceso a Nosotros/Contacto, cierres circulares de 44 px. |
| Barra inferior e indicador | Indicador abarca icono y etiqueta; barra centrada y próxima al borde respetando el área segura; etiqueta Catálogo. |
| Encabezado de escritorio/tablet | Logos con mayor superficie visible, selección rosa y tarjetas de categorías redondeadas. |
| Quiénes somos y materiales | Sin subrayado en el enlace del inicio; beneficio Materiales de calidad. Los textos históricos del beneficio que afirmaban inoxidable universal se normalizan sin sobrescribir textos personalizados. |
| WhatsApp y atención | Texto Escribir por WhatsApp, icono/texto blancos en botones verdes, debajo del horario de 09:00 a 22:00. Generador del footer actualizado. |
| Filtros de precio | Quitados de HTML y lógica del catálogo; parámetros de filtros antiguos se eliminan al normalizar la URL. |
| Agotados | Fotos en gris y raya blanca con bordes oscuros en tarjetas, buscador, galería y opciones. Se mantiene la posibilidad de verlos. |
| Producto en tablet y móvil | Dos columnas desde 768 px, márgenes y controles contenidos; miniaturas circulares y colores con volumen sutil. |
| Comentarios/Me gusta/selección duplicada | Quitados de producto. La integración conserva el retiro de la barra social y de Compartir ya aprobado en main #1084; favoritos del catálogo/perfil y modelo histórico se mantienen. |
| Carga de imágenes | Imagen principal reutilizada, tamaños adaptados con srcset, prioridad de la principal y miniaturas diferidas. |
| WhatsApp que desaparece al desplazarse | Acceso fijo y visible durante el scroll, sin animación ni ocultación por contenido ordinario; separación de la barra móvil y exclusión temporal de avisos superpuestos conservadas de main #1084. |
| Registro mínimo | Nombre y apellido en un campo (al menos dos palabras) y WhatsApp. Sin username, nacimiento ni mapa en el alta. Se conservan datos históricos. |
| Marca reservada | tintinaccs reservado en cliente y reglas de nuevas reservas; también se protegen tintin y tintinaccesorios en servidor. |
| Registro que no avanza | Errores junto al campo, foco/desplazamiento, aviso específico de número duplicado, límite de espera de red y reintento sin borrar datos. Perfil activo después de verificar la persistencia. |
| Factura | Persona física exige nombre y apellido tanto en navegador como en servidor. |
| Transferencia | Instrucción con WhatsApp +595 981 299 331. |
| Entrega el mismo día | Delivery por la tarde admite efectivo al recibir. Después de las 11, moto/Uber se coordina por WhatsApp, sin horario fijo y con producto pagado por transferencia antes del envío. No se integró un servicio de Uber. |
| Confirmación del pedido | Alta mínima coherente entre cuenta y servidor; mensajes específicos de conexión/sesión. Se preservan controles de stock, precios, autorización y clave idempotente en reintentos. |

## Evidencia nueva de esta sesión

- `node --test tests/checkout/*.test.mjs tests/login/*.test.mjs tests/auth/*.test.mjs tests/accounts/*.test.mjs`: 390 PASS, 0 FAIL.
- Navegación, checkout y regresiones de capturas en Playwright: 64 PASS, 0 FAIL.
- Factura, indicador móvil, galería real por colores y registro/producto: 43 PASS, 0 FAIL.
- Formulario de alta: dos pruebas de navegador con siete tamaños cada una, PASS.
- Primera revisión de geometría: 18 páginas × siete tamaños, 126/126 PASS. Los tamaños son 320, 390, 768, 1024, 1280, 1440 y 1920 px.
- Revisión final de navegación y capturas: 33 PASS; los tres casos de contraste fallaron inicialmente y se corrigió la cascada global de botones. Revisión posterior de horario, texto/icono/botón blancos (incluido contacto directo) y WhatsApp/agotados: 6 PASS.
- Registro y producto con los últimos cambios: 14 PASS (siete tamaños), incluido límite de espera al guardar, datos conservados, corrección de errores al escribir y miniaturas circulares.
- Última geometría canónica: 119/126 PASS. Los siete casos de admin.html exceden el límite duro de 12 segundos; el resto de las páginas pasa en los siete tamaños. Una lectura aislada con Chromium sin ignorar certificados registró ERR_CERT_AUTHORITY_INVALID para Firebase app/auth/firestore/app-check en www.gstatic.com. Esto limita la prueba de Administración en este entorno; no se atribuye a una regresión del código sin evidencia.
- Build completo (rutas, flujos de decisión, CSP, diagnóstico y caché): PASS. Plan protegido: 85 archivos, 59 registros afectados; auditoría local conserva 78 registros y 541 archivos.
- Pruebas Node finales combinadas de checkout/login/auth/accounts, protección de flujos, paleta e inventario: 453 PASS, 0 FAIL. El antiguo chequeo estático que exigía ocultar WhatsApp por colisión de texto se reemplazó por la prueba de navegador de visibilidad y colisión con controles.
- Auditorías de contacto, checkout, entrega e integridad CSS: PASS. Los auditores de carga de módulos consultan el registro canónico de versiones para validar versiones por recurso.
- El registro de caché se actualiza con el auditor oficial; no se relajaron hashes, CSP, TLS ni integridad de paquetes.
- Preparación de publicación autorizada por el usuario: 26 pruebas de arquitectura/editor visual y 40 pruebas finales de navegador PASS. Se retira también la selección duplicada del contrato del editor y se unifica el logo estático/dinámico sin cambiar la versión de la imagen.
- Build final PASS, 313 recursos/65 cargas dinámicas con versiones coherentes. Las auditorías de cache, confiabilidad y UI/UX consultan las versiones por recurso; el alta se audita con su contrato actual de nombre y WhatsApp. No se retiraron las comprobaciones de stock, identidad, consentimiento ni autorización.
- Los comandos del contrato audit:final se comprobaron por bloques después de corregir los contratos antiguos; maquetación de Administración con fixtures también pasa. Los scripts de navegador necesitan PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH y PLAYWRIGHT_EXECUTABLE_PATH apuntando a /usr/bin/chromium. Esto no es CI de GitHub ni valida Firebase remoto.

Las pruebas de formularios y pedidos usan servicios/datos aislados. Las pruebas de navegación de Cuenta/Alertas conservan los renderers y controlador de superficies reales y sustituyen Firebase remoto para no depender de cuentas reales ni del CDN bloqueado. Las capturas locales de revisión están en `artifacts/whatsapp-feedback/` (no versionadas).

## Límites y publicación

- PASS nuevo: el acceso a storage.googleapis.com funciona y el emulador oficial se descargó sin omitir verificaciones. test:rules-username verifica 16 controles, test:rules-phone 12 y test:rules-critical 127, todos con salida 0.
- BLOCKED: Administración con Firebase remoto conserva ERR_CERT_AUTHORITY_INVALID en Chromium. La revisión automática rechazó registrar la CA del proxy instalada en el sistema porque ampliaría persistentemente la confianza TLS; no se cambió el almacén ni se omitió TLS. Hace falta autorización específica para ese cambio de confianza.
- RESUELTO: después del bloqueo inicial de api.github.com y tintinaccesorios.pages.dev con CONNECT 403, ambos servicios respondieron. Se subió la rama por Git y se creó el PR #1083. Los permisos necesarios están guardados en la configuración del entorno. La portada productiva respondió HTTP 200; eso no confirma que estos cambios estén desplegados.
- No se confirmó un pedido en producción. La corrección se valida con simulaciones de servidor y no permite atribuir el error de la captura a credenciales o servicios productivos sin sus logs.
- Cambios protegidos: se prepara el plan oficial de mantenimiento con hashes reales; conserva los registros anteriores sin convertirlos en evidencia de esta revisión. CI y aprobación del SHA final corresponden a publicación.
- Código subido en codex/whatsapp-responsive-20261010, commit de implementación 25440e354a60703c4739777b363e301f1b0ac9c9, sobre main 6d7c644a913c25710c1d1604fb4ff07ec7f2d644. PR: https://github.com/tintinaccs/tintin-web/pull/1083. No se hizo merge ni deploy productivo. Cloudflare Pages pasó para el primer candidato; Repository audit y CodeQL comenzaron. Los checks automáticos de integridad histórica/mantenimiento bloquean los cambios protegidos hasta el dispatch de mantenimiento. El propietario debe revisar manualmente el entorno protected-flow-maintenance para el SHA final; el agente no puede aprobar en su nombre, según docs/agent/MANTENIMIENTO_FLUJOS.md. Un commit nuevo de documentación/manifiesto requiere CI para ese nuevo SHA.

Validación adicional tras el primer CI: bloque operativo de Actions reproducido con 678 pruebas Node PASS (la última ejecución de code-studio registra cero pruebas y no se presenta como cobertura). Se conservan favoritos en catálogo/perfil y los datos sociales históricos; las pruebas de la ficha ahora exigen ocultar Me gusta/comentarios. Recuperación real del formulario de WhatsApp: 3 pruebas de navegador PASS, con aborto por plazo, datos conservados y respuesta tardía descartada. Los seis contratos Maestro/Admin de Actions pasan localmente. La salud productiva previa al despliegue pasa con peticiones GET y Node usando el proxy del entorno; no confirma un pedido ni el despliegue del candidato. CI debe volver a pasar para este nuevo commit.

Segundo CI (1fdced09): compilación reproducible, contratos estáticos/operativos, reglas Firestore y Maestro/Admin PASS en GitHub. El bloque de navegador llegó a la matriz canónica: 119/126, con siete plazos agotados de admin.html. La sonda con el SDK oficial 10.14.1 descargado por curl con TLS verificado alcanzó DOMContentLoaded en 1240 ms; no valida Auth/App Check remotos. La geometría de Administración ahora usa HTML/CSS y navegación lateral reales con scripts de negocio retirados y CSP connect-src/frame-src/form-action none, como sus fixtures existentes. Exige panel visible y registra geometryMode=isolated-admin-layout; conserva los plazos y controles de overflow. Primera ejecución local: 125/126, Administración 7/7 PASS; checkout 1440 agotó el plazo mientras corría otra auditoría. Se detuvo esa ejecución global y se repite la matriz sola; no se la presenta como PASS completo. El contrato de identidad de navegación verifica ahora la URL efectivamente importada contra preload y registro: 9 pruebas PASS. Se debe repetir CI para el nuevo candidato.

## Entorno reutilizable

Node >=22 y Java para las pruebas de reglas. Instalación probada: `npm ci --cache /workspace/.cache/npm --no-audit --no-fund` (687 paquetes). Arranque: `node scripts/servidor-local-pruebas.mjs 4173`. Playwright usa `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173` , `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` y `PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium`. El borrador de instalación/arranque se guardó para revisión del usuario.

## Integración final con main #1084

El candidato se actualiza contra ec63adce6551cb6210c20fdcea21c4f3447f2896, preservando los cambios aprobados de navegación móvil/producto/WhatsApp. Se corrige la recuperación diferida del checkout que deshacía Volver. Reproducción determinista previa390/768/1440 FAIL; después34 pruebas checkout/primer render PASS y tres casos ampliados de retorno, recuperación tras recarga y teclado PASS, sin reintentos. Pruebas Node finales455 PASS. Plan oficial84 archivos/59 registros, inventario78/541 conservado. Estos resultados son locales; CI y revisión protegida deben corresponder al SHA combinado final antes de publicar.
