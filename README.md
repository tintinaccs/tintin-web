# Tintin Accesorios — plataforma web

Tienda online y panel administrativo de **Tintin Accesorios & Relojes**, desplegados como sitio estático en GitHub Pages e integrados con Firebase Authentication y Cloud Firestore.

## Arquitectura actual

- HTML, CSS y JavaScript nativos.
- Firebase Authentication para sesiones.
- Cloud Firestore para productos, colecciones, clientes, carrito, pedidos, configuración, auditoría y contenido.
- Google Apps Script autenticado para correos operativos.
- GitHub Actions para auditorías y despliegue atómico en GitHub Pages.
- Cloudflare Pages Functions activas en `functions/api/` (Cloudinary, geocoding, correo, geo aproximada); no forman parte del despliegue de GitHub Pages, se publican solas en Cloudflare.
- Cloud Functions de Firebase listas pero inactivas en `firebase-cloud-functions-inactive/` (requieren plan Blaze; hoy el proyecto corre en Spark).

La configuración pública del SDK web de Firebase no es un secreto. La seguridad depende de Authentication, Firestore Rules, validaciones del servidor y App Check cuando esté habilitado. Las claves privadas, cuentas de servicio y secretos de pasarelas nunca deben entrar en el frontend.

## Páginas principales

- `index.html`: inicio.
- `catalogo.html`: catálogo.
- `collections.html`: colecciones.
- `product.html`: producto.
- `checkout.html`: compra.
- `login.html`: acceso y registro.
- `perfil.html`: cuenta y pedidos.
- `admin.html`: panel administrativo.
- `admin-images.html`: administración de imágenes.
- Páginas informativas y legales: nosotros, contacto, envíos, cambios, preguntas frecuentes, términos, privacidad y 404.

## Regla de impacto obligatorio

Una corrección no se limita al archivo donde se detectó el problema. Antes de integrar un cambio se revisan todos los consumidores del mismo dato o comportamiento: interfaz, Firebase, reglas, roles, carrito, checkout, pedidos, stock, promociones, correos, analítica, SEO, accesibilidad y documentación.

Los cambios visuales y funcionales se validan en estas siete resoluciones:

- 1920 × 1080
- 1440 × 900
- 1280 × 720
- 1024 × 768
- 768 × 1024
- 390 × 844
- 320 × 568

Y, cuando corresponda, para Invitado, Cliente, Viewer, Agente, Admin y Super Admin.

La lista obligatoria está en [`docs/CHANGE_IMPACT_CHECKLIST.md`](docs/CHANGE_IMPACT_CHECKLIST.md).

## Desarrollo y auditorías

Se requiere Node.js 20.

```bash
npm run build:pages
npm run audit:deep
npm run audit:final
```

`npm run audit:final` ejecuta las comprobaciones estáticas transversales del repositorio. No se debe integrar un cambio con auditorías rojas.

## Flujo de cambios

1. Crear una rama desde `main`.
2. Inventariar páginas, módulos, datos, reglas y roles afectados.
3. Implementar el cambio sin duplicar fuentes de verdad.
4. Ejecutar auditorías y actualizar diagnósticos.
5. Abrir Pull Request con alcance, riesgos, pruebas y rollback.
6. Esperar todas las comprobaciones verdes.
7. Integrar en `main` y comprobar el despliegue.

No se realizan cambios directos en producción sin trazabilidad. Las acciones delicadas deben poder revertirse.

## Seguridad

- Denegación por defecto al final de `firestore.rules`.
- Super Admin protegido por la cuenta oficial.
- Roles y acciones sensibles validados en reglas, no solo mediante botones ocultos.
- Datos de usuarios renderizados como texto, no como HTML ejecutable.
- Secretos excluidos por `.gitignore` y documentados únicamente como marcadores en `.env.example`.
- Integraciones de pago y claves privadas exclusivamente del lado del servidor.

Ver [`SECURITY.md`](SECURITY.md).

## Copias de seguridad y recuperación

Antes de cambios masivos en productos, pedidos, usuarios, permisos o reglas se debe disponer de una exportación verificable y un procedimiento de reversión. El runbook está en [`docs/BACKUP_RECOVERY.md`](docs/BACKUP_RECOVERY.md).

## Despliegue

Cada `push` a `main` dispara `.github/workflows/deploy-pages.yml`. El workflow regenera y verifica el manifiesto de diagnóstico y publica exactamente el árbol comprobado. La concurrencia está configurada para que los despliegues no se pisen.

## Definición de terminado

Un cambio está terminado solamente cuando:

- funciona en todos los viewports y roles aplicables;
- contempla carga, éxito, vacío, error y reintento;
- no rompe integridad de datos ni seguridad;
- no duplica lógica o fuentes de verdad;
- tiene auditoría automática suficiente;
- está documentado y puede revertirse;
- el Pull Request y el despliegue quedan verdes.
