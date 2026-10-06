const CACHE="protein-studio-app-v70";
const CORE=["./","./index.html","./styles.css","./release56.css","./release58.css","./release62.css","./release68.css","./app.js","./release56.js","./story58.js","./password-reset58.js","./image-editor58.js","./messages.js","./staff-chat.js","./client-extras.js","./release68.js","./events62-base.js","./events62-admin.js","./features.css","./coach.js","./invitations.js","./coach.css","./vendor/qrcode.js","./community.js","./admin.js","./workspace.js","./journey.js","./workout-library.js","./journey.css","./theme-blackgold.svg","./consultant-card.js","./config.js","./manifest.webmanifest","./portion-guide.svg","./rhinestones.jpg","./theme-kpop.jpg","./theme-neon.jpg","./theme-sunset.jpg"];
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



self.addEventListener('push',event=>{let data={};try{data=event.data?.json()||{}}catch{}event.waitUntil(self.registration.showNotification(data.title||'PROTEIN STUDIO',{body:data.body||'Новое событие',tag:data.tag||'protein-studio',data:{route:data.route||{page:'notifications'}}}))});
self.addEventListener('notificationclick',event=>{event.notification.close();const route=event.notification.data?.route||{page:'notifications'};event.waitUntil((async()=>{const tabs=await self.clients.matchAll({type:'window',includeUncontrolled:true});const tab=tabs.find(c=>c.url.startsWith(self.registration.scope));if(tab){await tab.focus();tab.postMessage({type:'PS_NOTICE',route})}else{const url=new URL('./',self.registration.scope);url.searchParams.set('notice',JSON.stringify(route));await self.clients.openWindow(url.href)}})())});
