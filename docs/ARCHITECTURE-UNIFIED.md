# Arquitectura unificada de Tintin Web

Este documento define la dirección obligatoria de dependencias, las autoridades por dominio y las reglas de flujo para evitar implementaciones paralelas o contradictorias.

## Principio rector

Cada dato o decisión crítica tiene una sola autoridad. Las páginas y componentes consumen esa autoridad; no reinterpretan por su cuenta el estado de autenticación, perfil, carrito, pedidos, navegación o configuración.

## Dirección de dependencias

```text
pages / UI
   ↓
domains
   ↓
core / infrastructure
   ↓
Firebase / Cloudflare / Apps Script
```

Una capa inferior nunca depende de una página, selector DOM específico ni flujo visual concreto.

## Autoridades

| Dominio | Autoridad | Consumidores |
| --- | --- | --- |
| Sesión | `js/core/auth/coordinador-sesion.js` | navegación, perfil, carrito, checkout, admin |
| Navegación autenticada | `js/core/auth/navegacion-autenticacion.js` | login, guards y destinos posteriores |
| Roles/permisos | `js/core/auth/permisos-roles.js` + `roles.js` | admin y superficies protegidas |
| Perfil | `js/core/store/perfil-usuario.js` y contrato de perfil | login, perfil, checkout |
| Carrito | sincronizador/servicio canónico de carrito | header, tienda, checkout |
| Pedidos | servicio de pedidos + cliente API autorizado | checkout, historial, admin |
| Productos/inventario | modelo/estado de productos canónico | tienda, checkout, admin |
| Contenido | contrato/esquema de contenido | páginas públicas y editor |
| Configuración | configuración pública canónica | todas las superficies públicas |

## Estados explícitos

Ningún consumidor debe interpretar `null`, arrays vacíos o ausencia momentánea como estado definitivo mientras una dependencia se restaura.

### Sesión

- `loading`
- `guest`
- `authenticated`
- `error`

### Perfil

- `loading`
- `incomplete`
- `complete`
- `error`

### Carrito

- `loading`
- `ready`
- `syncing`
- `error`

## Flujo de acceso a checkout

```text
Usuario solicita checkout
        ↓
SessionCoordinator listo
        ↓
¿authenticated?
   ├─ no → login + destino solicitado=/checkout
   └─ sí
        ↓
Perfil canónico listo
        ↓
¿complete?
   ├─ no → completar perfil + destino solicitado=/checkout
   └─ sí
        ↓
Carrito canónico listo
        ↓
¿items > 0?
   ├─ no → carrito/tienda
   └─ sí → checkout
```

Checkout coordina el flujo, pero no vuelve a implementar autenticación, completitud de perfil ni selección de identidad del carrito.

## Reglas obligatorias

1. Ninguna página pública puede decidir sesión leyendo `auth.currentUser` antes de que el coordinador declare la sesión lista.
2. Ninguna página puede calcular de manera independiente si un perfil está completo.
3. Ninguna superficie puede decidir el carrito activo leyendo directamente una clave de identidad propia.
4. Los clientes HTTP deben normalizar errores de infraestructura; las páginas no deben conocer peculiaridades de Apps Script.
5. Los reintentos de creación de pedido conservan el mismo `requestId`.
6. Los eventos son notificaciones, no fuentes de verdad.
7. Todo código generado debe identificar fuente y comando de regeneración.
8. Toda compatibilidad legacy debe indicar motivo y condición de eliminación.
9. Los scripts inline críticos deben reducirse progresivamente a entrypoints externos para disminuir acoplamiento con CSP.
10. Las auditorías deben verificar contratos de arquitectura; no crear una segunda implementación del comportamiento que auditan.

## Organización de HTML

Las páginas largas deben usar encabezados de sección estables, por ejemplo:

```html
<!-- =========================================================
     HEADER / NAVIGATION
========================================================= -->
```

Los encabezados describen bloques funcionales grandes. No se agregan comentarios redundantes a cada línea.

## Organización de JavaScript

Los archivos deben tener una responsabilidad principal. Cuando un archivo necesite coordinar varias partes, las secciones deben indicar responsabilidades y delegar el comportamiento a servicios de dominio.

## Criterio de finalización

La normalización se considera completa cuando:

- cada flujo crítico tiene una sola autoridad;
- los consumidores no contienen implementaciones alternativas del mismo contrato;
- las dependencias siguen la dirección UI → dominio → core;
- las rutas login → perfil → carrito → checkout → pedido son determinísticas;
- los contratos de arquitectura fallan en CI si reaparece una autoridad duplicada;
- las pruebas de navegador cubren los principales handoffs entre páginas.
