# Plan de respaldo y recuperación

## Objetivo

Mantener una recuperación comprobable del código y una guía operativa para los servicios externos, sin guardar credenciales ni datos sensibles en Git.

## Cobertura

- Repositorio Git completo: historial, ramas y tags.
- GitHub Actions, GitHub Pages y configuración versionada.
- Firebase y Firestore.
- Cloudinary u otros proveedores de imágenes.
- Cloudflare, correo y dominio.
- Variables de entorno y secretos, solo como inventario de nombres y ubicación segura.

## Política inicial

| Activo | Frecuencia | Retención mínima | Ubicación |
| --- | --- | --- | --- |
| Bundle Git automatizado | Semanal | 30 días | Artefacto temporal de GitHub Actions |
| Bundle Git cifrado | Mensual y antes de cambios de alto riesgo | 12 meses | Almacenamiento externo independiente |
| Release estable | Después de una reorganización o entrega importante | Indefinida | GitHub Releases |
| Firestore | Diaria o según volumen operativo | 30 días | Bucket distinto del entorno productivo |
| Imágenes originales | Semanal | Mientras estén activas más 90 días | Segunda ubicación independiente |

El artefacto de GitHub Actions mejora la recuperación, pero no cuenta como copia independiente porque permanece dentro del mismo proveedor. La copia mensual cifrada debe guardarse fuera de GitHub.

## Comandos del repositorio

Crear un bundle completo:

```bash
node scripts/crear-respaldo-repositorio.mjs
```

Verificar el bundle más reciente y simular una restauración:

```bash
node scripts/verificar-respaldo-repositorio.mjs
```

Verificar un archivo específico:

```bash
node scripts/verificar-respaldo-repositorio.mjs respaldos/tintinaccs-tintin-web-FECHA.bundle
```

Cada ejecución genera:

- un archivo `.bundle` con todas las referencias disponibles;
- un checksum SHA-256;
- un manifiesto JSON con fecha, commit principal y referencias incluidas.

## Copia externa independiente

1. Ejecutar el creador de respaldo desde un clon actualizado.
2. Verificar la restauración con el segundo comando.
3. Cifrar el bundle, el checksum y el manifiesto con la herramienta aprobada por la propietaria.
4. Copiar el archivo cifrado a una ubicación que no dependa de GitHub ni del equipo principal.
5. Registrar fecha, ubicación, checksum y responsable sin anotar contraseñas.
6. Eliminar del equipo local cualquier copia temporal sin cifrar cuando termine la transferencia.

## Recuperación del código

1. Descargar el bundle y su checksum.
2. Comparar el SHA-256 antes de utilizarlo.
3. Ejecutar `git bundle verify`.
4. Clonar el bundle en una carpeta nueva.
5. Ejecutar `git fsck --full`.
6. Confirmar `main`, el tag estable y el commit esperado.
7. Crear un repositorio nuevo o restaurar el remoto solo después de verificar el contenido.
8. Ejecutar las auditorías del proyecto antes de publicar.

## Firestore

- Configurar exportaciones periódicas hacia un bucket separado de producción.
- Conservar una política de retención y acceso mínimo.
- Probar una restauración en un proyecto o base de datos no productiva.
- Comparar conteos y muestras de productos, pedidos, usuarios, configuraciones y permisos.
- Nunca ensayar una importación directamente sobre producción.

## Imágenes

- Mantener un inventario de originales y URLs activas.
- Respaldar el archivo original, no solo la URL transformada.
- Conservar identificador público, carpeta, formato, dimensiones y relación con el producto o contenido.
- Probar periódicamente la recuperación de una muestra.

## Variables y credenciales

El repositorio solo debe documentar:

- nombre de la variable;
- servicio que la utiliza;
- entorno;
- persona responsable;
- ubicación del gestor seguro;
- fecha de última rotación.

Nunca deben registrarse valores, tokens, contraseñas, claves privadas ni códigos de recuperación.

## Objetivos de recuperación iniciales

- Código: recuperación comprobable en menos de 60 minutos.
- Configuración versionada: recuperación junto con el código.
- Firestore: restauración de muestra en menos de 4 horas.
- Imágenes: recuperación de una muestra en menos de 8 horas.

Estos tiempos se consideran objetivos operativos iniciales y deben ajustarse después de la primera prueba real.

## Criterio de cierre de una prueba

Una prueba se considera válida cuando:

- el checksum coincide;
- el bundle pasa `git bundle verify`;
- el repositorio restaurado pasa `git fsck --full`;
- `main` puede abrirse en el commit esperado;
- las auditorías del proyecto terminan correctamente;
- el tiempo real y cualquier incidencia quedan documentados.
