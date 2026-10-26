# Fase 5 — Continuación reconstruida y verificada en Fase 6

Este documento describe la implementación de esta continuación; no es el
informe original ausente. Procedencia y base en CONTINUIDAD-FASES-0-5.md.

Se mantiene `mountProductWorkspace`, `saveProductEditor`, CAS, snapshots por UID,
respaldo de sesión y separación `products` / `productInventory`. No hay otra
colección comercial ni escritor. Los archivos pendientes no se prometen
recuperables como bytes: se guardan sus metadatos y se pide volver a elegirlos.

Acciones principales: Cancelar y Guardar cambios. Se retira Guardar progreso;
el autoguardado privado existente sigue funcionando. Cancelar sin modificaciones
desde la apertura sale normalmente. Si se editó, incluso si ya se autoguardó,
abre un diálogo con Guardar borrador y salir / Seguir editando / Descartar cambios
y salir. Descartar es una acción explícita que cierra el workspace con el dominio
canónico y su revisión; un error deja el editor abierto. El autoguardado no
convierte cancelar en una confirmación silenciosa ni elimina el borrador.

Guardar cambios con estado Borrador conserva el workspace privado, admite
incompletos y vuelve al listado. Ya no transforma draft en active. Un producto
nuevo sólo se publica tras elegir Activo y pasar todas las validaciones del
escritor. Un producto activo conserva su versión pública durante el borrador y
aplica su edición mediante Guardar cambios con estado Activo. Archivar y reabrir
siguen siendo transiciones explícitas del mismo producto, sin borrar inventario.
Seleccionar Borrador durante una edición activa ahora conserva una revisión
privada; no retira silenciosamente el producto público. Para retirarlo se usa
Archivar. Esta diferencia frente al flujo anterior queda documentada.

Los mensajes distinguen cambios pendientes, guardando, confirmación del servidor
y error. El respaldo en sessionStorage no se anuncia como confirmación remota.
El listado conserva su paginación, distingue producto nuevo de edición pendiente
y muestra la fecha de modificación válida. No publica campos privados.

Los diálogos nativos conservan Escape y foco: los atajos globales de Productos
ceden su manejo cuando hay un dialog abierto. Se evita duplicar Cancelar en la
barra del workspace y se restaura el control original al desmontarlo.

Pruebas y pendientes actuales: MATRIZ-PRUEBAS-FINAL.md e INCIDENCIAS-PENDIENTES.md.
