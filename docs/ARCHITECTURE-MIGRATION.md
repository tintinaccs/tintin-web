# Plan de migración arquitectónica

## Fases

1. Autoridad de sesión y navegación.
2. Contrato de perfil y completitud.
3. Autoridad de carrito e identidad.
4. Checkout como coordinador.
5. Cliente API y pedidos.
6. Productos e inventario.
7. Admin y permisos.
8. Contenido y editor visual.
9. HTML/CSS y entrypoints.
10. Build, CI, auditorías y limpieza legacy.

Cada fase debe mantener compatibilidad observable con producción y agregar pruebas de regresión antes de retirar rutas anteriores.
