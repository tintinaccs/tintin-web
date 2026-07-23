# Política de seguridad

## Alcance mantenido

La rama soportada es `main`. Las correcciones de seguridad se preparan en ramas aisladas, pasan auditorías y se integran mediante Pull Request.

## Comunicación responsable

Los hallazgos sensibles no deben publicarse con credenciales, datos personales ni instrucciones de explotación. Deben comunicarse al responsable de Tintin mediante el canal administrativo oficial, incluyendo:

- componente afectado;
- impacto;
- pasos mínimos para reproducir;
- evidencia sin datos personales;
- propuesta de mitigación, cuando exista.

## Secretos y credenciales

Está prohibido versionar:

- claves privadas de pasarelas;
- contraseñas;
- tokens de acceso;
- cuentas de servicio de Firebase;
- archivos PEM/P12/PFX;
- secretos compartidos de webhooks;
- claves de proveedores de correo.

Los secretos pertenecen al proveedor que ejecuta el backend. `.env.example` solo contiene nombres y valores vacíos. La configuración pública del SDK web de Firebase puede estar en el frontend, pero no concede permisos por sí sola.

Cuando un secreto se expone, no basta con borrarlo del archivo: debe revocarse o rotarse y revisarse el historial.

## Controles obligatorios

- Firestore aplica denegación por defecto.
- Authentication y Firestore Rules protegen datos por identidad y rol.
- El frontend nunca decide por sí solo que un pago fue aprobado.
- Los precios, descuentos, stock y estados sensibles deben validarse en una capa confiable.
- Las acciones administrativas dejan auditoría.
- Los datos introducidos por usuarios se muestran mediante `textContent` o mecanismos equivalentes, nunca como HTML sin sanitización.
- Los archivos se validan por tipo, tamaño y destino antes de aceptarse.
- Las cuentas bloqueadas pierden capacidad operativa.
- Las rutas administrativas usan `noindex` y control de acceso real.

## App Check

`js/firebase.js` incluye el soporte para Firebase App Check. La clave pública de reCAPTCHA y la activación de enforcement se realizan en Firebase Console. El diagnóstico debe mostrar claramente `enabled` o `configuration-required`; nunca se debe fingir que está activo.

App Check complementa, pero no reemplaza, Authentication ni Firestore Rules.

## Pull Requests de seguridad

Todo cambio de permisos, reglas, pedidos, stock, pagos, correos o roles debe incluir:

- superficies afectadas;
- reglas y consultas revisadas;
- pruebas negativas y positivas;
- compatibilidad con datos existentes;
- rollback;
- validación para los roles aplicables;
- comprobación en las siete resoluciones cuando haya interfaz.

## Respuesta a incidentes

1. Contener el acceso o integración afectada.
2. Rotar credenciales comprometidas.
3. Preservar logs y evidencia.
4. Identificar el intervalo y los datos afectados.
5. Corregir en una rama aislada.
6. Ejecutar auditorías y pruebas de regresión.
7. Integrar y comprobar producción.
8. Documentar causa raíz y prevención.

No se eliminan registros de auditoría para ocultar un incidente.
