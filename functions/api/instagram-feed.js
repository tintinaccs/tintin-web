// Latest videos from the connected professional account. Credentials stay on the server.
const PROFILE = 'https://www.instagram.com/tintinaccs/';
function postUrl(value) {
  try {
    const url = new URL(value);
    return url.origin === 'https://www.instagram.com' && /^\/(?:reel|p)\/[A-Za-z0-9_-]+\/$/.test(url.pathname) ? url.origin + url.pathname : '';
  } catch { return ''; }
}
function thumbnailUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /(?:^|\.)(?:cdninstagram\.com|fbcdn\.net|instagram\.com)$/.test(url.hostname) ? url.href : '';
  } catch { return ''; }
}
export function instagramVideos(data) {
  return (Array.isArray(data?.data) ? data.data : []).filter(item => item.media_type === 'VIDEO' && postUrl(item.permalink))
    .map(item => ({id:String(item.id || '').slice(0,100),url:postUrl(item.permalink),thumbnail:thumbnailUrl(item.thumbnail_url),caption:String(item.caption || 'Video de @tintinaccs').slice(0,160),publishedAt:Number.isFinite(Date.parse(item.timestamp)) ? new Date(item.timestamp).toISOString() : ''}))
    .sort((a,b)=>Date.parse(b.publishedAt || 0)-Date.parse(a.publishedAt || 0)).slice(0,8);
}
export async function onRequestGet({env,request,waitUntil}) {
  const respond = (body,status=200) => Response.json({profile:PROFILE,username:'tintinaccs',...body},{status,headers:{'Cache-Control':status===200?'public, max-age=60, s-maxage=120':'no-store','X-Content-Type-Options':'nosniff'}});
  const uid=String(env.INSTAGRAM_USER_ID || '');
  const token=env.INSTAGRAM_ACCESS_TOKEN;
  if (!/^\d{5,40}$/.test(uid) || !token) return respond({available:false,videos:[]});
  const version=/^v\d{2}\.0$/.test(env.INSTAGRAM_GRAPH_VERSION || '') ? env.INSTAGRAM_GRAPH_VERSION : 'v24.0';
  const cache=globalThis.caches?.default;
  const cacheKey=cache && request ? new Request(new URL(`/__instagram-feed-cache/${uid}/${version}`,request.url).href) : null;
  if(cacheKey) {try {const cached=await cache.match(cacheKey);if(cached)return cached;} catch {}}
  const url=new URL(`https://graph.instagram.com/${version}/${uid}/media`);
  url.searchParams.set('fields','id,caption,media_type,thumbnail_url,permalink,timestamp');
  url.searchParams.set('limit','50');
  try {
    const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(8000),cf:{cacheTtl:120,cacheEverything:true}});
    if(!response.ok) return respond({available:false,videos:[]},503);
    const data=await response.json();
    const result=respond({available:true,videos:instagramVideos(data),updatedAt:new Date().toISOString()});
    if(cacheKey) {
      const save=cache.put(cacheKey,result.clone()).catch(()=>{});
      if(waitUntil)waitUntil(save);else await save;
    }
    return result;
  } catch { return respond({available:false,videos:[]},503); }
}
