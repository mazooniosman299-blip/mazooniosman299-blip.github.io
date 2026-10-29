/* OFUQ TV cache v6 — network first. Do not cache live state or news feeds. */
const CACHE='ofuq-web-v6-20261029-teal';
const CORE=['./','./index.html','./theme.css','./website.js','./station.js','./player.html','./onair.html','./assets/ofuq-mark.svg','./manifest.webmanifest'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).catch(()=>{}));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ofuq-web-')&&k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{const req=e.request,url=new URL(req.url);if(req.method!=='GET'||url.origin!==self.location.origin||/\/(news|live)\.json$/.test(url.pathname))return;e.respondWith(fetch(req).then(res=>{if(res.ok&&res.type==='basic'){const copy=res.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{}))}return res}).catch(()=>caches.match(req).then(r=>r||(req.mode==='navigate'?caches.match('./index.html'):Response.error()))))});
