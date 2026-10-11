# Monitor Auth: diagnóstico report-only — 2026-10-11

Codex /root. Base main3488ebfd4315eceb58a3ca43ae5daefc30390775. Cambio separado del importador #1099; preservar ambos al integrar y regenerar plan/manifiesto contra main que resulte del primer merge.

El log del job114480880407 (run38143127671) demuestra FAIL por el aviso exacto Google frame-ancestors report-only. No bloqueó contenido: el texto declara que registra la violación sin aplicar otra acción. El commit af8e7f21176522ff7be977ee0bdbf8a5f0c9c0d4 del handoff sólo existía en Windows; git local no lo contiene y GitHub respondió422. Se reconstruye una corrección acotada sobre main actual, sin reutilizar su supuesto PASS65.

El monitor conserva ese único mensaje de consola como warning visible en JSON y terminal. Una CSP efectiva, host/directiva distintos o texto añadido permanecen bloqueantes; todas las excepciones pageerror son bloqueantes, incluso si imitan el aviso o throttling. Los avisos de throttling reCAPTCHA quedan explícitamente como desafío no verificado, y nunca ocultan una CSP efectiva ni errores de JavaScript. App Check/CSP/roles/Rules y configuración remota conservados.

PASS_LOCAL: audit:login-isolation62/62 (cuatro pruebas nuevas cubren fronteras de CSP, exceptions y throttling). PASS_PRODUCTION de sólo lectura, con excepción documentada al orden local/CI: monitor candidato ejecutado contra /login y /perfil publicados en main3488, navegador Chromium real /usr/bin/chromium, ambos200 y estado TintinAppCheckStatus enabled, sin errores bloqueantes, aproximadamente9.4s cada uno. Sólo lectura sin sesión de cliente, Google OAuth, OTP, pedidos, correos ni compras. No demuestra completo desafío+Firestore autenticado ni recorridos comerciales. JSON en artifacts/auth-browser-smoke.json local ignorado.

Fuente BCP oficial consultada por GET hoy y parser canónico aplicado: fecha2026-10-09,5694.47Gs/USD. Config pública actual PayPal reporta fuenteBCP, misma fecha, updatedAt2026-10-09T21:28:18.991Z dentro de7d, sandbox y feature_disabled. No se expone la cifra guardada públicamente, por lo que la igualdad privada numérica queda NOT_VERIFIED; no se activa PayPal ni se escribe settings.

CI/merge/publicación del nuevo SHA pendientes; el diff no modifica archivos del inventario protegido. Dominio/DNS/origen comercial y #929/#1101 excluidos por instrucción actual. Sin acceso Admin/Sheets/Google/Cloudflare conectado para QA privada/restore remoto. No anunciar importador ni cutover listos.
