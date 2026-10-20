const feed = document.querySelector('[data-instagram-feed]');
let dialog, frame, destination, returnFocus;
function instagramPost(value) {
  try {
    const url = new URL(value);
    return url.origin === 'https://www.instagram.com' && /^\/(?:reel|p)\/[A-Za-z0-9_-]+\/$/.test(url.pathname) ? url.origin + url.pathname : '';
  } catch { return ''; }
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
  let started=false, loading=false, lastUpdated=0;
  async function refresh() {
    if(loading || document.hidden || dialog?.open || Date.now()-lastUpdated<60000) return;
    loading=true;
    const controller=new AbortController();
    const timeout=window.setTimeout(()=>controller.abort(),10000);
    try {
      const response=await fetch('/api/instagram-feed',{cache:'no-cache',signal:controller.signal});
      if(!response.ok) return;
      const data=await response.json();
      if(!data.available || !Array.isArray(data.videos)) return;
      const cards=[];
      for(const item of data.videos) {
        const url=instagramPost(item.url); if(!url) continue;
        const card=document.createElement('button');card.type='button';card.className='tt-instagram-video';card.dataset.instagramVideo=url;
        const title=String(item.caption || 'Video de @tintinaccs');card.setAttribute('aria-label','Reproducir: '+title);
        if(item.thumbnail) {
          try {const imageUrl=new URL(item.thumbnail);if(imageUrl.protocol==='https:' && /(?:^|\.)(?:cdninstagram\.com|fbcdn\.net|instagram\.com)$/.test(imageUrl.hostname)) {const image=document.createElement('img');image.src=imageUrl.href;image.alt='';image.loading='lazy';image.decoding='async';card.append(image);}} catch {}
        }
        const play=document.createElement('span');play.className='tt-instagram-play';play.textContent='';play.setAttribute('aria-hidden','true');
        const caption=document.createElement('span');caption.className='tt-instagram-caption';caption.textContent=title;
        card.append(play,caption);cards.push(card);
      }
      // Avoid replacing a focused card during background refresh.
      if(!feed.contains(document.activeElement))feed.replaceChildren(...cards);
      lastUpdated=Date.now();
    } catch {} finally {window.clearTimeout(timeout);loading=false;}
  }
  const start=()=>{if(started)return;started=true;void refresh();window.setInterval(()=>{if(feedSurface.getBoundingClientRect().top<innerHeight && feedSurface.getBoundingClientRect().bottom>0)void refresh();},60000);};
  if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();start();}},{rootMargin:'200px'});observer.observe(feedSurface);}else start();
  document.addEventListener('visibilitychange',()=>{if(started && !document.hidden)void refresh();});
}
