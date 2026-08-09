# Editor visual seguro de TINTÍN

El módulo **Super Admin → Apariencia → Editor visual seguro** permite editar las páginas reales sin escribir código.

## Uso de la dueña

1. Elegir una página y una sección existente, o agregar un bloque seguro.
2. Cambiar textos, colores, espacios, ancho, alineación, bordes, sombra o animación.
3. Revisar la página real en Celular, Tablet y Escritorio.
4. Usar **Guardar borrador** para continuar después sin afectar la tienda.
5. Usar **Revisar y publicar** solamente cuando la vista previa esté correcta.
6. En **Historial y restauración**, restaurar cualquier versión publicada. La restauración crea una versión nueva y no borra el historial.

## Límites intencionales

- No acepta HTML, JavaScript, CSS, selectores ni URLs de imagen arbitrarios.
- Imágenes: biblioteca local `assets-tintin` o Cloudinary por HTTPS.
- Los bloques de productos leen productos reales; nunca cambian precio, stock, carrito ni checkout.
- Solo admite páginas públicas y secciones registradas en el esquema del repositorio. Checkout, pagos, pedidos, acceso y cuentas quedan fuera deliberadamente.
- Hasta 24 bloques adicionales y 8 imágenes por galería.
- Las animaciones respetan `prefers-reduced-motion`.

## Seguridad y recuperación

- La interfaz se oculta para cualquier cuenta distinta de la Super Admin oficial.
- El backend vuelve a verificar el token y el email de Super Admin.
- Navegador y servidor sanean la configuración de forma independiente.
- Diseño, contenido, versión e historial se publican mediante un commit atómico de Firestore.
- La versión y la revisión de contenido esperadas, junto con precondiciones atómicas de Firestore, evitan sobrescribir cambios de otra sesión.
- Las colecciones internas del editor no tienen acceso directo mediante Firestore Rules.
- La API pública devuelve solamente configuración saneada y nunca secretos.

No existe una garantía matemática de que ningún software pueda fallar. El editor reduce el riesgo evitando libertad de código y proporcionando validación doble, preview, versiones y rollback.
