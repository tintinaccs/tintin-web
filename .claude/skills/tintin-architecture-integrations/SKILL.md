---
name: tintin-architecture-integrations
description: "Use for changes crossing frontend, Firebase, Cloudflare, deployment configuration, APIs and third-party services in Tintín."
---

# Arquitectura e integraciones
1. Leer docs/arquitectura-tecnica.md, docs/agent/README.md y contratos afectados.
2. Antes de crear módulo nuevo, localizar implementación canónica y todos sus consumidores reales.
3. Seguir single source of truth para rutas, CSP, cache, estado de producto, roles y reglas de negocio.
4. Validar límites entre navegador, Firebase/Firestore, Cloudflare y otros servicios por configuración real, no por suposiciones.
5. No añadir dependencias/servicios/colas nuevas sin medir beneficio; conservar API contracts existentes.
6. Pruebas: npm run audit:architecture-contracts, npm run audit:domain-consumers, npm run audit:no-duplicate-authorities; sumar pruebas específicas.
7. No emitir claves ni abrir endpoints privilegiados en el cliente.
