/* Release 58: free-text story builder with 3 versions. */
const PS58_RESULT_Q=[
['purpose','С какой целью вы пришли в PROTEIN STUDIO?'],
['concern','Что вас больше всего беспокоило или не устраивало на старте?'],
['energy_before','Как вы чувствовали себя по энергии до начала программы?'],
['sleep_before','Как вы спали и как чувствовали себя утром?'],
['load_before','Как вы переносили ходьбу, лестницу и физическую нагрузку?'],
['swelling_before','Была ли отёчность? Если да — где и как вы её замечали?'],
['digestion_before','Как было с пищеварением и регулярностью стула?'],
['appetite_before','Какой был аппетит и была ли тяга к сладкому или частым перекусам?'],
['activity_before','Какая у вас была физическая активность?'],
['hardest_before','Что было самым сложным в вашем самочувствии или образе жизни?'],
['nutrition_changes','Что вы изменили в питании?'],
['products_started','Какие продукты или напитки начали использовать?'],
['water_changes','Что изменили в питьевом режиме?'],
['movement_started','Добавили ли движение, прогулки или тренировки? Что именно?'],
['easiest','Что оказалось самым удобным и лёгким для вас?'],
['hardest_action','Что было сложнее всего соблюдать?'],
['support','Что помогло вам не бросить и продолжать?'],
['wellbeing_now','Как сейчас изменилось ваше общее самочувствие по сравнению со стартом?'],
['energy_now','Что вы заметили в уровне энергии в течение дня?'],
['sleep_now','Как изменился сон: засыпание, качество сна и пробуждение?'],
['load_now','Как сейчас переносите ходьбу, лестницу и физическую нагрузку?'],
['breath_now','Изменилась ли одышка или чувство тяжести при нагрузке? Как именно?'],
['swelling_now','Как изменилась отёчность?'],
['digestion_now','Как изменились пищеварение и регулярность стула?'],
['discomfort_now','Уменьшилось ли чувство тяжести или дискомфорта после еды? Опишите своими словами.'],
['appetite_now','Как изменился аппетит и желание перекусывать?'],
['sweets_now','Как изменилась тяга к сладкому?'],
['activity_now','Стали ли вы больше двигаться? Что изменилось?'],
['body_changes','Что изменилось в одежде, объёмах, лице, талии, животе или ногах?'],
['mood_now','Что изменилось в настроении и уверенности в себе?'],
['others_notice','Что заметили близкие, коллеги или друзья?'],
['surprise','Какой результат вас удивил больше всего?'],
['proud','Каким результатом вы сейчас особенно довольны?'],
['next_goal','Что вы хотите улучшить дальше?'],
['products_now','Какие продукты или привычки вы продолжаете сейчас?']
];
const PS58_CONSULT_Q=[
['first_contact','Как вы впервые узнали о PROTEIN STUDIO или продуктах?'],
['why_try','Почему решили попробовать сами?'],
['personal_result','Какой личный результат или изменение вы получили?'],
['decision','В какой момент вы решили стать консультантом и почему?'],
['fear','Чего вы боялись или в чём сомневались в начале?'],
['hardest','Что было самым сложным в работе на старте?'],
['first_success','Какие первые результаты вы увидели у своих клиентов?'],
['life_change','Что изменилось в вашей жизни благодаря этой деятельности?'],
['helping','Что вам больше всего нравится в работе с людьми?'],
['current_stage','На каком этапе или статусе вы сейчас?'],
['next_goal','Какая ваша следующая цель?'],
['give_people','Что вы хотите дать своим клиентам и команде?'],
['why_continue','Почему вы продолжаете заниматься этим сейчас?']
];
function ps58Sentence(v){const s=String(v||'').trim();return s?(/[.!?…]$/.test(s)?s:s+'.'):''}
function ps58Join(a){return a.filter(Boolean).join(' ').replace(/\s+/g,' ').trim()}
function ps58Age(){const raw=profile?.birth_date||assessment?.birth_date;if(!raw)return null;const d=new Date(raw+'T00:00:00'),n=new Date();let y=n.getFullYear()-d.getFullYear();const m=n.getMonth()-d.getMonth();if(m<0||(m===0&&n.getDate()<d.getDate()))y--;return y>0?y:null}
function ps58Numbers(s){const a=[];if(s?.startWeight!=null&&s?.latestWeight!=null)a.push('На старте мой вес был '+ruNumber(s.startWeight)+' кг, сейчас — '+ruNumber(s.latestWeight)+' кг, изменение '+deltaText(s.weightChange,' кг')+'.');if(s?.startWaist!=null&&s?.latestWaist!=null)a.push('Талия изменилась с '+ruNumber(s.startWaist)+' до '+ruNumber(s.latestWaist)+' см ('+deltaText(s.waistChange,' см')+').');return a.join(' ')}
async function ps58ResultVersions(a){
 let s=null;try{s=await getProgressSummary()}catch{}
 const age=ps58Age(),intro='Меня зовут '+(profile?.full_name||'')+(age?', мне '+age+' лет':'')+'.';
 return {
  short:ps58Join([intro,a.purpose?'Моя цель в PROTEIN STUDIO была такой: '+ps58Sentence(a.purpose):'',a.wellbeing_now?ps58Sentence(a.wellbeing_now):ps58Sentence(a.concern),ps58Numbers(s),a.proud?'Больше всего сейчас меня радует то, что '+ps58Sentence(a.proud):'']),
  medium:ps58Join([intro,a.purpose?'В PROTEIN STUDIO меня привела такая цель: '+ps58Sentence(a.purpose):'',a.concern?'На старте меня больше всего беспокоило: '+ps58Sentence(a.concern):'',a.energy_before?'По энергии тогда было так: '+ps58Sentence(a.energy_before):'',a.nutrition_changes?'Изменения в питании: '+ps58Sentence(a.nutrition_changes):'',a.products_started?'В программу вошли: '+ps58Sentence(a.products_started):'',a.movement_started?'По движению добавилось: '+ps58Sentence(a.movement_started):'',ps58Numbers(s),a.wellbeing_now?'Сейчас по самочувствию я отмечаю: '+ps58Sentence(a.wellbeing_now):'',a.energy_now?'По энергии: '+ps58Sentence(a.energy_now):'',a.proud?'Особенно меня радует то, что '+ps58Sentence(a.proud):'',a.next_goal?'Дальше моя цель — '+ps58Sentence(a.next_goal):'']),
  full:ps58Join([intro,a.purpose?'Моя цель в PROTEIN STUDIO была такой: '+ps58Sentence(a.purpose):'',a.concern?'До начала программы меня больше всего беспокоило: '+ps58Sentence(a.concern):'',a.energy_before?'Моя энергия была такой: '+ps58Sentence(a.energy_before):'',a.sleep_before?'Со сном было так: '+ps58Sentence(a.sleep_before):'',a.load_before?'Физическая нагрузка на старте ощущалась так: '+ps58Sentence(a.load_before):'',a.swelling_before?'Про отёчность могу сказать: '+ps58Sentence(a.swelling_before):'',a.digestion_before?'С пищеварением было так: '+ps58Sentence(a.digestion_before):'',a.appetite_before?'Аппетит и тяга к сладкому выглядели так: '+ps58Sentence(a.appetite_before):'',a.activity_before?'Моя активность была такой: '+ps58Sentence(a.activity_before):'',a.hardest_before?'Самым сложным для меня было: '+ps58Sentence(a.hardest_before):'',a.nutrition_changes?'Изменения в питании начались так: '+ps58Sentence(a.nutrition_changes):'',a.products_started?'В программу вошли такие продукты и напитки: '+ps58Sentence(a.products_started):'',a.water_changes?'Питьевой режим изменился так: '+ps58Sentence(a.water_changes):'',a.movement_started?'Движение и тренировки: '+ps58Sentence(a.movement_started):'',a.easiest?'Самым удобным оказалось: '+ps58Sentence(a.easiest):'',a.hardest_action?'Сложнее всего было: '+ps58Sentence(a.hardest_action):'',a.support?'Продолжать мне помогло: '+ps58Sentence(a.support):'',ps58Numbers(s),a.wellbeing_now?'Сейчас моё общее самочувствие изменилось так: '+ps58Sentence(a.wellbeing_now):'',a.energy_now?'По энергии сейчас: '+ps58Sentence(a.energy_now):'',a.sleep_now?'Сон изменился так: '+ps58Sentence(a.sleep_now):'',a.load_now?'Нагрузку сейчас переношу так: '+ps58Sentence(a.load_now):'',a.breath_now?'По одышке и тяжести при нагрузке: '+ps58Sentence(a.breath_now):'',a.swelling_now?'Отёчность изменилась так: '+ps58Sentence(a.swelling_now):'',a.digestion_now?'Пищеварение изменилось так: '+ps58Sentence(a.digestion_now):'',a.discomfort_now?'После еды я замечаю: '+ps58Sentence(a.discomfort_now):'',a.appetite_now?'Аппетит сейчас: '+ps58Sentence(a.appetite_now):'',a.sweets_now?'Тяга к сладкому: '+ps58Sentence(a.sweets_now):'',a.activity_now?'Моя активность сейчас: '+ps58Sentence(a.activity_now):'',a.body_changes?'По телу и одежде я заметила: '+ps58Sentence(a.body_changes):'',a.mood_now?'В настроении и уверенности: '+ps58Sentence(a.mood_now):'',a.others_notice?'Окружающие заметили: '+ps58Sentence(a.others_notice):'',a.surprise?'Больше всего меня удивило: '+ps58Sentence(a.surprise):'',a.proud?'Особенно важным для меня стало то, что '+ps58Sentence(a.proud):'',a.products_now?'Сейчас я продолжаю: '+ps58Sentence(a.products_now):'',a.next_goal?'Следующая моя цель — '+ps58Sentence(a.next_goal):''])
 };
}
function ps58ConsultVersions(a){
 const age=ps58Age(),intro='Меня зовут '+(profile?.full_name||'')+(age?', мне '+age+' лет':'')+'.';
 return {
  short:ps58Join([intro,a.first_contact?'Моё знакомство с PROTEIN STUDIO началось так: '+ps58Sentence(a.first_contact):'',a.decision?'Решение стать консультантом появилось потому, что '+ps58Sentence(a.decision):'',a.why_continue?'Сегодня я продолжаю, потому что '+ps58Sentence(a.why_continue):'']),
  medium:ps58Join([intro,a.first_contact?'Первое знакомство с PROTEIN STUDIO было таким: '+ps58Sentence(a.first_contact):'',a.why_try?'Причина попробовать была такой: '+ps58Sentence(a.why_try):'',a.personal_result?'Мой личный результат: '+ps58Sentence(a.personal_result):'',a.decision?'После этого появилось решение стать консультантом: '+ps58Sentence(a.decision):'',a.helping?'Больше всего в работе с людьми мне нравится: '+ps58Sentence(a.helping):'',a.current_stage?'Сейчас мой этап: '+ps58Sentence(a.current_stage):'',a.next_goal?'Следующая цель — '+ps58Sentence(a.next_goal):'']),
  full:ps58Join([intro,a.first_contact?'Моё знакомство с PROTEIN STUDIO началось так: '+ps58Sentence(a.first_contact):'',a.why_try?'Причина попробовать была такой: '+ps58Sentence(a.why_try):'',a.personal_result?'Свой личный результат я описываю так: '+ps58Sentence(a.personal_result):'',a.decision?'Решение стать консультантом пришло так: '+ps58Sentence(a.decision):'',a.fear?'В начале у меня были такие страхи и сомнения: '+ps58Sentence(a.fear):'',a.hardest?'Самым сложным на старте было: '+ps58Sentence(a.hardest):'',a.first_success?'Первые результаты клиентов, которые меня вдохновили: '+ps58Sentence(a.first_success):'',a.life_change?'Эта деятельность изменила мою жизнь так: '+ps58Sentence(a.life_change):'',a.helping?'В работе с людьми мне особенно нравится: '+ps58Sentence(a.helping):'',a.current_stage?'Сейчас я нахожусь на таком этапе: '+ps58Sentence(a.current_stage):'',a.give_people?'Своим клиентам и команде я хочу дать: '+ps58Sentence(a.give_people):'',a.next_goal?'Моя следующая цель — '+ps58Sentence(a.next_goal):'',a.why_continue?'И сегодня я продолжаю этим заниматься потому, что '+ps58Sentence(a.why_continue):''])
 };
}
function ps58StoryType(r){return r?.snapshot?.story_type||(String(r?.kind||'').startsWith('consultant_')?'consultant':'result')}
function ps58Versions(r){const v=r?.snapshot?.versions;return v&&typeof v==='object'?v:{short:r.body||'',medium:r.body||'',full:r.body||''}}
function pageStory58(){const staff=isStaffWorkspace();return '<section class="card"><h2>Моя история</h2><p>Все ответы вы пишете своими словами. Приложение только собирает их в связный рассказ и не придумывает результат за вас.</p>'+(staff?'<div class="story-mode58"><button class="btn primary" data-story-mode58="result">Моя история результата</button><button class="btn ghost" data-story-mode58="consultant">Моя история консультанта</button></div>':'')+'<div id="story58">Загружаем…</div></section>'}
function ps58QuestionForm(q,mode){return q.map((x,i)=>{let h='';if(mode==='result'){if(i===0)h='<div class="story-section-title58"><b>1. До PROTEIN STUDIO</b><span>Расскажите, с чего всё начиналось.</span></div>';if(i===10)h='<div class="story-section-title58"><b>2. Что вы начали делать</b><span>Питание, продукты, вода, движение и поддержка.</span></div>';if(i===17)h='<div class="story-section-title58"><b>3. Что изменилось</b><span>Ответьте подробно своими словами — из этих ответов составится ваша история.</span></div>'}else if(i===0)h='<div class="story-section-title58"><b>Моя история консультанта</b><span>От знакомства с PROTEIN STUDIO до ваших целей сегодня.</span></div>';return h+'<label>'+escapeHtml(x[1])+'<textarea name="'+x[0]+'" rows="3" maxlength="1200" placeholder="Напишите своими словами"></textarea></label>'}).join('')}
function ps58VersionsEditor(v,id){return '<div class="story-versions58" data-story-editor58="'+id+'"><h3>Готовые версии</h3><label>30 секунд<textarea data-story-version="short" rows="5">'+escapeHtml(v.short||'')+'</textarea></label><label>1 минута<textarea data-story-version="medium" rows="9">'+escapeHtml(v.medium||'')+'</textarea></label><label>2–3 минуты<textarea data-story-version="full" rows="16">'+escapeHtml(v.full||'')+'</textarea></label></div>'}
function ps58ReadVersions(root){return Object.fromEntries([...root.querySelectorAll('[data-story-version]')].map(x=>[x.dataset.storyVersion,x.value.trim()]))}
async function bindStory58(mode='result'){
 const box=$('story58');if(!box)return;if(clientPreview){box.innerHTML='<p>«Моя история» доступна в рабочем аккаунте.</p>';return}
 const staff=isStaffWorkspace();if(!staff)mode='result';
 document.querySelectorAll('[data-story-mode58]').forEach(b=>{b.className='btn '+(b.dataset.storyMode58===mode?'primary':'ghost');b.onclick=()=>bindStory58(b.dataset.storyMode58)});
 try{
  const rows=await checked(sb.from('ps_stories').select('*').eq('user_id',me.id).order('created_at',{ascending:false}));
  const own=rows.filter(r=>ps58StoryType(r)===mode),firstResult=!rows.some(r=>ps58StoryType(r)==='result'),q=mode==='consultant'?PS58_CONSULT_Q:PS58_RESULT_Q;
  box.innerHTML=(own.length?'<div class="story-history58"><h3>Сохранённые истории</h3>'+own.map((r,i)=>{const v=ps58Versions(r);return '<details '+(i===0?'open':'')+' data-saved-story58="'+r.id+'"><summary>'+dateLabel(r.created_at)+' · '+(mode==='consultant'?'История консультанта':String(r.kind).includes('baseline')||r.kind==='baseline'?'Первая история':'Обновление')+'</summary><div class="story-choice58"><button class="btn ghost" data-show-version58="short">30 сек</button><button class="btn primary" data-show-version58="medium">1 мин</button><button class="btn ghost" data-show-version58="full">2–3 мин</button></div><p class="pre-line" data-story-read58>'+escapeHtml(v.medium)+'</p><div class="story-actions58"><button class="btn ghost" data-copy58>Скопировать</button><button class="btn ghost" data-share58>Поделиться</button><button class="btn ghost" data-edit58>Редактировать</button></div><div class="hidden" data-editbox58>'+ps58VersionsEditor(v,r.id)+'<button class="btn primary" data-saveedit58>Сохранить изменения</button><p role="status"></p></div></details>'}).join('')+'</div>':'')+
   '<form id="storyForm58"><h3>'+(mode==='consultant'?'Создать / обновить историю консультанта':firstResult&&!staff?'Первая история · +2 ⭐':'Создать / обновить историю результата')+'</h3><p>Пишите так, как вы действительно говорите. Если вопрос к вам не относится, его можно оставить пустым.</p>'+ps58QuestionForm(q,mode)+'<button class="btn primary">Сформировать 3 версии</button><p role="status"></p></form><div id="storyDraft58"></div>';
  box.querySelectorAll('[data-saved-story58]').forEach(d=>{
   const row=own.find(r=>r.id===d.dataset.savedStory58),v=ps58Versions(row);let active='medium';
   d.querySelectorAll('[data-show-version58]').forEach(b=>b.onclick=()=>{active=b.dataset.showVersion58;d.querySelector('[data-story-read58]').textContent=v[active]||'';d.querySelectorAll('[data-show-version58]').forEach(x=>x.className='btn '+(x===b?'primary':'ghost'))});
   d.querySelector('[data-copy58]').onclick=async()=>{await navigator.clipboard.writeText(d.querySelector('[data-story-read58]').textContent);d.querySelector('[data-copy58]').textContent='Скопировано ✓'};
   d.querySelector('[data-share58]').onclick=async()=>{const text=d.querySelector('[data-story-read58]').textContent;if(navigator.share)await navigator.share({title:'Моя история PROTEIN STUDIO',text});else await navigator.clipboard.writeText(text)};
   d.querySelector('[data-edit58]').onclick=()=>d.querySelector('[data-editbox58]').classList.toggle('hidden');
   d.querySelector('[data-saveedit58]').onclick=()=>buttonAction(d.querySelector('[data-saveedit58]'),async()=>{const nv=ps58ReadVersions(d.querySelector('[data-story-editor58]'));await checked(sb.rpc('ps_update_story_versions_v58',{p_id:row.id,p_versions:nv}));v.short=nv.short;v.medium=nv.medium;v.full=nv.full;d.querySelector('[data-story-read58]').textContent=v[active]||v.medium;d.querySelector('[role=status]').textContent='Сохранено ✓'},d.querySelector('[role=status]'));
  });
  const form=$('storyForm58');form.onsubmit=e=>{e.preventDefault();buttonAction(form.querySelector('button.btn.primary'),async()=>{
   const answers=Object.fromEntries(q.map(x=>[x[0],form.elements[x[0]].value.trim()])),must=mode==='consultant'?['first_contact','decision','why_continue']:['purpose','concern','nutrition_changes','wellbeing_now','proud'],missing=must.find(k=>!answers[k]);
   if(missing){const qq=q.find(x=>x[0]===missing);throw Error('Ответьте на вопрос: «'+qq[1]+'».')}
   const versions=mode==='consultant'?ps58ConsultVersions(answers):await ps58ResultVersions(answers),draft=$('storyDraft58');
   draft.innerHTML=ps58VersionsEditor(versions,'new')+'<button class="btn primary" id="saveStory58">Сохранить историю</button><p role="status"></p>';
   $('saveStory58').onclick=()=>buttonAction($('saveStory58'),async()=>{const nv=ps58ReadVersions(draft.querySelector('[data-story-editor58]'));await checked(sb.rpc('ps_save_story_v58',{p_id:crypto.randomUUID(),p_story_type:mode,p_answers:answers,p_versions:nv}));await bindStory58(mode);if(!staff)getJourney().then(showNewReward).catch(()=>{})},draft.querySelector('[role=status]'));
   draft.scrollIntoView({behavior:'smooth',block:'start'});
  },form.querySelector('[role=status]'))};
 }catch(e){box.innerHTML='<p>Не удалось загрузить «Мою историю»: '+escapeHtml(e.message||'ошибка')+'</p><button class="btn ghost" id="storyRetry58">Повторить</button>';$('storyRetry58').onclick=()=>bindStory58(mode)}
}
if(typeof pages!=='undefined')pages.story=pageStory58;
bindStory56=bindStory58;