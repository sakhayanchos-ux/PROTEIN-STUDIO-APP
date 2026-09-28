const CACHE="protein-studio-app-v49";
const CORE=["./","./index.html","./styles.css","./app.js","./community.js","./admin.js","./config.js","./manifest.webmanifest","./portion-guide.svg","./rhinestones.jpg","./theme-kpop.jpg","./theme-neon.jpg","./theme-sunset.jpg"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
  const url=new URL(e.request.url);
  if(e.request.method!=="GET"||url.origin!==self.location.origin)return;
  const allowed=CORE.some(path=>new URL(path,self.registration.scope).pathname===url.pathname);
  if(!allowed)return;
  e.respondWith(fetch(e.request).then(r=>{
    if(r.ok){
      const copy=r.clone();
      e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)));
    }
    return r;
  }).catch(async()=>await caches.match(e.request,{ignoreSearch:true})||Response.error()));
});
