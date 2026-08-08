# Tintin Accesorios

Tienda online y panel administrativo de Tintin Accesorios & Relojes. El sitio público se publica en Cloudflare Pages y usa Firebase Authentication/Firestore como fuente operativa; Cloudinary gestiona medios, Resend correos y Google Sheets funciona como panel sincronizado secundario.

## Desarrollo y validación

Requisitos: Node.js 22 y Java 21 para las pruebas de reglas.

```bash
npm ci
npm run audit:final
npm run test:rules-critical
npm run test:rules-phone
npm run test:pages
```

Las variables privadas se configuran en Cloudflare/Firebase; `.env.example` enumera nombres, nunca valores. `main` representa producción y los cambios deben entrar mediante Pull Request con las auditorías verdes.

## Operación

- Arquitectura: `docs/arquitectura-tecnica.md`.
- Cambios seguros: `docs/como-hacer-cambios.md`.
- Respaldo y recuperación: `docs/recuperacion-firestore.md`.
- Prueba de compra: `docs/prueba-compra-real.md`.

El código es propiedad de Tintin Accesorios. No se concede una licencia de reutilización por el hecho de que el repositorio sea visible públicamente.
