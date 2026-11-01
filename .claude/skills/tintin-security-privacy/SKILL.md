---
name: tintin-security-privacy
description: "Use when reviewing auth, authorization, Firebase Firestore rules, CSP, secrets, input validation and user data protection in Tintín."
---

# Seguridad de ecommerce
1. Leer AGENTS.md y docs/agent/README.md. Tratar auth, pedidos, roles, cuentas, claves y Firestore como críticos.
2. Revisar reglas de autorización en servidor/Firestore: un control visual no equivale a seguridad.
3. Verificar autorización por recurso y acción, validación de entradas, XSS, CSRF cuando corresponda, CSP, rate limits y gestión de secretos.
4. No insertar tokens, credenciales, PII ni información sensible en commits, informes, consola ni cliente.
5. No bajar controles para corregir tests; no ejecutar operaciones destructivas ni despliegues por defecto.
6. Usar npm run audit:security, npm run verify:csp y pruebas específicas de reglas si el cambio afecta esas áreas.
7. Reportar evidencia concreta, severidad e impacto. No declarar vulnerabilidades hipotéticas como hallazgos verificados.
