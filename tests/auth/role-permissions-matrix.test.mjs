import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { EDITABLE_PERMISSION_ROLES } from '../../js/core/auth/contrato-cuentas-generado.js';

function fixture({saved=null,fail=false}={}) {
  const roles=fs.readFileSync('js/core/auth/roles.js','utf8');
  const start=roles.indexOf('export const PERMISSIONS =');
  const fixed=roles.slice(start,roles.indexOf('\n};',start)+3).replace('export ','');
  const source=fs.readFileSync('js/core/auth/permisos-roles.js','utf8')
    .replace(/^import\b[\s\S]*?;\r?\n/gm,'')
    .replace(/import\('\.\.\/\.\.\/admin\/auth\/lecturas-admin\.js\?v=[^']+'\)/,'loadAdminReader()')
    .replace(/^export /gm,'');
  const state={saved,fail,reads:0};
  const context=vm.createContext({console:{error(){}},EDITABLE_PERMISSION_ROLES,db:{},
    doc:()=>({}),getDoc:async()=>{state.reads++;if(state.fail)throw Error('sin conexión');return {exists:()=>state.saved!==null,data:()=>state.saved};},
    loadAdminReader:async()=>({readAdminFirestore:fn=>fn()}),setDoc:async()=>assert.fail('revisión sin escrituras'),serverTimestamp:()=>assert.fail('sin escrituras')});
  const api=vm.runInContext(`${fixed}\n${source}\n({canDo,loadRolePermissions,buildDefaultRolePermissions,getRolePermissionsCache,PERMISSION_MODULES,PERMISSIONS});`,context);
  return {api,state};
}

function assertDefaults(api) {
  let checked=0;
  for(const role of EDITABLE_PERMISSION_ROLES)for(const [module,config] of Object.entries(api.PERMISSION_MODULES))for(const [action,definition] of Object.entries(config.actions)) {
    const allowed=definition.implemented!==false && (!definition.rolesEditable || definition.rolesEditable.includes(role));
    assert.equal(api.canDo(role,module,action),allowed && !!api.PERMISSIONS[role]?.[definition.defaultFrom],`${role}.${module}.${action}`);
    checked++;
  }
  assert.ok(checked>100,'la matriz debe incluir todas las acciones, no un caso vacío');
}

test('cada acción conserva los defaults antes de cargar y con documento ausente',async()=>{
  const {api,state}=fixture();assertDefaults(api);await api.loadRolePermissions();assertDefaults(api);
  await api.loadRolePermissions();assert.equal(state.reads,1,'la lectura confirmada se cachea');
});

test('un documento parcial conserva el resto y los roles no editables siguen excluidos',async()=>{
  const {api}=fixture({saved:{admin:{dashboard:{ver:false}},viewer:{productos:{eliminar:true}}}});
  await api.loadRolePermissions();
  assert.equal(api.canDo('admin','dashboard','ver'),false);
  assert.equal(api.canDo('admin','dashboard','verMetricas'),true);
  assert.equal(api.canDo('viewer','productos','eliminar'),false);
  assert.equal(api.canDo('agent','pedidos','crearManual'),false);
  assert.equal(api.canDo('admin','colecciones','destacar'),false);
  for(const role of ['client','guest','unknown','superadmin'])for(const [module,config] of Object.entries(api.PERMISSION_MODULES))for(const action of Object.keys(config.actions))assert.equal(api.canDo(role,module,action),false);
  assert.equal(api.canDo('admin','inventado','ver'),false);
  assert.equal(api.canDo('admin','pedidos','inventado'),false);
});

test('un fallo inicial no se cachea y la siguiente lectura recupera la configuración',async()=>{
  const {api,state}=fixture({fail:true});await api.loadRolePermissions();assertDefaults(api);assert.equal(api.getRolePermissionsCache(),null);
  state.fail=false;state.saved={admin:{dashboard:{ver:false}}};await api.loadRolePermissions();
  assert.equal(state.reads,2);assert.equal(api.canDo('admin','dashboard','ver'),false);
});

test('un fallo posterior conserva el permiso denegado confirmado en lugar de reabrirlo',async()=>{
  const {api,state}=fixture({saved:{admin:{dashboard:{ver:false}}}});await api.loadRolePermissions();state.fail=true;
  await api.loadRolePermissions(true);assert.equal(api.canDo('admin','dashboard','ver'),false);assert.equal(state.reads,2);
});
