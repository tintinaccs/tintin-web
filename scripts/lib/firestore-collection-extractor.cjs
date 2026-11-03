const {parse} = require('acorn');
const {parse:parseHtml} = require('parse5');
function scanJavaScript(source, lineOffset=0) {
 let tree;
 try { tree=parse(source,{ecmaVersion:'latest',sourceType:'module',locations:true,allowAwaitOutsideFunction:true,allowReturnOutsideFunction:true}); }
 catch { tree=parse(source,{ecmaVersion:'latest',sourceType:'script',locations:true,allowAwaitOutsideFunction:true,allowReturnOutsideFunction:true}); }
 const found=[];const visit=node=>{
  if(!node||typeof node!=='object')return;
  if(node.type==='CallExpression'&&node.callee?.type==='Identifier'&&['collection','doc'].includes(node.callee.name)&&node.arguments[0]?.type==='Identifier'&&node.arguments[0].name==='db'&&node.arguments[1]?.type==='Literal'&&typeof node.arguments[1].value==='string')found.push({name:node.arguments[1].value,line:node.loc.start.line+lineOffset,operation:node.callee.name});
  for(const [key,value] of Object.entries(node)){if(key==='loc')continue;if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);}
 };visit(tree);return found;
}
function extractCollections(source,{html=false}={}) {
 if(!html)return scanJavaScript(source);
 const tree=parseHtml(source,{sourceCodeLocationInfo:true});const found=[];
 const visit=node=>{if(node.tagName==='script'&&!node.attrs.some(a=>a.name==='src')){const type=node.attrs.find(a=>a.name==='type')?.value||'';if(['','module','text/javascript','application/javascript'].includes(type)){const text=(node.childNodes||[]).filter(n=>n.nodeName==='#text').map(n=>n.value).join('');const offset=(node.sourceCodeLocation?.startTag?.endLine||1)-1;found.push(...scanJavaScript(text,offset));}}for(const child of node.childNodes||[])visit(child);};visit(tree);return found;
}
module.exports={extractCollections};
