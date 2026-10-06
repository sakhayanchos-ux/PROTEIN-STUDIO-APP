/* Release 75: единый марафон 12–23 октября. */
let common75State=null;

function common75Shell(){return '<div id="commonMarathon75"><section class="card">Загружаем МАРАФОН…</section></div>'}
function common75Date(v){if(!v)return '—';return new Date(v+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long'})}
function common75Entry(s,kind,date=s.today){return (s.entries||[]).find(e=>e.kind===kind&&e.entry_date===date)}
function common75EntryStatus(e){
 if(!e)return '';
 if(e.status==='pending')return '<span class="cm75-status pending">⏳ Ждёт подтверждения</span>';
 if(e.status==='approved'||e.status==='auto')return '<span class="cm75-status approved">✓ Засчитано · +'+e.stars+'⭐</span>';
 if(e.status==='rejected')return '<span class="cm75-status rejected">Нужно отправить заново</span>';
 return '';
}
function common75Poster(path){
 if(!path)return '';
 const r=sb.storage.from('ps-marathon-media').getPublicUrl(path);
 const url=r?.data?.publicUrl;
 return url?'<img class="cm75-poster" src="'+escapeHtml(url)+'" alt="Афиша Zoom">':'';
}
function common75SafeUrl(value){try{const u=new URL(value);return u.protocol==='https:'?u.href:''}catch{return ''}}
function common75Rules(){
 return '<section class="card cm75-rules"><h2>Как собираем ⭐</h2><div class="cm75-rule-grid">'+
 [['1⭐','за каждые 1000 шагов'],['3⭐','ужин коктейлем'],['3⭐','Turbo / Detox'],['5⭐','утренний Zoom'],['5⭐','каждый друг в Zoom'],['5⭐','тренировка + фото'],['10⭐','коллаж ДО / ПОСЛЕ'],['10⭐','сканирование друга'],['20⭐','Амбассадор · 2❤️'],['20⭐','за каждые 50 VP']]
 .map(x=>'<div><b>'+x[0]+'</b><span>'+x[1]+'</span></div>').join('')+
 '</div></section>';
}
function common75Hero(s){
 const c=s.campaign;
 const phaseText=s.phase==='upcoming'?'Присоединение 12 октября':s.phase==='join'?'Сегодня присоединение':s.phase==='live'?'День '+s.day_number+' из 10':s.phase==='results'?'ИТОГ МАРАФОНА':s.phase==='finished'?'Марафон завершён':'Подготовка';
 return '<section class="card cm75-hero"><div class="eyebrow">🏁 ОТДЕЛЬНОЕ ПРОСТРАНСТВО</div><h1>МАРАФОН</h1><p>'+common75Date(c.join_date)+' — присоединение · '+common75Date(c.start_date)+'–'+common75Date(c.end_date)+' — 10 дней · '+common75Date(c.results_date)+' — итог</p>'+
 '<div class="cm75-hero-row"><div><span>Сейчас</span><b>'+phaseText+'</b></div><div class="cm75-stars"><span>Мои звёзды</span><b>⭐ '+(s.stars||0)+'</b></div></div></section>';
}
function common75ZoomCard(s){
 const sessions=s.zoom_sessions||[],today=s.today;
 const z=sessions.find(x=>x.session_date===today)||sessions.find(x=>x.session_date>=today)||sessions[sessions.length-1];
 if(!z)return '';
 const isToday=z.session_date===today;
 const self=common75Entry(s,'zoom_self'),friend=common75Entry(s,'zoom_friend');
 const url=common75SafeUrl(z.zoom_url);
 return '<section class="card cm75-zoom"><div class="eyebrow">☀️ УТРЕННИЙ ZOOM · 7:30</div><h2>'+escapeHtml(z.title)+'</h2><p>'+common75Date(z.session_date)+(isToday?' · сегодня':'')+'</p>'+
 common75Poster(z.poster_path)+
 (url?'<a class="btn primary app-link" href="'+escapeHtml(url)+'" target="_blank" rel="noopener">Подключиться к Zoom</a>':'<p class="muted">Ссылка Zoom появится здесь.</p>')+
 (isToday&&s.participant?'<div class="cm75-actions">'+
   (self?common75EntryStatus(self):'<button class="btn ghost" data-cm75-submit="zoom_self">Я подключилась · +5⭐</button>')+
   (friend?common75EntryStatus(friend):'<form data-cm75-form="zoom_friend"><label>Сколько друзей подключилось?<input name="qty" type="number" min="1" max="20" value="1" required></label><button class="btn ghost">Друг в Zoom · +5⭐ за каждого</button><p role="status"></p></form>')+
 '</div>':'')+'</section>';
}
function common75JoinCard(s){
 if(s.participant)return '';
 if(s.phase==='upcoming')return '<section class="card cm75-join"><h2>Присоединение — 12 октября</h2><p>12 октября откроются стартовые замеры и фото ДО. Первый день заданий — 13 октября.</p></section>';
 if(!['join','live'].includes(s.phase)||s.today>s.campaign.start_date)return '<section class="card"><h2>Присоединение закрыто</h2><p>Следующий марафон появится здесь.</p></section>';
 return '<section class="card cm75-join"><h2>Присоединиться к марафону</h2><p>Сейчас фиксируем старт: вес, талию и фото ДО.</p><form id="cm75JoinForm"><div class="two-col"><label>Вес, кг<input name="weight" type="number" min="25" max="400" step="0.1" required></label><label>Талия, см<input name="waist" type="number" min="30" max="300" step="0.1" required></label></div><label>Фото ДО<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required></label><button class="btn primary">Присоединиться 🏁</button><p role="status"></p></form></section>';
}
function common75FinishCard(s){
 if(!s.participant||s.today<s.campaign.end_date)return '';
 if(s.participant.after_photo_path)return '<section class="card"><h2>Финальные замеры ✓</h2><p>Фото ПОСЛЕ и замеры сохранены. Теперь создайте коллаж в разделе «Прогресс».</p><button class="btn primary" data-cm75-go="progress">Создать коллаж</button>'+common75EntryStatus(common75Entry(s,'collage',s.campaign.end_date))+'</section>';
 return '<section class="card cm75-finish"><h2>Финиш · замеры и фото ПОСЛЕ</h2><form id="cm75FinishForm"><div class="two-col"><label>Вес, кг<input name="weight" type="number" min="25" max="400" step="0.1" required></label><label>Талия, см<input name="waist" type="number" min="30" max="300" step="0.1" required></label></div><label>Фото ПОСЛЕ<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required></label><button class="btn primary">Сохранить финал</button><p role="status"></p></form></section>';
}
function common75Daily(s){
 if(!s.participant||s.phase!=='live')return '';
 const steps=common75Entry(s,'steps'),dinner=common75Entry(s,'dinner_shake'),turbo=common75Entry(s,'turbo_detox'),
 workout=common75Entry(s,'workout'),scan=common75Entry(s,'scan_friend'),vp=common75Entry(s,'vp');
 const ambassador=(s.entries||[]).find(e=>e.kind==='ambassador'&&(e.status==='auto'||e.status==='approved'));
 return '<section class="card cm75-today"><div class="eyebrow">ДЕНЬ '+s.day_number+' ИЗ 10</div><h2>Сегодня собираем ⭐</h2>'+
 '<div class="cm75-task"><h3>🚶 Шаги · 1⭐ / 1000</h3><form data-cm75-form="steps"><label>Шагов сегодня<input name="value" type="number" min="0" max="100000" value="'+escapeHtml(steps?.value??'')+'" required></label><button class="btn ghost">Сохранить шаги</button><p role="status">'+(steps?'Сейчас: '+steps.value+' шагов · +'+steps.stars+'⭐':'')+'</p></form></div>'+
 '<div class="cm75-task"><h3>🥤 Ужин коктейлем · 3⭐</h3>'+(dinner&&dinner.status!=='rejected'?common75EntryStatus(dinner):'<form data-cm75-photo="dinner_shake"><label>Фото ужина<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required></label><button class="btn ghost">Отправить в общую группу</button><p role="status"></p></form>')+'</div>'+
 '<div class="cm75-task"><h3>⚡ Turbo / Detox · 3⭐</h3>'+(turbo&&turbo.status!=='rejected'?common75EntryStatus(turbo):'<form data-cm75-photo="turbo_detox"><label>Фото Turbo / Detox<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required></label><button class="btn ghost">Отправить в общую группу</button><p role="status"></p></form>')+'</div>'+
 '<div class="cm75-task"><h3>🏋🏻‍♀️ Тренировка + фото · 5⭐</h3>'+(workout?common75EntryStatus(workout)+(workout.photo_path?'<img class="task-photo" data-task-photo="'+escapeHtml(workout.photo_path)+'" alt="Фото тренировки">':''):'<p>Выполните любую простую тренировку и добавьте фото тренировки. Для 5⭐ фото обязательно.</p><button class="btn ghost" data-cm75-go="workouts">Открыть тренировки</button>')+'</div>'+
 '<div class="cm75-task"><h3>🧍 Сканирование друга · 10⭐</h3>'+(scan&&scan.status!=='rejected'?common75EntryStatus(scan):'<form data-cm75-form="scan_friend"><label>Сколько друзей просканировали?<input name="qty" type="number" min="1" max="20" value="1" required></label><button class="btn ghost">Отправить консультанту</button><p role="status"></p></form>')+'</div>'+
 '<div class="cm75-task"><h3>❤️ Амбассадор · 20⭐</h3><p>'+Math.min(Number(s.heart_count||0),2)+' / 2 успешных приглашений</p>'+(ambassador?common75EntryStatus(ambassador):'<button class="btn ghost" data-cm75-go="invitations">Открыть приглашения</button>')+'</div>'+
 '<div class="cm75-task"><h3>📦 VP · 20⭐ / каждые 50 VP</h3>'+(vp&&vp.status==='pending'?common75EntryStatus(vp):'<form data-cm75-form="vp"><label>Сколько VP добавить сегодня?<input name="value" type="number" min="1" max="10000" step="0.1" required></label><button class="btn ghost">Отправить на подтверждение</button><p role="status">'+(vp?.status==='approved'?'Сегодня уже подтверждено: '+vp.value+' VP · +'+vp.stars+'⭐':'')+'</p></form>')+'</div>'+
 '</section>';
}
function common75History(s){
 if(!s.participant)return '';
 const rows=(s.entries||[]).filter(e=>e.status==='approved'||e.status==='auto');
 const labels={steps:'Шаги',dinner_shake:'Ужин коктейлем',turbo_detox:'Turbo / Detox',zoom_self:'Zoom',zoom_friend:'Друг в Zoom',workout:'Тренировка',scan_friend:'Сканирование друга',ambassador:'Амбассадор',collage:'Коллаж ДО / ПОСЛЕ',vp:'VP'};
 return '<section class="card"><details><summary><b>История звёзд · ⭐ '+s.stars+'</b></summary><div class="cm75-ledger">'+(rows.length?rows.map(e=>'<div><span>'+common75Date(e.entry_date)+' · '+escapeHtml(labels[e.kind]||e.kind)+'</span><b>+'+e.stars+'⭐</b></div>').join(''):'<p>Пока звёзд нет.</p>')+'</div></details></section>';
}
async function common75Upload(file,bucket,prefix=''){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10485760)throw Error('Выберите JPG, PNG или WEBP до 10 МБ.');
 const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
 const path=me.id+'/'+prefix+crypto.randomUUID()+'.'+ext;
 await checked(sb.storage.from(bucket).upload(path,file,{contentType:file.type}));
 return path;
}
async function loadCommonMarathon75(){
 const box=$('commonMarathon75')||$('journeyView');if(!box)return;
 try{
  if(isStaffWorkspace()&&!clientPreview)return loadCommonMarathonStaff75(box);
  const s=await checked(sb.rpc('ps_common_marathon_state'));common75State=s;
  if(!s.campaign){box.innerHTML='<section class="card">Активного марафона пока нет.</section>';return}
  box.innerHTML=common75Hero(s)+common75JoinCard(s)+(s.participant?common75ZoomCard(s):'')+common75Daily(s)+common75FinishCard(s)+(s.participant?common75Rules():'')+common75History(s);
  bindCommonMarathon75(box,s);hydratePhotos(box);
 }catch(e){journeyError(box,e,loadCommonMarathon75)}
}
function bindCommonMarathon75(box,s){
 box.querySelectorAll('[data-cm75-go]').forEach(b=>b.onclick=()=>openPage(b.dataset.cm75Go));
 const join=$('cm75JoinForm');if(join)join.onsubmit=e=>{e.preventDefault();buttonAction(join.querySelector('button'),async()=>{const photo=await uploadJourneyPhoto(join.elements.photo.files[0]);await checked(sb.rpc('ps_join_common_marathon',{p_weight:Number(join.elements.weight.value),p_waist:Number(join.elements.waist.value),p_photo:photo}));await loadCommonMarathon75()},join.querySelector('[role=status]'))};
 const finish=$('cm75FinishForm');if(finish)finish.onsubmit=e=>{e.preventDefault();buttonAction(finish.querySelector('button'),async()=>{const photo=await uploadJourneyPhoto(finish.elements.photo.files[0]);await checked(sb.rpc('ps_finish_common_marathon',{p_weight:Number(finish.elements.weight.value),p_waist:Number(finish.elements.waist.value),p_photo:photo}));await loadCommonMarathon75()},finish.querySelector('[role=status]'))};
 box.querySelectorAll('[data-cm75-submit]').forEach(b=>b.onclick=()=>buttonAction(b,async()=>{await checked(sb.rpc('ps_submit_common_marathon',{p_kind:b.dataset.cm75Submit,p_value:null,p_qty:1,p_photo:null}));await loadCommonMarathon75()},box));
 box.querySelectorAll('[data-cm75-form]').forEach(f=>f.onsubmit=e=>{e.preventDefault();buttonAction(f.querySelector('button'),async()=>{await checked(sb.rpc('ps_submit_common_marathon',{p_kind:f.dataset.cm75Form,p_value:f.elements.value?Number(f.elements.value.value):null,p_qty:f.elements.qty?Number(f.elements.qty.value):1,p_photo:null}));await loadCommonMarathon75()},f.querySelector('[role=status]'))});
 box.querySelectorAll('[data-cm75-photo]').forEach(f=>f.onsubmit=e=>{e.preventDefault();buttonAction(f.querySelector('button'),async()=>{const path=await common75Upload(f.elements.photo.files[0],'ps-community','marathon-');await checked(sb.rpc('ps_submit_common_marathon',{p_kind:f.dataset.cm75Photo,p_value:null,p_qty:1,p_photo:path}));await loadCommonMarathon75()},f.querySelector('[role=status]'))});
}
function common75KindLabel(k){return ({dinner_shake:'Ужин коктейлем · 3⭐',turbo_detox:'Turbo / Detox · 3⭐',zoom_self:'Zoom · 5⭐',zoom_friend:'Друг в Zoom · 5⭐/чел.',scan_friend:'Сканирование друга · 10⭐/чел.',vp:'VP · 20⭐/50 VP'})[k]||k}
async function loadCommonMarathonStaff75(box){
 try{
  const s=await checked(sb.rpc('ps_common_marathon_staff_state'));if(!s.campaign){box.innerHTML='<section class="card">Марафон не найден.</section>';return}
  box.innerHTML='<section class="card cm75-hero"><div class="eyebrow">🏁 УПРАВЛЕНИЕ</div><h1>МАРАФОН</h1><p>12 октября — присоединение · 13–22 октября — марафон · 23 октября — итог</p></section>'+
   '<section class="card"><div class="row"><h2>Подтверждения</h2><button class="btn ghost" id="cm75StaffRefresh">Обновить</button></div><div id="cm75Pending">'+(s.pending.length?s.pending.map(e=>'<article class="cm75-review"><b>'+escapeHtml(e.full_name)+'</b><p>'+common75Date(e.entry_date)+' · '+escapeHtml(common75KindLabel(e.kind))+(e.qty>1?' · ×'+e.qty:'')+(e.value!=null?' · '+e.value+(e.kind==='vp'?' VP':''):'')+'</p>'+(e.photo_path?'<img class="task-photo" data-cm75-community-photo="'+escapeHtml(e.photo_path)+'" alt="Фото задания">':'')+'<div class="two-col"><button class="btn primary" data-cm75-approve="'+e.id+'">Подтвердить</button><button class="btn ghost" data-cm75-reject="'+e.id+'">Отклонить</button></div></article>').join(''):'<p>Новых подтверждений нет.</p>')+'</div></section>'+
   '<section class="card"><h2>Участники · '+s.participants.length+'</h2><div class="cm75-ledger">'+(s.participants.length?s.participants.map(p=>'<div><span>'+escapeHtml(p.full_name)+'</span><b>⭐ '+p.stars+'</b></div>').join(''):'<p>Пока никто не присоединился.</p>')+'</div></section>'+
   '<section class="card"><h2>Zoom · каждый день в 7:30</h2><p>Добавьте ссылку и афишу для каждого дня. Участникам придёт уведомление в 7:15.</p><div id="cm75ZoomAdmin">'+s.zoom_sessions.map(z=>'<details class="cm75-zoom-edit"><summary><b>'+common75Date(z.session_date)+' · '+escapeHtml(z.title)+'</b></summary>'+common75Poster(z.poster_path)+'<form data-cm75-zoom="'+z.session_date+'" data-poster="'+escapeHtml(z.poster_path||'')+'"><label>Название<input name="title" maxlength="160" value="'+escapeHtml(z.title)+'" required></label><label>Ссылка Zoom<input name="url" type="url" value="'+escapeHtml(z.zoom_url||'')+'" placeholder="https://..."></label><label>Афиша<input name="poster" type="file" accept="image/jpeg,image/png,image/webp"></label><button class="btn primary">Сохранить Zoom</button><p role="status"></p></form></details>').join('')+'</div></section>'+common75Rules();
  $('cm75StaffRefresh')?.addEventListener('click',()=>loadCommonMarathonStaff75(box));
  box.querySelectorAll('[data-cm75-approve]').forEach(b=>b.onclick=()=>buttonAction(b,async()=>{await checked(sb.rpc('ps_review_common_marathon_entry',{p_entry:b.dataset.cm75Approve,p_approve:true}));await loadCommonMarathonStaff75(box)},box));
  box.querySelectorAll('[data-cm75-reject]').forEach(b=>b.onclick=()=>buttonAction(b,async()=>{await checked(sb.rpc('ps_review_common_marathon_entry',{p_entry:b.dataset.cm75Reject,p_approve:false}));await loadCommonMarathonStaff75(box)},box));
  await Promise.allSettled([...box.querySelectorAll('[data-cm75-community-photo]')].map(async img=>{img.src=await signedMedia('ps-community',img.dataset.cm75CommunityPhoto)}));
  box.querySelectorAll('[data-cm75-zoom]').forEach(f=>f.onsubmit=e=>{e.preventDefault();buttonAction(f.querySelector('button'),async()=>{let poster=f.dataset.poster||null;if(f.elements.poster.files[0])poster=await common75Upload(f.elements.poster.files[0],'ps-marathon-media','zoom-');await checked(sb.rpc('ps_save_common_marathon_zoom',{p_date:f.dataset.cm75Zoom,p_title:f.elements.title.value.trim(),p_url:f.elements.url.value.trim()||null,p_poster:poster}));f.querySelector('[role=status]').textContent='Сохранено ✓';await loadCommonMarathonStaff75(box)},f.querySelector('[role=status]'))});
 }catch(e){journeyError(box,e,()=>loadCommonMarathonStaff75(box))}
}
