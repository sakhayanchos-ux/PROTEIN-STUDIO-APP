/* Release 82: 3 pose photos, consultant approval for proof tasks, final cutoff 15:00. */
function cm82StartComplete(p){
 return !!(p?.before_front_photo_path&&p?.before_side_photo_path&&p?.before_back_photo_path);
}
function cm82FinishComplete(p){
 return !!(p?.after_front_photo_path&&p?.after_side_photo_path&&p?.after_back_photo_path);
}
function cm82PhotoGrid(p,prefix,label){
 const front=p?.[prefix+'_front_photo_path'],side=p?.[prefix+'_side_photo_path'],back=p?.[prefix+'_back_photo_path'];
 const items=[['Спереди',front],['Сбоку',side],['Сзади',back]];
 return '<div class="cm82-photo-grid">'+items.map(([name,path])=>'<div><b>'+label+' · '+name+'</b>'+(path?'<img class="task-photo" data-task-photo="'+escapeHtml(path)+'" alt="'+escapeHtml(label+' '+name)+'">':'<span class="muted">Нет фото</span>')+'</div>').join('')+'</div>';
}
cm81ZeroDay=function(s){
 const p=s.participant;
 if(!p||!cm82StartComplete(p)){
   if(s.phase!=='join')return '';
   return '<section class="card cm81-zero"><div class="eyebrow">📸 НУЛЕВОЙ ДЕНЬ</div><h2>Стартовые замеры и 3 фото ДО</h2><p>Нужны три ракурса: <b>спереди, сбоку и сзади</b>. Для фото сбоку выберите любую сторону и повторите ту же сторону ПОСЛЕ.</p>'+
    '<form id="cm82JoinForm"><div class="two-col"><label>Вес, кг<input name="weight" type="number" min="25" max="400" step="0.1" value="'+escapeHtml(p?.start_weight_kg??'')+'" required></label><label>Талия, см<input name="waist" type="number" min="30" max="300" step="0.1" value="'+escapeHtml(p?.start_waist_cm??'')+'" required></label></div>'+
    '<label>Фото ДО · спереди<input name="front" type="file" accept="image/jpeg,image/png,image/webp" required></label>'+
    '<label>Фото ДО · сбоку<input name="side" type="file" accept="image/jpeg,image/png,image/webp" required></label>'+
    '<label>Фото ДО · сзади<input name="back" type="file" accept="image/jpeg,image/png,image/webp" required></label>'+
    '<button class="btn primary">Сохранить старт 🏁</button><p role="status"></p></form></section>';
 }
 return '<section class="card cm81-zero"><div class="eyebrow">✅ НУЛЕВОЙ ДЕНЬ</div><h2>Старт зафиксирован</h2><div class="cm81-zero-grid"><div><span>Вес</span><b>'+escapeHtml(p.start_weight_kg??'—')+' кг</b></div><div><span>Талия</span><b>'+escapeHtml(p.start_waist_cm??'—')+' см</b></div><div><span>Фото ДО</span><b>3 / 3 ✓</b></div></div>'+
 cm82PhotoGrid(p,'before','ДО')+
 '<p class="muted">Кто в городе — 12 октября можно прийти на сканирование в клуб.</p></section>';
};
common75FinishCard=function(s){
 const p=s.participant;
 if(!p||s.phase!=='results')return '';
 if(cm82FinishComplete(p)){
   return '<section class="card cm82-finish"><div class="eyebrow">✅ ФИНАЛ</div><h2>Финальные замеры сохранены</h2><div class="cm81-zero-grid"><div><span>Вес</span><b>'+escapeHtml(p.end_weight_kg??'—')+' кг</b></div><div><span>Талия</span><b>'+escapeHtml(p.end_waist_cm??'—')+' см</b></div><div><span>Фото ПОСЛЕ</span><b>3 / 3 ✓</b></div></div>'+
   cm82PhotoGrid(p,'after','ПОСЛЕ')+
   '<button class="btn primary" data-cm75-go="progress">Создать коллаж</button>'+common75EntryStatus(common75Entry(s,'collage',s.campaign.results_date))+'</section>';
 }
 if(!s.final_measurements_open){
   return '<section class="card cm82-finish-closed"><div class="eyebrow">🔒 ФИНАЛЬНЫЕ ЗАМЕРЫ</div><h2>Приём замеров закрыт</h2><p>23 октября финальные замеры и фотографии принимаются <b>до 15:00</b>.</p></section>';
 }
 return '<section class="card cm82-finish"><div class="eyebrow">📸 ФИНАЛ · ДО 15:00</div><h2>Финальные замеры и 3 фото ПОСЛЕ</h2><p>Повторите те же три ракурса: <b>спереди, сбоку и сзади</b>. Сбоку — той же стороной, что и ДО.</p>'+
 '<form id="cm82FinishForm"><div class="two-col"><label>Вес, кг<input name="weight" type="number" min="25" max="400" step="0.1" required></label><label>Талия, см<input name="waist" type="number" min="30" max="300" step="0.1" required></label></div>'+
 '<label>Фото ПОСЛЕ · спереди<input name="front" type="file" accept="image/jpeg,image/png,image/webp" required></label>'+
 '<label>Фото ПОСЛЕ · сбоку<input name="side" type="file" accept="image/jpeg,image/png,image/webp" required></label>'+
 '<label>Фото ПОСЛЕ · сзади<input name="back" type="file" accept="image/jpeg,image/png,image/webp" required></label>'+
 '<button class="btn primary">Сохранить финал</button><p role="status">До 15:00 по времени марафона.</p></form></section>';
};
common75KindLabel=function(k){
 return ({
   steps:'Шаги · 1⭐/1000',
   dinner_shake:'Ужин коктейлем · 3⭐',
   turbo_detox:'Turbo / Detox · 3⭐',
   zoom_self:'Zoom · 5⭐',
   zoom_friend:'Друг в Zoom · 5⭐/чел.',
   workout:'Тренировка + фото · 5⭐',
   scan_friend:'Сканирование друга · 10⭐/чел.',
   vp:'VP · 20⭐/50 VP'
 })[k]||k;
};
cm80Bind=function(box,s){
 box.querySelectorAll('[data-cm80-workout]').forEach(form=>{
   form.onsubmit=e=>{
     e.preventDefault();
     buttonAction(form.querySelector('button'),async()=>{
       const file=form.querySelector('input').files[0];
       if(!file)throw Error('Добавьте фото после тренировки.');
       const taskPath=await uploadJourneyPhoto(file);
       const communityPath=await common75Upload(file,'ps-community','workout-');
       await checked(sb.rpc('ps_log_workout',{p_workout:form.dataset.cm80Workout,p_photo:taskPath}));
       await checked(sb.rpc('ps_submit_common_marathon_workout',{p_photo:communityPath}));
       await loadCommonMarathon75();
     },form.querySelector('[role=status]'));
   };
 });
 box.querySelectorAll('[data-video-path]').forEach(async el=>{
   if(el.dataset.videoPath)el.src=await signedMedia('ps-workout-media',el.dataset.videoPath);
 });
 const send=$('cm80SendStars');
 if(send)send.onclick=()=>{
   const st=$('cm80SendStarsStatus');
   buttonAction(send,async()=>{
     await checked(sb.rpc('ps_submit_marathon_stars'));
     await loadCommonMarathon75();
   },st);
 };
};
function cm82Bind(box,s){
 const join=$('cm82JoinForm');
 if(join)join.onsubmit=e=>{
   e.preventDefault();
   buttonAction(join.querySelector('button'),async()=>{
     const [front,side,back]=await Promise.all([
       uploadJourneyPhoto(join.elements.front.files[0]),
       uploadJourneyPhoto(join.elements.side.files[0]),
       uploadJourneyPhoto(join.elements.back.files[0])
     ]);
     await checked(sb.rpc('ps_join_common_marathon_v82',{
       p_weight:Number(join.elements.weight.value),
       p_waist:Number(join.elements.waist.value),
       p_front_photo:front,
       p_side_photo:side,
       p_back_photo:back
     }));
     await loadCommonMarathon75();
   },join.querySelector('[role=status]'));
 };
 const finish=$('cm82FinishForm');
 if(finish)finish.onsubmit=e=>{
   e.preventDefault();
   buttonAction(finish.querySelector('button'),async()=>{
     const [front,side,back]=await Promise.all([
       uploadJourneyPhoto(finish.elements.front.files[0]),
       uploadJourneyPhoto(finish.elements.side.files[0]),
       uploadJourneyPhoto(finish.elements.back.files[0])
     ]);
     await checked(sb.rpc('ps_finish_common_marathon_v82',{
       p_weight:Number(finish.elements.weight.value),
       p_waist:Number(finish.elements.waist.value),
       p_front_photo:front,
       p_side_photo:side,
       p_back_photo:back
     }));
     await loadCommonMarathon75();
   },finish.querySelector('[role=status]'));
 };
}
loadCommonMarathon75=async function(){
 const box=$('commonMarathon75')||$('journeyView');if(!box)return;
 try{
  if(isStaffWorkspace()&&!clientPreview)return loadCommonMarathonStaff75(box);
  const s=await checked(sb.rpc('ps_common_marathon_state'));common75State=s;
  if(!s.campaign){box.innerHTML='<section class="card">Активного марафона пока нет.</section>';return}
  if(s.phase==='upcoming'){
    box.innerHTML=cm81Locked(s);
    return;
  }
  const zero=cm81ZeroDay(s);
  const live=s.phase==='live';
  const result=s.phase==='results'||s.phase==='finished';
  box.innerHTML=
    zero+
    common75ZoomCard(s)+
    (live?common75Daily(s):'')+
    (live||result?cm80Tracker(s):'')+
    (live||result?cm80WorkoutSchedule(s):'')+
    (result?common75FinishCard(s):'')+
    common75Rules()+
    cm80Program(s)+
    (live||result?cm80StarSend(s):'')+
    common75History(s);
  bindCommonMarathon75(box,s);cm80Bind(box,s);cm81Bind(box,s);cm82Bind(box,s);hydratePhotos(box);
 }catch(e){journeyError(box,e,loadCommonMarathon75)}
};