// Se monta una sola vez sobre el formulario canónico; no agrega otro guardado.
export function ensureEditorialFields(card) {
  if(!card?.querySelector || card.querySelector('#prod-publicationStatus'))return;
  const anchor=card.querySelector('#prod-form-error');if(!anchor)return;
  anchor.insertAdjacentHTML('beforebegin', `<section class="tt-editor-section tt-product-editorial tt-product-editorial-publication" aria-labelledby="prod-publication-heading">
            <h2 id="prod-publication-heading">Publicación</h2>
            <label for="prod-publicationStatus">Estado del producto</label>
            <select id="prod-publicationStatus" class="adm-input"><option value="active">Activo</option><option value="draft">Borrador</option><option value="archived">Archivado</option></select>
            <p class="tt-editor-caption">Borrador guarda el progreso privado. Activo publica el producto al guardar. El stock se gestiona por separado.</p>
            <label for="prod-productTemplate">Presentación de la ficha</label>
            <select id="prod-productTemplate" class="adm-input"><option value="default">Actual</option><option value="gallery">Galería ampliada</option></select>
          </section>
          <details class="tt-editor-section tt-product-editorial tt-product-editorial-seo">
            <summary>Personalizar información de Google</summary>
            <div class="tt-editor-detail-fields">
              <p class="tt-editor-caption">Dejá estos campos vacíos para usar los datos del producto. Se conservan las personalizaciones guardadas.</p>
              <label for="prod-seoTitle">Título para Google</label><input id="prod-seoTitle" class="adm-input" maxlength="70" placeholder="Título automático">
              <label for="prod-seoDescription">Descripción para Google</label><textarea id="prod-seoDescription" class="adm-input" maxlength="220" rows="3" placeholder="Descripción automática"></textarea>
            </div>
          </details>
          <details class="tt-editor-section tt-product-editorial tt-product-editorial-statistics">
            <summary>Estadísticas del producto</summary>
            <div id="prod-statistics" class="tt-editor-detail-fields" aria-live="polite"></div>
          </details>`);
}
