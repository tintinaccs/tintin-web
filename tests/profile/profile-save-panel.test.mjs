import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const {parse}=createRequire(import.meta.url)('parse5');
const root=parse(fs.readFileSync(new URL('../../perfil.html',import.meta.url),'utf8'));
const nodes=[];
function visit(node){nodes.push(node);for(const child of node.childNodes||[])visit(child);}
visit(root);
const attr=(node,name)=>node.attrs?.find(a=>a.name===name)?.value;
const find=id=>nodes.filter(n=>attr(n,'id')===id);
function panel(node){while(node && attr(node,'data-profile-panel')===undefined)node=node.parentNode;return node;}
test('Mis datos permite guardar desde el mismo panel que contiene los campos editables',()=>{
  const save=find('btn-guardar-perfil');assert.equal(save.length,1,'una sola acción canónica de guardado');
  const editable=panel(find('perfil-nombre')[0]);
  assert.equal(attr(editable,'data-profile-panel'),'datos');
  assert.equal(attr(panel(save[0]),'id'),attr(editable,'id'),'Guardar debe estar accesible mientras se editan los datos');
  assert.equal(attr(editable,'hidden'),undefined);
  assert.equal(attr(panel(find('btn-logout')[0]),'data-profile-panel'),'cuenta');
});
