# Continuidad del PR1241 — 26/10/2026

Responsable: Codex /root (GPT-6). Se retoma el adjunto sobre la cabeza
5aa7c935, contra main f9399a90. El merge ya está autorizado; no se ejecuta
publicación manual, despliegue de Rules ni operaciones comerciales reales.

CI40311904791 aprobó administración, comercio, Rules, CodeQL y Pages preview.
Falló rendimiento por tres consultas iguales de colecciones en Inicio/Catálogo.
Calidad terminó 443/444: WebKit informó cancelación nativa de la lectura local
de colecciones durante el recorrido que recarga favoritos. No se declara esa
corrida aprobada. El artefacto remoto no pudo descargarse (HTTP403); el log de
Actions sí se recuperó.

Correcciones:

- Metadata de colecciones comparte la promesa durante el documento, incluyendo
  consumidores tardíos. Documento nuevo revalida; force reconsulta; fallo elimina
  la promesa para permitir reintento y conserva respaldo local.
- Cerrar reseñas restaura overflow sin esperar el evento close encolado. Una
  reapertura inmediata conserva el bloqueo y recupera el valor original al salir.
- Borrado Cloudinary verifica desde servidor referencias en progreso privado de
  cualquier cuenta, con proyección de fotos y cursor exclusivo por nombre de
  documento. Si encuentra una referencia o falla la inspección no destruye nada.
  No expone dueños ni snapshots. Progreso cerrado no bloquea; no se borran
  borradores/fotos automáticamente ni se agrega una retención destructiva.
- Monitor runtime admite la cancelación nativa de collections bajo las mismas
  condiciones que products: endpoint local exacto, caller canónico y ventana de
  salida. Errores de página activa, fuera de ventana, otros recursos/callers y
  excepciones/rechazos JavaScript siguen fallando. Las pruebas negativas cubren
  también collections; no se omiten recorridos ni se modifican umbrales.
- Versionado y shell se regeneran desde sus autoridades; los cambios transitivos
  de imports conservan una URL por módulo. Plan protegido calculado contra main.

Evidencia local en /tmp/1241-*.log (no versionada):

- 161 pruebas Node administrativas/catálogo, incluidas consultas, bloqueo del
  endpoint, rechazo de respuestas inválidas y reintento con respaldo: PASS.
- Firestore real aislado:14/14, incluida consulta de grupo proyectada/paginada
  entre cuentas y205 borradores recuperados: PASS.
- Chromium:25/25 reseñas/revalidación/rendimiento; cero solicitudes duplicadas en
  Inicio y Catálogo. La primera ejecución no arrancó por navegador ausente y
  queda separada del PASS. La prueba adicional de reapertura se ejecuta después.
- Build Pages/caché: PASS. Preflight inicial bloqueado por node_modules anterior
  al lockfile; se ejecuta npm ci y se repite con dependencias exactas.

Las verificaciones posteriores, CI del SHA final y merge son autoridad de cierre.
No se hereda PASS_CI de5aa7c935 ni se certifica Safari físico, proveedores reales,
CRUD productivo o Rules desplegadas a partir de los fixtures/emuladores.

Segunda comprobación local:161/161 Node con dependencias exactas y16/16
Chromium de reseñas/revalidación (incluye reapertura inmediata) aprobados.
Preflight oficial completo:39 comandos aprobados. Se conserva por separado el
primer intento con dependencias inválidas. npm ci compila RE2 desde su fuente.

PR1237–1240 son ancestros de la cabeza consolidada. PR1233 tiene historia
separada: su barrera de lectura está conservada con evaluación de permisos
factorizada en Fase4. Se incorporan además sus41 líneas de ataques/controles al
script crítico canónico, conservando los tests aislados de Fase4. La repetición
real de estas reglas y los30 recorridos runtime se ejecutan antes del cierre;
su resultado no se presupone. No se ejecuta el deploy manual de Rules.
