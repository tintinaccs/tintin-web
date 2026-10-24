// Se monta una sola vez sobre el formulario canónico; no agrega otro guardado.
export function ensureEditorialFields(card) {
  if(!card?.querySelector || card.querySelector('#prod-publicationStatus'))return;
  const anchor=card.querySelector('#prod-form-error');if(!anchor)return;
  anchor.insertAdjacentHTML('beforebegin', `<section class="tt-editor-section tt-product-editorial" aria-label="Publicación y SEO">
            <h2>Publicación y presentación</h2>
            <label for="prod-publicationStatus">Estado</label>
            <select id="prod-publicationStatus" class="adm-input"><option value="active">Activo</option><option value="draft">Borrador</option><option value="archived">Archivado</option></select>
            <p>El estado controla la publicación. Una variante agotada conserva el estado del producto.</p>
            <label for="prod-productTemplate">Plantilla</label>
            <select id="prod-productTemplate" class="adm-input"><option value="default">Actual</option><option value="gallery">Galería ampliada</option></select>
            <label for="prod-seoTitle">Título para Google</label><input id="prod-seoTitle" class="adm-input" maxlength="70" placeholder="Automático si queda vacío">
            <label for="prod-seoDescription">Descripción para Google</label><textarea id="prod-seoDescription" class="adm-input" maxlength="220" rows="3" placeholder="Automática si queda vacía"></textarea>
            <div id="prod-statistics" aria-live="polite"></div>
          </section>`);
}
