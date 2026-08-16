# Diagnóstico Maestro Tintin

El workflow **Diagnóstico Maestro Tintin** es la auditoría manual de cierre global del sitio. No reemplaza las validaciones específicas de cada PR: las agrupa, amplía y produce evidencia por área para decidir si una versión puede considerarse baseline estable.

## Cómo ejecutarlo

1. Abrir GitHub → **Actions**.
2. Elegir **Diagnóstico Maestro Tintin**.
3. Presionar **Run workflow**.
4. Elegir la rama a auditar (normalmente `main`).
5. Confirmar `production_origin`.
6. Mantener **include_production = true** para una auditoría final de cierre.
7. Ejecutar el workflow.

El workflow es deliberadamente manual porque es amplio y costoso. Las auditorías específicas existentes siguen cubriendo cambios normales de PR.

## Cobertura

El Maestro ejecuta suites independientes. Una falla en una suite no impide que las demás produzcan evidencia.

### 1. Integridad y diagnóstico estructural

- build reproducible de Pages;
- manifiesto de diagnóstico;
- auditoría final acumulada;
- barrido profundo;
- coherencia de nombres.

### 2. Comercio, pedidos, carrito y datos

- contrato seguro de pedidos;
- checkout y entrega;
- carrito y persistencia;
- store gate y recuperación ante bloqueos;
- inventario/productos/multimedia;
- pedidos del Admin;
- usuarios y roles;
- login/perfil;
- contrato operativo público.

### 3. Cliente

- header y navegación;
- UI/UX en Chromium;
- accesibilidad;
- SEO dinámico;
- viewports canónicos;
- geometría responsive;
- búsqueda y navegación.

### 4. Super Admin

- fundamentos y sincronización Admin ↔ público;
- contenido y apariencia;
- correo/mensajería;
- analítica;
- editor visual;
- barrido visual de todas las secciones Admin/Super Admin en múltiples viewports;
- ajuste global de páginas y panel.

La auditoría visual del panel usa estados controlados y no necesita escribir datos reales para comprobar geometría, secciones, diálogos y responsive.

### 5. Performance y fluidez

- rendimiento y regresiones;
- carga inicial/loader;
- caché/versionado;
- pruebas Playwright de performance pública y del acceso Admin.

### 6. Seguridad

- auditoría general de seguridad;
- CSP;
- App Check;
- aislamiento de login/sesión;
- regresiones Firebase Auth/Cloudinary;
- `npm audit` de dependencias utilizadas en producción.

### 7. Firestore Rules

- matriz crítica mediante emulador;
- unicidad de teléfono/cuenta.

### 8. Producción real

- disponibilidad;
- rutas y redirects;
- CSP y security headers reales;
- robots/sitemaps/manifest;
- canónicas y respuestas HTTP.

## Evidencia

Cada suite escribe:

- `result.json` con estado y duración de cada check;
- `SUMMARY.md`;
- un log completo por verificación;
- capturas/reportes Playwright cuando los scripts existentes los generan.

El job final descarga las evidencias y genera:

- `RESUMEN-MAESTRO.md`;
- `diagnostico-maestro.json`;
- artifact final **diagnostico-maestro-tintin**.

También publica el resumen en la página del workflow mediante `GITHUB_STEP_SUMMARY`.

## Estados

- **PASS**: la suite produjo resultado y todos sus checks pasaron.
- **FAIL**: al menos un check automático falló.
- **NOT_VERIFIED**: la suite no pudo producir un resultado utilizable. Nunca se convierte automáticamente en PASS.
- **SKIPPED**: solo se usa para producción cuando el operador desactiva explícitamente `include_production`.

## Criterio de cierre

El workflow queda verde únicamente cuando:

- todas las suites habilitadas produjeron resultado;
- no existe ningún check automático fallido;
- producción está incluida y sana cuando se usa como auditoría final de cierre.

Un workflow verde significa que la cobertura automática definida quedó aprobada; no autoriza a afirmar que una operación manual excluida fue probada.

## Exclusiones deliberadas

### Compra real end-to-end

La automatización **no ejecuta una transacción monetaria real**. Esta verificación queda a cargo del propietario. Sí se auditan el contrato de checkout/pedido, carrito, entrega, reglas, seguridad y manejo técnico relacionado.

### Escrituras destructivas en producción

El Maestro no crea, modifica ni elimina pedidos, usuarios, inventario o configuración real únicamente para probar el sistema. Los checks que requieren reglas utilizan emuladores o mecanismos de solo lectura/aislamiento ya existentes en el repositorio.
