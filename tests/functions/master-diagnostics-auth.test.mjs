import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { onRequest } from '../../functions/api/master-diagnostics.js';
const origin='https://tintinaccesorios.pages.dev';
const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const kid='local-master-key';
const jwk={...publicKey.export({format:'jwk'}),kid,alg:'RS256',use:'sig'};
function token(email){const now=Math.floor(Date.now()/1000);const b=value=>Buffer.from(JSON.stringify(value)).toString('base64url');const input=b({alg:'RS256',kid})+'.'+b({aud:'tintin-accesorios',iss:'https://securetoken.google.com/tintin-accesorios',sub:'local-fixture',exp:now+3600,iat:now-10,auth_time:now-10,email,email_verified:true});return input+'.'+sign('RSA-SHA256',Buffer.from(input),privateKey).toString('base64url');}
function request(value){return new Request(origin+'/api/master-diagnostics',{headers:{origin,...(value?{authorization:'Bearer '+value}:{})}});}
test('diagnóstico distingue sin token, token inválido, cliente y Super Admin firmado, sin red real ni secretos',async()=>{
 const original=globalThis.fetch; const calls=[];
 globalThis.fetch=async input=>{const url=String(input);calls.push(url);if(url.includes('service_accounts/v1/jwk/'))return Response.json({keys:[jwk]},{headers:{'cache-control':'max-age=3600'}});if(url.includes('/actions/')&&url.includes('/runs'))return Response.json({workflow_runs:[]});if(url.endsWith('/branches/main'))return Response.json({commit:{sha:'local-head'}});if(url.includes('/check-runs?'))return Response.json({check_runs:[]});throw new Error('Unexpected fixture request '+url);};
 try{
  for(const [value,status] of [['',401],['invalid-local-token',401],[token('cliente@example.com'),403],[token('tintinaccs@gmail.com'),200]]){
   const response=await onRequest({request:request(value),env:{GITHUB_TOKEN:'local-only-secret'}});assert.equal(response.status,status);const body=await response.text();assert.doesNotMatch(body,/local-only-secret|invalid-local-token|private_key|stack|RSA|authorization/i);if(status===200)assert.equal(JSON.parse(body).currentCommit,'local-head');
  }
  assert.ok(calls.every(url=>url.startsWith('https://www.googleapis.com/')||url.startsWith('https://api.github.com/')));
 }finally{globalThis.fetch=original;}
});
