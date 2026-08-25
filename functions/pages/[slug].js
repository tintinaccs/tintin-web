import { decodeFirestoreFields, firestoreAdminGet } from '../../cloudflare/firebase-admin-ligero.js';

const PAGE_REDIRECTS = Object.freeze({ contact:'/contact', contacto:'/contact', about:'/about', nosotros:'/about', 'quienes-somos':'/about', envios:'/envios', shipping:'/envios', 'shipping-policy':'/envios', faq:'/preguntas-frecuentes', 'preguntas-frecuentes':'/preguntas-frecuentes', 'cambios-devoluciones':'/cambios-devoluciones', devoluciones:'/cambios-devoluciones', cambios:'/cambios-devoluciones', privacy:'/privacidad', privacidad:'/privacidad', terms:'/terminos', terminos:'/terminos' });

function safeSlug(value) { const slug = String(value || '').trim().toLowerCase(); return /^[a-z0-9][a-z0-9-]{0,179}$/.test(slug) ? slug : ''; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char])); }
function sanitizeContent(value) {
  return String(value || '')
    .replace(/<\/?(?:script|style|iframe|object|embed|form|base|meta|link)[^>]*>/gi, '')
    .replace(/\s(?:on[a-z]+|srcdoc)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(?:href|src)\s*=\s*(["'])\s*javascript:[^"']*\1/gi, '')
    .replace(/\s(?:href|src)\s*=\s*javascript:[^\s>]+/gi, '');
}
function renderPage(data, request) {
  const title = escapeHtml(data.title || 'Tintin');
  const description = escapeHtml(data.metaDescription || 'Descubrí el universo Tintin.');
  const content = sanitizeContent(data.contentHtml);
  const template = ['standard', 'editorial', 'minimal'].includes(data.template) ? data.template : 'standard';
  const css = ':root{--tt-ink:#2b1c25;--tt-pink:#b63d6b;--tt-soft:#fff4f8;--tt-border:#efd8e2}*{box-sizing:border-box}body{margin:0;background:var(--tt-soft);color:var(--tt-ink);font-family:Montserrat;line-height:1.65}.tt-shell{min-height:100vh;display:flex;flex-direction:column}.tt-header{height:76px;background:#fff;border-bottom:1px solid var(--tt-border);display:flex;align-items:center;justify-content:space-between;padding:0 clamp(20px,6vw,96px);position:sticky;top:0;z-index:2}.tt-brand{color:var(--tt-pink);font-weight:800;letter-spacing:.2em;text-decoration:none}.tt-back{color:var(--tt-pink);font-size:.88rem;text-decoration:none}.tt-main{width:min(100% - 32px,960px);margin:clamp(28px,7vw,84px) auto;flex:1}.tt-card{background:#fff;border:1px solid var(--tt-border);border-radius:24px;padding:clamp(24px,5vw,64px);box-shadow:0 16px 45px rgba(111,40,75,.08)}.tt-card h1{font-size:clamp(2rem,5vw,4rem);line-height:1.08;margin:0 0 28px}.tt-content{font-size:clamp(1rem,1.3vw,1.12rem)}.tt-content h2,.tt-content h3{color:var(--tt-pink);line-height:1.2;margin-top:2em}.tt-content a{color:var(--tt-pink);font-weight:700}.tt-content img{display:block;max-width:100%;height:auto;border-radius:16px;margin:1.5rem auto}.tt-footer{text-align:center;padding:28px 20px;color:#806b76;font-size:.8rem}.tt-template-editorial .tt-card{border-radius:8px}.tt-template-minimal{background:#fff}.tt-template-minimal .tt-card{box-shadow:none;border:0;padding-inline:0;background:transparent}@media(max-width:640px){.tt-header{height:64px;padding:0 18px}.tt-main{width:min(100% - 22px,960px);margin:22px auto}.tt-card{border-radius:18px;padding:24px 20px}.tt-back{font-size:.78rem}}@media(prefers-reduced-motion:no-preference){.tt-card{animation:tt-in .35s ease both}@keyframes tt-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}}';
  const body = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Tintin</title><meta name="description" content="${description}"><style>${css}</style></head><body><div class="tt-shell tt-template-${template}"><header class="tt-header"><a class="tt-brand" href="/">TINTIN</a><a class="tt-back" href="/">Volver a la tienda</a></header><main class="tt-main"><article class="tt-card"><h1>${title}</h1><div class="tt-content">${content || '<p>Esta página está lista para recibir contenido.</p>'}</div></article></main><footer class="tt-footer">Tintin Accesorios · Hecho para brillar</footer></div></body></html>`;
  return new Response(request.method === 'HEAD' ? null : body, { status:200, headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=30, s-maxage=120','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin'} });
}
export async function onRequest({ request, params, env }) {
  if (!['GET','HEAD'].includes(request.method)) return new Response(null,{status:405,headers:{allow:'GET, HEAD'}});
  const slug = safeSlug(params?.slug);
  if (!slug) return new Response('Página no encontrada',{status:404,headers:{'cache-control':'public, max-age=300'}});
  try {
    const document = await firestoreAdminGet(env, `site_content/${encodeURIComponent(slug)}`);
    if (document?.fields) {
      const page = decodeFirestoreFields(document.fields);
      if (page.pageType === 'custom') {
        if (page.published === false) return new Response('Página no encontrada',{status:404,headers:{'cache-control':'no-store'}});
        return renderPage(page, request);
      }
    }
  } catch (error) { console.error('No se pudo resolver la página personalizada', error); }
  const target = PAGE_REDIRECTS[slug];
  if (!target) return new Response('Página no encontrada',{status:404,headers:{'cache-control':'public, max-age=300','x-tintin-legacy-route':'shopify-page-miss'}});
  return new Response(null,{status:301,headers:{location:new URL(target,request.url).toString(),'cache-control':'public, max-age=3600, s-maxage=86400','x-tintin-legacy-route':'shopify-page'}});
}
