/* Ofuq TV offline support — scope only this channel's caches. */
const CACHE="ofuq-web-v4-20261029-restored";
const CORE=["./","./index.html","./site.css","./main.js","./config.js","./broadcast.html","./assets/mark.svg","./assets/brand.svg","./assets/atlas.svg","./manifest.webmanifest"];
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>(key.startsWith("ofuq-web-")||key.startsWith("ofuq-tv-"))&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
  const req=event.request;
  if(req.method!=="GET")return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin||!url.pathname.startsWith(self.registration.scope.replace(self.location.origin,""))||url.pathname.includes("/api/"))return;
  event.respondWith(fetch(req).then(resp=>{
    if(resp.ok&&(req.mode==="navigate"||/\.(?:css|js|svg|png|webmanifest)$/.test(url.pathname))){
      const copy=resp.clone();
      event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,copy)));
    }
    return resp;
  }).catch(()=>caches.match(req).then(cached=>cached||Response.error())));
});