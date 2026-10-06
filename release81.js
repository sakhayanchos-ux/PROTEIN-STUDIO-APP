/* Release 81: lock until 12 Oct, compact marathon, step proof, zero-day summary. */
function cm81Locked(s){
 return '<section class="card cm81-locked"><div class="cm81-lock">🔒</div><h1>Марафон откроется 12 октября</h1><p>До старта раздел закрыт для участников.</p><div class="cm81-lock-date"><b>12 октября</b><span>Нулевой день · замеры, фото ДО, сканирование в клубе</span><span>Zoom-старт в 20:00</span></div></section>';
}
function cm81ZeroDay(s){
 if(!s.participant){
  if(s.phase==='join')return common75JoinCard(s);
  return '';
 }
 const p=s.participant;
 return '<section class="card cm81-zero"><div class="eyebrow">✅ НУЛЕВОЙ ДЕНЬ</div><h2>Старт зафиксирован</h2><div class="cm81-zero-grid"><div><span>Вес</span><b>'+escapeHtml(p.start_weight_kg??'—')+' кг</b></div><div><span>Талия</span><b>'+escapeHtml(p.start_waist_cm??'—')+' см</b></div><div><span>Фото ДО</span><b>'+(p.before_photo_path?'✓ добавлено':'—')+'</b></div></div>'+(p.before_photo_path?'<img class="task-photo cm81-before" data-task-photo="'+escapeHtml(p.before_photo_path)+'" alt="Фото ДО">':'')+'<p class="muted">Кто в городе — 12 октября можно прийти на сканирование в клуб.</p></section>';
}
common75ZoomCard=function(s){
 const sessions=s.zoom_sessions||[],today=s.today;
 const todaySession=sessions.find(x=>x.session_date===today);
 const z=todaySession||sessions.find(x=>x.session_date>today)||sessions[sessions.length-1];
 if(!z)return '';
 if(todaySession?.is_rest)return '<section class="card cm75-zoom"><div class="eyebrow">🌿 СЕГОДНЯ</div><h2>День отдыха</h2><p>Восстановление и мягкая активность.</p></section>';
 const isToday=z.session_date===today;
 const self=common75Entry(s,'zoom_self'),friend=common75Entry(s,'zoom_friend');
 const url=common75SafeUrl(z.zoom_url),time=cm80Time(z)||'07:30';
 return '<section class="card cm75-zoom"><div class="eyebrow">☀️ ZOOM · '+escapeHtml(time)+'</div><h2>'+escapeHtml(z.topic||z.title)+'</h2><p>'+common75Date(z.session_date)+(z.speaker?' · '+escapeHtml(z.speaker):'')+(isToday?' · сегодня':'')+'</p>'+
   (z.sales_focus?'<p class="muted">Фокус: '+escapeHtml(z.sales_focus)+'</p>':'')+
   common75Poster(z.poster_path)+
   (url?'<a class="btn primary app-link" href="'+escapeHtml(url)+'" target="_blank" rel="noopener">Подключиться к Zoom</a>':'<p class="muted">Ссылка Zoom появится здесь.</p>')+
   (isToday&&s.participant?'<div class="cm75-actions">'+
     (self?common75EntryStatus(self):'<button class="btn ghost" data-cm75-submit="zoom_self">Я подключилась · +5⭐</button><p id="cm75ZoomStatus" role="status"></p>')+
     (friend?common75EntryStatus(friend):'<form data-cm75-form="zoom_friend"><label>Сколько друзей подключилось?<input name="qty" type="number" min="1" max="20" value="1" required></label><button class="btn ghost">Друг в Zoom · +5⭐ за каждого</button><p role="status"></p></form>')+
   '</div>':'')+'</section>';
};
common75Daily=function(s){
 if(!s.participant||s.phase!=='live')return '';
 const steps=common75Entry(s,'steps'),dinner=common75Entry(s,'dinner_shake'),turbo=common75Entry(s,'turbo_detox'),
 scan=common75Entry(s,'scan_friend'),vp=common75Entry(s,'vp');
 const ambassador=(s.entries||[]).find(e=>e.kind==='ambassador'&&(e.status==='auto'||e.status==='approved'));
 return '<section class="card cm75-today"><div class="eyebrow">ДЕНЬ '+s.day_number+' ИЗ 10</div><h2>Сегодня собираем ⭐</h2>'+
 '<div class="cm75-task"><h3>🚶 Шаги · 1⭐ / 1000</h3><form data-cm81-steps><label>Шагов сегодня<input name="value" type="number" min="0" max="100000" value="'+escapeHtml(steps?.value??'')+'" required></label><label>Скриншот шагов<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required></label><button class="btn ghost">Отправить шаги в общую группу</button><p role="status">'+(steps?'Сейчас: '+steps.value+' шагов · +'+steps.stars+'⭐':'')+'</p></form></div>'+
 '<div class="cm75-task"><h3>🥤 Ужин коктейлем · 3⭐</h3>'+(dinner&&dinner.status!=='rejected'?common75EntryStatus(dinner):'<form data-cm75-photo="dinner_shake"><label>Фото ужина<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required></label><button class="btn ghost">Отправить в общую группу</button><p role="status"></p></form>')+'</div>'+
 '<div class="cm75-task"><h3>⚡ Turbo / Detox · 3⭐</h3>'+(turbo&&turbo.status!=='rejected'?common75EntryStatus(turbo):'<form data-cm75-photo="turbo_detox"><label>Фото Turbo / Detox<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required></label><button class="btn ghost">Отправить в общую группу</button><p role="status"></p></form>')+'</div>'+
 '<div class="cm75-task"><h3>🧍 Сканирование друга · 10⭐</h3>'+(scan&&scan.status!=='rejected'?common75EntryStatus(scan):'<form data-cm75-form="scan_friend"><label>Сколько друзей просканировали?<input name="qty" type="number" min="1" max="20" value="1" required></label><button class="btn ghost">Отправить консультанту</button><p role="status"></p></form>')+'</div>'+
 '<div class="cm75-task"><h3>❤️ Амбассадор · 20⭐</h3><p>'+Math.min(Number(s.heart_count||0),2)+' / 2 успешных приглашений</p>'+(ambassador?common75EntryStatus(ambassador):'<button class="btn ghost" data-cm75-go="invitations">Открыть приглашения</button>')+'</div>'+
 '<div class="cm75-task"><h3>📦 VP · 20⭐ / каждые 50 VP</h3>'+(vp&&vp.status==='pending'?common75EntryStatus(vp):'<form data-cm75-form="vp"><label>Сколько VP добавить сегодня?<input name="value" type="number" min="1" max="10000" step="0.1" required></label><button class="btn ghost">Отправить на подтверждение</button><p role="status">'+(vp?.status==='approved'?'Сегодня уже подтверждено: '+vp.value+' VP · +'+vp.stars+'⭐':'')+'</p></form>')+'</div>'+
 '</section>';
};
cm80Program=function(s){
 const rows=s.zoom_sessions||[];
 return '<section class="card cm80-program"><details><summary><b>📅 Программа марафона · 12–23 октября</b></summary><div class="cm80-program-list cm81-program-list">'+rows.map(z=>{
  const rest=!!z.is_rest;
  return '<article class="cm80-program-day '+(rest?'rest':'')+'"><div class="cm80-program-date"><b>'+common75Date(z.session_date)+'</b><span>'+cm80DayName(z.session_date)+'</span></div><div class="cm80-program-body">'+
   (rest?'<h3>🌿 Отдых</h3><p>Восстановление и мягкая активность.</p>':'<h3>'+escapeHtml(cm80Time(z)+' · '+(z.speaker||''))+'</h3><p><b>'+escapeHtml(z.topic||z.title)+'</b></p>'+(z.sales_focus?'<p class="muted">Фокус: '+escapeHtml(z.sales_focus)+'</p>':''))+
  '</div></article>';
 }).join('')+'</div></details></section>';
};
cm80WorkoutSchedule=function(s){
 const rows=s.workout_schedule||[];
 if(!rows.length)return '';
 return '<section class="card cm80-workouts"><div class="eyebrow">🏋🏻‍♀️ ТРЕНИРОВКИ ПО ДНЯМ</div><h2>13–22 октября</h2><p>Каждый день открывается своя простая тренировка. Будущие дни закрыты 🔒.</p>'+
 rows.map((w,i)=>{
   const unlocked=!!w.unlocked;
   if(!unlocked)return '<details class="cm80-workout locked"><summary><b>🔒 День '+(i+1)+' · '+common75Date(w.session_date)+'</b></summary><p>Откроется '+common75Date(w.session_date)+'.</p></details>';
   const video=w.source_type==='youtube'?youtubePlayer(w):'<video controls playsinline preload="none" data-video-path="'+escapeHtml(w.video_path||'')+'"></video>';
   const isToday=w.session_date===s.today;
   const form=isToday&&s.participant
    ? '<form data-cm80-workout="'+w.workout_id+'"><p><b>Фото после тренировки для +5⭐</b></p><p class="muted">Не надо фотографироваться во время тренировки. После неё сделайте селфи или фото коврика/резинки/экрана часов.</p><label>Фото после тренировки<input type="file" accept="image/jpeg,image/png,image/webp" required></label><button class="btn primary">'+(w.completed?'Выполнено ✓':'Выполнено ✅')+'</button><p role="status"></p></form>'
    : '<p class="muted">'+(w.completed?'Выполнено ✓':'Тренировка открыта для просмотра.')+'</p>';
   return '<details class="cm80-workout '+(isToday?'today':'')+'" '+(isToday?'open':'')+'><summary><b>'+(w.completed?'✓ ':'')+'День '+(i+1)+' · '+common75Date(w.session_date)+' · '+escapeHtml(w.label||w.title)+'</b></summary><div class="cm80-workout-body"><h3>'+escapeHtml(w.title)+'</h3><p>'+w.minutes+' мин · '+escapeHtml(w.level)+' · '+escapeHtml(w.place)+'</p><p>'+escapeHtml(w.description||'')+'</p>'+video+form+'</div></details>';
 }).join('')+'</section>';
};
function cm81Bind(box,s){
 box.querySelectorAll('[data-cm81-steps]').forEach(f=>f.onsubmit=e=>{
   e.preventDefault();
   buttonAction(f.querySelector('button'),async()=>{
     const path=await common75Upload(f.elements.photo.files[0],'ps-community','steps-');
     await checked(sb.rpc('ps_submit_common_marathon',{p_kind:'steps',p_value:Number(f.elements.value.value),p_qty:1,p_photo:path}));
     await loadCommonMarathon75();
   },f.querySelector('[role=status]'));
 });
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
  bindCommonMarathon75(box,s);cm80Bind(box,s);cm81Bind(box,s);hydratePhotos(box);
 }catch(e){journeyError(box,e,loadCommonMarathon75)}
};