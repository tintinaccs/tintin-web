# Preparación sin activar dominio — 11 octubre 2026

Codex /root. Instrucción vigente: preparar y verificar, sin migrar URL/DNS. Base main `64cc48ce8e852d40abe0d176494a7d436d54c0ce` (#1105). El PR #1101 sigue borrador NO MERGE; #929 excluido.

## Código preparado

El borrador anterior se reconcilia mediante merge normal con main. Se usa el árbol de main como fuente para conservar importador/Sheets, monitor report-only, factura móvil, ticket confirmado, diseño responsive y disponibilidad por variante; luego se reaplica únicamente el destino desde config/public-site.json mediante los generadores canónicos. El origen definitivo existe sólo en este borrador, no en main ni en producción. Las referencias inmutables nuevas usan el prefijo vigente de main más -domain-prepared-20261011-4:317 assets,64 cargas dinámicas y seis entradas históricas conservadas;108 assets cambian por origen/cascada.

PASS_LOCAL observado: build/caché/CSP/diagnóstico;17 controles del auditor de preparación de dominio; autoridad/consumidores del dominio;3 contratos de redirects Shopify. También PASS_LOCAL:15 controles UI/UX, diagnóstico y27 controles Maestro; release version interna alineada a su URL inmutable nueva. CI nueva PENDING hasta verificar el SHA del merge de reconciliación. No se hereda la CI antigua del borrador.

## Verificación externa de sólo lectura

Observada 2026-10-12T01:46:55Z (11 octubre local). DNS público: NS leo/gemma Cloudflare, A23.227.38.65, AAAA2620:127:f00f:5:: y www→shops.myshopify.com. Apex/www responden HTTPS200 con marcado Shopify. El tráfico continúa en Shopify. La zona/cuenta Pages y el certificado futuro de Pages no están acreditados por estas lecturas.

Firebase Identity Toolkit confirma autorizados tanto tintinaccs.com como www.tintinaccs.com, además de pages.dev/locales. Esto NO certifica el redirect OAuth registrado ni el desafío App Check. DNS de correo observado: send MX prioridad10 feedback-smtp.sa-east-1.amazonses.com, SPF amazonses, DMARC p=none y TXT DKIM resend._domainkey presente. Son consultas de nombres conocidos, no un export completo de zona. No se modifica correo.

Main #1104: CI38191556590 y salud38191556560 SUCCESS sobre ee04a188; la segunda comprueba artefacto exacto y controles públicos. El desafío real App Check sigue NOT_VERIFIED por throttling de reCAPTCHA en el runner; no acredita una compra autenticada. Backup Firestore38135334540 SUCCESS observado; restore remoto aislado no ejecutado.

## Pendientes concretos

| Requisito | Estado | Qué falta |
| --- | --- | --- |
| Zona completa/Pages misma cuenta/Custom Domain | BLOCKED | Acceso autenticado de lectura a Cloudflare, export completo y configuración del proyecto. No agregar Custom Domain porque cambia tráfico. |
| Redirect OAuth exacto /__/auth/handler | BLOCKED | Acceso de lectura a clientes OAuth del proyecto tintin-accesorios. |
| Hosts reCAPTCHA Enterprise/App Check | BLOCKED | Acceso a configuración de la clave y desafío real autorizado. |
| Search Console | BLOCKED | Acceso a la propiedad y estado de verificación. TXT público presente no certifica propiedad; sitemap se envía después del corte. |
| Sheets/Firestore y QA comercial | BLOCKED | Sesiones Admin/Sheets y entorno de prueba aislado; verificar paridad/catálogo/medios y flujos privados. No fabricar compras, stock ni emails en producción. |
| Restore aislado / MFA | BLOCKED | Identidad GCP y proyecto/base de ensayo; no activar enforcement ni restaurar sobre producción. |

El runtime de esta tarea reporta red enforced/unrestricted y observaciones actuales, sin secretos, variables ni identidades externas configurados; no hay sesiones documentales conectadas. Se solicitaron pestañas de Cloudflare y Google Cloud. Una sesión abierta en el navegador no conecta por sí sola las credenciales al executor. No se leen ni copian cookies/passwords. La autenticación y el acceso deben comprobarse por herramientas admitidas, nunca inferirse de una pestaña.

## Mantener pausado

Sin merge de #1101/#929, Custom Domain, redirect de host pages.dev, DNS writes, publicación de cutover, envío de sitemap, altas comerciales, pedidos/cobros/emails ni alteración de App Check/MFA. Antes del corte futuro se requerirán acceso/configuración verificados, aceptación comercial, CI del SHA definitivo y decisión del propietario. Rollback del runbook conserva datos y correo y restaura únicamente web/origen.

Comprobación tras el aviso de autenticación del propietario: environment_status vuelve a reportar observaciones actuales y cero secretos/variables/identidades; document-control vuelve sin sesiones y no hay herramientas de Chrome/browser. El login local del propietario no acredita acceso autenticado desde esta tarea.

CI38193911315 de f3aecdb7 aprobó build/drift/preflight y falló una aserción literal que exigía el tag antiguo de origen-funciones en los imports de notificaciones Admin. Se conserva el control de URL completa pero se consulta el registro canónico de versiones; las dos pruebas focalizadas pasan. La CI del siguiente SHA debe verificarse de nuevo.

Coordinación 12 octubre: main avanzó por #1105 (Sheets autenticado/conteo de imágenes). Se incorpora íntegro mediante merge normal en este worktree; #1106 pertenece al trabajo paralelo y no se modifica. TinyFish figura instalado, sin herramientas disponibles en este chat.

La CI38194156174 de 844b2a28 falló en audit:images porque el tag corto había perdido los prefijos de release exigidos. Se conservan las aserciones existentes y se usa el prefijo de main con un sufijo nuevo, sin reutilizar URLs publicadas. Caché, imágenes, recursos y build se vuelven a verificar en esta revisión. CI del próximo SHA: PENDING.

Revisión local v4: build:pages PASS, audit:images PASS, critical-resource-urls 2/2 PASS, preparación de dominio 17/17 PASS. Plan protegido regenerado contra main #1105:146 archivos/59 registros. #1101 sigue DRAFT, sin auto-merge.
