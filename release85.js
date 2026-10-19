/* Release 85: muted feed autoplay, never autoplay training videos. */
(function(){
 if(!('IntersectionObserver' in window))return;
 const watched=new WeakSet();
 const observer=new IntersectionObserver(entries=>{
  for(const e of entries){
   const video=e.target;
   if(!video.isConnected){observer.unobserve(video);continue}
   if(e.isIntersecting&&e.intersectionRatio>=0.55&&!document.hidden){
    video.muted=true;
    video.play().catch(()=>{});
   }else video.pause();
  }
 },{threshold:[0,0.55,0.85]});
 function update(){
  document.querySelectorAll('video[data-feed-autoplay="1"]').forEach(video=>{
   if(video.closest('.cm80-workout,.workout-library,.workout-card,[data-page="workouts"]'))return;
   if(watched.has(video))return;
   watched.add(video);
   video.muted=true;video.playsInline=true;video.preload='metadata';
   observer.observe(video);
  });
 }
 const mutations=new MutationObserver(update);
 function start(){update();mutations.observe(document.body,{childList:true,subtree:true})}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 document.addEventListener('visibilitychange',()=>{
  if(document.hidden)document.querySelectorAll('video[data-feed-autoplay="1"]').forEach(v=>v.pause());
 });
})();
