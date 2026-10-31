import {productVariantPrice,variantStockLimit,hasProductStock} from '../../core/store/inventario-variantes.mjs?v=tintin-20261031-seo-espacios-1';
import { sanitizeImageUrl } from '../../components/images/utilidades-imagenes.js?v=tintin-20261030-home-history-5';
import '../../components/images/galeria-producto.js?v=tintin-20261019-variant-links-1';

// La vista previa lee el formulario; nunca escribe precios, stock ni asociaciones.
const states = new WeakMap();
const money = value => `Gs. ${Number(value).toLocaleString('es-PY')}`;
const hide = (element, hidden) => { if (element.hidden !== hidden) element.hidden = hidden; };
const node = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
};
function stateFor(card) {
  if (!states.has(card)) states.set(card, { rows: [], selected: Object.create(null), photo: '', signature: '' });
  return states.get(card);
}
export function setProductPreviewMedia(card, rows) {
  if (!card) return;
  stateFor(card).rows = rows || [];
  refreshProductPreview(card);
}
export function mountProductPreview(card, layout) {
  if (card.querySelector('#prod-live-preview')) return;
  const aside = node('aside', 'tt-editor-preview'); aside.id = 'prod-live-preview';
  aside.tabIndex = -1;
  aside.setAttribute('aria-label', 'Vista previa del producto');
  aside.innerHTML = `<div class="tt-editor-preview-heading"><span>Vista previa</span><span class="tt-editor-live">En vivo</span></div>
    <p class="tt-editor-caption">Revisá tus cambios antes de guardar.</p>
    <div class="tt-editor-cover"><img alt="" hidden><span>Agregá una foto para ver tu producto</span></div>
    <div class="tt-editor-thumbnails" aria-label="Fotos del producto"></div>
    <p class="tt-editor-preview-category"></p><h2 class="tt-editor-preview-name"></h2><p class="tt-editor-preview-badges"></p>
    <div class="tt-editor-preview-money"><strong></strong><s hidden></s><span hidden></span></div>
    <p class="tt-editor-preview-stock"></p><div class="tt-editor-preview-options"></div>
    <p class="tt-editor-preview-description"></p><dl class="tt-editor-preview-specs"></dl>
    <p class="tt-editor-preview-visibility"></p><p class="tt-editor-caption">Vista orientativa. Los cambios se publican al guardar.</p>`;
  layout.append(aside);
  const back = node('button','adm-btn adm-btn-outline tt-editor-preview-jump','Volver a editar'); back.type='button';
  back.addEventListener('click',()=>{const section=card.querySelector('[role=tab][aria-selected=true]') || card.querySelector('#prod-editor-section');section?.focus();section?.scrollIntoView({block:'start'});});
  aside.prepend(back);
  const refresh = () => refreshProductPreview(card);
  // Las URLs blob son sólo una vista local: nunca pasan al campo persistido
  // ni a las asociaciones del catálogo.
  card.addEventListener('tintin:image-preview', event => {
    if (event.target.id !== 'prod-image-widget') return;
    stateFor(card).pendingPhoto = event.detail?.pending ? event.detail.url : '';
    stateFor(card).photo = stateFor(card).pendingPhoto || '';
    refresh();
  });
  card.addEventListener('tintin:commercial-draft',event=>{stateFor(card).commercial=event.detail;refresh();});
  card.addEventListener('input', refresh);
  card.addEventListener('change', refresh);
  refresh();
}
export function refreshProductPreview(card) {
  const aside = card.querySelector('#prod-live-preview');
  if (!aside) return;
  const state = stateFor(card), media = window.TintinProductMedia;
  const value = id => card.querySelector(`#prod-${id}`)?.value || '';
  const write = (selector, text) => {
    const element = aside.querySelector(selector);
    if (element.textContent !== text) element.textContent = text;
  };
  const groups = Object.create(null);
  for (const line of value('variants-text').split(/\r?\n/)) {
    const index = line.indexOf(':'); if (index < 1) continue;
    const key = line.slice(0, index).trim();
    groups[key] = [...new Set([...(groups[key] || []), ...line.slice(index + 1).split(',').map(s => s.trim()).filter(Boolean)])];
  }
  for (const key of Object.keys(state.selected)) if (!groups[key]?.includes(state.selected[key])) delete state.selected[key];
  const product = { ...state.commercial, price:Number(value('price')),priceBefore:value('price-before')===''?null:Number(value('price-before')), imageUrl: value('imageUrl'), imagesExtra: value('images-extra').split(/\r?\n/), variants: groups, variantMedia: state.rows };
  if(state.commercial?.variantCommerceVersion===2) {
    for(const [key,values] of Object.entries(groups))groups[key]=values.filter(value=>product.variantInventory.some(row=>row.attributes?.[key]===value && row.active!==false));
    for(const key of Object.keys(state.selected))if(!groups[key]?.includes(state.selected[key]))delete state.selected[key];
  }
  const photos = media.uniqueImages(media.galleryImages(product, state.selected).map(url => sanitizeImageUrl(url)).filter(Boolean));
  if (state.pendingPhoto) photos.unshift(state.pendingPhoto);
  if (!photos.includes(state.photo)) state.photo = photos[0] || '';
  const image = aside.querySelector('.tt-editor-cover img'), placeholder = aside.querySelector('.tt-editor-cover span');
  if (image.dataset.source !== state.photo) {
    image.dataset.source = state.photo; hide(image, !state.photo); hide(placeholder, Boolean(state.photo));
    placeholder.textContent = 'Agregá una foto para ver tu producto';
    if (state.photo) image.src = state.photo; else image.removeAttribute('src');
    image.onerror = () => { image.hidden = true; placeholder.hidden = false; placeholder.textContent = 'Imagen no disponible'; };
  }
  image.alt = value('name') || 'Vista previa del producto';
  const signature = JSON.stringify([photos, groups, state.selected, state.photo]);
  if (signature !== state.signature) {
    state.signature = signature;
    const focused = aside.contains(document.activeElement) ? document.activeElement.getAttribute('aria-label') : null;
    const thumbnails = aside.querySelector('.tt-editor-thumbnails'); thumbnails.replaceChildren();
    photos.forEach((url, index) => {
      const button = node('button'); button.type = 'button';
      button.setAttribute('aria-label', `Vista previa: foto ${index + 1}`); button.setAttribute('aria-pressed', String(state.photo === url));
      const img = node('img'); img.src = url; img.alt = ''; img.loading = 'lazy'; button.append(img);
      button.addEventListener('click', () => { state.photo = url; refresh(); }); thumbnails.append(button);
    });
    const options = aside.querySelector('.tt-editor-preview-options'); options.replaceChildren();
    for (const [key, values] of Object.entries(groups)) {
      const label = node('label', 'tt-editor-preview-option', key);
      const select = node('select'); select.setAttribute('aria-label', `Vista previa: ${key}`);
      const all = node('option', '', 'Todas las opciones'); all.value = ''; select.append(all);
      for (const value of values) { const option = node('option', '', value); option.value = value; select.append(option); }
      select.value = state.selected[key] || '';
      select.addEventListener('change', () => { if (select.value) state.selected[key] = select.value; else delete state.selected[key]; refresh(); });
      label.append(select); options.append(label);
    }
    if (focused) aside.querySelector(`[aria-label="${CSS.escape(focused)}"]`)?.focus({preventScroll:true});
  }
  function refresh() { refreshProductPreview(card); }
  write('.tt-editor-preview-name', value('name').trim() || 'Nombre de tu producto');
  const badges = [value('badge'), card.querySelector('#prod-oferta')?.checked ? 'En oferta' : '', card.querySelector('#prod-destacado')?.checked ? 'Más vendido' : ''].filter(Boolean);
  write('.tt-editor-preview-badges', [...new Set(badges)].join(' · '));
  const category = card.querySelector('#prod-category');
  write('.tt-editor-preview-category', category?.value ? category.selectedOptions[0]?.textContent || category.value : 'Sin colección');
  let price = Number(value('price')), before = Number(value('price-before'));
  let commercialStock=state.commercial && !hasProductStock(state.commercial)?0:undefined;
  if(state.commercial && Object.keys(groups).every(key=>state.selected[key])){try{const selection=Object.keys(groups).map(key=>state.selected[key]).join(' / ');const effective=productVariantPrice(state.commercial,selection);price=effective.price;before=effective.priceBefore;commercialStock=variantStockLimit(state.commercial,selection);}catch{price=0;}}
  write('.tt-editor-preview-money strong', price > 0 ? money(price) : 'Ingresá un precio');
  const old = aside.querySelector('.tt-editor-preview-money s'), discount = aside.querySelector('.tt-editor-preview-money span');
  const sale = price > 0 && before > price;
  hide(old, !sale); hide(discount, !sale);
  if (sale) { if (old.textContent !== money(before)) old.textContent = money(before); const text = `−${Math.round((1 - price / before) * 100)}%`; if (discount.textContent !== text) discount.textContent = text; }
  const selectedVariant = Object.keys(groups).map(key => state.selected[key]).filter(Boolean).join(' / ');
  const inputs = [...card.querySelectorAll('#prod-variant-stock:not(.tt-commercial-editor) input')];
  const match = inputs.find(input => input.closest('label')?.dataset.variant === selectedVariant);
  const stock = commercialStock!==undefined ? commercialStock??'' : match ? match.value : value('stock');
  write('.tt-editor-preview-stock', stock === '' ? 'Sin control de stock' : Number(stock) > 0 ? `${Number(stock).toLocaleString('es-PY')} unidades disponibles${match ? ' · opción elegida' : ''}` : 'Agotado');
  write('.tt-editor-preview-description', value('description').trim() || 'La descripción de tu producto aparecerá acá.');
  const specs = ['material','measurements','color-finish','care','water-resistance','warranty','size-fit','package-contents'].map(id => [id, value(id)]).filter(([,text]) => text);
  const specsBox = aside.querySelector('.tt-editor-preview-specs');
  if (specsBox.dataset.values !== JSON.stringify(specs)) {
    specsBox.dataset.values = JSON.stringify(specs); specsBox.replaceChildren();
    for (const [id, text] of specs) {
      const label = card.querySelector(`label[for="prod-${id}"]`)?.textContent || id;
      specsBox.append(node('dt', '', label), node('dd', '', text));
    }
  }
  write('.tt-editor-preview-visibility', card.querySelector('#prod-active')?.checked ? 'Visible en tienda al guardar' : 'Inactivo · oculto en tienda');
  for (const input of inputs) {
    const label = input.closest('label');
    if (!label.dataset.variant) {
      label.dataset.variant = label.firstChild?.textContent.trim() || '';
      label.classList.add('tt-editor-stock-row');
      const name = node('strong', '', label.dataset.variant), info = node('span', 'tt-editor-stock-info');
      info.append(name, node('small'));
      const thumb = node('span', 'tt-editor-stock-thumb');
      const img = node('img'); img.alt = ''; img.loading = 'lazy'; img.hidden = true; thumb.append(img);
      label.firstChild?.remove(); label.prepend(thumb, info);
      input.setAttribute('aria-label', `Stock de ${label.dataset.variant}`); input.inputMode = 'numeric';
    }
    const selected = Object.fromEntries(Object.keys(groups).map((key, index) => [key, label.dataset.variant.split(' / ')[index] || '']));
    const urls = media.galleryImages(product, selected);
    const url = sanitizeImageUrl(urls[0] || ''), img = label.querySelector('img');
    if (img.dataset.source !== url) { img.dataset.source = url; hide(img, !url); if (url) img.src = url; else img.removeAttribute('src'); img.onerror = () => { hide(img, true); }; }
    const text = Number(input.value) > 0 ? 'Disponible' : 'Agotado';
    const status = label.querySelector('small'); if (status.textContent !== text) status.textContent = text;
    label.classList.toggle('is-soldout', Number(input.value) === 0);
  }
}
