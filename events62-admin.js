/* Release 62: staff editor, participants and discount assignment. */
function event62Editor(kind){
 const training=kind==='training';
 return'<section class="card event-editor62"><div class="row"><div><div class="eyebrow">Конструктор афиши</div><h2>'+(training?'Обучение':'Мероприятие')+'</h2></div><button class="btn ghost" id="newEvent62">+ Новая афиша</button></div><form id="eventForm62"><input type="hidden" name="id"><input type="hidden" name="poster_path"><input type="hidden" name="media_json" value="[]"><input type="hidden" name="removed_media_json" value="[]"><label>Название<input name="title" maxlength="140" required></label><label>Главная афиша <small>необязательно</small><input name="poster" type="file" accept="image/jpeg,image/png,image/webp"></label><label>Фото / видео / трейлеры <small>можно выбрать сразу несколько файлов</small><input name="media" type="file" multiple data-no-image-editor="1" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"></label><div id="eventMediaEditor67"></div><label>Описание<textarea name="description" rows="3" maxlength="1200"></textarea></label><div class="two-col"><label>Дата<input name="event_date" type="date"></label><label>Время<input name="event_time" type="time"></label></div><label class="inline-check"><input name="is_permanent" type="checkbox"> Постоянное / регулярное</label><label>Расписание<input name="schedule_text" maxlength="160" placeholder="Например: каждый понедельник в 20:00"></label><label>Место<input name="venue" maxlength="200"></label><label>Онлайн-ссылка<input name="online_url" type="url" placeholder="https://..."></label><label>Стоимость<select name="price_mode"><option value="free">Бесплатно</option><option value="fixed">Одна цена</option>'+(training?'<option value="tiered">Цена по скидкам</option>':'')+'</select></label><label data-fixed-price62>Цена входа, ₽<input name="fixed_price" type="number" min="0" step="1"></label>'+(training?'<div data-tier-prices62><b>Цена по скидкам</b><div class="five-col62">'+[15,25,35,42,50].map(d=>'<label>'+d+'%<input name="price_'+d+'" type="number" min="0" step="1"></label>').join('')+'</div></div><label>Минимальная скидка<select name="min_discount"><option value="">Без ограничения</option>'+[15,25,35,42,50].map(d=>'<option value="'+d+'">от '+d+'%</option>').join('')+'</select></label><label>Статусы для доступа <small>через запятую; пусто — любые</small><input name="allowed_statuses" maxlength="300" placeholder="Например: Supervisor, World Team"></label><label>Спикеры <small>Имя | тема, по одному на строку</small><textarea name="speakers" rows="4"></textarea></label>':'')+'<label>⭐ За фактический приход<input name="attendance_stars" type="number" min="0" max="50" value="0"></label><button class="btn primary" type="submit">Сохранить афишу</button><button class="btn ghost" type="button" id="clearEventForm62">Очистить</button><p role="status"></p></form></section>'
}
function event62ParseSpeakers(v){return String(v||'').split('\n').map(x=>x.trim()).filter(Boolean).map(x=>{const p=x.split(/\s*[|—]\s*/,2);return{name:(p[0]||'').trim(),topic:(p[1]||'').trim()}}).filter(x=>x.name)}
function event62SpeakersText(v){return(Array.isArray(v)?v:[]).map(s=>s.name+(s.topic?' | '+s.topic:'')).join('\n')}
function event62PriceMode(){const f=$('eventForm62');if(!f)return;const m=f.elements.price_mode.value;f.querySelector('[data-fixed-price62]')?.classList.toggle('hidden',m==='free'||m==='tiered');f.querySelector('[data-tier-prices62]')?.classList.toggle('hidden',m!=='tiered')}
function event62ClearForm(){const f=$('eventForm62');if(!f)return;f.reset();f.elements.id.value='';f.elements.poster_path.value='';f.elements.media_json.value='[]';f.elements.removed_media_json.value='[]';f.elements.attendance_stars.value='0';event62RenderMediaEditor67();event62PriceMode()}
function event62FillForm(e){
 const f=$('eventForm62');if(!f||!e)return;for(const k of ['id','title','description','event_date','venue','online_url','schedule_text','poster_path'])if(f.elements[k])f.elements[k].value=e[k]||'';
 f.elements.event_time.value=(e.event_time||'').slice(0,5);f.elements.is_permanent.checked=!!e.is_permanent;f.elements.price_mode.value=e.price_mode||'free';f.elements.fixed_price.value=e.fixed_price??'';f.elements.attendance_stars.value=e.attendance_stars||0;
 if(f.elements.min_discount)f.elements.min_discount.value=e.min_discount||'';if(f.elements.allowed_statuses)f.elements.allowed_statuses.value=(Array.isArray(e.allowed_statuses)?e.allowed_statuses:[]).join(', ');if(f.elements.speakers)f.elements.speakers.value=event62SpeakersText(e.speakers);
 for(const d of[15,25,35,42,50])if(f.elements['price_'+d])f.elements['price_'+d].value=e.price_by_discount?.[String(d)]??'';
 f.elements.media_json.value=JSON.stringify(Array.isArray(e.media)?e.media:[]);f.elements.removed_media_json.value='[]';event62RenderMediaEditor67();
 event62PriceMode();f.scrollIntoView({behavior:'smooth',block:'start'})
}
async function event62Upload(file,id){if(!file)return null;const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg',path=me.id+'/'+id+'-'+Date.now()+'.'+ext,r=await sb.storage.from('ps-event-posters').upload(path,file,{contentType:file.type,cacheControl:'3600'});if(r.error)throw r.error;return path}
function event67MediaExt(file){
 if(file.type==='image/png')return'png';if(file.type==='image/webp')return'webp';if(file.type==='image/jpeg')return'jpg';
 if(file.type==='video/webm')return'webm';if(file.type==='video/quicktime')return'mov';return'mp4'
}
function event67MediaKind(file){return file.type.startsWith('video/')?'video':'image'}
async function event67UploadMedia(files,id){
 const allowed=new Set(['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/webm']),out=[];
 for(const file of files){
  if(!allowed.has(file.type))throw Error('Поддерживаются JPG, PNG, WEBP, MP4, MOV и WEBM.');
  if(file.size>50*1024*1024)throw Error('Один файл должен быть не больше 50 МБ.');
  const type=event67MediaKind(file),path=me.id+'/'+id+'/media-'+Date.now()+'-'+crypto.randomUUID()+'.'+event67MediaExt(file);
  const r=await sb.storage.from('ps-event-media').upload(path,file,{contentType:file.type,cacheControl:'3600'});if(r.error)throw r.error;
  out.push({type,path,name:file.name||'',mime:file.type})
 }
 return out
}
function event62RenderMediaEditor67(){
 const f=$('eventForm62'),box=$('eventMediaEditor67');if(!f||!box)return;
 let media=[];try{media=JSON.parse(f.elements.media_json.value||'[]')}catch{}
 box.innerHTML=media.length?'<div class="event-media-editor67"><b>Уже добавлено · '+media.length+'</b>'+media.map((m,i)=>{const url=event67MediaUrl(m);return'<div class="event-media-edit-item67">'+(m.type==='video'?'<video src="'+escapeHtml(url)+'" muted playsinline preload="metadata"></video>':'<img src="'+escapeHtml(url)+'" alt="">')+'<span>'+(m.type==='video'?'🎬 Видео':'🖼 Фото')+(m.name?' · '+escapeHtml(m.name):'')+'</span><button type="button" class="btn ghost" data-remove-media67="'+i+'">Убрать</button></div>'}).join('')+'</div>':'<p class="muted">Можно загрузить одну афишу или несколько фото и видео-трейлеров.</p>';
 box.querySelectorAll('[data-remove-media67]').forEach(b=>b.onclick=()=>{let cur=[];try{cur=JSON.parse(f.elements.media_json.value||'[]')}catch{};const idx=Number(b.dataset.removeMedia67),removed=cur.splice(idx,1)[0];let gone=[];try{gone=JSON.parse(f.elements.removed_media_json.value||'[]')}catch{};if(removed?.path)gone.push(removed.path);f.elements.media_json.value=JSON.stringify(cur);f.elements.removed_media_json.value=JSON.stringify(gone);event62RenderMediaEditor67()})
}
async function event62Save(ev,kind){
 ev.preventDefault();const f=ev.target,status=f.querySelector('[role=status]');
 buttonAction(f.querySelector('button[type=submit]'),async()=>{
  const id=f.elements.id.value||crypto.randomUUID(),oldPoster=f.elements.poster_path.value||null,file=f.elements.poster.files?.[0],poster=file?await event62Upload(file,id):oldPoster;
  let existingMedia=[];try{existingMedia=JSON.parse(f.elements.media_json.value||'[]')}catch{}
  const selected=[...(f.elements.media.files||[])];if(existingMedia.length+selected.length>20)throw Error('Можно добавить не больше 20 фото и видео в одну афишу.');
  let uploaded=[];
  try{uploaded=selected.length?await event67UploadMedia(selected,id):[]}catch(e){if(uploaded.length)await sb.storage.from('ps-event-media').remove(uploaded.map(x=>x.path)).catch(()=>{});throw e}
  const media=[...existingMedia,...uploaded];
  let online=null;if(f.elements.online_url.value.trim()){const u=new URL(f.elements.online_url.value.trim());if(u.protocol!=='https:')throw Error('Ссылка должна начинаться с https://');online=u.href}
  const prices={};for(const d of[15,25,35,42,50]){const x=f.elements['price_'+d];if(x&&x.value!=='')prices[String(d)]=Number(x.value)}
  const payload={id,kind,title:f.elements.title.value.trim(),description:f.elements.description.value.trim(),event_date:f.elements.event_date.value||null,event_time:f.elements.event_time.value||null,venue:f.elements.venue.value.trim()||null,online_url:online,is_permanent:f.elements.is_permanent.checked,schedule_text:f.elements.schedule_text.value.trim()||null,poster_path:poster,price_mode:f.elements.price_mode.value,fixed_price:f.elements.fixed_price.value===''?null:Number(f.elements.fixed_price.value),price_by_discount:prices,min_discount:f.elements.min_discount?.value?Number(f.elements.min_discount.value):null,allowed_statuses:f.elements.allowed_statuses?f.elements.allowed_statuses.value.split(',').map(x=>x.trim()).filter(Boolean):[],attendance_stars:Number(f.elements.attendance_stars.value||0),speakers:f.elements.speakers?event62ParseSpeakers(f.elements.speakers.value):[],media,active:true,updated_at:new Date().toISOString()};
  const existing=!!f.elements.id.value,r=await(existing?sb.from('ps_events').update(payload).eq('id',id):sb.from('ps_events').insert({...payload,created_by:me.id}));if(r.error){if(uploaded.length)await sb.storage.from('ps-event-media').remove(uploaded.map(x=>x.path)).catch(()=>{});throw r.error}
  if(file&&oldPoster&&oldPoster!==poster)await sb.storage.from('ps-event-posters').remove([oldPoster]).catch(()=>{});
  let removed=[];try{removed=JSON.parse(f.elements.removed_media_json.value||'[]')}catch{};if(removed.length)await sb.storage.from('ps-event-media').remove(removed).catch(()=>{});
  status.textContent='Афиша сохранена ✓';event62ClearForm();await bindEvents62(kind)
 },status)
}
function bindEventEditor62(kind){const f=$('eventForm62');if(!f)return;f.onsubmit=e=>event62Save(e,kind);f.elements.price_mode.onchange=event62PriceMode;$('clearEventForm62').onclick=event62ClearForm;$('newEvent62').onclick=event62ClearForm;event62RenderMediaEditor67();event62PriceMode()}
function bindEventStaffButtons62(kind,rows,box){
 bindEventEditor62(kind);
 box.querySelectorAll('[data-edit-event62]').forEach(b=>b.onclick=()=>event62FillForm(rows.find(x=>x.id===b.dataset.editEvent62)));
 box.querySelectorAll('[data-publish-event62]').forEach(b=>b.onclick=()=>buttonAction(b,async()=>{await checked(sb.rpc('ps_publish_event',{p_event:b.dataset.publishEvent62}));await bindEvents62(kind)},box));
 box.querySelectorAll('[data-participants-event62]').forEach(b=>b.onclick=()=>loadEventParticipants62(b.dataset.participantsEvent62));
 box.querySelectorAll('[data-archive-event62]').forEach(b=>b.onclick=()=>buttonAction(b,async()=>{const r=await sb.from('ps_events').update({active:false,updated_at:new Date().toISOString()}).eq('id',b.dataset.archiveEvent62);if(r.error)throw r.error;await bindEvents62(kind)},box))
}
async function loadEventParticipants62(eventId){
 const h=document.querySelector('[data-participant-box62="'+eventId+'"]');if(!h)return;h.classList.remove('hidden');h.innerHTML='<p>Загружаем…</p>';
 try{
  const parts=await checked(sb.from('ps_event_participations').select('*').eq('event_id',eventId).order('created_at')),ids=[...new Set(parts.map(x=>x.user_id))],people=ids.length?await checked(sb.from('ps_profiles').select('id,full_name,phone,discount_level,member_status').in('id',ids)):[],by=new Map(people.map(x=>[x.id,x]));
  h.innerHTML='<h3>Участники · '+parts.filter(x=>x.status!=='cancelled').length+'</h3>'+(parts.length?parts.map(p=>{const u=by.get(p.user_id)||{};return'<div class="participant-row62 '+(p.status==='cancelled'?'cancelled':'')+'"><div><b>'+escapeHtml(u.full_name||'Участник')+'</b><small>'+escapeHtml(u.phone||'')+(u.discount_level?' · '+u.discount_level+'%':'')+'</small><span>'+event62Money(p.price_snapshot)+' · '+(p.payment_status==='paid'?'оплачено':p.payment_status==='not_required'?'бесплатно':'ожидает оплаты')+(p.attended_at?' · пришёл ✅':'')+'</span></div><div class="participant-actions62">'+(p.status!=='cancelled'&&p.payment_status==='pending'?'<button class="btn ghost" data-pa62="paid" data-pid62="'+p.id+'">Оплата получена</button>':'')+(p.status!=='cancelled'&&!p.attended_at?'<button class="btn primary" data-pa62="attended" data-pid62="'+p.id+'">Пришёл ✅</button>':'')+(p.attended_at?'<button class="btn ghost" data-pa62="undo_attendance" data-pid62="'+p.id+'">Убрать отметку</button>':'')+(p.status!=='cancelled'?'<button class="btn ghost" data-pa62="cancel" data-pid62="'+p.id+'">Отменить</button>':'')+'</div></div>'}).join(''):'<p>Пока никто не записался.</p>');
  h.querySelectorAll('[data-pa62]').forEach(b=>b.onclick=()=>buttonAction(b,async()=>{await checked(sb.rpc('ps_manage_event_participation',{p_participation:b.dataset.pid62,p_action:b.dataset.pa62}));await loadEventParticipants62(eventId)},h))
 }catch{h.innerHTML='<p>Не удалось загрузить участников.</p>'}
}
async function ps62AppendDiscount(id){
 const d=$('adminClientDetail'),p=adminRows.find(x=>x.id===id);if(!d||!p||d.dataset.client!==id)return;d.querySelector('#clientDiscount62')?.remove();
 const s=document.createElement('section');s.className='card';s.id='clientDiscount62';s.innerHTML='<h3>Скидка / статус</h3><p>Скидку назначает консультант. Она определяет доступ и цену некоторых обучений.</p><form><label>Скидка<select name="discount">'+[15,25,35,42,50].map(x=>'<option value="'+x+'" '+(Number(p.discount_level)===x?'selected':'')+'>'+x+'%</option>').join('')+'</select></label><label>Статус<input name="status" maxlength="80" value="'+escapeHtml(p.member_status||'')+'"></label><button class="btn primary">Сохранить</button><p role="status"></p></form>';d.append(s);
 s.querySelector('form').onsubmit=e=>{e.preventDefault();const f=e.target;buttonAction(f.querySelector('button'),async()=>{const x=await checked(sb.rpc('ps_set_client_discount',{p_client:id,p_discount:Number(f.elements.discount.value),p_status:f.elements.status.value.trim()||null}));p.discount_level=x.discount_level;p.member_status=x.member_status;s.querySelector('[role=status]').textContent='Сохранено ✓'},s.querySelector('[role=status]'))}
}
if(typeof loadAdminClientDetail==='function'){const base62=loadAdminClientDetail;loadAdminClientDetail=async function(id,...rest){await base62(id,...rest);await ps62AppendDiscount(id)}}
