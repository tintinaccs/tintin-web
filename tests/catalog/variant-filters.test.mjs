import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogFilterRecord as record, catalogFilterOptions as options, matchesCatalogFilters as matches, pruneCatalogFilters as prune, catalogFilterPreview as preview } from '../../js/pages/catalog/filtros-variantes.mjs';
const selection = entries => new Map(entries.map(([key, values]) => [key, new Set(values)]));
const bag = { id: 'bag', price: 100, stock: 3, variants: { Color: ['Marrón', 'Violeta'], Tamaño: ['S', 'L'] }, variantInventory: [{ variant: 'Marrón / S', stock: 0 }, { variant: 'Violeta / L', stock: 3 }] };

test('opciones reales, cualquier atributo y material, sin colores inventados', () => {
  const groups = options([record({...bag, material:'Acero'}), record({stock:1,variants:{Grabado:['Inicial A']}})]);
  assert.deepEqual(groups.map(group=>group.label),['Color','Grabado','Material','Tamaño']);
  assert.deepEqual(groups[0].options.map(option=>option.label),['Violeta','Marrón']);
  assert.equal(groups[0].options[1].availableCount,0);
  assert.equal(options([record({stock:1})]).length,0);
});

test('stock de la variante, no stock del producto: 0 baja, 1 vuelve normal', () => {
  const before=options([record(bag)])[0].options;
  assert.equal(before.at(-1).label,'Marrón');
  const after=options([record({...bag,variantInventory:bag.variantInventory.map(row=>({...row,stock:1}))})])[0].options;
  assert.equal(after[0].label,'Marrón');
  assert.equal(after[0].availableCount,1);
  const chosen=selection([['color',['marrón']]]);
  assert.equal(matches(record(bag),chosen),true);
  assert.equal(matches(record(bag),chosen,{onlyStock:true}),false);
});

test('no combina atributos de filas diferentes; OR dentro de grupo y AND entre grupos', () => {
  assert.equal(matches(record(bag),selection([['color',['marrón']],['tamaño',['l']]])),false);
  assert.equal(matches(record(bag),selection([['color',['marrón','violeta']],['tamaño',['l']]]),{onlyStock:true}),true);
  const facets=options([record(bag)],selection([['tamaño',['s']]]));
  assert.equal(facets[0].options.find(option=>option.label==='Violeta').count,0);
});

test('opciones únicas desaparecen al borrar el último producto y limpian la selección', () => {
  const selected=selection([['color',['violeta']],['grabado',['inicial a']]]);
  const retained=record({stock:1,variants:{Color:['Marrón']}});
  prune(selected,[retained]);
  assert.equal(selected.size,0);
  assert.deepEqual(options([retained])[0].options.map(option=>option.label),['Marrón']);
  assert.deepEqual(options([]),[]);
});

test('V2 respeta combinaciones deshabilitadas, stock sin límite y nombres libres', () => {
  const product={price:100,stock:0,variantCommerceVersion:2,variants:{Acabado:['Mate','Brillante','Especial']},variantInventory:[
    {variant:'v1',attributes:{Acabado:'Mate'},stock:null},
    {variant:'v2',attributes:{Acabado:'Brillante'},stock:7,active:false},
    {variant:'v3',attributes:{Acabado:'Especial'},stock:0}
  ]};
  const group=options([record(product)])[0];
  assert.equal(group.options[0].label,'Mate');
  assert.equal(matches(record(product),selection([['acabado',['brillante']]])),true);
  assert.equal(matches(record(product),selection([['acabado',['brillante']]]),{onlyStock:true}),false);
  assert.equal(matches(record(product),selection([['acabado',['mate']]]),{onlyStock:true}),true);
});

test('sin matriz usa stock general; no crea combinaciones ni cambia el inventario', () => {
  const product={stock:0,variants:[{Color:'Marrón',Talle:'Único'},{Color:'Dorado',Talle:'Único'}]};
  const snapshot=JSON.stringify(product);
  const data=record(product);
  assert.equal(matches(data,selection([['color',['dorado']]])),true);
  assert.equal(matches(data,selection([['color',['dorado']]]),{onlyStock:true}),false);
  assert.equal(JSON.stringify(product),snapshot);
});

test('búsqueda o categoría sin resultados no oculta opciones elegidas; sólo una baja real las retira', () => {
  const records=[record(bag)];
  const selected=selection([['color',['violeta']]]);
  assert.deepEqual(options([],selected,records).find(group=>group.key==='color').options.map(option=>option.label),['Marrón','Violeta']);
  assert.equal(options([],selected,records)[0].options.every(option=>option.count===0),true);
  assert.equal(selected.get('color').has('violeta'),true);
  prune(selected,[]);
  assert.equal(selected.size,0);
});

const shoe = { id: 'shoe', price: 100, stock: 9, variants: { Color: ['Negro', 'Beige', 'Rosa'], Diseño: ['Liso', 'Cruz'] }, variantInventory: [
  { variant: 'Negro / Liso', stock: 4 }, { variant: 'Beige / Liso', stock: 0 }, { variant: 'Beige / Cruz', stock: 3 }, { variant: 'Rosa / Cruz', stock: 2 }] };

test('vista previa: la tarjeta muestra la combinación del color elegido, no la primera disponible', () => {
  const result = preview(record(shoe), selection([['color', ['beige']]]));
  assert.equal(result.selection, 'Beige / Cruz');
  assert.deepEqual(result.attrs, { Color: 'Beige', Diseño: 'Cruz' });
  assert.equal(preview(record(shoe), selection([['color', ['rosa']]])).selection, 'Rosa / Cruz');
});

test('vista previa: funciona con cualquier atributo y con varios a la vez', () => {
  assert.equal(preview(record(shoe), selection([['diseño', ['cruz']]])).selection, 'Beige / Cruz');
  assert.equal(preview(record(shoe), selection([['diseño', ['liso']]])).selection, 'Negro / Liso');
  assert.equal(preview(record(shoe), selection([['color', ['beige']], ['diseño', ['liso']]])).selection, 'Beige / Liso');
  assert.equal(preview(record(shoe), selection([['color', ['negro', 'rosa']]])).selection, 'Negro / Liso');
});

test('vista previa: prefiere la combinación con stock y respeta Solo con stock', () => {
  const soldOutBeige = { ...shoe, variantInventory: shoe.variantInventory.map(row => row.variant.startsWith('Beige') ? { ...row, stock: 0 } : row) };
  assert.equal(preview(record(soldOutBeige), selection([['color', ['beige']]])).selection, 'Beige / Liso');
  assert.equal(preview(record(soldOutBeige), selection([['color', ['beige']]]), { onlyStock: true }), null);
});

test('vista previa: sin filtros o sin coincidencia no cambia la tarjeta', () => {
  assert.equal(preview(record(shoe), new Map()), null);
  assert.equal(preview(record(shoe), selection([['color', ['verde']]])), null);
  assert.equal(preview(record({ id: 'plain', price: 1, stock: 1 }), selection([['color', ['beige']]])), null);
});

test('vista previa: sin matriz de inventario arma la combinación desde las opciones', () => {
  const noMatrix = { id: 'nm', price: 1, stock: 5, variants: { Color: ['Negro', 'Beige'], Talla: ['S', 'M'] } };
  const result = preview(record(noMatrix), selection([['talla', ['m']]]));
  assert.equal(result.selection, 'Negro / M');
  assert.equal(preview(record(noMatrix), selection([['color', ['beige']]])).selection, 'Beige / S');
});

test('vista previa: combinación comercial v2 devuelve la etiqueta de la variante', () => {
  const v2 = { id: 'v2', price: 100, variantCommerceVersion: 2, variants: { Color: ['Oro', 'Beige'], Tamaño: ['S', 'L'] }, variantInventory: [
    { variant: 'k1', attributes: { Color: 'Oro', Tamaño: 'S' }, stock: 2 }, { variant: 'k2', attributes: { Color: 'Beige', Tamaño: 'L' }, stock: null } ] };
  const result = preview(record(v2), selection([['color', ['beige']]]));
  assert.equal(result.selection, 'Beige / L');
  assert.deepEqual(result.attrs, { Color: 'Beige', Tamaño: 'L' });
});
