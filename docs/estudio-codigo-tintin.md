# Editor de Código Tintin

## Objetivo

El **Editor de Código Tintin** agrega al Super Panel Admin una superficie técnica separada del Editor visual seguro para inspeccionar, editar y revisar el repositorio oficial de Tintin sin convertir el navegador en una terminal ni exponer credenciales.

La fuente de verdad es GitHub. El navegador recibe archivos y estados a través de Cloudflare Pages Functions autenticadas como Super Admin. Los secretos de GitHub App, Firebase Admin y del proveedor de IA permanecen en el backend.

## Principios no negociables

1. Nunca escribir directo sobre `main`.
2. Nunca enviar un PAT, private key, installation token ni secret al navegador.
3. Toda edición se hace en una rama aislada.
4. Todo `update` o `delete` conserva y verifica el SHA base del archivo.
5. Todo commit verifica el HEAD esperado antes y justo antes de actualizar la referencia.
6. Una divergencia remota cancela el guardado; no hay sobreescritura silenciosa.
7. Los archivos de riesgo rojo requieren autenticación reciente.
8. El preview abre un deployment externo; el código modificado no se ejecuta dentro del origen Admin.
9. La IA analiza y propone. No tiene una ruta de commit, merge o deploy.
10. El merge final solo se habilita con checks y preview verdes, autenticación reciente y confirmación humana exacta dentro de Tintin.
11. Restaurar significa crear un commit nuevo desde una versión histórica. Nunca se resetea ni se borra historia.
12. El Editor visual seguro existente continúa siendo una herramienta distinta y conserva sus límites actuales.

## Etapa 1 — Base, permisos, explorador y editor

Implementado:

- Entrada `Editor de Código` solo para la cuenta Super Admin ya autenticada.
- Autoridad real en servidor mediante `requireSuperAdmin()`.
- GitHub App exclusiva de backend.
- Estado del repositorio, SHA de `main` y protección informada por GitHub.
- Explorador progresivo: la raíz carga primero y cada carpeta se consulta al expandirse.
- Búsqueda global mediante GitHub Code Search.
- Lectura de archivos con SHA.
- Pestañas, estado `dirty`, riesgo por archivo y shortcuts.
- Monaco Editor `0.52.2` empaquetado localmente durante `build:pages`; el Super Admin no depende de un CDN. No se agregó `unsafe-eval`, `unsafe-inline` ni una relajación nueva de CSP. Si Monaco no puede inicializarse, el Estudio cae a un editor de texto seguro y mantiene el flujo de GitHub.
- Marcadores de lenguaje, minimapa, folding y navegación provista por los language services que Monaco soporte para el tipo abierto.

## Etapa 2 — Edición, commits, diff, PR y checks

Implementado:

- Creación de rama desde un SHA esperado de `main`.
- Alta, modificación, renombre/movimiento y eliminación preparados localmente.
- Commit multiarchivo mediante Git Data API:
  1. revalidar HEAD de la rama;
  2. revalidar SHA base de cada archivo;
  3. crear blobs;
  4. crear tree sobre el tree padre;
  5. crear commit;
  6. revalidar HEAD;
  7. actualizar ref con `force: false`.
- Diff local con Monaco Diff Editor cuando está disponible.
- Diff remoto `main...rama` antes y después del commit.
- Pull Request desde la rama hacia `main`.
- Lectura de Check Runs reales de GitHub.
- Conflictos `409` preservan los buffers locales.

## Etapa 3 — Preview, historial, rollback y sincronización

Implementado:

- Estado de deployments por SHA.
- Preview abierto en una pestaña/origen independiente mediante `environment_url` informado por GitHub/Cloudflare.
- Historial por rama y opcionalmente por archivo.
- Restauración desde un commit anterior como un **nuevo commit reversible**.
- Webhook GitHub con HMAC SHA-256 y deduplicación por `X-GitHub-Delivery`.
- Eventos almacenados por el backend en `codeStudioEvents` y transmitidos por un stream SSE autenticado, con snapshots, heartbeat y reconexión.
- Reconciliación periódica del estado GitHub para detectar cambios externos aunque un webhook se retrase o falle.
- Las colecciones `codeStudioEvents` y `codeStudioAudit` no tienen reglas explícitas de cliente: quedan alcanzadas por el `match /{document=**} { allow read, write: if false; }` final de Firestore. La cuenta de servicio backend es la única que las usa.

### Publicación

El Estudio muestra PR, checks, preview y estado de despliegue, y permite la aprobación humana final sin salir de Tintin. El backend vuelve a validar PR, rama, SHA, checks y preview; exige una sesión reciente y la frase exacta `MERGEAR #<número>`. La IA no recibe esta capacidad y no puede aprobar su propio trabajo.

## Etapa 4 — Mapa de conexiones e impacto

Implementado de forma progresiva y basada en evidencia.

El mapa analiza los archivos abiertos/seleccionados y crea nodos y relaciones cuando puede demostrar una señal concreta:

- `import`/`export from` literal → relación de archivo confirmada;
- `fetch()` con URL literal → API/servicio llamado confirmado;
- `collection(db, '...')` literal → colección Firestore confirmada;
- clases y funciones → píldoras navegables con archivo y línea exacta;
- llamada a un símbolo con nombre único entre los archivos analizados → relación probable entre funciones;
- URL HTTPS literal de un host allowlisted → enlace navegable fuera del Admin;
- paquetes/servicios externos → informacional si el import no representa un archivo local resoluble.

Cada relación conserva archivo, línea, tipo y clase de evidencia: `confirmed`, `probable` o `informational`. Al pulsar una píldora local, Monaco abre el archivo y revela la línea; una URL o colección abre únicamente una consola HTTPS allowlisted. No se inventan conexiones para completar el gráfico. El análisis crece abriendo más archivos, evitando descargar el repositorio entero al navegador.

## Etapa 5 — Asistente IA

Implementado como capacidad opcional y fail-closed.

Variables:

- `CODE_STUDIO_AI_ENDPOINT`
- `CODE_STUDIO_AI_TOKEN`
- `CODE_STUDIO_AI_MODEL`
- `CODE_STUDIO_AI_ALLOWED_HOSTS`

El endpoint debe ser HTTPS y su hostname debe aparecer explícitamente en la allowlist. El backend entrega como contexto máximo 12 archivos abiertos provenientes de GitHub y sus SHAs.

El prompt de sistema obliga al asistente a:

- distinguir evidencia de hipótesis;
- no inventar archivos, pruebas o resultados;
- no revelar secretos;
- no sugerir evasión de permisos, CSP, checks o autenticación;
- entregar diagnóstico, propuesta, impacto, pruebas y rollback;
- devolver JSON estructurado y, si propone cambios, el contenido completo de cada archivo existente con su SHA base;
- declarar cuando falta evidencia;
- no aprobar, fusionar, desplegar ni publicar.

## Configuración de GitHub App

Crear una GitHub App para esta función e instalarla únicamente en `tintinaccs/tintin-web`.

Permisos recomendados mínimos:

| Permiso | Nivel | Motivo |
| --- | --- | --- |
| Metadata | Read | Identidad del repositorio |
| Contents | Read & write | árbol, archivos, blobs, trees, commits y ramas |
| Pull requests | Read & write | crear y consultar PR |
| Checks | Read | estado de validaciones |
| Actions | Read | observabilidad de workflows si se amplía el centro GitHub |
| Deployments | Read | estado y URL de preview/deploy |

No conceder `Actions: write` salvo que una necesidad futura se diseñe y audite de forma separada.
No otorgar a la GitHub App bypass de las reglas de protección de `main`: el endpoint valida estados y GitHub debe seguir haciendo cumplir la protección como segunda barrera.

Eventos de webhook útiles:

- Push
- Pull request
- Check run
- Check suite
- Workflow run
- Deployment
- Deployment status

Webhook:

`https://<dominio-admin>/api/code-studio/webhook/github`

Guardar el mismo secreto HMAC en `CODE_STUDIO_GITHUB_WEBHOOK_SECRET` dentro de Cloudflare.

## Variables Cloudflare

Configurar como **secrets/variables del proyecto**, nunca dentro del repositorio:

```text
CODE_STUDIO_GITHUB_APP_ID
CODE_STUDIO_GITHUB_INSTALLATION_ID
CODE_STUDIO_GITHUB_APP_PRIVATE_KEY
CODE_STUDIO_GITHUB_REPOSITORY=tintinaccs/tintin-web
CODE_STUDIO_GITHUB_WEBHOOK_SECRET
CODE_STUDIO_FIREBASE_PROJECT_ID=tintin-accesorios
CODE_STUDIO_EXTERNAL_ALLOWED_HOSTS=console.firebase.google.com,dash.cloudflare.com,github.com,docs.github.com,tintinaccesorios.pages.dev
```

El registro de auditoría y la deduplicación de webhooks reutilizan `FIREBASE_SERVICE_ACCOUNT_KEY`, que ya es el mecanismo backend usado por otras funciones administrativas del proyecto.

## Riesgo por archivo

- `green`: documentación u otros archivos sin código ejecutable sensible.
- `yellow`: código/HTML/CSS/configuración ordinaria.
- `orange`: Functions, Cloudflare, scripts, package files y entradas centrales de Admin.
- `red`: autenticación, reglas, workflows, rutas/headers/CSP, checkout/pagos y módulos de seguridad.

Los archivos bloqueados incluyen `.env`, `.dev.vars`, `.git`, `node_modules`, artifacts, service accounts, private keys, credentials y rutas de secretos. También se bloquea traversal `..`, backslashes y rutas inválidas.

## Auditoría

Las operaciones backend registran de forma saneada cuando corresponde:

- UID y email del actor autenticado;
- acción;
- rama;
- commit SHA;
- archivos;
- riesgo;
- resultado;
- detalle limitado;
- fecha.

El saneamiento elimina patrones de token, secret, private key y authorization. El contenido completo de archivos y secretos no se guarda en el audit log.

## CI del módulo

`.github/workflows/validar-estudio-codigo.yml` ejecuta para cambios relevantes:

1. `node --test tests/code-studio/*.test.mjs`
2. `npm run sync:monaco` y verificación del loader local
3. `npm run audit:names`
4. `npm run verify:routes`
5. `npm run verify:csp`
6. `npm run audit:security`
7. `npm run audit:admin-foundation`
8. `npm run test:visual-builder`

No se afirma que una prueba pasó hasta que GitHub Actions reporte su resultado.

## Flujo operativo final

```text
Super Admin
  ↓
Editor de Código
  ↓
GitHub oficial (lectura)
  ↓
rama aislada desde SHA esperado
  ↓
edición local + diff
  ↓
commit atómico con SHA base
  ↓
Pull Request
  ↓
checks reales
  ↓
preview Cloudflare por SHA
  ↓
REVISIÓN HUMANA
  ↓
merge desde Tintin mediante GitHub App
  ↓
deploy/verificación
```

Ante un error posterior, el historial y la restauración permiten producir un nuevo commit que devuelve uno o varios archivos a una versión anterior sin destruir trazabilidad.
