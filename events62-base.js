/* Release 62: events and training — shared/client UI. */
let requestedEvent62=null;
function event62Money(v){const n=Number(v||0);return n.toLocaleString('ru-RU',{maximumFractionDigits:n%1?2:0})+' ₽'}
function event62Poster(path){if(!path)return'';try{return sb.storage.from('ps-event-posters').getPublicUrl(path).data.publicUrl||''}catch{return''}}
function event67MediaUrl(item){
 if(!item?.path)return'';
 try{return sb.storage.from(item.bucket||'ps-event-media').getPublicUrl(item.path).data.publicUrl||''}catch{return''}
}
function event67MediaItems(e){
 const out=[];
 if(e.poster_path)out.push({type:'image',path:e.poster_path,bucket:'ps-event-posters',legacy:true});
 const media=Array.isArray(e.media)?e.media:[];
 media.forEach(x=>{if(x&&x.path&&['image','video'].includes(x.type))out.push(x)});
 return out
}
function event67MediaGallery(e){
 const items=event67MediaItems(e);
 if(!items.length)return'<div class="event-poster-placeholder62">📣<span>Фото или видео</span></div>';
 return'<div class="event-media67 '+(items.length>1?'multi':'single')+'">'+items.map((m,i)=>{
  const url=m.legacy?event62Poster(m.path):event67MediaUrl(m);
  if(!url)return'';
  if(m.type==='video')return'<div class="event-media-item67"><video controls playsinline preload="metadata" src="'+escapeHtml(url)+'" aria-label="Видео афиши '+(i+1)+'"></video>'+(items.length>1?'<span class="event-media-count67">'+(i+1)+' / '+items.length+'</span>':'')+'</div>';
  return'<div class="event-media-item67"><img src="'+escapeHtml(url)+'" alt="Фото афиши '+(i+1)+'">'+(items.length>1?'<span class="event-media-count67">'+(i+1)+' / '+items.length+'</span>':'')+'</div>'
 }).join('')+'</div>'
}
function event62When(e){const a=[];if(e.is_permanent&&e.schedule_text)a.push(e.schedule_text);else if(e.event_date)a.push(dateLabel(e.event_date));if(e.event_time)a.push(String(e.event_time).slice(0,5));return a.join(' · ')||'Дата уточняется'}
function event62Price(e){
 if(e.price_mode==='free')return'Бесплатно';
 if(e.price_mode==='fixed')return'Вход: '+event62Money(e.fixed_price);
 const d=Number(profile?.discount_level||0),p=e.price_by_discount||{},v=d&&p[String(d)]!=null?p[String(d)]:e.fixed_price;
 return v!=null?'Ваша цена: '+event62Money(v):'Цена зависит от скидки'
}
function event62Eligible(e){
 if(isStaffWorkspace()||e.kind!=='training')return{ok:true};
 const d=Number(profile?.discount_level||0);
 if(e.min_discount){if(!d)return{ok:false,text:'🔒 Скидка ещё не назначена консультантом'};if(d<Number(e.min_discount))return{ok:false,text:'🔒 Доступно от скидки '+e.min_discount+'%'}}
 const statuses=Array.isArray(e.allowed_statuses)?e.allowed_statuses:[];
 if(statuses.length){const s=String(profile?.member_status||'').trim().toLowerCase();if(!s||!statuses.some(x=>String(x).trim().toLowerCase()===s))return{ok:false,text:'🔒 Доступно для выбранных статусов'}}
 return{ok:true}
}
function event62Speakers(e){const a=Array.isArray(e.speakers)?e.speakers:[];return a.length?'<div class="event-speakers62"><h4>Спикеры</h4>'+a.map(s=>'<div><b>'+escapeHtml(s.name||'Спикер')+'</b>'+(s.topic?'<span>'+escapeHtml(s.topic)+'</span>':'')+'</div>').join('')+'</div>':''}
function event62State(p){
 if(!p)return'';
 if(p.attended_at)return'<div class="event-state62 attended">✅ Посещение отмечено'+(p.stars_awarded?' · +'+p.stars_awarded+' ⭐':'')+'</div>';
 if(p.status==='cancelled')return'<div class="event-state62">Участие отменено</div>';
 if(p.payment_status==='pending'&&Number(p.price_snapshot)>0)return'<div class="event-state62 pending">⏳ Ожидает оплаты · '+event62Money(p.price_snapshot)+'</div>';
 return'<div class="event-state62 confirmed">✅ Участие подтверждено</div>'
}
function event62Card(e,p,staff){
 const access=event62Eligible(e);
 const userAction=staff?'':!access.ok?'<button class="btn ghost" disabled>'+escapeHtml(access.text)+'</button>':p&&p.status!=='cancelled'?(p.attended_at?'':'<button class="btn ghost" data-cancel-event62="'+e.id+'">Отменить участие</button>'):'<button class="btn primary" data-join-event62="'+e.id+'">Участвую</button>';
 const staffActions=staff?'<div class="event-staff-actions62"><button class="btn ghost" data-edit-event62="'+e.id+'">Редактировать</button><button class="btn primary" data-publish-event62="'+e.id+'">'+(e.published_at?'Отправить новое 📣':'Опубликовать 📣')+'</button><button class="btn ghost" data-participants-event62="'+e.id+'">Участники</button><button class="btn ghost" data-archive-event62="'+e.id+'">Снять с публикации</button></div>':'';
 return'<article class="event-card62" id="event62-'+e.id+'">'+event67MediaGallery(e)+'<div class="event-body62"><div class="row"><span class="event-kind62">'+(e.kind==='training'?'🎓 Обучение':'🎉 Мероприятие')+'</span>'+(staff?'<span class="pill">'+(e.published_at?'Опубликовано':'Черновик')+'</span>':'')+'</div><h2>'+escapeHtml(e.title)+'</h2><div class="event-meta62"><b>'+escapeHtml(event62When(e))+'</b>'+(e.venue?'<span>📍 '+escapeHtml(e.venue)+'</span>':'')+(e.online_url?'<a href="'+escapeHtml(e.online_url)+'" target="_blank" rel="noopener">Открыть онлайн-ссылку</a>':'')+'</div>'+(e.description?'<p>'+escapeHtml(e.description)+'</p>':'')+'<div class="event-price62">'+escapeHtml(event62Price(e))+(e.kind==='training'&&e.min_discount?'<small> · доступ от '+e.min_discount+'%</small>':'')+(e.kind==='training'&&Array.isArray(e.allowed_statuses)&&e.allowed_statuses.length?'<small> · статусы: '+escapeHtml(e.allowed_statuses.join(', '))+'</small>':'')+'</div>'+(e.attendance_stars?'<div class="event-stars62">За фактический приход: +'+e.attendance_stars+' ⭐</div>':'')+event62Speakers(e)+event62State(p)+userAction+staffActions+'<div class="event-participants62 hidden" data-participant-box62="'+e.id+'"></div></div></article>'
}
function pageEvents62(kind){
 return'<section class="card event-head62"><div class="eyebrow">PROTEIN STUDIO</div><h1>'+(kind==='training'?'🎓 Обучение':'🎉 Мероприятия')+'</h1></section>'+(isStaffWorkspace()?event62Editor(kind):'')+'<div id="eventsList62">Загружаем…</div>'
}
async function event62Load(kind){
 let q=sb.from('ps_events').select('*').eq('kind',kind).eq('active',true);if(!isStaffWorkspace())q=q.not('published_at','is',null);
 const rows=await checked(q.order('is_permanent',{ascending:false}).order('event_date',{ascending:true,nullsFirst:false}).order('created_at',{ascending:false}));
 const own=rows.length?await checked(sb.from('ps_event_participations').select('*').eq('user_id',me.id).in('event_id',rows.map(x=>x.id))):[];
 return{rows,own}
}
async function bindEvents62(kind){
 const box=$('eventsList62');if(!box)return;
 try{
  const d=await event62Load(kind),by=new Map(d.own.map(x=>[x.event_id,x]));if(!box.isConnected)return;
  box.innerHTML=d.rows.length?d.rows.map(e=>event62Card(e,by.get(e.id),isStaffWorkspace())).join(''):'<section class="card"><p>Пока афиш нет.</p></section>';
  box.querySelectorAll('[data-join-event62]').forEach(b=>b.onclick=()=>buttonAction(b,async()=>{await checked(sb.rpc('ps_join_event',{p_event:b.dataset.joinEvent62}));await bindEvents62(kind)},box));
  box.querySelectorAll('[data-cancel-event62]').forEach(b=>b.onclick=()=>buttonAction(b,async()=>{await checked(sb.rpc('ps_cancel_event_participation',{p_event:b.dataset.cancelEvent62}));await bindEvents62(kind)},box));
  if(isStaffWorkspace())bindEventStaffButtons62(kind,d.rows,box);
  if(requestedEvent62){const el=$('event62-'+requestedEvent62);if(el){setTimeout(()=>el.scrollIntoView({behavior:'smooth',block:'start'}),80);requestedEvent62=null}}
 }catch(e){box.innerHTML='<section class="card"><p>Не удалось загрузить афиши.</p><button class="btn ghost" id="eventsRetry62">Повторить</button></section>';$('eventsRetry62').onclick=()=>bindEvents62(kind)}
}
