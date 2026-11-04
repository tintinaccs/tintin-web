# Favicon original de Tintín

Fuente canónica: `assets-tintin/images/general/logo.png`, SHA-256 `8c96090fa70f0a8e029e92b0daa1f44c5743e3163929e77ec54a72073394a684`. La fuente se conserva intacta. Exportación técnica con el generador existente `scripts/generar-iconos-admin.mjs`: recortar únicamente margen transparente, centrar proporcionalmente sobre círculo blanco y dibujar una vez la silueta original con la variante plana rosa #CF367B ya usada por los favicons/apps. El PNG fuente contiene brillo: se reutiliza su alfa con el mismo tratamiento plano del generador existente, atendiendo la aclaración «logo original, sin3d». Sin redibujar, reforzar opacidad, texto, bordes o sombras. Exterior transparente.

PNG: `favicon-16x16.png`, `favicon-32x32.png`, `favicon-192x192.png`, `favicon-512x512.png`. ICO: `favicon.ico`, entradas16/24/32/48/64px con alfa y máscara AND de compatibilidad. El logo ocupa84% del ancho y mantiene toda su silueta dentro del círculo. Favicons versionados en todas las páginas, incluidas administración y redirección. Las variantes Apple, instalación y notificaciones conservan sus contratos previos.

El remuestreo a16/32px es antialias del original, no una regeneración ni un aumento de detalle. Los navegadores pueden conservar su propia caché de favicons; las URLs nuevas y las rutas revalidables permiten solicitar esta exportación.
