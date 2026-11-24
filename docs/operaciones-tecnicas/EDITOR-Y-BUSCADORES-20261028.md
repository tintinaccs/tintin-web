# Editor de productos y buscadores — 2026-10-28

Base inspeccionada: `9fcc8c57` (main). Implementación y evidencia: Codex, agente raíz y revisión paralela de búsqueda pública, administrativa y escritor comercial. No se modificaron productos reales ni se iniciaron compras, correos o sesiones de prueba en producción.

## Diagnóstico y correcciones

| Gravedad | Causa comprobada | Corrección |
| --- | --- | --- |
| HIGH | Publicación (6/6) mostraba `Último paso` siempre deshabilitado y sin guardado. Reproducido en Chromium320 antes del cambio. | El botón final invoca el botón canónico del editor. Refleja etiqueta, espera y disponibilidad; conserva validación, permisos y escritor. |
| HIGH | El alta reservaba ID antes del transporte; un fallo convertía el siguiente intento en edición para el control de permisos. | Se distingue alta/edición por la revisión de origen confirmada. Se conserva el mismo ID/changeId. |
| HIGH | Un alta confirmada cuya respuesta se perdía exigía permiso de edición en el reintento de una cuenta con permiso exclusivo de crear. | Sólo un recibo privado cerrado atómicamente acredita propietario, alta, cambio y revisión originales. El replay exige permiso de crear vigente, no vuelve a escribir y no habilita editar. Pruebas rechazan actores/revisiones/recibos ajenos y permisos revocados. |
| MEDIUM | El guardado oficial no acotaba la espera del transporte. | Timeout30s, recuperación existente, formulario y clave idempotente conservados. |
| MEDIUM | Productos, Colecciones, Páginas y ventas locales reconstruían el campo al filtrar; se perdían foco/cursor/composición o teclado móvil. Productos además actualizaba la consulta recién tras el debounce. | Se conserva conectado el campo y sus ancestros, consulta inmediata, sólo render diferido, sin refoco. Se evita acumular listeners en Páginas. |
| MEDIUM | Denuncias consultaba por tecla y aceptaba respuestas antiguas o de una sesión anterior. | Debounce120ms, cancelación e invalidación al escribir/cambiar sesión; sólo responde la generación vigente. |
| MEDIUM | Búsquedas administrativas y mayoristas trataban tildes/espacios de manera desigual. | Comparación normalizada compartida sin cambiar los datos. |
| MEDIUM | Catálogo encontraba exactos pero el orden predeterminado priorizaba merchandising. | Relevancia primero al buscar; se mantienen los órdenes explícitos elegidos por la clienta. |
| MEDIUM | Cerrar búsqueda de ubicación no cancelaba timer/petición; los resultados reaparecían. | Escape, clic externo y selección cancelan/invalida la consulta. |
| MEDIUM | Mayorista acumulaba callbacks mientras esperaba el catálogo y podía repintar consultas borradas. | Se conserva single-flight y se descartan generaciones de búsqueda anteriores; exactos primero. |

El estado Borrador guarda progreso privado; Activo publica al guardar. Las etiquetas y ayuda del editor explicitan esa diferencia. No se cambió el contrato editorial ni se publica automáticamente un borrador.

## Inventario de búsquedas

| Superficie | Autoridad y resultado de inspección |
| --- | --- |
| Header público, todas sus variantes | `control-busqueda` y motor `busqueda-productos`: índice reutilizado, debounce120ms, coincidencias normalizadas/exactas/aproximadas, consulta actual y catálogo single-flight. Se conserva. |
| Catálogo | `catalogo.html`, mismo motor, paginado48 y orden explícito preservados; relevancia corregida. |
| Cotización en Perfil | `mayorista-perfil`: catálogo autorizado existente, generaciones y normalización corregidas. |
| Ubicación Perfil/Checkout | `mapa-ubicacion`: API compartida, abort y generaciones; cierre corregido. El export legacy `attachLocationPicker` no tiene consumidores activos y no se reconstruyó. |
| Productos/Colecciones/Pedidos admin | `shopify-commerce-admin` y tablero canónico de pedidos; consulta estable, debounce, IME y filtros. Las listas conservan paginación/subscripciones existentes. |
| Productos heredados y selector de colección | `admin-app`: normalización y debounce sobre controles existentes; conservados por sus consumidores internos. |
| Usuarios, clientes de correo, plantillas e historial | `admin-app`: comparación normalizada y trabajo diferido, sin modificar cuentas, destinatarios ni enviar mensajes. |
| Ventas locales/clientes compradores | `comercio-local-admin`: búsqueda preserva campo y sólo actualiza listado; no reconstruye compradores/espejos por tecla. |
| Reseñas/Me gusta/Denuncias | `gestion-participacion-admin-v2` y `comentarios-sociales`: normalización coherente cliente/servidor; respuesta vigente en Denuncias. |
| Mayoristas Super Admin | `mayoristas-admin`: cuentas aprobadas y cotizaciones conservan permisos/filtros, normalización/debounce. |
| Multimedia, permisos, apariencia | Biblioteca de Productos y `admin-app`: comparación compartida; mismo origen de medios/permisos. |
| Páginas, biblioteca visual, diagnóstico, conexiones | Implementaciones existentes; normalización y render diferido donde es costoso; Páginas conserva el campo. |
| Buscador de módulos y matriz maestra | Autoridades `buscador-modulos-admin`, `panel-maestro`; normalización compartida, guardia/navegación actuales. |
| Combinaciones/opciones del editor | Controles/galería canónicos: no se agregaron escritores ni campos paralelos. Cubiertos por regresiones del editor. |

No se agregaron servicios, dependencias, índices, permisos ni reglas públicas. Se mantienen CSP, autenticación, App Check, CAS, inventario privado, recibos, validaciones de publicación y sincronización existentes. No se puede prometer latencia del proveedor: se verifican cancelación, trabajo coalescido, foco y respuesta vigente.

## Verificación

Los resultados finales del candidato y GitHub se registran en CURRENT_STATE y en el recibo externo del PR. Evidencia local de esta sesión:

- 60/60 Node del escritor/editor antes de integración;182/182 Node administrativos y1 omitida por requerir emulador (tras corregir un fixture preexistente que no inyectaba `statusFromError`).
- 63/63 participación;29/29 búsqueda pública/ubicación y sesiones.
- 37/37 Chromium público (catálogo, ubicación, mayoristas),44/44 comercio/admin y regresiones iniciales del último paso3/3.
- Páginas: fixture corregido para importar el helper y ejecutar el controlador con nonce válido, manteniendo CSP sin unsafe-eval;3/3 casos específicos pasan. El conjunto inicial de59 pasó56 y falló esos3 por infraestructura del fixture; no fue un fallo comercial.
- Regresión final de editor/guardado responsive y build: estado del candidato en CURRENT_STATE.

Las pruebas usan DOM/controladores y escritores reales con identidad, red y almacenamiento de QA en memoria; no acreditan un guardado comercial real de la cuenta titular. No hubo acceso a Safari/iPhone físico ni a su sesión administrativa. Esos recorridos quedan como NO VERIFICADOS; no se rebajan autenticación ni seguridad para probarlos.
