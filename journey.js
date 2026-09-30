/* Client journey: all awards and permissions are authoritative on the server. */
let journeyState=null,journeyTimer=null;
const GIFT_SUGGESTIONS=['Порция травяного напитка','Detox','Белковый перекус','Вечерний коктейль','Turbo','Коллаген','Любой напиток из меню'];
function programMonths(start,target){
 const difference=Math.round((Number(start)-Number(target))*100)/100;
 if(!Number.isFinite(difference)||!start||!target||difference<=0)return null;
 const ranges=[[4,1,2],[7,2,3],[12,3,3],[16,4,4],[22,5,5],[28,6,6],[34,7,7],[40,8,8],[50,9,9],[63,10,10],[78,11,11],[90,12,12]];
 const row=ranges.find(r=>difference<=r[0]);return row?{difference,loss:row[1],maintain:row[2],total:row[1]+row[2]}:{difference};
}
function monthWord(n){return n===1?'месяц':n>=2&&n<=4?'месяца':'месяцев'}
function programHtml(start,target){const p=programMonths(start,target);if(!p)return '';return '<section class="card program-card"><div class="eyebrow">Ваша программа</div><h3>Снижение и сохранение результата</h3><p>Разница: <b>'+ruNumber(p.difference)+' кг</b>.</p>'+(p.loss?'<div class="program-stages"><div><b>'+p.loss+' '+monthWord(p.loss)+'</b><span>Ориентировочный этап снижения</span></div><div><b>'+p.maintain+' '+monthWord(p.maintain)+'</b><span>Сохранение результата</span></div></div><p>Общая программа: около <b>'+p.total+' '+monthWord(p.total)+'</b>.</p>':'<p>Продолжительность программы обсудите индивидуально со специалистом.</p>')+'<p>Это ориентир, а не обещанный срок. Темп изменения веса индивидуален.</p></section>'}
function journeyShell(){return '<div id="journeyView" aria-live="polite"><section class="card">Загружаем…</section></div>'}
async function getJourney(user=null){return checked(sb.rpc('ps_marathon_state',{p_user:user}))}
function journeyError(box,error,retry){if(!box?.isConnected)return;box.innerHTML='<section class="card"><p>'+escapeHtml(error?.message||'Не удалось загрузить данные.')+'</p><button class="btn ghost">Повторить</button></section>';box.querySelector('button').onclick=retry}
function rewardStatus(r){return r.issued_at?'Подарок выдан ✓':r.requested_at?'🎁 Награда ожидает выдачи':r.unlocked_at?'Открыто':'Откроется на '+r.milestone+'%'}
async function buttonAction(button,action,status){button.disabled=true;try{await action()}catch(e){if(status?.isConnected)status.textContent=e.message||'Не удалось сохранить. Попробуйте снова.'}finally{if(button.isConnected)button.disabled=false}}
function bindRewards(box,s,staff,reload){
 const status=box.querySelector('.journey-status');bindExtraRewards(box,s);
 box.querySelectorAll('[data-save-gift]').forEach(b=>b.onclick=()=>buttonAction(b,async()=>{await checked(sb.rpc('ps_reward_action',{p_reward:b.dataset.saveGift,p_action:'set',p_gift:box.querySelector('[data-gift-input="'+b.dataset.saveGift+'"]').value.trim()}));await reload()},status));
 box.querySelectorAll('[data-issue]').forEach(b=>b.onclick=()=>buttonAction(b,async()=>{await checked(sb.rpc('ps_reward_action',{p_reward:b.dataset.issue,p_action:'issue'}));await reload()},status));
 box.querySelectorAll('[data-claim]').forEach(b=>b.onclick=()=>buttonAction(b,async()=>{await checked(sb.rpc('ps_reward_action',{p_reward:b.dataset.claim,p_action:'claim'}));await reload()},status));
 box.querySelectorAll('[data-share]').forEach(b=>b.onclick=()=>shareReward(s,s.rewards.find(r=>r.id===b.dataset.share),status));
}
async function showNewReward(s){
 if(staffConsultants.length||$('rewardDialog')||!s?.enrollment)return;
 const r=s.rewards.find(r=>r.unlocked_at&&!r.announced_at);if(!r)return;
 const dialog=document.createElement('dialog');dialog.id='rewardDialog';dialog.className='reward-dialog';dialog.innerHTML='<h2>Новое достижение!</h2><img class="reward-art" src="'+couponCanvas(s,r).toDataURL('image/png')+'" alt="Ваш подарок: '+escapeHtml(r.gift||'Подарок')+'"><button class="btn primary" id="dialogClaim" '+(!r.gift||r.requested_at?'disabled':'')+'>Получить у консультанта</button><button class="btn ghost" id="dialogChat">Написать консультанту</button><button class="btn ghost" id="dialogDownload">Скачать</button><button class="btn ghost" id="dialogShare">Поделиться</button><button class="btn ghost" id="dialogClose">Продолжить</button><p role="status" id="dialogStatus"></p>';
 document.body.append(dialog);dialog.showModal();
 async function close(){try{await checked(sb.rpc('ps_reward_action',{p_reward:r.id,p_action:'seen'}));dialog.close();dialog.remove();r.announced_at=true;showNewReward(s)}catch(e){$('dialogStatus').textContent=e.message}}
 $('dialogClose').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close()});
 $('dialogChat').onclick=()=>openClientDialog();$('dialogDownload').onclick=()=>buttonAction($('dialogDownload'),()=>downloadCoupon(s,r),$('dialogStatus'));
 $('dialogShare').onclick=()=>shareReward(s,r,$('dialogStatus'));
 $('dialogClaim').onclick=()=>buttonAction($('dialogClaim'),async()=>{await checked(sb.rpc('ps_reward_action',{p_reward:r.id,p_action:'claim'}));r.requested_at=true;$('dialogStatus').textContent='Запрос отправлен консультанту ✓';$('dialogClaim').textContent='Запрос отправлен';setTimeout(()=>{if($('dialogClaim'))$('dialogClaim').disabled=true},0)},$('dialogStatus'));
}
async function uploadJourneyPhoto(file){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10485760)throw Error('Выберите JPG, PNG или WEBP до 10 МБ.');
 const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];const path=me.id+'/'+crypto.randomUUID()+'.'+ext;
 await checked(sb.storage.from('ps-task-photos').upload(path,file,{contentType:file.type}));return path;
}
async function signedMedia(bucket,path){const result=await checked(sb.storage.from(bucket).createSignedUrl(path,3600));return result.signedUrl}
async function hydratePhotos(box){await Promise.allSettled([...box.querySelectorAll('[data-task-photo]')].map(async img=>{img.src=await signedMedia('ps-task-photos',img.dataset.taskPhoto)}))}
async function loadMarathonTracker(day=null){
 const box=$('journeyView');if(!box)return;
 try{
 const s=await getJourney();if(!box.isConnected)return;journeyState=s;
 if(!s.enrollment){box.innerHTML='<section class="card">Марафон ещё не начат.</section>';return}
 const selected=Math.max(1,s.day);
 const tasks=s.tasks.filter(t=>t.day_number===selected&&t.active!==false),next=s.rewards.find(r=>!r.unlocked_at);
 box.innerHTML=journeyHeader(s)+'<section class="card"><h2>Сегодня</h2>'+tasks.map(t=>'<div class="marathon-task '+(t.completed_at?'done':'')+'"><div class="task-heading"><span class="task-check">'+(t.completed_at?'✓':'○')+'</span><b>'+escapeHtml(t.title)+'</b><span>+'+t.stars+'⭐</span></div>'+(t.photo_path?'<img class="task-photo" data-task-photo="'+escapeHtml(t.photo_path)+'" alt="Фото задания">':'')+(t.completed_at?'<span>Выполнено '+dateLabel(t.completed_at)+'</span>':t.kind==='topic'?'<button class="btn ghost" data-go="topics">Открыть темы</button>':t.kind==='workout'?'<button class="btn ghost" data-go="workouts">К тренировкам</button>':'<form data-task-key="'+t.task_key+'">'+(t.kind.endsWith('_photo')?'<label>Добавить фото<input type="file" accept="image/jpeg,image/png,image/webp" required></label>':t.kind==='steps'?'<label>Количество шагов<input type="number" min="'+t.target+'" max="100000" inputmode="numeric" required></label>':'')+'<button class="btn ghost">Выполнено ✅</button></form>')+'</div>').join('')+'<p id="taskStatus" role="status"></p></section><section class="card"><h3>Контроль веса</h3><p>Дни 10, 20 и 30 · каждые полные −500 г = 1⭐</p><p>Считаем новые полные 500 г от стартового веса. Уже награждённые килограммы повторно не считаются; звёзды не отнимаются.</p>'+(s.checks.length?s.checks.map(c=>'<p>День '+c.day_number+': '+ruNumber(c.weight_kg)+' кг · +'+c.stars+'⭐</p>').join(''):'')+([10,20,30].includes(s.actual_day)&&!s.checks.some(c=>c.day_number===s.actual_day)?'<form id="checkpointForm"><label>Контрольный вес, кг<input id="checkpointWeight" type="number" min="25" max="400" step="0.1" inputmode="decimal" required></label><p>Проверьте число: этот контрольный замер фиксируется один раз.</p><button class="btn primary">Сохранить контрольный вес</button><p id="checkpointStatus" role="status"></p></form>':'<p>Следующий контроль: '+([10,20,30].find(d=>d>s.actual_day)?'день '+[10,20,30].find(d=>d>s.actual_day):'все контрольные дни завершены')+'</p>')+'</section>';
 box.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>openPage(b.dataset.go));
 box.querySelectorAll('[data-task-key]').forEach(form=>form.onsubmit=e=>{e.preventDefault();const task=tasks.find(t=>t.task_key===form.dataset.taskKey);buttonAction(form.querySelector('button'),async()=>{const photo=task.kind.endsWith('_photo')?await uploadJourneyPhoto(form.querySelector('input').files[0]):null;await checked(sb.rpc('ps_complete_marathon_task',{p_enrollment:s.enrollment.id,p_day:selected,p_key:task.task_key,p_photo:photo,p_value:task.kind==='steps'?Number(form.querySelector('input').value):null}));await loadMarathonTracker(selected)},$('taskStatus'))});
 if($('checkpointForm'))$('checkpointForm').onsubmit=e=>{e.preventDefault();buttonAction(e.target.querySelector('button'),async()=>{await checked(sb.rpc('ps_marathon_weigh',{p_enrollment:s.enrollment.id,p_weight:Number($('checkpointWeight').value)}));await loadMarathonTracker(selected)},$('checkpointStatus'))};
 hydratePhotos(box);showNewReward(s);
 }catch(e){journeyError(box,e,()=>loadMarathonTracker(day))}
}
async function loadTopics(){
 const box=$('journeyView');if(!box)return;
 try{
 const staff=isStaffWorkspace();
 const [days,s,titles]=await Promise.all([staff?checked(sb.from('ps_marathon_days').select('*').order('day_number')):checked(sb.rpc('ps_get_marathon_days')),staff?null:getJourney(),staff?Promise.resolve([]):checked(sb.from('ps_marathon_days').select('day_number,title').order('day_number'))]);
 const activity=!clientPreview&&s?.enrollment?await checked(sb.from('ps_marathon_activity').select('day_number,opened_at').eq('enrollment_id',s.enrollment.id)):[];
 if(!box.isConnected)return;
 box.innerHTML='<section class="card"><div class="topic-list">'+days.map(d=>{const unlocked=staff||d.unlocked,seen=activity.some(t=>t.day_number===d.day_number)||s?.tasks?.some(t=>t.day_number===d.day_number&&t.kind==='topic'&&t.completed_at);return '<article class="topic-card '+(unlocked?'':'locked')+'"><span class="day-num">'+d.day_number+'</span><div><h3>'+escapeHtml(d.title||titles.find(t=>t.day_number===d.day_number)?.title||'День '+d.day_number)+'</h3><p>'+(staff?'Предпросмотр':unlocked?(seen?'✓ Просмотрено':'Не просмотрено'):'🔒 Откроется '+dateLabel(d.unlock_date))+'</p>'+(unlocked&&safeTopicUrl(d.source_url)?'<a class="btn ghost app-link" data-topic="'+d.day_number+'" href="'+safeTopicUrl(d.source_url)+'" target="_blank" rel="noopener">Открыть тему</a>':'')+'</div></article>'}).join('')+'</div><p id="topicStatus" role="status"></p></section>';
 if(!staff&&!clientPreview)box.querySelectorAll('[data-topic]').forEach(a=>a.onclick=async()=>{const day=Number(a.dataset.topic),task=s.tasks.find(t=>t.day_number===day&&t.kind==='topic'&&t.active!==false);if(!s?.enrollment||task?.completed_at)return;try{if(task){await checked(sb.rpc('ps_complete_marathon_task',{p_enrollment:s.enrollment.id,p_day:day,p_key:task.task_key}));task.completed_at=true}else{const r=await sb.from('ps_marathon_activity').insert({enrollment_id:s.enrollment.id,day_number:day});if(r.error&&r.error.code!=='23505')throw r.error;}if(a.isConnected)a.parentElement.querySelector('p').textContent='✓ Просмотрено';showNewReward(await getJourney())}catch(e){if($('topicStatus'))$('topicStatus').textContent='Не удалось сохранить просмотр. Откройте тему ещё раз.'}});
 }catch(e){journeyError(box,e,loadTopics)}
}
async function loadAchievements(){const box=$('journeyView');try{const s=await getJourney();if(!box.isConnected)return;if(!s.enrollment){box.innerHTML='<section class="card">Марафон ещё не начат.</section>';return}box.innerHTML='<section class="card">'+rewardCards(s)+'</section>';bindRewards(box,s,false,loadAchievements);showNewReward(s)}catch(e){journeyError(box,e,loadAchievements)}}
function staffRewardsHtml(s){return s?.enrollment?'<section class="card"><h3>Настроить подарки</h3>'+rewardCards(s,true)+'</section>':'<p>Клиент ещё не начал марафон.</p>'}
