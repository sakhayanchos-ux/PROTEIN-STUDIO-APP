/* Release 96 — confirmed-star tracker for common 21-day marathon.
   User submissions are stored as pending and approved by their assigned consultant. */
const ps96Groups=[
 {points:1,items:[
 ['weight_300g','Снизить вес на 300 г'],
 ['evening_shake','Ужин вечерним коктейлем'],
 ['product_baking','Выпечка из продукта'],
 ['herbal_drink','ГЕРБИ напиток: кофе Herbalife, коллагеновый лимонад, детокс, LiftOff и др.'],
 ['zoom_review','Посещение Zoom и отзыв'],
 ['zoom_friend','Подключить друга к Zoom']
 ]},
 {points:3,items:[
 ['turbo_drink','Турбо напиток'],
 ['story_mention','Статус / сторис с отметкой консультанта'],
 ['friend_repost','Друг сделал репост готового статуса']
 ]},
 {points:5,items:[
 ['offline_friend','Привести друга на офлайн-мероприятие'],
 ['online_workout','Посещение онлайн-тренировки'],
 ['hiber_day','День Хибера'],
 ['thematic_reel','Reels по тематике проекта']
 ]},
 {points:10,items:[['ten_day_pass','10-дневный абонемент'],['body_scan_friend','Пригласить друга на диагностику состава тела']]},
 {points:20,items:[['home_client','Домашний клиент с Алоэ, Чаем, Коктейлем или месячный абонемент в клуб']]},
 {points:30,items:[['vip300','VIP 300 — открыть промоушен БАЙКАЛ']]},
 {points:50,items:[['vip500','VIP 500 — открыть промоушен ЗАБУГОР-2']]}
];
const ps96LabelMap=Object.fromEntries(ps96Groups.flatMap(g=>g.items.map(x=>[x[0],x[1]])));
function ps96Build(s){
 const today=s.today,done=new Map((s.entries||[]).filter(x=>x.entry_date===today&&String(x.kind).startsWith('star96:')).map(x=>[x.kind.slice(7),x]));
 const total=Number(s.stars)||0;
 const earned=(s.entries||[]).filter(x=>String(x.kind).startsWith('star96:')&&['approved','auto'].includes(x.status)).reduce((v,x)=>v+Number(x.stars||0),0);
 return '<section class="card" id="ps96Stars"><div class="eyebrow">⭐ ЗВЁЗДНАЯ СИСТЕМА · 21 ДЕНЬ</div><h2>Мой трекер звёзд</h2><div class="cm75-hero-row"><div><span>Всего подтверждено</span><b>'+total+' ⭐</b></div><div><span>По новым заданиям</span><b>'+earned+' ⭐</b></div></div>'+
 '<p class="muted">Выбирайте выполненные задания. Консультант подтвердит их, после чего звёзды прибавятся автоматически. Каждое задание — не более одного раза в день.</p>'+
 (s.participant&&s.phase==='live'?ps96Groups.map(group=>'<div class="ps96-group"><h3>'+group.points+' ⭐</h3>'+
 group.items.map(([kind,label])=>{const e=done.get(kind),status=e?.status;
 return '<div class="ps96-task"><div><b>'+escapeHtml(label)+'</b>'+(e?'<p class="muted">'+(status==='pending'?'⏳ На проверке':status==='approved'?'✅ Подтверждено · +'+e.stars+' ⭐':status==='rejected'?'↻ Не подтверждено, можно отправить заново':'✓ '+status)+'</p>':'')+'</div>'+
 ((!e||status==='rejected')?'<button class="btn ghost" data-star96="'+escapeHtml(kind)+'">Отправить</button>':'')+
 '</div>'}).join('')+'</div>').join(''):'<p>Задания можно отправлять после регистрации и с первого дня марафона.</p>')+
 '</section>';
}
function ps96Bind(box,s){
 const card=box.querySelector('#ps96Stars');if(!card)return;
 card.querySelectorAll('[data-star96]').forEach(btn=>btn.onclick=()=>buttonAction(btn,async()=>{
 const kind=btn.dataset.star96,heading=ps96LabelMap[kind];
 if(!heading)throw Error('Задание не найдено');
 await checked(sb.rpc('ps_submit_star_task_96',{p_kind:kind,p_photo:null}));
 await loadCommonMarathon75();
 },card));
}
const ps96PrevLoad=loadCommonMarathon75;
loadCommonMarathon75=async function(){
 await ps96PrevLoad();
 if(!common75State?.campaign||!me)return;
 if(isStaffWorkspace()&&!clientPreview)return;
 const box=$('commonMarathon75')||$('journeyView');
 if(!box?.isConnected)return;
 if(box.querySelector('#ps96Stars'))return;
 const ui=document.createElement('div');ui.innerHTML=ps96Build(common75State);
 const target=box.querySelector('.cm80-tracker')||box.querySelector('.cm75-rules');
 if(target)target.before(ui.firstElementChild);else box.appendChild(ui.firstElementChild);
 ps96Bind(box,common75State);
};
const ps96OldKind=common75KindLabel;
common75KindLabel=function(kind){return String(kind).startsWith('star96:')?(ps96LabelMap[String(kind).slice(7)]||kind):ps96OldKind(kind)};
