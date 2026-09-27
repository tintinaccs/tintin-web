# Estado actual de reparación

> Este archivo es un registro operativo, no una certificación permanente. Debe actualizarse con el SHA/rama que realmente se verificó. No heredar PASS de auditorías históricas.

## Baseline

- Rama: `chore/agent-repair-protocol`
- Base inicial: `main`
- Baseline observado al crear esta fase: `53eb4d8f4bfb672345b55b44e355c9f80ca507da`
- Objetivo actual: instalar el protocolo de agentes y la matriz de aceptación.
- Producción: no modificada.
- Merge: no realizado.

## Estado de la matriz

Todas las áreas funcionales comienzan en `PENDING` para este protocolo hasta que sean verificadas contra el commit correspondiente. Los estados verdes de documentos fechados anteriores son evidencia histórica, no PASS automático.

| Dominio | Estado | Evidencia / siguiente paso |
| --- | --- | --- |
| Protocolo de agentes | IN_PROGRESS | Crear documentos, enlazar AGENTS/CLAUDE y revisar diff |
| Build y estructura | PENDING | Verificar en fase de reparación |
| Home/shell | PENDING | Verificar |
| Catálogo/colecciones/producto | PENDING | Verificar |
| Carrito/checkout/pedidos/pagos | PENDING | Verificar |
| Login/sesión/perfil | PENDING | Verificar |
| Roles/Super Admin | PENDING | Verificar |
| Firestore/App Check | PENDING | Verificar |
| Integraciones | PENDING | Verificar |
| CSP/rutas/caché/diagnóstico | PENDING | Verificar |
| Responsive/a11y/performance/SEO | PENDING | Verificar |
| Correos/notificaciones | PENDING | Verificar |
| Producción | NOT_VERIFIED | No se modifica ni se asume sana por esta fase |
| Recuperación | PENDING | Verificar contratos/workflows |

## Hallazgos estructurales de Fase 1

- Existe amplia cobertura automática; no crear suites paralelas sin demostrar un hueco.
- `audit:final` debe ser gate amplio, no bucle de edición.
- Los informes fechados de raíz y cierres anteriores son históricos.
- La documentación vigente contiene algunas referencias operativas antiguas; corregir deriva documental de forma quirúrgica cuando se confirme.
- El protocolo debe mantener separados PASS local, CI y producción.

## Bloqueos

Ninguno para instalar este protocolo.

## Próximo paso

Terminar esta fase, revisar el diff y luego usar esta matriz para una reparación integral en una rama de trabajo, sin merge/deploy automático.
