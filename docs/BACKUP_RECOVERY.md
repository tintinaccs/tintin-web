# Copias de seguridad y recuperación

## Objetivo

Asegurar que un cambio de código, una edición masiva o un error operativo no conviertan una incidencia recuperable en pérdida permanente.

## Activos cubiertos

- Código e historial Git.
- Configuración de GitHub Actions y GitHub Pages.
- Firestore: productos, colecciones, usuarios, carritos, pedidos, configuración, permisos, contenido, auditoría y registros operativos.
- Reglas e índices de Firebase.
- Imágenes y referencias de medios.
- Configuración y plantillas de correo.
- Integraciones externas documentadas.

## Antes de un cambio de alto riesgo

Se considera de alto riesgo cualquier cambio masivo de productos, pedidos, usuarios, roles, reglas, inventario, precios, promociones, imágenes o configuración global.

1. Identificar colecciones y documentos afectados.
2. Exportar los datos mediante el mecanismo disponible y verificar que el archivo puede abrirse.
3. Registrar fecha, responsable, versión y alcance.
4. Crear rama y punto de reversión en Git.
5. Definir cómo se detectará una ejecución parcial.
6. Definir cómo se revertirá sin duplicar stock, correos o pedidos.

No se considera respaldo un archivo que nunca fue revisado ni una copia guardada en el mismo lugar que el original.

## Código y despliegue

- `main` representa producción.
- Cada integración conserva un commit identificable.
- Ante una regresión se revierte el Pull Request o se restaura el último commit estable.
- El workflow de Pages debe publicar un árbol atómico ya verificado.
- No se corrige una emergencia acumulando parches directos sin registrar causa raíz.

## Firestore

### Recuperación de cambios puntuales

Usar historial de auditoría, exportaciones administrativas y documentos afectados para restaurar únicamente el alcance necesario.

### Recuperación de cambios masivos

1. Bloquear temporalmente la acción que continúa modificando datos.
2. Conservar evidencia y logs.
3. Determinar qué documentos se modificaron y cuáles quedaron sin tocar.
4. Restaurar por lotes pequeños y verificables.
5. Recalcular integridad de stock, totales y contadores.
6. Ejecutar auditorías y comparar muestras antes de reabrir la operación.

### Reglas

Las reglas versionadas se restauran desde Git y se despliegan mediante el comando documentado. Antes de publicar reglas nuevas se ejecutan pruebas positivas y negativas con Emulator Suite cuando el cambio afecta permisos críticos.

## Pedidos e inventario

- Los pedidos no se reconstruyen a partir del catálogo actual: conservan sus datos históricos.
- Una cancelación o eliminación debe restaurar stock una sola vez.
- Los reintentos deben reconocer operaciones ya aplicadas.
- Un resultado parcial debe quedar visible para continuar o revertir de forma segura.

## Imágenes

- Las referencias activas se inventarían antes de eliminar archivos.
- No se elimina un recurso utilizado por productos, colecciones, contenido, correos o páginas.
- La restauración debe conservar URL, orden, texto alternativo y relación con el documento consumidor.

## Incidente de credenciales

1. Revocar o rotar inmediatamente.
2. No limitarse a borrar el valor del repositorio.
3. Revisar historial, logs y accesos durante el intervalo de exposición.
4. Actualizar proveedores y variables privadas.
5. Confirmar que el frontend no conserva copias.

## Prueba de restauración

Al menos periódicamente y después de cambios estructurales se debe ejecutar una prueba controlada:

- seleccionar una muestra no productiva;
- exportar;
- restaurar en un entorno separado;
- verificar conteos, relaciones y permisos;
- documentar tiempo, problemas y resultado.

## Criterio de cierre

Una recuperación termina cuando:

- la causa quedó contenida;
- los datos recuperados fueron verificados;
- no existen duplicados ni operaciones parciales ocultas;
- las auditorías están verdes;
- producción fue comprobada;
- el incidente y la prevención quedaron documentados.
