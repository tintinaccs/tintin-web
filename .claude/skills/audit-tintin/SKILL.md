---
name: audit-tintin
description: Auditoría integral de Tintin en modo solo lectura, basada en evidencia y sin cambios de código.
---

# Audit Tintin

Realiza una auditoría técnica integral del repositorio sin modificar archivos.

## Alcance
Evalúa solo lo aplicable al sistema real:
- lógica y comportamiento de negocio
- arquitectura y mantenibilidad
- CRUD requerido
- Firebase/Firestore, reglas, auth y roles
- integridad de datos
- catálogo, carrito, pedidos, precios e inventario
- validaciones y manejo de errores
- seguridad
- performance
- responsive y UI/UX
- accesibilidad
- SEO
- integraciones
- configuración y preparación de producción
- tests, auditorías y CI existentes

## Método
1. Identifica primero stack, arquitectura y flujos reales.
2. Reutiliza las auditorías existentes del repositorio cuando aporten evidencia.
3. No ejecutes `audit:final` salvo que sea necesario para una auditoría final completa.
4. No reportes tecnologías o funciones como faltantes si no son necesarias.
5. No inventes hallazgos.

## Salida
Clasifica únicamente hallazgos reales como CRITICAL, HIGH, MEDIUM o LOW. Para cada problema indica en una línea: ubicación, evidencia, impacto y corrección mínima. Después lista CORRECTO y NOT APPLICABLE de forma breve.

No modifiques nada durante esta skill.
