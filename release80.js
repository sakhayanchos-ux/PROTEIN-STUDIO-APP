/* Release 80: program, tracker, day-unlocked workouts, scorekeeper. */
function cm80DayName(v){return new Date(v+'T12:00:00').toLocaleDateString('ru-RU',{weekday:'short'}).replace('.','')}
function cm80Time(z){return z?.session_time?String(z.session_time).slice(0,5):''}
function cm80Program(s){
 const rows=s.zoom_sessions||[];
 return '<section class="card cm80-program"><div class="eyebrow">💫 ПРОГРАММА МАРАФОНА</div><h2>12–23 октября</h2><div class="cm80-program-list">'+rows.map(z=>{
  const rest=!!z.is_rest;
  return '<article class="cm80-program-day '+(rest?'rest':'')+'"><div class="cm80-program-date"><b>'+common75Date(z.session_date)+'</b><span>'+cm80DayName(z.session_date)+'</span></div><div class="cm80-program-body">'+
    (rest?'<h3>🌿 Отдых</h3><p>Восстановление и мягкая активность.</p>':
      '<h3>'+escapeHtml(cm80Time(z)+' · '+(z.speaker||''))+'</h3><p><b>'+escapeHtml(z.topic||z.title)+'</b></p>'+
      (z.sales_focus?'<p class="muted">Фокус: '+escapeHtml(z.sales_focus)+'</p>':'')
    )+
  '</div></article>';
 }).join('')+'</div></section>';
}
function cm80Entry(s,date,kind){return (s.entries||[]).find(e=>e.entry_date===date&&e.kind===kind)}
function cm80Cell(e,kind){
 if(!e)return '—';
 if(e.status==='pending')return '⏳';
 if(e.status==='rejected')return '↻';
 if(kind==='steps')return Math.round(Number(e.value||0))+'<small> / +'+e.stars+'⭐</small>';
 if(kind==='zoom_friend'||kind==='scan_friend')return (e.qty||1)+'<small> / +'+e.stars+'⭐</small>';
 if(kind==='vp')return Number(e.value||0)+'<small> / +'+e.stars+'⭐</small>';
 return '✓<small> +'+e.stars+'⭐</small>';
}
function cm80Dates(start,end){
 const out=[],a=new Date(start+'T12:00:00Z'),b=new Date(end+'T12:00:00Z');
 for(let d=new Date(a);d<=b;d.setUTCDate(d.getUTCDate()+1))out.push(d.toISOString().slice(0,10));
 return out;
}
function cm80Tracker(s){
 const dates=cm80Dates(s.campaign.start_date,s.campaign.end_date);
 const kinds=['steps','dinner_shake','turbo_detox','zoom_self','zoom_friend','workout','scan_friend','ambassador','vp'];
 const heads=['👣','🥤','⚡','Zoom','+Друг','🏋️','Скан','❤️','VP'];
 return '<section class="card cm80-tracker"><div class="eyebrow">⭐ ТРЕКЕР МАРАФОНА</div><div class="cm80-total"><span>Всего звёзд</span><b>'+Number(s.stars||0)+'⭐</b></div><div class="cm80-table-wrap"><table><thead><tr><th class="cm80-stick1">Дата</th><th class="cm80-stick2">⭐</th>'+heads.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+
 dates.map(date=>{
   const dayEntries=(s.entries||[]).filter(e=>e.entry_date===date&&(e.status==='approved'||e.status==='auto'));
   const total=dayEntries.reduce((sum,e)=>sum+Number(e.stars||0),0);
   return '<tr class="'+(date===s.today?'today':'')+'"><td class="cm80-stick1"><b>'+date.slice(8,10)+'.10</b><small>'+cm80DayName(date)+'</small></td><td class="cm80-stick2"><b>'+total+'⭐</b></td>'+
     kinds.map(k=>'<td>'+cm80Cell(cm80Entry(s,date,k),k)+'</td>').join('')+'</tr>';
 }).join('')+
 '</tbody></table></div><p class="note">⬅️➡️ Листай трекер вправо и влево. Будущие дни заполняются по мере прохождения марафона.</p></section>';
}
function cm80WorkoutSchedule(s){
 const rows=s.workout_schedule||[];
 if(!rows.length)return '';
 return '<section class="card cm80-workouts"><div class="eyebrow">🏋🏻‍♀️ ТРЕНИРОВКИ ПО ДНЯМ</div><h2>13–22 октября</h2><p>Как темы: каждый день открывается своя простая тренировка. Прошедшие дни остаются доступными для просмотра.</p>'+
 rows.map((w,i)=>{
   const preview=common75Preview();
   const unlocked=w.unlocked||preview;
   if(!unlocked)return '<details class="cm80-workout locked"><summary><b>🔒 День '+(i+1)+' · '+common75Date(w.session_date)+'</b></summary><p>Откроется '+common75Date(w.session_date)+'.</p></details>';
   const video=w.source_type==='youtube'?youtubePlayer(w):'<video controls playsinline preload="none" data-video-path="'+escapeHtml(w.video_path||'')+'"></video>';
   const isToday=w.session_date===s.today;
   const form=isToday&&s.participant
     ? '<form data-cm80-workout="'+w.workout_id+'"><label>Фото тренировки для +5⭐<input type="file" accept="image/jpeg,image/png,image/webp" required></label><button class="btn primary">'+(w.completed?'Выполнено ✓':'Выполнено ✅')+'</button><p role="status"></p></form>'
     : '<p class="muted">'+(preview&&!isToday?'Предпросмотр. Отметка «Выполнено» откроется в этот день.':w.completed?'Выполнено ✓':'Тренировка открыта для просмотра.')+'</p>';
   return '<details class="cm80-workout '+(isToday?'today':'')+'" '+(isToday||preview&&i===0?'open':'')+'><summary><b>'+(w.completed?'✓ ':'')+'День '+(i+1)+' · '+common75Date(w.session_date)+' · '+escapeHtml(w.label||w.title)+'</b></summary><div class="cm80-workout-body"><h3>'+escapeHtml(w.title)+'</h3><p>'+w.minutes+' мин · '+escapeHtml(w.level)+' · '+escapeHtml(w.place)+'</p><p>'+escapeHtml(w.description||'')+'</p>'+video+form+'</div></details>';
 }).join('')+'</section>';
}
function cm80StarSend(s){
 const submissions=s.star_submissions||[];
 const latest=submissions[0];
 const previewLocked=common75Preview()&&s.phase!=='live'&&s.phase!=='results';
 const status=latest
   ? latest.status==='approved'?'✓ Проверено Викторией · '+latest.stars_snapshot+'⭐'
    :latest.status==='pending'?'⏳ Отправлено Виктории · '+latest.stars_snapshot+'⭐'
    :'Нужно уточнить и отправить ещё раз'
   :'';
 if(!s.participant&&!common75Preview())return '';
 return '<section class="card cm80-send"><div class="eyebrow">🧮 СЧЕТОВОД</div><h2>Отправить звёзды Виктории</h2><p>Виктория Никитина проверяет трекер и итог ⭐. Кнопка отправляет весь накопленный результат на проверку.</p>'+
   (status?'<p class="cm80-send-status">'+escapeHtml(status)+'</p>':'')+
   '<button class="btn primary" id="cm80SendStars">'+(latest?.status==='pending'?'Отправить обновлённый трекер':'Отправить звёзды Виктории')+'</button><p id="cm80SendStarsStatus" role="status">'+(previewLocked?'Сейчас это предпросмотр. Отправка откроется 13 октября.':'')+'</p></section>';
}
function cm80Bind(box,s){
 box.querySelectorAll('[data-cm80-workout]').forEach(form=>{
   form.onsubmit=e=>{e.preventDefault();buttonAction(form.querySelector('button'),async()=>{
     const file=form.querySelector('input').files[0],path=await uploadJourneyPhoto(file);
     await checked(sb.rpc('ps_log_workout',{p_workout:form.dataset.cm80Workout,p_photo:path}));
     await loadCommonMarathon75();
   },form.querySelector('[role=status]'))};
 });
 box.querySelectorAll('[data-video-path]').forEach(async el=>{if(el.dataset.videoPath)el.src=await signedMedia('ps-workout-media',el.dataset.videoPath)});
 const send=$('cm80SendStars');
 if(send)send.onclick=()=>{
   const st=$('cm80SendStarsStatus');
   if(common75Preview()&&s.phase!=='live'&&s.phase!=='results'){st.textContent='Отправка откроется 13 октября.';return}
   buttonAction(send,async()=>{await checked(sb.rpc('ps_submit_marathon_stars'));await loadCommonMarathon75()},st);
 };
}
loadCommonMarathon75=async function(){
 const box=$('commonMarathon75')||$('journeyView');if(!box)return;
 try{
  if(isStaffWorkspace()&&!clientPreview)return loadCommonMarathonStaff75(box);
  const s=await checked(sb.rpc('ps_common_marathon_state'));common75State=s;
  if(!s.campaign){box.innerHTML='<section class="card">Активного марафона пока нет.</section>';return}
  box.innerHTML=common75Hero(s)+common75JoinCard(s)+cm80Program(s)+common75ZoomCard(s)+cm80Tracker(s)+common75Daily(s)+cm80WorkoutSchedule(s)+common75FinishCard(s)+common75Rules()+cm80StarSend(s)+common75History(s);
  bindCommonMarathon75(box,s);cm80Bind(box,s);hydratePhotos(box);
 }catch(e){journeyError(box,e,loadCommonMarathon75)}
};

const cm80LegacyStaffLoad=loadCommonMarathonStaff75;
loadCommonMarathonStaff75=async function(box){
 await cm80LegacyStaffLoad(box);
 if(!box?.isConnected)return;
 try{
  const s=await checked(sb.rpc('ps_common_marathon_staff_state'));
  const program=document.createElement('section');program.className='card cm80-staff-program';
  program.innerHTML='<div class="eyebrow">📅 ГОТОВАЯ ПРОГРАММА</div><h2>Расписание Zoom</h2><p>Ссылку и афишу может добавить <b>любой консультант</b>.</p>'+
   '<div class="cm80-program-list">'+(s.zoom_sessions||[]).map(z=>'<article class="cm80-program-day '+(z.is_rest?'rest':'')+'"><div class="cm80-program-date"><b>'+common75Date(z.session_date)+'</b><span>'+cm80DayName(z.session_date)+'</span></div><div class="cm80-program-body"><h3>'+(z.is_rest?'🌿 Отдых':escapeHtml(cm80Time(z)+' · '+(z.speaker||'')))+'</h3><p><b>'+escapeHtml(z.topic||z.title)+'</b></p>'+(z.sales_focus?'<p class="muted">Фокус: '+escapeHtml(z.sales_focus)+'</p>':'')+'</div></article>').join('')+'</div>';
  box.prepend(program);

  if(s.is_scorekeeper){
    const review=document.createElement('section');review.className='card cm80-scorekeeper';
    review.innerHTML='<div class="eyebrow">🧮 СЧЕТОВОД · ВИКТОРИЯ</div><h2>Проверка звёзд</h2>'+
      ((s.star_reviews||[]).length?(s.star_reviews||[]).map(x=>'<article class="cm80-review"><b>'+escapeHtml(x.full_name)+'</b><p>'+common75Date(x.submission_date)+' · <b>'+x.stars_snapshot+'⭐</b> · ждут подтверждения: '+x.pending_items+'</p><label>Комментарий<textarea rows="2" data-cm80-note="'+x.id+'"></textarea></label><div class="two-col"><button class="btn primary" data-cm80-star-approve="'+x.id+'">Подтвердить</button><button class="btn ghost" data-cm80-star-reject="'+x.id+'">Вернуть</button></div><p role="status"></p></article>').join(''):'<p>Новых трекеров на проверку нет.</p>');
    program.after(review);
    review.querySelectorAll('[data-cm80-star-approve]').forEach(b=>b.onclick=()=>buttonAction(b,async()=>{const id=b.dataset.cm80StarApprove,n=review.querySelector('[data-cm80-note="'+id+'"]');await checked(sb.rpc('ps_review_marathon_stars',{p_submission:id,p_approve:true,p_note:n?.value||null}));await loadCommonMarathonStaff75(box)},b.closest('.cm80-review')?.querySelector('[role=status]')));
    review.querySelectorAll('[data-cm80-star-reject]').forEach(b=>b.onclick=()=>buttonAction(b,async()=>{const id=b.dataset.cm80StarReject,n=review.querySelector('[data-cm80-note="'+id+'"]');await checked(sb.rpc('ps_review_marathon_stars',{p_submission:id,p_approve:false,p_note:n?.value||null}));await loadCommonMarathonStaff75(box)},b.closest('.cm80-review')?.querySelector('[role=status]')));
  }
 }catch(e){console.warn('Marathon staff extras:',e)}
};