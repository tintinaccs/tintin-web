const feed = document.querySelector('[data-instagram-feed]');
let dialog, frame, destination, returnFocus;
function instagramPost(value) {
  try {
    const url = new URL(value);
    return url.origin === 'https://www.instagram.com' && /^\/(?:reel|p)\/[A-Za-z0-9_-]+\/$/.test(url.pathname) ? url.origin + url.pathname : '';
  } catch { return ''; }
}
// Same allowed image hosts as functions/api/instagram-feed.js.
function instagramImage(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /(?:^|\.)(?:cdninstagram\.com|fbcdn\.net|instagram\.com)$/.test(url.hostname) ? url.href : '';
  } catch { return ''; }
}
const POSTS = {
  image: {fallback: 'Foto de @tintinaccs', label: 'Ver foto en Instagram'},
  carousel: {fallback: 'Carrusel de @tintinaccs', label: 'Ver carrusel en Instagram'},
  video: {fallback: 'Video de @tintinaccs'}
};
// Videos keep the in-page player; photos and carousels open the post on Instagram in a new tab.
function buildCard(item) {
  const type = item?.type, url = instagramPost(item?.url);
  if (!Object.prototype.hasOwnProperty.call(POSTS, type) || !url) return null;
  const kind = POSTS[type], title = String(item.caption || kind.fallback), isVideo = type === 'video';
  const card = document.createElement(isVideo ? 'button' : 'a');
  card.className = 'tt-instagram-post';
  if (isVideo) {
    card.type = 'button'; card.dataset.instagramVideo = url; card.setAttribute('aria-label', 'Reproducir: ' + title);
  } else {
    card.href = url; card.target = '_blank'; card.rel = 'noopener noreferrer';
    card.setAttribute('aria-label', kind.label + ': ' + title + ' (se abre en una pestaña nueva)');
  }
  const source = instagramImage(item.thumbnail);
  if (source) {
    const image = document.createElement('img');
    image.src = source; image.alt = ''; image.width = 640; image.height = 640; image.loading = 'lazy'; image.decoding = 'async';
    card.append(image);
  }
  if (isVideo) {
    const play = document.createElement('span'); play.className = 'tt-instagram-play'; play.setAttribute('aria-hidden', 'true');
    card.append(play);
  } else if (type === 'carousel') {
    // Not named "badge": the theme restyles every [class*="-badge"] element.
    const stack = document.createElement('span'); stack.className = 'tt-instagram-stack'; stack.setAttribute('aria-hidden', 'true');
    card.append(stack);
  }
  const caption = document.createElement('span'); caption.className = 'tt-instagram-caption'; caption.textContent = title;
  card.append(caption);
  return card;
}
function ensurePlayer() {
  if (dialog) return;
  dialog = document.createElement('dialog'); dialog.className = 'tt-instagram-player'; dialog.setAttribute('aria-label', 'Video de Tintin en Instagram');
  const header=document.createElement('div'); header.className='tt-instagram-player-head';
  const label=document.createElement('strong'); label.textContent='@tintinaccs';
  const close=document.createElement('button'); close.type='button'; close.textContent='×'; close.setAttribute('aria-label','Cerrar video'); close.className='tt-instagram-close';
  header.append(label,close);
  frame=document.createElement('iframe'); frame.title='Reproductor de Instagram'; frame.allow='autoplay; encrypted-media; fullscreen; picture-in-picture'; frame.referrerPolicy='strict-origin-when-cross-origin'; frame.allowFullscreen=true;
  destination=document.createElement('a'); destination.className='tt-instagram-link'; destination.textContent='Ir a Instagram'; destination.target='_blank'; destination.rel='noopener noreferrer';
  dialog.append(header,frame,destination); document.body.append(dialog);
  close.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
  dialog.addEventListener('close',()=>{frame.removeAttribute('src');document.documentElement.classList.remove('tt-instagram-playing');returnFocus?.focus();});
}
document.addEventListener('click',event=>{
  const trigger=event.target.closest('[data-instagram-video]');
  if(!trigger) return;
  const url=instagramPost(trigger.dataset.instagramVideo);
  if(!url) return;
  event.preventDefault(); ensurePlayer(); returnFocus=trigger;
  destination.href=url;
  frame.src=url+'embed/?autoplay=1';
  dialog.showModal(); document.documentElement.classList.add('tt-instagram-playing');
});
if(feed) {
  const feedSurface=feed.closest('section') || feed;
  const refreshInterval=60000;
  let nearViewport=false, pageActive=true, loading=false, lastAttempt=0, timer=0, activeRequest=null, renderedFeed='';
  const canRefresh=()=>nearViewport && pageActive && !document.hidden;
  const surfaceIsNear=()=>{const rect=feedSurface.getBoundingClientRect();return rect.top<innerHeight+200 && rect.bottom>-200;};
  // Empty state (message + "Ir a Instagram") only when there is nothing to show; cards already on screen are kept on a failed refresh.
  const markEmpty=()=>{if(!feed.children.length)feed.dataset.state='empty';};
  function pause() {
    window.clearTimeout(timer);timer=0;
    // Un intento cortado al salir de la sección no cuenta: al volver se pide de inmediato.
    if(activeRequest){activeRequest.abort();lastAttempt=0;}
  }
  function schedule() {
    window.clearTimeout(timer);timer=0;
    if(!canRefresh() || loading) return;
    timer=window.setTimeout(()=>{timer=0;void refresh();},Math.max(0,refreshInterval-(Date.now()-lastAttempt)));
  }
  async function refresh() {
    if(loading || !canRefresh()) return;
    // An observer delivery can lag a scroll or a restored page by a frame.
    if(!surfaceIsNear()) {nearViewport=false;pause();return;}
    if(dialog?.open) {lastAttempt=Date.now();schedule();return;}
    loading=true;
    lastAttempt=Date.now();
    const controller=new AbortController();
    activeRequest=controller;
    let timedOut=false;
    const timeout=window.setTimeout(()=>{timedOut=true;controller.abort();},10000);
    try {
      const response=await fetch('/api/instagram-feed',{cache:'no-cache',signal:controller.signal});
      if(!response.ok) return markEmpty();
      const data=await response.json();
      if(controller.signal.aborted || !canRefresh()) {if(!timedOut)lastAttempt=0;return;}
      if(!data.available || !Array.isArray(data.posts)) return markEmpty();
      const fingerprint=JSON.stringify(data.posts.map(item=>[item?.type,item?.url,item?.caption,item?.thumbnail]));
      if(fingerprint===renderedFeed) return;
      const cards=data.posts.map(buildCard).filter(Boolean);
      if(!cards.length) return markEmpty();
      // Avoid replacing a focused card during background refresh.
      if(!feed.contains(document.activeElement)) {feed.replaceChildren(...cards);feed.dataset.state='ready';renderedFeed=fingerprint;}
    } catch {if(timedOut || !controller.signal.aborted)markEmpty();} finally {window.clearTimeout(timeout);loading=false;activeRequest=null;schedule();}
  }
  function reconcile() {if(canRefresh())schedule();else pause();}
  if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{nearViewport=entries.some(entry=>entry.isIntersecting);reconcile();},{rootMargin:'200px'});observer.observe(feedSurface);}else {
    let frame=0;
    const check=()=>{frame=0;nearViewport=surfaceIsNear();reconcile();};
    const onScroll=()=>{if(!frame)frame=requestAnimationFrame(check);};
    window.addEventListener('scroll',onScroll,{passive:true});
    window.addEventListener('resize',onScroll,{passive:true});
    check();
  }
  document.addEventListener('visibilitychange',reconcile);
  window.addEventListener('pagehide',()=>{pageActive=false;pause();});
  window.addEventListener('pageshow',()=>{pageActive=true;reconcile();});
  reconcile();
}
