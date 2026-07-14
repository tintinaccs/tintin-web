# Fase 6 — Contenido y textos

## Fuente de verdad

Los textos editables se guardan en:

```text
site_content/{pageId}
```

Las páginas disponibles son:

- Inicio
- Nosotros
- Catálogo
- Colecciones
- Contacto
- Envíos
- Preguntas frecuentes
- Cambios y devoluciones

Los datos de productos, colecciones, precios, ciudades, imágenes, WhatsApp y correo no se duplican dentro de Contenido. Cada uno continúa en su módulo correspondiente.

## Seguridad

- Firestore guarda texto, enlaces validados y estados visibles/ocultos.
- No se admite HTML, JavaScript, CSS ni selectores escritos desde el panel.
- Los saltos de línea se crean como nodos seguros.
- Los enlaces rechazan protocolos inseguros.
- Super Admin tiene control total.
- Admin, Agent y Viewer respetan la matriz de Roles y Permisos.

## Uso

1. Abrir `admin.html`.
2. Entrar en **Contenido**.
3. Elegir una página y una sección.
4. Editar los campos.
5. Guardar.
6. Abrir **Ver página** para comprobar el resultado.

Los cambios aparecen en tiempo real en las pestañas abiertas.

## Visibilidad

Las secciones que permiten ocultarse muestran el interruptor:

```text
Mostrar esta sección en el sitio público
```

Ocultar una sección no borra sus textos. Volver a activarla recupera el mismo contenido.

## Restaurar

**Restaurar sección original** guarda nuevamente los valores base de esa sección. No elimina otras páginas ni otros apartados.

## Concurrencia

Cuando otra pestaña modifica la misma página mientras el formulario tiene cambios locales, el editor muestra una advertencia y no pisa el texto que todavía no se guardó.

## Despliegue

Esta fase no cambia reglas de Firestore y no usa Cloud Functions. No requiere Cloud Shell, Blaze ni una publicación manual en Firebase. GitHub Pages publica el código al fusionar el Pull Request.
