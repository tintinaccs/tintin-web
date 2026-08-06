# Fase 8 — Usuarios, auditoría y permisos

## Super Admin

La única cuenta Super Admin es:

```text
tintinaccs@gmail.com
```

No se puede asignar `superadmin` desde un selector, bloquear esa cuenta ni eliminar su ficha.

## Roles válidos

- Admin
- Agente
- Viewer
- Cliente

Los roles desconocidos se muestran y tratan como Cliente. Una cuenta bloqueada siempre queda con rol Cliente hasta que sea restaurada.

## Usuarios

La tabla usa listeners en tiempo real y renderiza nombres, emails, teléfonos y motivos mediante `textContent`. Ningún dato de una clienta se interpreta como HTML.

Las acciones sensibles son:

- Cambiar rol.
- Bloquear.
- Restaurar.
- Eliminar la ficha de Firestore.
- Acciones masivas equivalentes.

La eliminación desde el navegador no borra la cuenta de Firebase Authentication. Esa operación requiere un backend administrativo y no está disponible en el plan Spark actual.

## Auditoría

Cada cambio de usuario y su registro de auditoría se escriben dentro del mismo `writeBatch`. Si el registro no puede guardarse, tampoco se aplica el cambio del usuario.

La auditoría es:

- Visible únicamente para Super Admin.
- Inmutable desde el panel.
- Actualizada en tiempo real.
- Renderizada como texto seguro.

## Firebase

Esta fase usa las reglas ya publicadas para `users`, `auditLog`, `rolePermissions` y carritos privados por UID. No cambia reglas, no usa Cloud Functions y no necesita Blaze ni Cloud Shell.
