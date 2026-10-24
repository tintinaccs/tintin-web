import * as ort from '../../../vendor/onnxruntime-web-1.22.0/ort.wasm.bundle.min.mjs?v=tintin-20261024-editor-intuitivo-1';
import {rankProductImage} from './vision-productos-core.mjs?v=tintin-20261024-editor-intuitivo-1';

// Todo se sirve desde Tintin. Sin API externa, telemetría ni envío de fotos.
ort.env.wasm.numThreads=1;
ort.env.wasm.proxy=false;
ort.env.wasm.wasmPaths={
  mjs:new URL('../../../vendor/onnxruntime-web-1.22.0/ort-wasm-simd-threaded.mjs',import.meta.url).href,
  wasm:new URL('../../../vendor/onnxruntime-web-1.22.0/ort-wasm-simd-threaded.wasm',import.meta.url).href,
};
ort.env.wasm.initTimeout=45000;

async function asset(name,type) {
  const response=await fetch(new URL(`../../../assets-tintin/vision/${name}`,import.meta.url),{credentials:'omit'});
  if(!response.ok)throw Error('No se pudo cargar el reconocimiento local.');
  return response[type]();
}

self.onmessage=async event=>{
  let session;
  try {
    const pixels=event.data?.pixels;
    if(!(pixels instanceof Float32Array) || pixels.length!==3*224*224 || !pixels.every(Number.isFinite))throw Error('Imagen inválida.');
    const [parts,metadata,provenance]=await Promise.all([Promise.all([asset('tinyclip-vision-int8-v1.part1.bin','arrayBuffer'),asset('tinyclip-vision-int8-v1.part2.bin','arrayBuffer')]),asset('etiquetas-v1.json','json'),asset('procedencia.json','json')]);
    const buffer=new Uint8Array(parts.reduce((sum,part)=>sum+part.byteLength,0));let offset=0;
    for(const part of parts){buffer.set(new Uint8Array(part),offset);offset+=part.byteLength;}
    const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),byte=>byte.toString(16).padStart(2,'0')).join('');
    if(sha!==provenance.modelSha256)throw Error('El modelo local está incompleto.');
    session=await ort.InferenceSession.create(buffer,{executionProviders:['wasm'],graphOptimizationLevel:'all'});
    const output=await session.run({pixel_values:new ort.Tensor('float32',pixels,[1,3,224,224])});
    self.postMessage({ok:true,suggestion:rankProductImage(output.image_embeds.data,metadata.labels)});
  } catch {
    self.postMessage({ok:false});
  } finally {await session?.release();}
};
