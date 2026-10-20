/* Generated during build. Only the application shell is cached here. */
const CACHE=__CACHE_NAME__;
const PRECACHE=__PRECACHE__;
self.addEventListener('install',event=>{
  // Atomic install: keep the current version if any required resource fails.
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PRECACHE.map(url=>new Request(url,{cache:'reload'})))));
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    // Retain the previous assets for tabs that have not reloaded yet.
    const versions=(await caches.keys()).filter(k=>k.startsWith('qos-shell-')&&k!==CACHE);
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    if(clients.length<=1)await Promise.all(versions.slice(0,-1).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('message',event=>{
  if(event.data?.type==='APPLY_UPDATE')event.waitUntil(self.skipWaiting());
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  // Never cache Supabase requests, writes, tokens or arbitrary network data.
  if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/downloads/'))return;
  if(request.mode==='navigate'){
    event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match('/index.html'))||fetch(request)));
    return;
  }
  if(!PRECACHE.includes(url.pathname)&&!url.pathname.startsWith('/assets/'))return;
  event.respondWith((async()=>{
    const current=await caches.open(CACHE);
    return (await current.match(url.pathname)) || (await caches.match(url.pathname)) || fetch(request);
  })());
});
