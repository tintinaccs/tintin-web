---
name: tintin-observability-recovery
description: "Use for diagnosing errors, user-visible failures, production monitoring, incident recovery and safe rollbacks in Tintín."
---

# Diagnóstico y recuperación
1. Antes de tocar producción, establecer gravedad y reproducibilidad usando logs, observabilidad existente y tests.
2. No pedir ni divulgar claves, datos de clientes, números de pedido ni secretos en logs.
3. Analizar si el fallo procede de red, frontend, Firestore, auth, integración o cache con evidencia concreta.
4. Respetar documentación y flujos en docs/agent/, docs/arquitectura-tecnica.md y scripts del repo.
5. Los planes de rollback son propuestas hasta recibir la autorización requerida; no borrar datos productivos.
6. Tests mínimos dirigidos; registrar impacto, causa, corrección, evidencia y riesgos remanentes.
7. Si la aplicación sigue operativa, preferir soluciones aditivas de bajo riesgo y monitorización antes que cambios amplios.
