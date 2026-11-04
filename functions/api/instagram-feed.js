// Latest posts (photos, carousels and videos) from the connected professional account. Credentials stay on the server.
const PROFILE = 'https://www.instagram.com/tintinaccs/';
const LIMIT = 12;
const TYPES = {IMAGE:'image',CAROUSEL_ALBUM:'carousel',VIDEO:'video'};
const FALLBACK_CAPTION = {image:'Foto de @tintinaccs',carousel:'Carrusel de @tintinaccs',video:'Video de @tintinaccs'};
function postUrl(value) {
  try {
    const url = new URL(value);
    return url.origin === 'https://www.instagram.com' && /^\/(?:reel|p)\/[A-Za-z0-9_-]+\/$/.test(url.pathname) ? url.origin + url.pathname : '';
  } catch { return ''; }
}
// Only images from Instagram's CDN. A video file is not a valid thumbnail (e.g. a carousel whose first piece is a video).
function thumbnailUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /(?:^|\.)(?:cdninstagram\.com|fbcdn\.net|instagram\.com)$/.test(url.hostname) && !/\.(?:mp4|mov|m4v|webm)$/i.test(url.pathname) ? url.href : '';
  } catch { return ''; }
}
export function instagramPosts(data) {
  const time = post => Date.parse(post.publishedAt) || 0;
  return (Array.isArray(data?.data) ? data.data : []).flatMap(item => {
    const type = TYPES[item?.media_type], url = postUrl(item?.permalink);
    if (!type || !url) return [];
    return [{id:String(item.id || '').slice(0,100),type,url,thumbnail:thumbnailUrl(type === 'video' ? item.thumbnail_url : item.media_url),caption:String(item.caption || FALLBACK_CAPTION[type]).slice(0,160),publishedAt:Number.isFinite(Date.parse(item.timestamp)) ? new Date(item.timestamp).toISOString() : ''}];
  }).sort((a,b)=>time(b)-time(a)).slice(0,LIMIT);
}
export async function onRequestGet({env,request,waitUntil}) {
  const respond = (body,status=200) => Response.json({profile:PROFILE,username:'tintinaccs',...body},{status,headers:{'Cache-Control':status===200?'public, max-age=60, s-maxage=120':'no-store','X-Content-Type-Options':'nosniff'}});
  const uid=String(env.INSTAGRAM_USER_ID || '');
  const token=env.INSTAGRAM_ACCESS_TOKEN;
  if (!/^\d{5,40}$/.test(uid) || !token) return respond({available:false,posts:[]});
  const version=/^v\d{2}\.0$/.test(env.INSTAGRAM_GRAPH_VERSION || '') ? env.INSTAGRAM_GRAPH_VERSION : 'v24.0';
  const cache=globalThis.caches?.default;
  const cacheKey=cache && request ? new Request(new URL(`/__instagram-feed-cache/v2/${uid}/${version}`,request.url).href) : null;
  if(cacheKey) {try {const cached=await cache.match(cacheKey);if(cached)return cached;} catch {}}
  const url=new URL(`https://graph.instagram.com/${version}/${uid}/media`);
  url.searchParams.set('fields','id,caption,media_type,media_url,thumbnail_url,permalink,timestamp');
  // Headroom over LIMIT: items with an unknown type or an invalid permalink are dropped.
  url.searchParams.set('limit',String(LIMIT * 2));
  try {
    const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(8000),cf:{cacheTtl:120,cacheEverything:true}});
    // Status only: an expired token must be diagnosable without logging the token or Instagram's response body.
    if(!response.ok) {console.warn('instagram-feed: Instagram respondió con estado',response.status);return respond({available:false,posts:[]},503);}
    const data=await response.json();
    const result=respond({available:true,posts:instagramPosts(data),updatedAt:new Date().toISOString()});
    if(cacheKey) {
      const save=cache.put(cacheKey,result.clone()).catch(()=>{});
      if(waitUntil)waitUntil(save);else await save;
    }
    return result;
  } catch (error) {console.warn('instagram-feed: sin respuesta de Instagram',error?.name);return respond({available:false,posts:[]},503);}
}
