/* PROTEIN STUDIO release 56 UI: invitations, story, water, access controls. */

function pageInvitations56(){
  return '<section class="card ps56-invite-card"><h2>Приглашения</h2><p>Пригласите 5 человек в PROTEIN STUDIO.</p><div id="heartSlots56" class="heart-slots56">Загружаем…</div><div id="heartStatus56"></div></section>'+
    '<section class="card"><h3>Кого вы пригласили</h3><div id="heartList56">Загружаем…</div></section>'+
    '<section class="card" id="heartReward56"></section>';
}
function ps56HeartUrl(token){const u=appBaseUrl();u.searchParams.set('heart',token);return u.href}
function ps56RelationOptions(){return ['Подруга','Друг','Сестра','Брат','Младшая сестра','Двоюродная сестра','Родственник','Коллега','Знакомый','Другое']}
function ps56InviteTypes(){return ['Привилегированный клиент','Независимый партнёр','Домашний клиент','Абонемент / клиент клуба']}
async function bindInvitations56(){
  const slots=$('heartSlots56');if(!slots||clientPreview)return;
  try{
    const [rows,reward]=await Promise.all([
      checked(sb.from('ps_heart_invites').select('*').eq('owner_id',me.id).order('slot')),
      checked(sb.from('ps_referral_rewards').select('*').eq('owner_id',me.id).maybeSingle()).catch(()=>null)
    ]);
    if(!slots.isConnected)return;
    const bySlot=new Map((rows||[]).map(r=>[Number(r.slot),r]));
    const filled=(rows||[]).filter(r=>r.registered_user_id).length;
    if(filled>=2&&!profile?.ambassador_at){const p=await checked(sb.from('ps_profiles').select('ambassador_at').eq('id',me.id).single());if(p?.ambassador_at)profile.ambassador_at=p.ambassador_at}
    slots.innerHTML=Array.from({length:5},(_,i)=>{const n=i+1,r=bySlot.get(n);return '<button class="heart-slot56 '+(r?.registered_user_id?'filled':'')+'" data-heart-slot="'+n+'" aria-label="Сердечко '+n+'">'+(r?.registered_user_id?'♥':'♡')+'</button>'}).join('');
    const status=$('heartStatus56');
    status.innerHTML='<p><b>'+filled+' из 5</b> заполнено</p>'+(profile?.ambassador_at?'<div class="ambassador56">🎉 Амбассадор PROTEIN STUDIO</div>':filled>=2?'<p>Статус Амбассадора уже должен быть активирован. Обновите страницу.</p>':'<p>После 2 заполненных сердечек откроется статус «Амбассадор».</p>');
    $('heartList56').innerHTML=(rows||[]).filter(r=>r.registered_user_id).length?(rows||[]).filter(r=>r.registered_user_id).map(r=>'<div class="invite-person56"><span>♥</span><div><b>'+escapeHtml(r.registered_name||'Участник')+'</b><small>'+escapeHtml(r.relationship||'')+(r.invite_type?' · '+escapeHtml(r.invite_type):'')+' · '+dateLabel(r.registered_at)+'</small></div></div>').join(''):'<p>Пока никто не зарегистрировался по вашим приглашениям.</p>';
    const rewardBox=$('heartReward56');
    if(rewardBox){
      rewardBox.innerHTML=filled<5?'<h3>🎁 Подарок за 5 сердечек</h3><p>Когда заполнятся все 5 ♥, откроется 1 месяц абонемента бесплатно.</p>':
        '<h3>🎁 1 месяц абонемента бесплатно</h3><p>'+(reward?.issued_at?'Выдано ✓':reward?.requested_at?'Запрос отправлен консультанту.':'Награда открыта!')+'</p>'+(!reward?.requested_at&&!reward?.issued_at?'<button class="btn primary" id="heartClaim56">Получить у консультанта</button>':'');
      if($('heartClaim56'))$('heartClaim56').onclick=()=>buttonAction($('heartClaim56'),async()=>{await checked(sb.rpc('ps_referral_reward_action',{p_owner:me.id,p_action:'claim'}));await bindInvitations56()},rewardBox);
    }
    slots.querySelectorAll('[data-heart-slot]').forEach(b=>b.onclick=()=>ps56OpenHeart(Number(b.dataset.heartSlot),bySlot.get(Number(b.dataset.heartSlot))));
  }catch(e){slots.innerHTML='<p>Не удалось загрузить приглашения.</p><button class="btn ghost" id="heartRetry56">Повторить</button>';$('heartRetry56').onclick=bindInvitations56}
}
async function ps56OpenHeart(slot,row){
  const dialog=document.createElement('dialog');dialog.className='reward-dialog heart-dialog56';
  if(row?.registered_user_id){
    dialog.innerHTML='<h2>♥ Сердечко '+slot+'</h2><p><b>'+escapeHtml(row.registered_name||'Участник')+'</b></p><p>'+escapeHtml(row.relationship||'')+(row.invite_type?' · '+escapeHtml(row.invite_type):'')+'</p><p>'+dateLabel(row.registered_at)+'</p><button class="btn primary" data-close>Готово</button>';
    document.body.append(dialog);dialog.showModal();dialog.querySelector('[data-close]').onclick=()=>{dialog.close();dialog.remove()};return;
  }
  if(row){
    const url=ps56HeartUrl(row.token);
    dialog.innerHTML='<h2>♡ Сердечко '+slot+'</h2><p>Приглашение уже создано. Сердечко станет красным после регистрации человека.</p>'+qrMarkup(url,'Приглашение PROTEIN STUDIO','heartQR56')+'<button class="btn ghost" data-close>Закрыть</button>';
    document.body.append(dialog);dialog.showModal();bindQR(url,'Приглашение PROTEIN STUDIO','heartQR56');dialog.querySelector('[data-close]').onclick=()=>{dialog.close();dialog.remove()};return;
  }
  dialog.innerHTML='<h2>♡ Сердечко '+slot+'</h2><form id="heartForm56"><label>Кем вам приходится человек?<select name="relationship">'+ps56RelationOptions().map(v=>'<option>'+v+'</option>').join('')+'</select></label><label id="heartOtherLabel56" hidden>Напишите сами<input name="other" maxlength="100"></label><label>Кого приглашаете?<select name="type">'+ps56InviteTypes().map(v=>'<option>'+v+'</option>').join('')+'</select></label><button class="btn primary">Создать приглашение</button><button class="btn ghost" type="button" data-close>Отмена</button><p role="status"></p></form>';
  document.body.append(dialog);dialog.showModal();const form=$('heartForm56');
  form.elements.relationship.onchange=()=>{$('heartOtherLabel56').hidden=form.elements.relationship.value!=='Другое'};
  form.querySelector('[data-close]').onclick=()=>{dialog.close();dialog.remove()};
  form.onsubmit=e=>{e.preventDefault();buttonAction(form.querySelector('button.btn.primary'),async()=>{
    const rel=form.elements.relationship.value==='Другое'?form.elements.other.value.trim():form.elements.relationship.value;
    if(rel.length<2)throw Error('Укажите, кем вам приходится человек.');
    const created=await checked(sb.rpc('ps_create_heart',{p_slot:slot,p_relationship:rel,p_type:form.elements.type.value}));
    const url=ps56HeartUrl(created.token);
    dialog.innerHTML='<h2>Приглашение готово</h2><p>Сердечко станет красным, когда человек зарегистрируется по этой ссылке.</p>'+qrMarkup(url,'Приглашение PROTEIN STUDIO','heartQR56')+'<button class="btn ghost" data-close>Закрыть</button>';
    bindQR(url,'Приглашение PROTEIN STUDIO','heartQR56');dialog.querySelector('[data-close]').onclick=()=>{dialog.close();dialog.remove();bindInvitations56()};
  },form.querySelector('[role=status]'))};
}

const PS56_STORY_FIELDS=[
 ['goal','Зачем вы пришли в PROTEIN STUDIO?','textarea'],
 ['energy','Энергия','select'],
 ['sleep','Сон','select'],
 ['exercise','Переносимость физической нагрузки','select'],
 ['breathlessness','Одышка / тяжесть при нагрузке','select'],
 ['swelling','Отёчность','select'],
 ['digestion','Пищеварение / регулярность стула','select'],
 ['discomfort','Тяжесть или дискомфорт','select'],
 ['appetite','Аппетит','select'],
 ['cravings','Тяга к сладкому','select'],
 ['activity','Физическая активность','select'],
 ['wellbeing','Общее самочувствие','select'],
 ['products','Какие продукты или напитки вы начали использовать?','textarea'],
 ['notes','Что ещё хотите рассказать?','textarea']
];
function pageStory56(){return '<section class="card"><h2>Моя история</h2><p>Ответьте на несколько вопросов — приложение соберёт короткую историю, которую удобно рассказать на встрече или мероприятии.</p><div id="story56">Загружаем…</div></section>'}
function ps56StoryOptions(isUpdate){const vals=isUpdate?['Стало лучше','Без изменений','Стало хуже','Не было / не относится']:['Хорошо','Средне','Плохо','Не было / не относится'];return '<option value="">Выберите</option>'+vals.map(v=>'<option>'+v+'</option>').join('')}
async function bindStory56(){
  const box=$('story56');if(!box||clientPreview)return;
  try{
    const rows=await checked(sb.from('ps_stories').select('*').eq('user_id',me.id).order('created_at',{ascending:false}));
    if(!box.isConnected)return;
    const baseline=rows.some(r=>r.kind==='baseline'),isUpdate=baseline;
    box.innerHTML=(rows.length?'<div class="story-history56"><h3>Сохранённые истории</h3>'+rows.map((r,i)=>'<details '+(i===0?'open':'')+'><summary>'+dateLabel(r.created_at)+' · '+(r.kind==='baseline'?'Первая история':'Обновление')+'</summary><p class="pre-line">'+escapeHtml(r.body)+'</p><button class="btn ghost" data-copy-story="'+i+'">Скопировать</button><button class="btn ghost" data-share-story="'+i+'">Поделиться</button></details>').join('')+'</div>':'')+
      '<form id="storyForm56"><h3>'+(isUpdate?'Обновить мою историю':'Первая история · +2 ⭐')+'</h3><p>'+(isUpdate?'Отметьте, что изменилось с прошлого раза.':'Первая заполненная история в марафоне приносит +2 ⭐ один раз.')+'</p>'+
      PS56_STORY_FIELDS.map(([key,label,type])=>'<label>'+label+(type==='select'?'<select name="'+key+'">'+ps56StoryOptions(isUpdate)+'</select>':'<textarea name="'+key+'" rows="2" maxlength="700"></textarea>')+'</label>').join('')+
      '<button class="btn primary">Сформировать мою историю</button><p role="status"></p></form><div id="storyResult56"></div>';
    box.querySelectorAll('[data-copy-story]').forEach(b=>b.onclick=async()=>{await navigator.clipboard.writeText(rows[Number(b.dataset.copyStory)].body);b.textContent='Скопировано ✓'});
    box.querySelectorAll('[data-share-story]').forEach(b=>b.onclick=async()=>{const body=rows[Number(b.dataset.shareStory)].body;if(navigator.share)await navigator.share({title:'Моя история PROTEIN STUDIO',text:body});else await navigator.clipboard.writeText(body)});
    const form=$('storyForm56');
    form.onsubmit=e=>{e.preventDefault();buttonAction(form.querySelector('button.btn.primary'),async()=>{
      const answers=Object.fromEntries(PS56_STORY_FIELDS.map(([key])=>[key,form.elements[key].value.trim()]));
      const saved=await checked(sb.rpc('ps_save_story',{p_id:crypto.randomUUID(),p_answers:answers}));
      $('storyResult56').innerHTML='<section class="story-result56"><h3>Готово 🌸</h3><p class="pre-line">'+escapeHtml(saved.body)+'</p></section>';
      await bindStory56();
      if(!isStaffWorkspace())getJourney().then(s=>showNewReward(s)).catch(()=>{});
    },form.querySelector('[role=status]'))};
  }catch(e){box.innerHTML='<p>Не удалось загрузить «Мою историю».</p><button class="btn ghost" id="storyRetry56">Повторить</button>';$('storyRetry56').onclick=bindStory56}
}

function ps56WaterTotal(state){return Number(state?.today_ml??state?.total_ml??state?.ml??0)||0}
function ps56WaterTarget(state){return Number(state?.target_ml??state?.goal_ml??(buildNutritionTargets(progressSummary?.latestWeight).waterLiters||0)*1000)||0}
async function bindWaterQuick56(){
  const box=$('waterQuick56');if(!box||clientPreview)return;
  try{
    let state=await checked(sb.rpc('ps_water_state'));if(!box.isConnected)return;
    const paint=()=>{const total=ps56WaterTotal(state),target=ps56WaterTarget(state),pct=target?Math.min(100,Math.round(total/target*100)):0;box.innerHTML='<section class="card water-quick56"><div class="row"><h3>💧 Вода сегодня</h3><b>'+Math.round(total/100)/10+' / '+Math.round(target/100)/10+' л</b></div><div class="plan-progress-line"><i style="width:'+pct+'%"></i></div><div class="water-buttons56">'+[200,250,500].map(n=>'<button class="btn ghost" data-water-add="'+n+'">+'+n+' мл</button>').join('')+'</div><p role="status"></p></section>';box.querySelectorAll('[data-water-add]').forEach(b=>b.onclick=()=>buttonAction(b,async()=>{state=await checked(sb.rpc('ps_add_water',{p_id:crypto.randomUUID(),p_ml:Number(b.dataset.waterAdd)}));paint()},box.querySelector('[role=status]')))};paint();
  }catch(e){box.innerHTML='<section class="card"><p>Не удалось загрузить воду.</p></section>'}
}

async function bindWaterReminderSettings56(){
  const box=$('waterReminder56');if(!box||isStaffWorkspace()||clientPreview)return;
  try{
    const row=await checked(sb.from('ps_notification_settings').select('water,water_times,timezone').eq('user_id',me.id).maybeSingle());
    const times=(row?.water_times?.length?row.water_times:['12:00','15:00','17:00']).slice(0,3);
    box.innerHTML='<h3>💧 Напоминания о воде</h3><label class="inline-check"><input id="waterReminderEnabled56" type="checkbox" '+(row?.water!==false?'checked':'')+'> Включить напоминания</label><div class="three-times56">'+[0,1,2].map(i=>'<label>Время '+(i+1)+'<input type="time" data-water-time value="'+escapeHtml(times[i]||['12:00','15:00','17:00'][i])+'"></label>').join('')+'</div><button class="btn ghost" id="saveWaterReminder56">Сохранить</button><p role="status"></p>';
    $('saveWaterReminder56').onclick=()=>buttonAction($('saveWaterReminder56'),async()=>{const values=[...box.querySelectorAll('[data-water-time]')].map(x=>x.value).filter(Boolean);await checked(sb.rpc('ps_save_water_reminders',{p_enabled:$('waterReminderEnabled56').checked,p_times:values,p_timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Yakutsk'}));box.querySelector('[role=status]').textContent='Сохранено ✓'},box.querySelector('[role=status]'));
  }catch(e){box.innerHTML='<p>Не удалось загрузить настройки воды.</p>'}
}

async function ps56AppendClientAccess(id){
  const detail=$('adminClientDetail');if(!detail||detail.dataset.client!==id)return;
  const p=adminRows.find(x=>x.id===id);if(!p)return;
  let heartRows=[],refReward=null;try{[heartRows,refReward]=await Promise.all([checked(sb.from('ps_heart_invites').select('registered_user_id').eq('owner_id',id)),checked(sb.from('ps_referral_rewards').select('*').eq('owner_id',id).maybeSingle())])}catch{}
  detail.querySelector('#clientAccess56')?.remove();
  const section=document.createElement('section');section.id='clientAccess56';section.className='card';
  section.innerHTML='<h3>'+(p.access_paused?'Доступ приостановлен':'Доступ клиента')+'</h3>'+(p.access_paused?'<p>Причина: '+escapeHtml(p.pause_reason||'Не указана')+'</p><button class="btn primary" id="resumeClient56">Возобновить доступ</button>':'<button class="btn ghost" id="pauseClient56">Приостановить доступ</button>')+'<p role="status"></p>';
  detail.append(section);
  const filled=heartRows.filter(x=>x.registered_user_id).length;
  if(filled||refReward){const r=document.createElement('section');r.className='card';r.id='clientReferral56';r.innerHTML='<h3>Приглашения</h3><p><b>'+filled+' из 5 ♥</b>'+(p.ambassador_at?' · Амбассадор':'')+'</p>'+(refReward?'<p>1 месяц бесплатно: '+(refReward.issued_at?'выдано ✓':refReward.requested_at?'ожидает выдачи':'открыто')+'</p>':'')+(refReward?.requested_at&&!refReward?.issued_at?'<button class="btn primary" id="issueReferral56">Абонемент выдан ✓</button>':'')+'<p role="status"></p>';detail.append(r);if($('issueReferral56'))$('issueReferral56').onclick=()=>buttonAction($('issueReferral56'),async()=>{await checked(sb.rpc('ps_referral_reward_action',{p_owner:id,p_action:'issue'}));await ps56AppendClientAccess(id)},r.querySelector('[role=status]'))}
  if($('resumeClient56'))$('resumeClient56').onclick=()=>buttonAction($('resumeClient56'),async()=>{await checked(sb.rpc('ps_set_client_access',{p_client:id,p_paused:false,p_reason:null}));p.access_paused=false;p.pause_reason=null;renderAdminClients();await ps56AppendClientAccess(id)},section.querySelector('[role=status]'));
  if($('pauseClient56'))$('pauseClient56').onclick=()=>{const d=document.createElement('dialog');d.className='reward-dialog';d.innerHTML='<h2>Приостановить доступ</h2><form id="pauseForm56"><label>Причина<select name="reason">'+['Перестал ходить в клуб','Перестал использовать продукты','Не выходит на связь / не отвечает','Временная пауза','Переехал','Другое'].map(v=>'<option>'+v+'</option>').join('')+'</select></label><label>Комментарий<input name="other" maxlength="200" placeholder="Необязательно"></label><button class="btn primary">Приостановить</button><button type="button" class="btn ghost" data-close>Отмена</button><p role="status"></p></form>';document.body.append(d);d.showModal();d.querySelector('[data-close]').onclick=()=>{d.close();d.remove()};d.querySelector('form').onsubmit=e=>{e.preventDefault();const f=e.target;buttonAction(f.querySelector('button.btn.primary'),async()=>{const reason=f.elements.reason.value+(f.elements.other.value.trim()?' · '+f.elements.other.value.trim():'');await checked(sb.rpc('ps_set_client_access',{p_client:id,p_paused:true,p_reason:reason}));p.access_paused=true;p.pause_reason=reason;d.close();d.remove();renderAdminClients();await ps56AppendClientAccess(id)},f.querySelector('[role=status]'))}};
}
if(typeof loadAdminClientDetail==='function'){
  const ps56BaseClientDetail=loadAdminClientDetail;
  loadAdminClientDetail=async function(id,...rest){await ps56BaseClientDetail(id,...rest);await ps56AppendClientAccess(id)}
}

if(typeof pages!=='undefined'){
  pages.invitations=pageInvitations56;
  pages.story=pageStory56;
}
