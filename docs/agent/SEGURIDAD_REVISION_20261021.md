# Revisión de seguridad acotada — 21/10/2026

Codex /root. Base e96eea9300ec6c2be9aa7a1a73b4aba4618f8823. Revisión de sólo lectura, sin cambios de permisos ni datos productivos. No certifica invulnerabilidad.

CORRECT: revisión de límites de confianza en Firestore Rules, verificación criptográfica RS256/issuer/audience/exp/email_verified en servidor, guardas de Super Admin y usuarios bloqueados, permisos de pedidos, validación de precios desde Firestore, CSP por ruta y cuotas compartidas con fallo cerrado. Sin hallazgos CRITICAL/HIGH demostrados en este alcance.

Evidencia nueva: auditorías security/phase6 aprobadas;56 pruebas de seguridad/roles/contenido/routers aprobadas y61 de tokens/checkout/pagos/identidad aprobadas. Emulador Firestore propio, loopback8080, demo-tintin-critical:200 ataques/controles del script canónico aprobados, CLI0 y emulador detenido. Primer intento con ruta de configuración inválida no ejecutó la suite; se corrigió sólo la configuración local y el intento final sí la ejecutó. Auditoría de cabeceras de producción aprobada. npm audit del lock vigente devolvió0 advisories conocidos en671 dependencias. Un primer intento Node falló por parse5 ausente en el checkout nuevo: las56 pruebas se repitieron completas usando las dependencias existentes y aprobaron. Logs privados en artifacts/.

NOT_VERIFIED: igualdad de las reglas desplegadas en Firebase con el archivo revisado; IAM/MFA/recuperación de cuentas de proveedor; todos los endpoints e integraciones desplegados; pentest completo autenticado y resistencia a carga hostil. La revisión de código y los fixtures no sustituyen estas comprobaciones. PayPal real continúa desactivado/sandbox. Las API keys públicas de Firebase no se clasifican por sí mismas como secretos. No se extrajeron credenciales ni datos de clientes.

Conclusión: hay defensas y pruebas concretas que aprobaron; no existe evidencia suficiente para prometer seguridad de pies a cabeza ni100%. No se inventan vulnerabilidades para llenar pendientes.
