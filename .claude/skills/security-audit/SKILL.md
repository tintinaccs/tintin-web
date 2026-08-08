---
name: security-audit
description: Auditoría de seguridad de Tintin enfocada en riesgos reales de Firebase, Firestore, auth, roles, datos e integraciones.
---

# Security Audit

Audita seguridad en modo solo lectura salvo que el usuario pida explícitamente corregir.

## Revisar cuando aplique
- autenticación y sesiones
- autorización y separación usuario/admin
- Firestore Security Rules
- exposición de datos y privilegios
- validación y normalización de entradas
- secretos, tokens y configuración sensible
- acciones administrativas
- integridad de pedidos, precios e inventario
- carga de archivos y contenido externo
- CORS, headers y navegador cuando existan
- dependencias e integraciones externas relevantes

## Reglas
- No debilites controles para hacer pasar pruebas.
- No marques riesgos teóricos sin evidencia concreta.
- No propongas infraestructura de seguridad que el proyecto no necesite.
- Prioriza límites de confianza y controles del lado servidor/reglas.
- Usa las auditorías y tests de seguridad existentes antes de crear comprobaciones duplicadas.

## Salida
Ordena por CRITICAL, HIGH, MEDIUM y LOW. Para cada hallazgo: ubicación, evidencia, impacto y corrección mínima recomendada. Indica brevemente los controles críticos que ya están correctos.
