# Inventario de recuperación de servicios

Este documento registra qué debe recuperarse y dónde verificarlo. No debe contener secretos, contraseñas, tokens ni códigos de recuperación.

| Servicio | Activos críticos | Responsable | Método de recuperación | Copia externa | Última prueba | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| GitHub | Código, historial, ramas, tags, Releases, Actions y Pages | Propietaria de Tintin | Snapshot, Release y bundle verificado | Pendiente | Pendiente | En preparación |
| Firebase | Proyecto, reglas, índices, Authentication y configuración | Propietaria de Tintin | Consola Firebase y configuración versionada | Pendiente | Pendiente | Requiere revisión manual |
| Firestore | Productos, colecciones, usuarios, pedidos, configuración y auditoría | Propietaria de Tintin | Exportación administrada y restauración en entorno separado | Pendiente | Pendiente | Requiere configuración |
| Cloudinary / imágenes | Originales, identificadores públicos, carpetas y URLs activas | Propietaria de Tintin | Exportación o copia de originales | Pendiente | Pendiente | Requiere inventario |
| Cloudflare | DNS, reglas, Workers/Pages y acceso de cuenta | Propietaria de Tintin | Exportación de configuración y recuperación de cuenta | Pendiente | Pendiente | Requiere revisión manual |
| Correo | Cuenta, remitentes, plantillas y registros DNS | Propietaria de Tintin | Recuperación del proveedor y copia de configuración | Pendiente | Pendiente | Requiere revisión manual |
| Dominio | Registrador, DNS, renovación y contactos | Propietaria de Tintin | Recuperación del registrador y códigos de cuenta | Pendiente | Pendiente | Requiere revisión manual |

## Variables y credenciales

Registrar únicamente metadatos, nunca valores reales.

| Nombre de variable | Servicio | Entorno | Ubicación segura | Responsable | Última rotación |
| --- | --- | --- | --- | --- | --- |
| Pendiente de completar | Pendiente | Producción | Gestor seguro externo | Propietaria de Tintin | Pendiente |

## Revisión manual de cuentas

- [ ] GitHub: 2FA o passkey activa.
- [ ] GitHub: códigos de recuperación guardados fuera del equipo principal.
- [ ] GitHub: Apps, webhooks, secretos y permisos revisados.
- [ ] GitHub: secret scanning y push protection confirmados.
- [ ] Google/Firebase: 2FA o passkey activa.
- [ ] Google/Firebase: métodos de recuperación actualizados.
- [ ] Cloudflare: 2FA o passkey activa.
- [ ] Cloudflare: códigos de recuperación guardados de forma segura.
- [ ] Correo principal: 2FA y correo/teléfono de recuperación actualizados.
- [ ] Registrador del dominio: 2FA, renovación automática y contacto vigente.

## Registro de pruebas

| Fecha | Activo | Entorno de prueba | Resultado | Tiempo real | Evidencia | Responsable |
| --- | --- | --- | --- | --- | --- | --- |
| Pendiente | Código | Carpeta temporal aislada | Pendiente | Pendiente | Log del verificador | Propietaria de Tintin |
| Pendiente | Firestore | Proyecto o base no productiva | Pendiente | Pendiente | Conteos y muestra verificada | Propietaria de Tintin |
| Pendiente | Imágenes | Carpeta temporal | Pendiente | Pendiente | Muestra restaurada | Propietaria de Tintin |

## Regla de seguridad

Si una recuperación requiere copiar una clave, contraseña o token dentro de este archivo, el procedimiento es incorrecto. Solo debe anotarse el nombre de la credencial y la ubicación del gestor seguro donde está almacenada.
