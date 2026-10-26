# Estado general del editor de productos

## Única versión vigente

El editor de seis fases y sus correcciones es la única versión mantenida.
Autoridad: [00-VERSION-UNICA.md](00-VERSION-UNICA.md).

Incluye#1241 (integración de las seis fases),#1244 (continuidad de guardado,
borradores y variantes),#1245 y Perfil#1246. La propuesta visual#1247 se cerró
sin merge, con CI cancelada. No está publicada ni se incorpora a esta versión.

No existe un selector de diseños. Se conservan el formulario, galería, controles,
serializer, progreso privado, permisos y contratos comerciales canónicos. Las
especificaciones visuales previas y los controles muertos se retiran de la rama
vigente para impedir que se reutilicen como versiones actuales.

## Verificación actual

La unificación se valida en `codex/editor-version-unica-seis-fases-20261026`.
PASS_LOCAL:44/44 Chromium,44/44 Node y39/39 preflight, sin reintentos.
CI y monitor propios pendientes al publicar; no se reutiliza PASS de#1247.

Recibo: [UNIFICACION-SEIS-FASES.md](UNIFICACION-SEIS-FASES.md).
La evidencia fechada de Fase6 funcional se conserva en sus informes. Las pruebas
autenticadas con proveedores y dispositivos físicos siguen pendientes.
