/* Wellness 101 · additive measurement history. Never clears earlier progress. */
(function(){
"use strict";
const originalPageProgress=pageProgress;
const originalBindProgress=bindProgressPhotoActions;
const originalLoadProgressPhotos=loadProgressPhotos;
const METRICS=[
 {key:"weight",group:"body",label:"Вес",unit:"кг",min:20,max:450},
 {key:"fat",group:"body",label:"Общий жир",unit:"%",min:0,max:80},
 {key:"water",group:"body",label:"Вода в организме",unit:"%",min:0,max:100},
 {key:"muscle",group:"body",label:"Мышечная масса",unit:"кг",min:0,max:200},
 {key:"physique",group:"body",label:"Физический тип (1–9)",unit:"",min:1,max:9,integer:true},
 {key:"bmr",group:"body",label:"Обмен веществ (ккал/сутки)",unit:"ккал",min:300,max:8000},
 {key:"metabolicAge",group:"body",label:"Метаболический возраст",unit:"лет",min:1,max:130,integer:true},
 {key:"bone",group:"body",label:"Костная масса",unit:"кг",min:0,max:10},
 {key:"visceral",group:"body",label:"Внутренний жир (рейтинг)",unit:"",min:0,max:60},
 {key:"neck",group:"tape",label:"Шея",unit:"см",min:10,max:100},
 {key:"chest",group:"tape",label:"Грудь",unit:"см",min:30,max:250},
 {key:"rightArm",group:"tape",label:"Правая рука",unit:"см",min:10,max:100},
 {key:"leftArm",group:"tape",label:"Левая рука",unit:"см",min:10,max:100},
 {key:"waist",group:"tape",label:"Талия",unit:"см",min:25,max:250},
 {key:"belly",group:"tape",label:"Живот",unit:"см",min:30,max:250},
 {key:"hips",group:"tape",label:"Бёдра",unit:"см",min:30,max:250},
 {key:"rightThigh",group:"tape",label:"Правое бедро",unit:"см",min:15,max:150},
 {key:"leftThigh",group:"tape",label:"Левое бедро",unit:"см",min:15,max:150}
];
const CHART_METRICS=["weight","fat","water","waist","muscle","visceral"];
// Optional non-clinical body-frame reference for adults 25+, distinct from Wellness scan norms.
/* Reference transcription: "Индивидуальные параметры тела Wellness-Test", slide 2.
Rows: height cm, small frame [min,max], medium, large. Ranges are historical
brochure references, not clinical goal weights. Exact rows remain unchanged. */
const FRAME_TABLE={
 female:[
 [147,[42,45],[44,49],[47,54]],[150,[43,46],[45,50],[48,56]],
 [152,[44,47],[46,51],[50,58]],[155,[45,49],[47,53],[51,59]],
 [157,[46,50],[49,54],[52,60]],[160,[48,51],[50,56],[54,61]],
 [162,[49,53],[51,57],[55,63]],[165,[51,54],[53,59],[57,65]],
 [168,[52,56],[55,61],[58,66]],[170,[54,58],[56,63],[60,68]],
 [173,[56,60],[58,65],[62,70]],[175,[57,61],[60,67],[64,72]],
 [178,[59,64],[62,69],[66,74]],[180,[61,66],[64,71],[67,76]],
 [183,[63,67],[66,72],[70,79]]
 ],
 male:[
 [157,[51,55],[54,59],[57,64]],[160,[52,56],[55,60],[59,66]],
 [162,[52,56],[56,62],[60,67]],[165,[55,59],[58,63],[61,69]],
 [168,[56,60],[59,65],[63,71]],[170,[58,62],[61,67],[65,73]],
 [173,[60,64],[63,69],[67,75]],[175,[62,66],[65,71],[69,77]],
 [178,[64,68],[66,73],[71,79]],[180,[66,70],[68,75],[72,81]],
 [183,[67,72],[70,77],[75,84]],[185,[69,74],[72,80],[76,86]],
 [188,[71,76],[74,82],[79,88]],[190,[73,78],[76,84],[88,91]],
 [193,[75,80],[78,86],[83,93]]
 ]
};
function frameEstimate(info){
 if(!info.frame||!info.sex||!(info.age>=18)||!Number.isFinite(info.height))return null;
 const rows=FRAME_TABLE[info.sex];if(!rows)return null;
 const h=info.height;
 if(h<rows[0][0]||h>rows.at(-1)[0])return null;
 let a=rows.find(row=>row[0]===h),b=a;
 if(!a)for(let i=0;i<rows.length-1;i++){if(h>rows[i][0]&&h<rows[i+1][0]){a=rows[i];b=rows[i+1];break}}
 if(!a||!b)return null;
 const col={small:1,medium:2,large:3}[info.frame];
 if(!col)return null;
 const ratio=(h-a[0])/Math.max(1,b[0]-a[0]);
 return {range:[a[col][0]+ratio*(b[col][0]-a[col][0]),a[col][1]+ratio*(b[col][1]-a[col][1])],interpolated:a!==b};
}
const WELLNESS_BROCHURE_URL="https://ppt-online.org/552105";
let wellnessNormsMode="brochure";
try{if(localStorage.getItem("ps_wellness_norms_source")==="form2025")wellnessNormsMode="form2025"}catch(e){}
const PHYSIQUE_TYPES=[
"Скрытое ожирение","Ожирение","Плотное телосложение","Нетренированный",
"Нормальный","Стандартно мускулистый","Худой",
"Худой и мускулистый","Очень мускулистый"
];
let wellnessRows101=[],legacyRows101=[];
const $w=id=>document.getElementById(id);
const safe=v=>String(v==null?"":v).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
function nValue(v){if(v===undefined||v===null||v==="")return null;const n=Number(v);return Number.isFinite(n)?n:null}
function format(v){return nValue(v)==null?"—":Number(v).toLocaleString("ru-RU",{maximumFractionDigits:2})}
function dateText(s){if(!s)return"—";return s.slice(8,10)+"."+s.slice(5,7)+"."+s.slice(0,4)}
function yearsFromBirthday(d,at){if(!d)return null;const y=Number(at.slice(0,4))-Number(d.slice(0,4));const birthday=at.slice(5,10)<d.slice(5,10)?1:0;return Number.isFinite(y)?y-birthday:null}
function metaDefaults(){
 const dob=assessment?.birth_date||profile?.birth_date||"";
 return {sex:"",age:yearsFromBirthday(dob,profileToday()),height:nValue(assessment?.height_cm??profile?.height_cm),frame:"",wrist:null};
}
function inputFor(m){
 return '<label class="w101-field">'+safe(m.label)+' <small>'+safe(m.unit)+'</small><input data-w101-key="'+m.key+'" inputmode="decimal" type="number" step="'+(m.integer?"1":"0.01")+'" min="'+m.min+'" max="'+m.max+'" placeholder="—"></label>';
}
function cardMarkup(){
 const opts='<option value="">Укажите</option><option value="female">Женщина</option><option value="male">Мужчина</option>';
 const frame='<option value="">Выберите</option><option value="small">Мелкое (хрупкое)</option><option value="medium">Среднее</option><option value="large">Крупное (ширококостное)</option>';
 return '<section class="card w101-card" id="wellness101">'+
 '<div class="eyebrow">Wellness-тест</div><h2>Полное сканирование и замеры</h2>'+
 '<p class="muted">Записывайте данные со своего анализатора и сантиметровой ленты. Можно заполнять только измеренные сегодня показатели. История сохраняется в вашем аккаунте.</p>'+
 '<div class="w101-current"><div id="w101Summary">Загружаем результаты…</div></div>'+
 '<details class="w101-details" open><summary>✍️ Записать Wellness-замер</summary>'+
 '<label class="w101-date">Дата измерения<input id="w101Date" type="date" max="'+profileToday()+'" value="'+profileToday()+'"></label>'+
 '<details class="w101-nested"><summary id="w101ProfileSummary">1. Мои данные · заполнить один раз</summary><div class="w101-input-grid">'+
 '<label class="w101-field">Пол<select id="w101Sex">'+opts+'</select></label>'+
 '<label class="w101-field">Возраст <small>лет</small><input id="w101Age" type="number" step="1" min="18" max="100" inputmode="numeric" placeholder="—"></label>'+
 '<label class="w101-field">Рост <small>см</small><input id="w101Height" type="number" step="0.01" min="100" max="250" inputmode="decimal" placeholder="—"></label>'+
 '<label class="w101-field">Телосложение<select id="w101Frame">'+frame+'</select></label>'+
 '<label class="w101-field">Запястье <small>см, необязательно</small><input id="w101Wrist" type="number" step="0.01" min="8" max="35" inputmode="decimal" placeholder="—"></label>'+
 '</div><p class="w101-note">Пол, возраст, рост и телосложение сохраняются после первого Wellness-замера. Откройте этот раздел, только если нужно изменить данные.</p><p class="w101-note" id="w101FrameInfo">Тип телосложения — характеристика комплекции, а не диагноз.</p><p class="w101-note" id="w101FrameWeight"></p></details>'+
 '<details class="w101-nested" open><summary>2. Полное сканирование состава тела</summary><div class="w101-input-grid">'+
 METRICS.filter(x=>x.group==="body").map(inputFor).join("")+'</div>'+
 '<p class="w101-note" id="w101Bmi">ИМТ рассчитывается автоматически по весу и росту.</p></details>'+
 '<details class="w101-nested"><summary>3. Все замеры сантиметровой лентой (9)</summary><div class="w101-input-grid">'+
 METRICS.filter(x=>x.group==="tape").map(inputFor).join("")+'</div></details>'+
 '<button type="button" class="btn primary w101-save" id="w101Save">Сохранить Wellness-замер</button><p id="w101Message" class="message" role="status" aria-live="polite"></p>'+
 '</details>'+
 '<details class="w101-details" open><summary>📊 Начало → сейчас: показатели и нормы</summary>'+
 '<label class="w101-source">Источник справочных таблиц<select id="w101RefMode"><option value="brochure">🍏 Wellness-Test · брошюра с яблоком</option><option value="form2025">Herbalife · бланк июня 2025</option></select></label>'+
 '<p class="w101-note">Начальный вес, талия, грудь и бёдра — из сохранённых стартовых данных. Остальные параметры — с первого Wellness-замера. Нормы справочные.</p>'+
 '<div class="w101-history-scroll"><table class="w101-compare"><thead><tr><th>Показатель</th><th>Старт</th><th>Сейчас</th><th>Изменение</th><th>Ориентир</th></tr></thead><tbody id="w101Compare"></tbody></table></div></details>'+
 '<details class="w101-details" open><summary>🍏 Wellness-Test: справочник и таблицы</summary>'+
 '<p class="w101-note">Нормы жира, воды, висцерального жира и костной массы, физические типы. <a href="https://ppt-online.org/552105" target="_blank" rel="noopener noreferrer">Открыть всю брошюру с яблоком ↗</a></p>'+
 '<div id="w101Guide"></div></details>'+
 '<details class="w101-details" open><summary>📈 График изменений</summary>'+
 '<label class="w101-chart-choice">Что показать<select id="w101ChartKey">'+CHART_METRICS.map(key=>{const m=METRICS.find(x=>x.key===key);return '<option value="'+key+'">'+safe(m.label)+'</option>'}).join("")+'</select></label>'+
 '<div id="w101Chart" class="w101-chart">Добавьте хотя бы два замера для графика.</div></details>'+
 '<details class="w101-details"><summary>📅 История замеров по датам</summary><div class="w101-history-scroll"><table class="w101-history"><thead><tr><th>Дата</th><th>Вес</th><th>Жир</th><th>Вода</th><th>Талия</th><th>Бёдра</th></tr></thead><tbody id="w101History"></tbody></table></div>'+
 '<p class="w101-note">Выберите дату выше, чтобы открыть и дополнить ранее записанные показатели. Старые данные веса и талии учитываются автоматически.</p></details>'+
 '<p class="w101-disclaimer">Таблица веса по телосложению: <a href="https://ppt-online.org/552105" target="_blank" rel="noopener noreferrer">Wellness-Test, слайд 2</a>. Старые материалы и бланк 2025 года содержат разные диапазоны: выберите нужный источник. Нормы зависят от возраста, пола, прибора и метода измерения. «Костная масса» в весах — расчётный показатель, а не анализ кальция или исследование плотности костей. При вопросах о здоровье обратитесь к врачу.</p>'+
 '</section>';
}
pageProgress=function(){
 const source=originalPageProgress();
 const target='  <section class="card">\n    <div class="row">\n      <div>\n        <div class="eyebrow">Фото прогресса</div>';
 if(!source.includes(target))return source+cardMarkup();
 return source.replace(target,cardMarkup()+'\n'+target)
 .replace('<div class="photo-frame" id="beforePhotoFrame"><span>Фото ДО</span></div>',
 '<div class="photo-frame" id="beforePhotoFrame"><span>Фото ДО</span></div><button class="w101-photo-x hidden" id="w101DeleteBefore" type="button" aria-label="Удалить фото ДО" title="Удалить фото ДО">✕</button>')
 .replace('<div class="photo-frame" id="afterPhotoFrame"><span>Фото ПОСЛЕ</span></div>',
 '<div class="photo-frame" id="afterPhotoFrame"><span>Фото ПОСЛЕ</span></div><button class="w101-photo-x hidden" id="w101DeleteAfter" type="button" aria-label="Удалить фото ПОСЛЕ" title="Удалить фото ПОСЛЕ">✕</button>');
};
pages.progress=pageProgress;
bindProgressPhotoActions=async function(){
 await originalBindProgress();
 if($w("wellness101"))await bindWellness101();
 $w("w101DeleteBefore")?.addEventListener("click",()=>removeProgressPhoto101("before"));
 $w("w101DeleteAfter")?.addEventListener("click",()=>removeProgressPhoto101("after"));
};
loadProgressPhotos=async function(){
 await originalLoadProgressPhotos();
 await refreshPhotoDeleteButtons101();
};
async function refreshPhotoDeleteButtons101(){
 const a=await sb.from("ps_progress_photos").select("kind").eq("user_id",me.id);
 if(a.error)return;
 const kinds=new Set((a.data||[]).map(x=>x.kind));
 $w("w101DeleteBefore")?.classList.toggle("hidden",!kinds.has("before"));
 $w("w101DeleteAfter")?.classList.toggle("hidden",!kinds.has("after"));
}
async function removeProgressPhoto101(kind){
 if(!window.confirm("Удалить фото "+(kind==="before"?"ДО":"ПОСЛЕ")+"? Восстановить удалённое фото нельзя."))return;
 const msg=$w("photoMessage"),btn=$w(kind==="before"?"w101DeleteBefore":"w101DeleteAfter");
 if(btn)btn.disabled=true;
 try{
  const existing=await sb.from("ps_progress_photos").select("storage_path").eq("user_id",me.id).eq("kind",kind).maybeSingle();
  if(existing.error)throw existing.error;
  const removed=await sb.from("ps_progress_photos").delete().eq("user_id",me.id).eq("kind",kind);
  if(removed.error)throw removed.error;
  if(existing.data?.storage_path){
   const storage=await sb.storage.from("ps-progress-photos").remove([existing.data.storage_path]);
   if(storage.error)console.warn("Old photo storage cleanup:",storage.error.message);
  }
  const isBefore=kind==="before";
  const frame=$w(isBefore?"beforePhotoFrame":"afterPhotoFrame");
  if(frame)frame.innerHTML="<span>Фото "+(isBefore?"ДО":"ПОСЛЕ")+"</span>";
  const edit=$w(isBefore?"beforePhotoBtn":"afterPhotoBtn");
  if(edit)edit.textContent="Добавить фото "+(isBefore?"ДО":"ПОСЛЕ");
  if(msg)msg.textContent="Фото "+(isBefore?"ДО":"ПОСЛЕ")+" удалено ✓";
  await refreshPhotoDeleteButtons101();
 }catch(e){if(msg)msg.textContent="Не удалось удалить фото: "+(e.message||"ошибка")}
 finally{if(btn)btn.disabled=false}
}
function mergeRows(){
 const map=new Map();
 const put=(d)=>{if(!map.has(d))map.set(d,{entry_date:d,body:{},tape:{},profile:{}});return map.get(d)};
 for(const r of legacyRows101){
  const row=put(r.entry_date);
  if(nValue(r.weight_kg)!=null)row.body.weight=nValue(r.weight_kg);
  if(nValue(r.waist_cm)!=null)row.tape.waist=nValue(r.waist_cm);
  if(nValue(r.chest_cm)!=null)row.tape.chest=nValue(r.chest_cm);
  if(nValue(r.hips_cm)!=null)row.tape.hips=nValue(r.hips_cm);
 }
 for(const w of wellnessRows101){
  const row=put(w.entry_date);
  Object.assign(row.body,w.body||{});
  Object.assign(row.tape,w.tape||{});
  Object.assign(row.profile,w.profile||{});
 }
 return Array.from(map.values()).sort((a,b)=>a.entry_date.localeCompare(b.entry_date));
}
function readInfo(){
 return {sex:$w("w101Sex")?.value||"",age:nValue($w("w101Age")?.value),height:nValue($w("w101Height")?.value),frame:$w("w101Frame")?.value||"",wrist:nValue($w("w101Wrist")?.value)};
}
function setInfo(d){
 const m=d||{};
 if($w("w101Sex"))$w("w101Sex").value=m.sex||"";
 if($w("w101Age"))$w("w101Age").value=m.age??"";
 if($w("w101Height"))$w("w101Height").value=m.height??"";
 if($w("w101Frame"))$w("w101Frame").value=m.frame||"";
 if($w("w101Wrist"))$w("w101Wrist").value=m.wrist??"";
 updateInfo();
}
function latestMeta(){
 // The latest nonempty value of each field is used for every measurement date.
 // Empty fields in old entries must not clear a previously saved personal profile.
 const result=metaDefaults();
 for(const row of [...wellnessRows101].sort((a,b)=>a.entry_date.localeCompare(b.entry_date))){
  const data=row.profile||{};
  for(const key of ["sex","age","height","frame","wrist"]){
   const value=data[key];
   if(value!==null&&value!==undefined&&value!=="")result[key]=value;
  }
 }
 return result;
}
function fillDate(){
 const d=$w("w101Date")?.value;
 if(!d)return;
 const r=mergeRows().find(x=>x.entry_date===d);
 setInfo(latestMeta());
 for(const m of METRICS){
  const input=$w("wellness101")?.querySelector('[data-w101-key="'+m.key+'"]');
  if(input)input.value=(r?.[m.group]?.[m.key]??"");
 }
 updateInfo();
}
function updateInfo(){
 const m=readInfo(),weight=nValue($w("wellness101")?.querySelector('[data-w101-key="weight"]')?.value);
 const parts=[m.sex==="female"?"женщина":m.sex==="male"?"мужчина":null,m.age!=null?m.age+" лет":null,m.height!=null?format(m.height)+" см":null,m.frame?({small:"мелкое",medium:"среднее",large:"крупное"}[m.frame]):null].filter(Boolean);
 const heading=$w("w101ProfileSummary");
 if(heading)heading.textContent=parts.length===4?"1. Мои данные · "+parts.join(" · ")+" (изменить)":"1. Мои данные · заполнить один раз";
 if($w("w101Bmi"))$w("w101Bmi").textContent=weight&&m.height?"ИМТ по росту и весу: "+format(weight/Math.pow(m.height/100,2))+". Ориентир для взрослых: 18,5–24,9.":"ИМТ рассчитывается по введённым весу и росту. Для взрослых ориентир: 18,5–24,9.";
 const names={small:"мелкое",medium:"среднее",large:"крупное"};
 let wristHint="";
 if(m.wrist&&m.sex){
  const threshold=m.sex==="female"?[14.5,16.5]:[16,18];
  const cls=m.wrist<threshold[0]?"мелкое":m.wrist<=threshold[1]?"среднее":"крупное";
  wristHint=" По окружности запястья ориентировочно: "+cls+".";
 }
 if($w("w101FrameInfo"))$w("w101FrameInfo").textContent=(m.frame?"Выбранное телосложение: "+names[m.frame]+". ":"")+
 "Размер костного каркаса не определяет точный «идеальный вес»."+wristHint;
 const ref=frameEstimate(m);
 if($w("w101FrameWeight"))$w("w101FrameWeight").textContent=ref
 ? "Таблица Wellness-Test (слайд 2): "+format(ref.range[0])+"–"+format(ref.range[1])+" кг"+(ref.interpolated?" · приблизительно между строками таблицы":"")+". Это справочный, НЕ медицинский диапазон, а не обязательная цель."
 : "Укажите пол, рост и телосложение — покажем диапазон по таблице Wellness-Test. Он не заменяет медицинскую оценку.";
}
/* Select archived Wellness-Test (apple cover) or June 2025 Herbalife scan form. */
function fatReference(age,sex){
 if(!(age>=18)||!["female","male"].includes(sex))return null;
 const i=age<30?0:age<40?1:age<50?2:age<60?3:4;
 if(wellnessNormsMode==="form2025")return (sex==="female"?[[20,28],[21,29],[22,30],[23,31],[24,32]]:[[14,20],[15,21],[17,23],[18,24],[19,25]])[i];
 return (sex==="female"?[[20,28],[22,30],[24,32],[26,34],[28,36]]:[[8,18],[11,20],[13,22],[15,24],[17,26]])[i];
}
function rangeText(low,high,value,unit){
 const v=nValue(value);
 return format(low)+"–"+format(high)+(unit||"")+(v==null?"":v<low?" · ниже":v>high?" · выше":" · в диапазоне");
}
function boneValue(sex,w){
 if(!sex||!(w>0))return null;
 if(wellnessNormsMode==="form2025")return sex==="female"?(w<50?1.95:w<=75?2.4:2.95):(w<65?2.66:w<=95?3.29:3.69);
 return sex==="female"?(w<50?1.95:w<=75?2.4:w<=90?3.1:3.3):(w<65?2.66:w<=95?3.29:w<=110?4.0:4.3);
}
function reference(m,current,info){
 const v=nValue(current),sex=info.sex,age=info.age,w=nValue(info.weight);
 if(m.key==="fat"){const r=fatReference(age,sex);return r?rangeText(r[0],r[1],v,"%"):"Укажите пол и возраст";}
 if(m.key==="water"){
  if(!sex)return "Укажите пол";
  const interval=wellnessNormsMode==="form2025"?(sex==="female"?[50,60]:[60,70]):(sex==="female"?[45,60]:[50,65]);
  return rangeText(interval[0],interval[1],v,"%");
 }
 if(m.key==="visceral"){
  if(v==null)return "1–4 · уровни 1–2 и 3–4";
  return v<=2?"1–2 · низкий":v<=4?"3–4 · обычный":v<=6?"5–6 · средний":v<=9?"7–9 · высокий":"10+ · высокий";
 }
 if(m.key==="bone"){
  const b=boneValue(sex,w);
  return b==null?"Нужны пол и вес":"≈ "+format(b)+" кг, ориентир для группы веса";
 }
 if(m.key==="weight"){
  const frame=frameEstimate(info);
  return frame?"По телосложению: "+format(frame.range[0])+"–"+format(frame.range[1])+" кг":"Укажите рост, пол и телосложение";
 }
 if(m.key==="physique")return v!=null&&Number.isInteger(v)&&v>=1&&v<=9?"Тип "+v+": "+PHYSIQUE_TYPES[v-1]:"Тип анализатора от 1 до 9";
 if(m.key==="muscle")return "Сравнивайте динамику на одном приборе";
 if(m.key==="bmr")return "Индивидуальная оценка прибора";
 if(m.key==="metabolicAge")return "Расчётный показатель прибора";
 return "Изменение относительно старта";
}
function getReferenceInfo(rows){
 const meta={...metaDefaults(),...latestMeta()};
 const latestWeight=[...rows].reverse().find(r=>nValue(r.body.weight)!=null)?.body.weight;
 return {...meta,weight:latestWeight??assessment?.starting_weight_kg??null};
}
function renderWellnessGuide(){
 const box=$w("w101Guide");if(!box)return;
 const stored=latestMeta(),input=readInfo();
 const sex=input.sex||stored.sex||"";
 const age=input.age??stored.age??null;
 const fat=fatReference(age,sex);
 const water=!sex?null:wellnessNormsMode==="form2025"?(sex==="female"?[50,60]:[60,70]):(sex==="female"?[45,60]:[50,65]);
 const currentWeight=nValue($w("wellness101")?.querySelector('[data-w101-key="weight"]')?.value)??getReferenceInfo(mergeRows()).weight;
 const bone=boneValue(sex,currentWeight);
 const cell=(title,value,info)=>'<div class="w101-guide-item"><b>'+safe(title)+'</b><strong>'+safe(value)+'</strong><small>'+safe(info)+'</small></div>';
 box.innerHTML='<p class="w101-note">'+(wellnessNormsMode==="brochure"?'Брошюра Wellness-Test: слайды 2–11':'Бланк Herbalife, июнь 2025')+'. Справочные значения для анализатора, не диагноз.</p>'+
 '<div class="w101-guide-grid">'+
 cell("Жир",fat?format(fat[0])+"–"+format(fat[1])+" %":"Укажите пол и возраст","Возрастная группа по выбранному источнику")+
 cell("Вода",water?format(water[0])+"–"+format(water[1])+" %":"Укажите пол","Доля воды в организме по измерителю")+
 cell("Внутренний жир","1–4","Шкала из брошюры; уровень 5+ выше")+
 cell("Костная масса",bone!=null?format(bone)+" кг":"Укажите пол и вес","Расчётное значение по группе веса")+'</div>'+
 '<details class="w101-nested"><summary>Физический тип 1–9 — пояснения</summary>'+
 '<div class="w101-type-list">'+PHYSIQUE_TYPES.map((name,i)=>'<div><b>'+(i+1)+'.</b> '+safe(name)+'</div>').join("")+'</div>'+
 '<p class="w101-note">Названия — из брошюры. Они описывают тип по анализатору, а не состояние здоровья.</p></details>'+
 '<p class="w101-note">У мышечной массы, скорости основного обмена и метаболического возраста нет единого универсального «правильного» числа для всех. Важно сравнивать данные одного прибора со временем.</p>';
}
// Baselines of measurements entered during onboarding come from the official
// starting values, NOT from the first chronological weigh-in in the history.
// Historical measurements are kept unchanged.
function startValue101(metric,firstRecorded){
 const official={
  weight:assessment?.starting_weight_kg,
  waist:assessment?.waist_cm,
  chest:assessment?.chest_cm,
  hips:assessment?.hips_cm
 };
 if(Object.prototype.hasOwnProperty.call(official,metric.key)){
  const v=nValue(official[metric.key]);
  if(v!=null)return v;
 }
 return firstRecorded;
}
function isOfficialStart101(metric){
 const keys={weight:"starting_weight_kg",waist:"waist_cm",chest:"chest_cm",hips:"hips_cm"};
 return keys[metric.key]&&nValue(assessment?.[keys[metric.key]])!=null;
}
function renderSummary(rows){
 const box=$w("w101Summary");if(!box)return;
 const metrics=METRICS.filter(m=>m.key==="weight"||m.key==="fat"||m.key==="water"||m.key==="waist");
 const cards=metrics.map(m=>{
  const r=[...rows].reverse().find(x=>nValue(x[m.group][m.key])!=null);
  const first=rows.find(x=>nValue(x[m.group][m.key])!=null);
  const now=r?.[m.group][m.key]??null,start=startValue101(m,first?.[m.group][m.key]??null);
  const delta=now!=null&&start!=null?Number((now-start).toFixed(2)):null;
  const label=isOfficialStart101(m)?" от старта":" от первого замера";
  return '<div><span>'+safe(m.label)+'</span><b>'+format(now)+' '+m.unit+'</b><small>'+(delta==null?"Нет изменений":(delta>0?"+":"")+format(delta)+" "+m.unit+label)+'</small></div>';
 }).join("");
 box.innerHTML='<div class="w101-stats">'+cards+'</div>';
}
function renderCompare(rows){
 const tbody=$w("w101Compare");if(!tbody)return;
 const info=getReferenceInfo(rows);
 const all=METRICS.map(m=>{
  const present=rows.filter(r=>nValue(r[m.group][m.key])!=null);
  const first=startValue101(m,present[0]?.[m.group][m.key]??null);
  const last=present.at(-1)?.[m.group][m.key]??null;
  const diff=first!=null&&last!=null?Number((last-first).toFixed(2)):null;
  return '<tr><th>'+safe(m.label)+'</th><td>'+format(first)+'</td><td><b>'+format(last)+'</b></td><td>'+ (diff==null?"—":(diff>0?"+":"")+format(diff))+'</td><td>'+safe(reference(m,last,info))+'</td></tr>';
 }).join("");
 const wRows=rows.filter(r=>nValue(r.body.weight)!=null);
 const wLast=wRows.at(-1)?.body.weight;
 const bmi=info.height&&wLast?format(wLast/Math.pow(info.height/100,2)):"—";
 tbody.innerHTML=all+'<tr><th>Индекс массы тела (расчёт)</th><td>—</td><td><b>'+bmi+'</b></td><td>—</td><td>18,5–24,9 · для взрослых</td></tr>';
}
function renderHistory(rows){
 const b=$w("w101History");if(!b)return;
 if(!rows.length){b.innerHTML='<tr><td colspan="6">Пока нет сохранённых замеров.</td></tr>';return}
 b.innerHTML=[...rows].reverse().slice(0,50).map(r=>
  '<tr><td><button type="button" class="w101-pick" data-date="'+safe(r.entry_date)+'">'+dateText(r.entry_date)+'</button></td>'+
  '<td>'+format(r.body.weight)+'</td><td>'+format(r.body.fat)+'</td><td>'+format(r.body.water)+'</td><td>'+format(r.tape.waist)+'</td><td>'+format(r.tape.hips)+'</td></tr>'
 ).join("");
 b.querySelectorAll("[data-date]").forEach(button=>button.onclick=()=>{
  $w("w101Date").value=button.dataset.date;fillDate();$w("w101Date").scrollIntoView({behavior:"smooth",block:"center"});
 });
}
function renderChart(rows){
 const target=$w("w101Chart");if(!target)return;
 const key=$w("w101ChartKey")?.value||"weight";
 const m=METRICS.find(x=>x.key===key);
 const points=rows.map(r=>({date:r.entry_date,v:nValue(r[m.group][key])})).filter(x=>x.v!=null);
 if(points.length<2){target.innerHTML='<p class="muted">Для графика «'+safe(m.label)+'» нужны хотя бы два замера с разными датами.</p>';return}
 const values=points.map(x=>x.v),min=Math.min(...values),max=Math.max(...values);
 const span=Math.max(max-min,0.1),lo=min-span*.16,hi=max+span*.16,dx=points.length-1;
 const x=i=>45+270*i/dx,y=v=>128-96*(v-lo)/(hi-lo);
 const path=points.map((p,i)=>(i?"L":"M")+x(i).toFixed(1)+","+y(p.v).toFixed(1)).join(" ");
 const circles=points.map((p,i)=>'<circle cx="'+x(i).toFixed(1)+'" cy="'+y(p.v).toFixed(1)+'" r="4" fill="#b665aa"><title>'+dateText(p.date)+': '+format(p.v)+' '+m.unit+'</title></circle>').join("");
 target.innerHTML='<svg class="w101-linechart" viewBox="0 0 360 175" role="img" aria-label="'+safe(m.label)+': '+format(values[0])+' → '+format(values.at(-1))+' '+m.unit+'">'+
 '<line x1="45" y1="128" x2="315" y2="128" stroke="currentColor" opacity=".18"/>'+
 '<path fill="none" stroke="#b665aa" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round" d="'+path+'"/>'+circles+
 '<text x="8" y="25" font-size="12" fill="currentColor">'+format(max)+' '+m.unit+'</text>'+
 '<text x="8" y="145" font-size="12" fill="currentColor">'+format(min)+'</text>'+
 '<text x="45" y="164" font-size="11" fill="currentColor">'+dateText(points[0].date)+'</text>'+
 '<text x="315" y="164" font-size="11" text-anchor="end" fill="currentColor">'+dateText(points.at(-1).date)+'</text></svg>';
}
function paintWellness101(){
 const rows=mergeRows();
 renderSummary(rows);renderCompare(rows);renderWellnessGuide();renderHistory(rows);renderChart(rows);
}
async function refreshWellness101(){
 const [a,b]=await Promise.all([
  sb.from("ps_wellness_measurements").select("entry_date,body,tape,profile").eq("user_id",me.id).order("entry_date"),
  sb.from("ps_progress_entries").select("entry_date,weight_kg,waist_cm,chest_cm,hips_cm").eq("user_id",me.id).order("entry_date")
 ]);
 if(a.error)throw a.error;if(b.error)throw b.error;
 wellnessRows101=a.data||[];legacyRows101=b.data||[];
 paintWellness101();fillDate();
}
function readInput(el,m){
 if(!el||!String(el.value).trim())return null;
 const raw=String(el.value).trim().replace(",",".");
 if(!/^\d+(?:\.\d{1,2})?$/.test(raw))throw new Error("В поле «"+m.label+"» допускается не более двух знаков после запятой.");
 const v=Number(raw);
 if(!Number.isFinite(v)||v<m.min||v>m.max||(m.integer&&!Number.isInteger(v)))throw new Error("Проверьте значение «"+m.label+"». Допустимо от "+m.min+" до "+m.max+".");
 return v;
}
async function saveWellness101(){
 const button=$w("w101Save"),message=$w("w101Message"),date=$w("w101Date")?.value;
 if(!date){message.textContent="Укажите дату измерения.";return}
 if(date>profileToday()){message.textContent="Дата замера не может быть в будущем.";return}
 let meta,body={},tape={};
 try{
  meta=readInfo();
  if(meta.age!=null&&(!Number.isInteger(meta.age)||meta.age<18||meta.age>100))throw new Error("Возраст: укажите полное число лет (18–100).");
  if(meta.height!=null&&(meta.height<100||meta.height>250))throw new Error("Проверьте рост.");
  if(meta.wrist!=null&&(meta.wrist<8||meta.wrist>35))throw new Error("Проверьте окружность запястья.");
  for(const m of METRICS){
   const v=readInput($w("wellness101").querySelector('[data-w101-key="'+m.key+'"]'),m);
   if(v!=null)(m.group==="body"?body:tape)[m.key]=v;
  }
  if(!Object.keys(body).length&&!Object.keys(tape).length&&!(meta.sex||meta.age||meta.frame||meta.height))
   throw new Error("Введите хотя бы один показатель.");
 }catch(e){message.textContent=e.message;return}
 button.disabled=true;message.textContent="Сохраняем Wellness-замер…";
 try{
  const previous=wellnessRows101.find(x=>x.entry_date===date);
  // Preserve values not filled this time; filling a new form never destroys old measurements.
  body={...(previous?.body||{}),...body};
  tape={...(previous?.tape||{}),...tape};
  const response=await sb.from("ps_wellness_measurements").upsert({
   user_id:me.id,entry_date:date,body,tape,profile:meta,updated_at:new Date().toISOString()
  },{onConflict:"user_id,entry_date"});
  if(response.error)throw response.error;
  if(date===profileToday()&&(body.weight!=null||tape.waist!=null||tape.hips!=null||tape.chest!=null)){
   const old=await sb.rpc("ps_save_progress",{p_weight_kg:body.weight??null,p_waist_cm:tape.waist??null,p_hips_cm:tape.hips??null,p_chest_cm:tape.chest??null});
   if(old.error)message.textContent="Wellness сохранён, но основной дневник не обновился: "+old.error.message;
  }
  await refreshWellness101();
  if($w("progressSummaryBox"))await loadProgressStats();
  if($w("coachGraphs")&&typeof refreshCoachResult==="function")await refreshCoachResult();
  if(!message.textContent.includes("но основной"))message.textContent="Wellness-замер сохранён в аккаунте ✓";
 }catch(e){message.textContent="Не удалось сохранить: "+(e.message||"Попробуйте ещё раз.")}
 finally{button.disabled=false}
}
async function bindWellness101(){
 $w("w101Date")?.addEventListener("change",fillDate);
 $w("w101ChartKey")?.addEventListener("change",()=>renderChart(mergeRows()));
 const refSelect=$w("w101RefMode");if(refSelect)refSelect.value=wellnessNormsMode;
 refSelect?.addEventListener("change",event=>{
  wellnessNormsMode=event.target.value==="form2025"?"form2025":"brochure";
  try{localStorage.setItem("ps_wellness_norms_source",wellnessNormsMode)}catch(error){}
  renderCompare(mergeRows());renderWellnessGuide();updateInfo();
 });
 ["w101Sex","w101Age","w101Height","w101Frame","w101Wrist"].forEach(id=>$w(id)?.addEventListener("input",updateInfo));
 $w("wellness101")?.querySelector('[data-w101-key="weight"]')?.addEventListener("input",updateInfo);
 $w("w101Save")?.addEventListener("click",saveWellness101);
 ["w101Sex","w101Age","w101Height","w101Frame","w101Wrist"].forEach(id=>$w(id)?.addEventListener("change",renderWellnessGuide));
 try{await refreshWellness101()}catch(error){
  $w("w101Summary").textContent="Не удалось загрузить Wellness-историю: "+(error.message||"ошибка доступа");
 }
}
})();