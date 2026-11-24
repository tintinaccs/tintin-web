#!/usr/bin/env python3
"""Read a fixed Git snapshot and its canonical diagnostic index; no network."""
import collections, hashlib, json, pathlib, re, subprocess
BASE='085953dc0b700e91f95fc8c84dd8e17f4627a70c'
OUT=pathlib.Path(__file__).resolve().parents[3]/'docs/agent/evidence/phase01-20261101'
read=lambda p:subprocess.check_output(['git','show',f'{BASE}:{p}'],text=True)
tracked=subprocess.check_output(['git','ls-tree','-r','--name-only',BASE],text=True).splitlines()
m=json.loads(read('diagnostic-manifest.json'))
production=lambda p:p.startswith(('js/','cloudflare/','functions/')) or p in ['tienda.js','firebase-messaging-sw.js','config/csp-runtime.js']
modules={v['path']:v for v in m['modules'] if production(v['path'])}
edges=sorted({(p,imp['target']) for p,v in modules.items() for imp in v['imports'] if imp.get('target') in modules})
fanin=collections.Counter(b for a,b in edges)
byhash=collections.defaultdict(list)
for p,v in modules.items():byhash[v['sha256']].append(p)
# SCCs describe coupling, never by themselves prove broken/dead code.
graph={p:[] for p in modules}
for a,b in edges:graph[a].append(b)
index={};low={};stack=[];active=set();components=[]
def visit(v):
 index[v]=low[v]=len(index);stack.append(v);active.add(v)
 for w in graph[v]:
  if w not in index:visit(w);low[v]=min(low[v],low[w])
  elif w in active:low[v]=min(low[v],index[w])
 if low[v]==index[v]:
  component=[]
  while True:
   w=stack.pop();active.remove(w);component.append(w)
   if w==v:break
  if len(component)>1:components.append(sorted(component))
for v in graph:
 if v not in index:visit(v)
pages=[]
for p in m['pages']:
 pages.append({k:p.get(k) for k in ['path','label','visibility','requiresAuth','roles','bytes']}|{'scripts':[x.get('target') or x['raw'] for x in p['scripts']],'styles':[x.get('target') or x['raw'] for x in p['styles']],'inlineScripts':len(p['inlineScripts']),'duplicateIds':p['duplicateIds'],'duplicateScriptTargets':[k for k,v in collections.Counter(x.get('target') for x in p['scripts'] if x.get('target')).items() if v>1]})
endpoints=[]
for p in tracked:
 if not p.startswith('functions/api/') or not p.endswith('.js'):continue
 s=read(p)
 endpoints.append({'path':p,'route':'/api/'+pathlib.PurePosixPath(p).stem,'exports':re.findall(r'export\s+(?:async\s+)?function\s+(\w+)',s),'securityReferences':sorted(set(re.findall(r'\b(?:requireSuperAdmin|requireOrderStaff|verifyFirebaseIdToken|enforceAuthenticatedRateLimit|originIsAllowed|verifyGitHubActionsOidc|assertSharedSecret|handleProductEditor|handleAuditRequest)\b',s)))})
phantoms=[x for x in m['firestore']['collectionsUsed'] if not re.fullmatch(r'[A-Za-z0-9_-]{1,80}',x['name'])]
result={'auditedBase':BASE,'sourceTree':subprocess.check_output(['git','rev-parse',BASE+'^{tree}'],text=True).strip(),'manifestFingerprint':m['sourceFingerprint'],'trackedFiles':len(tracked),'countsByTopDirectory':dict(sorted(collections.Counter(p.split('/')[0] for p in tracked if '/' in p).items())),'testFilesByDirectory':dict(sorted(collections.Counter(p.split('/')[1] for p in tracked if p.startswith('tests/')).items())),'pages':pages,'apiEndpoints':endpoints,'productionGraph':{'nodes':sorted(modules),'edges':[{'from':a,'to':b} for a,b in edges],'topImportConsumers':[{'path':p,'directConsumers':n} for p,n in fanin.most_common(20)],'stronglyConnectedComponents':components,'byteIdenticalModuleGroups':[v for v in byhash.values() if len(v)>1]},'manifestMissingReferences':m['missingReferences'],'phantomCollectionReferences':phantoms,'scopeLimits':['Static imports and literal dynamic imports from canonical manifest; indirect window registries, workers and Apps Script globals require manual tracing.','No unreferenced file is classified dead solely from this graph.','Security reference names are navigation aids; delegated auth and Rules must be read before judging authorization.']}
(OUT/'inventory.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
(OUT/'diagnostic-index-result.json').write_text(json.dumps({'finding':'F07-INDEX','phantoms':phantoms,'runtimeCollectionNameFilter':'^[A-Za-z0-9_-]{1,80}$','missingSecurityRulesClaimed':False},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'tracked':len(tracked),'pages':len(pages),'endpoints':len(endpoints),'productionModules':len(modules),'importEdges':len(edges),'cycles':components,'identicalModuleGroups':result['productionGraph']['byteIdenticalModuleGroups'],'topConsumers':result['productionGraph']['topImportConsumers'][:8]},ensure_ascii=False))
