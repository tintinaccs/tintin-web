# Contratos arquitectónicos de CI

Estos gates protegen la regla de autoridad única sin limitar la cantidad de superficies administrativas.

- `audit:domain-consumers`: Superadmin y Sheets deben delegar en los dominios server-side canónicos para operaciones sensibles.
- `audit:component-registry`: todo tipo nativo renderizado por Visual Builder debe existir en `VISUAL_BLOCK_TYPES`; los tipos registrados deben tener renderer explícito o pertenecer al grupo genérico permitido.
- `audit:sync-contracts`: conserva idempotencia, `changeId`, `baseChangeId`, precios canónicos y auditoría en la sincronización administrativa.
- `audit:no-duplicate-authorities`: impide que Sheets o un consumidor de UI vuelva a implementar escrituras de pedidos/inventario que correspondan al dominio canónico.

`audit:architecture-contracts` ejecuta los cuatro gates y `test:architecture-gates` prueba que las regresiones deliberadas fallen. Ambos forman parte de `audit:final`.

## Regla de extensión

Agregar una nueva superficie administrativa no crea una nueva autoridad. Debe invocar el mismo dominio que las superficies existentes. Agregar un tipo nativo de Visual Builder requiere registrarlo en el contrato compartido y proporcionar un renderer compatible; CI bloquea cualquiera de los dos lados incompletos.
