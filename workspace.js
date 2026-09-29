function staffNavigation(){
 const staff=!!staffConsultants.length;
 document.querySelectorAll('.nav[data-page]').forEach(b=>{
  const p=b.dataset.page;
  b.classList.toggle('hidden',staff?['plan','nutrition','progress','consultant'].includes(p):['admin','staffCard'].includes(p));
 });
 $('adminNav').textContent='🗂 Клиенты';
}
function safeTopicUrl(value){try{const u=new URL(value);return u.protocol==='https:'?escapeHtml(u.href):''}catch{return ''}}
function dateLabel(value){return value?escapeHtml(new Date(value.length===10?value+'T12:00:00':value).toLocaleDateString('ru-RU')):'—'}
function marathonDay(e){if(!e)return 0;const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Yakutsk',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());return Math.max(0,Math.min(e.duration_days||30,Math.floor((Date.parse(today)-Date.parse(e.start_date))/86400000)+1))}
async function checked(query){const r=await query;if(r.error)throw r.error;return r.data}
async function clientFacts(id){
 const [a,progress,enrollments]=await Promise.all([
  checked(sb.from('ps_assessments').select('goals,primary_goal,starting_weight_kg,target_weight_kg,goal_result_text,height_cm').eq('user_id',id).maybeSingle()),
  checked(sb.from('ps_progress_entries').select('entry_date,weight_kg,waist_cm').eq('user_id',id).order('entry_date',{ascending:false}).limit(100)),
  checked(sb.from('ps_marathon_enrollments').select('id,user_id,start_date,duration_days,status,created_at').eq('user_id',id).order('created_at',{ascending:false}).limit(1))]);
 const enrollment=enrollments?.[0]||null;
 const journey=await getJourney(id);
 const activity=enrollment?await checked(sb.from('ps_marathon_activity').select('*').eq('enrollment_id',enrollment.id)):[];
 return {a:a||{},progress:progress||[],enrollment,activity:activity||[],journey};
}
function activityHtml(f){
 if(!f.journey?.enrollment)return '<p>Клиент ещё не начал марафон.</p>';
 return Array.from({length:30},(_,i)=>{const n=i+1,rows=f.journey.tasks.filter(t=>t.day_number===n);return '<details class="activity-row"><summary><b>День '+n+'</b> · '+rows.filter(t=>t.completed_at).length+' / '+rows.length+'</summary>'+rows.map(t=>'<div class="activity-row"><b>'+(t.completed_at?'✓ ':'○ ')+escapeHtml(t.title)+'</b><span>'+ (t.completed_at?dateLabel(t.completed_at):'Не выполнено')+'</span>'+(t.value!=null?'<span>Шагов: '+t.value+'</span>':'')+(t.photo_path?'<img class="task-photo" data-task-photo="'+escapeHtml(t.photo_path)+'" alt="Фото задания клиента">':'')+'</div>').join('')+'</details>'}).join('');
}
function marathonSummary(f){const s=f.journey;if(!s?.enrollment)return '<p>Марафон ещё не начат.</p>';const next=s.rewards.find(r=>!r.unlocked_at);return '<div class="fact-grid"><div><b>День '+s.day+' из 30</b><span>'+s.percent+'% заданий</span></div><div><b>⭐ '+s.enrollment.stars+'</b><span>Заработано звёзд</span></div><div><b>'+(next?next.milestone+'%':'Все этапы открыты')+'</b><span>'+escapeHtml(next?.gift||'Ближайшая награда')+'</span></div></div>'}
async function loadAdminClientDetail(id,version=adminViewVersion,tab='overview'){
 const p=adminRows.find(p=>p.id===id);const box=$('adminClientDetail');if(!p||!box)return;
 box.dataset.client=id;box.innerHTML='<section class="card">Загружаем карточку…</section>';
 try{
 const f=await clientFacts(id);
 if(version!==adminViewVersion||!box.isConnected||box.dataset.client!==id)return;
 const show=(v,s='')=>v==null?'—':escapeHtml(v)+s;
 const sections={
 overview:'<p>'+escapeHtml(p.bio||'')+'</p><div class="admin-detail-line"><span>Телефон</span><b>'+escapeHtml(p.phone||'—')+'</b></div><div class="admin-detail-line"><span>Дата рождения</span><b>'+dateLabel(p.birth_date)+'</b></div><div class="admin-detail-line"><span>Рост</span><b>'+show(p.height_cm??f.a.height_cm,' см')+'</b></div><p><b>Цель</b><br>'+escapeHtml(f.a.goals?.join(', ')||f.a.primary_goal||'Не указана')+'</p><p>'+escapeHtml(f.a.goal_result_text||'')+'</p>'+marathonSummary(f),
 marathon:marathonSummary(f)+(f.enrollment?'<p>Статус: '+escapeHtml(f.enrollment.status==='active'?'Участвует':f.enrollment.status)+'</p>':''),
 topics:activityHtml(f),
 progress:'<div class="admin-detail-line"><span>Начальный вес</span><b>'+show(f.a.starting_weight_kg,' кг')+'</b></div><div class="admin-detail-line"><span>Целевой вес</span><b>'+show(f.a.target_weight_kg,' кг')+'</b></div>'+(f.progress.length?'<div class="admin-measurements"><table><thead><tr><th>Дата</th><th>Вес, кг</th><th>Талия, см</th></tr></thead><tbody>'+f.progress.map(r=>'<tr><td>'+dateLabel(r.entry_date)+'</td><td>'+show(r.weight_kg)+'</td><td>'+show(r.waist_cm)+'</td></tr>').join('')+'</tbody></table></div>':'<p>Замеров пока нет.</p>'),
 achievements:staffRewardsHtml(f.journey)};
 box.innerHTML='<section class="card admin-detail"><h2>'+escapeHtml(p.full_name||'Клиент')+'</h2><div class="dossier-tabs" role="tablist">'+Object.entries({overview:'Обзор',marathon:'Марафон',topics:'Темы и задания',progress:'Прогресс',achievements:'Достижения'}).map(([k,v])=>'<button role="tab" aria-selected="'+(k==='overview')+'" data-dossier="'+k+'">'+v+'</button>').join('')+'</div><div id="dossierBody">'+sections.overview+'</div></section>';
 box.querySelectorAll('[data-dossier]').forEach(b=>b.onclick=()=>{box.querySelectorAll('[data-dossier]').forEach(t=>t.setAttribute('aria-selected',String(t===b)));$('dossierBody').innerHTML=sections[b.dataset.dossier];if(b.dataset.dossier==='achievements'&&f.journey?.enrollment)bindRewards($('dossierBody'),f.journey,true,()=>loadAdminClientDetail(id,version,'achievements'));if(b.dataset.dossier==='topics')hydratePhotos($('dossierBody'))});
 if(tab!=='overview')box.querySelector('[data-dossier="'+tab+'"]')?.click();
 box.scrollIntoView({behavior:'smooth',block:'start'});
 }catch{if(box.isConnected&&box.dataset.client===id)box.innerHTML='<section class="card">Не удалось загрузить карточку. Выберите клиента ещё раз.</section>'}
}
function pageStaffCollection(){return '<section class="card"><div id="staffCollection">Загружаем…</div></section><div id="adminClientDetail"></div>'+($('pageTitle').textContent==='Марафон'?taskSettingsHtml():'')}
async function loadStaffCollection(page){
 const box=$('staffCollection'),version=adminViewVersion;
 try{
 const rows=await fetchAdminRows();const facts=await Promise.all(rows.map(p=>clientFacts(p.id)));
 if(!box.isConnected||version!==adminViewVersion)return;adminRows=rows;
 box.innerHTML=rows.length?rows.map((p,i)=>'<div class="staff-client-summary"><button class="admin-client-row" data-client="'+p.id+'"><b>'+escapeHtml(p.full_name||'Клиент')+'</b><span>Открыть карточку →</span></button>'+marathonSummary(facts[i])+(page==='achievements'&&facts[i].journey?.enrollment?facts[i].journey.rewards.filter(r=>r.unlocked_at).map(r=>'<p>'+r.milestone+'% · '+escapeHtml(r.gift||'Подарок не назначен')+' · '+rewardStatus(r)+'</p>').join(''):'')+'</div>').join(''):'<p>Клиентов пока нет.</p>';
 box.querySelectorAll('[data-client]').forEach(b=>b.onclick=()=>loadAdminClientDetail(b.dataset.client,version));
 }catch{if(box.isConnected)box.innerHTML='<p>Не удалось загрузить данные.</p><button class="btn ghost" id="staffRetry">Повторить</button>';const retry=$('staffRetry');if(retry)retry.onclick=()=>loadStaffCollection(page)}
}
