import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../../js/components/location/mapa-ubicacion.js',import.meta.url),'utf8')
  .replace(/^import .*;\r?\n/gm,'').replace(/\bexport\s/g,'');

function runtime({loadLibrary=true}={}) {
  const handlers={},scripts=[],markers=[];
  const map={setView(){return this;},on(name,callback){handlers[name]=callback;return this;},invalidateSize(){},remove(){}};
  const L={map:()=>map,tileLayer:()=>({addTo(){return this;},on(name,callback){handlers[name]=callback;return this;}}),latLng:(lat,lng)=>({lat,lng}),divIcon:()=>({}),marker:(point,options)=>{
    const marker={point,options,addTo(){return this;},off(){return this;},on(){return this;},setLatLng(value){this.point=value;}};
    markers.push(marker);return marker;
  }};
  const context=vm.createContext({window:loadLibrary?{L}:{},document:{createElement:()=>({remove(){},setAttribute(){},append(){}}),head:{appendChild:s=>scripts.push(s)},addEventListener(){},removeEventListener(){},getElementById:()=>null},requestAnimationFrame:callback=>callback(),setTimeout:()=>0,clearTimeout(){},searchPlaces:async()=>[],parseLocationSearchInput:()=>null});
  vm.runInContext(source+';globalThis.makeMap=options=>{Object.assign(options.mapEl,{classList:{add(){}},before(){},after(){}});return createLocationMap(options);};',context);
  return {context,L,handlers,scripts,markers};
}

test('un mapa de dirección guardada no mueve el pin al tocarlo ni permite arrastrarlo',async()=>{
  const r=runtime();let scrolled=false;
  const map=await r.context.makeMap({mapEl:{id:'saved-address',scrollIntoView(){scrolled=true;}},readOnly:true});
  map.setLocation({lat:-25.2867,lng:-57.6467,name:'Dirección de prueba'},{scroll:false});
  assert.equal(r.handlers.click,undefined);
  assert.equal(r.markers[0].options.draggable,false);
  assert.equal(map.getLocation().lat,-25.2867);
  assert.equal(scrolled,false);
  map.destroy();
});

test('el selector de nueva dirección conserva el pin interactivo',async()=>{
  const r=runtime();const map=await r.context.makeMap({mapEl:{id:'new-address',scrollIntoView(){}}});
  assert.equal(typeof r.handlers.click,'function');
  r.handlers.click({latlng:{lat:-25.3,lng:-57.6}});
  assert.equal(r.markers[0].options.draggable,true);
  assert.equal(map.getLocation().lat,-25.3);
  map.destroy();
});

test('un fallo al descargar Leaflet permite reintentar sin recargar la cuenta',async()=>{
  const r=runtime({loadLibrary:false});
  const first=r.context.makeMap({mapEl:{id:'first'}});
  r.scripts[0].onerror();
  await assert.rejects(first,/No se pudo cargar el mapa/);
  const retry=r.context.makeMap({mapEl:{id:'retry'}});
  assert.equal(r.scripts.length,2);
  r.context.window.L=r.L;r.scripts[1].onload();
  (await retry).destroy();
});
