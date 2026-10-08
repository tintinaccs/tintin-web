# Revisión activa de producto y superficies compartidas

Base: b8ec93d45d9b155a618c174e09747b48a7351120. Agente: Codex. Autorización de cambios/publicación vigente; sin pagos. El mantenimiento protegido requiere revisión manual del propietario para el SHA final; no se aprobará en su nombre.

## Alcance pendiente de cierre

- Variantes/fotos bidireccionales y círculos en todas las tarjetas; reparar asociaciones perdidas con evidencia real, sin adivinar orden de imágenes.
- Otros productos aleatorios, otras colecciones, una colección por fila, ciclo sin repetición de productos hasta agotarlo. Catálogo completo sin demorar la ficha ni reemplazar precio/stock realtime con datos edge tardíos.
- Reseñas inmediatamente antes del footer, eliminar beneficios “Comprá con confianza”, mejorar marcos y espacios sin reducir fotos.
- WhatsApp verde; cuenta y carrito con logo/título blancos centrados; retirar favoritos del carrito.
- Avisos flotantes sólo superadmin, sin duplicados por actualizaciones del mismo evento. Push superadmin para likes/reseñas/login/registro/pedidos; clientes sólo bandeja personal de perfil. Permiso actual del navegador: default, aún no activado.
- Mapas de perfil/checkout/alta fit en desktop/laptop/tablet/móvil: tiles sin estilos globales de imágenes y resize de previews.
- Pedidos distinguibles en perfil; teléfono obligatorio con validación PY canónica; eliminar doble contenido inicial/final del hero; checkout sin fondos blancos de back-row/pasos ni margen superior excesivo.
- Verificar UI en 1920/1440/1280/1024/768/390/320, teclado, variantes/stock/carrito, notificaciones por rol y registros. Build/cache/CSP y CI del candidato. Preparar mantenimiento exacto, PR y revisión humana final.

## Diagnóstico inicial (histórico, antes de las correcciones)

- Producción: window.PRODUCTS de ficha contiene sólo 9 earcuffs; API pública contiene 279 productos. Related muestra tres earcuffs. La carga SDK usa where(category == current.category), limit12.
- Celina: dos imágenes (oro primero, plata segundo), opciones en orden plateado/dorado; variantMedia no existe en documento canónico. Los dos documentos originales por ID de foto ya no existen. El selector usa foto principal cuando no encuentra asociación.
- Tracker de avisos incluye updatedAt en firma y crea otra tarjeta sin reemplazar la anterior. Push foreground se inicia únicamente cuando existe push-card de admin. Se prepararon correcciones; aún NO VERIFICADAS.
## Evidencia del candidato

- Rama aislada codex/producto-colores-recomendaciones-20261008, worktree work/producto-variantes-final. Metadata de variantes reparada en producción con transacción y sincronización HTTP200 de ambos lotes de Sheets. No se modificaron sellos. La fuente está preparada, aún no publicada.

- Comprobación real Chrome: checkout blanco/contraste y textos completos; mapas con tiles256 y overflow:hidden; recarga desde abajo termina scrollY0/restoration manual. Siete anchos 320 a1920. Logo blanco cuenta verificado visualmente. Nuevo requerimiento: carga siempre arriba, sin auto scroll de enlaces iniciales a pedido/reseña; dos pruebas de entrada/load/pageshow pasan.
- Firma SRI Leaflet corregida tomando bytes verificados de #1066; se mantiene la protección de integridad. Backend/control de acceso sin rebajar permisos.
- Regresión ampliada: 406/406 pruebas PASS. Los contratos se actualizaron a los requisitos actuales: favoritos en perfil, reseñas antes del footer y mock clear del presentador. Las auditorías de relacionados ahora exigen lectura individual realtime, API edge compartida, caché y single-flight sin enumerar Firestore ni bloquear la ficha; se retiró la expectativa incompatible de mostrar únicamente 12 productos de la misma categoría.
- Build Pages PASS: rutas, CSP con hashes, manifiesto de 19 páginas y versionado de 309 recursos/73 cargas dinámicas. La validación de carga admite el argumento explícito de versión del módulo de producto.
- Protección: 541 archivos y 78 registros conservados. Plan de renovación exacto: 68 archivos y 34 registros afectados; no cambia alcances, sellos ni mecanismo de aprobación. Pendiente CI y revisión humana del SHA final.
- Producción revalidada a las 15:46:12Z: 33 sellados verdes y 45 cambios detectados desde sellos anteriores. No se renuevan ni se ocultan esos estados como sustituto de pruebas reales. PayPal Live permanece pendiente; sandbox no cumple LIVE_PRODUCTION.
- Push: se solicitó permiso mediante el botón real de activación. Chrome continúa con permiso default; falta autorización del navegador y prueba de recepción. No se fabricaron compras ni se pagó nada.
