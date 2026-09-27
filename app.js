const CONFIG_KEY="protein_studio_supabase_config";
let sb=null,me=null,profile=null,assessment=null,plan=null,consultant=null,selectedGoals=[];

const $=id=>document.getElementById(id);
const screens=["authScreen","setupScreen","onboardingScreen","appScreen"];
function showScreen(id){screens.forEach(x=>$(x).classList.toggle("hidden",x!==id))}
function readConfig(){
  if(window.PROTEIN_STUDIO_CONFIG?.url&&window.PROTEIN_STUDIO_CONFIG?.key)return window.PROTEIN_STUDIO_CONFIG;
  try{return JSON.parse(localStorage.getItem(CONFIG_KEY)||"null")}catch{return null}
}
function initClient(){
  const cfg=readConfig();
  if(!cfg?.url||!cfg?.key){showScreen("setupScreen");return false}
  sb=supabase.createClient(cfg.url,cfg.key);
  return true
}
function setMessage(t){
  const map={
    "Email signups are disabled":"В Supabase выключена регистрация через Email. Включите Email provider, подтверждение e-mail оставьте выключенным.",
    "Invalid login credentials":"Неверный номер телефона или пароль."
  };
  $("authMessage").textContent=map[t]||t||"";
}
function toggleDrawer(open){$("drawer").classList.toggle("open",open);$("backdrop").classList.toggle("show",open)}
function setStep(n){
  document.querySelectorAll("[data-step]").forEach(el=>el.classList.toggle("hidden",Number(el.dataset.step)!==n));
  document.querySelectorAll(".steps i").forEach((el,i)=>el.classList.toggle("on",i<n));
}
function numberValue(id){const n=Number($(id).value);return Number.isFinite(n)&&$(id).value!==""?n:null}
function normalizePhone(value){
  let digits=String(value||"").replace(/\D/g,"");
  if(digits.length===11&&digits.startsWith("8"))digits="7"+digits.slice(1);
  if(digits.length===10)digits="7"+digits;
  return digits?("+"+digits):"";
}
function phoneLoginEmail(phone){
  const digits=normalizePhone(phone).replace(/\D/g,"");
  return digits ? ("phone."+digits+"@protein-studio.app") : "";
}

async function loadConsultants(){
  if(!sb)return;
  const {data,error}=await sb.from("ps_consultants").select("id,display_name").eq("active",true).order("display_name");
  if(error)return setMessage("Не удалось загрузить консультантов");
  $("regConsultant").innerHTML=(data||[]).map(x=>`<option value="${x.id}">${x.display_name}</option>`).join("");
}
async function registerClient(){
  setMessage("Создаём аккаунт...");
  const full_name=$("regName").value.trim();
  const phone=$("regPhone").value.trim();
  const normalizedPhone=normalizePhone(phone);
  const password=$("regPassword").value;
  const consultant_id=$("regConsultant").value||null;
  if(!full_name||normalizedPhone.length<12||password.length<6)return setMessage("Заполните имя, телефон и пароль минимум из 6 символов.");

  const technicalEmail=phoneLoginEmail(normalizedPhone);
  const {data,error}=await sb.auth.signUp({
    email:technicalEmail,
    password,
    options:{data:{full_name,phone:normalizedPhone,consultant_id}}
  });
  if(error)return setMessage(error.message);
  if(!data.user)return setMessage("Не удалось создать аккаунт.");

  if(!data.session){
    $("registerBox").classList.add("hidden");
    $("loginBox").classList.remove("hidden");
    $("loginPhone").value=normalizedPhone;
    return setMessage("Аккаунт создан. Теперь войдите по номеру телефона и паролю.");
  }

  me=data.user;
  selectedGoals=[];
  await bootstrap();
}
async function login(){
  setMessage("Входим...");
  const phone=normalizePhone($("loginPhone").value),password=$("loginPassword").value;
  if(phone.length<12)return setMessage("Введите номер телефона.");
  const email=phoneLoginEmail(phone);
  const {data,error}=await sb.auth.signInWithPassword({email,password});
  if(error)return setMessage(error.message);
  me=data.user;await bootstrap();
}
async function logout(){await sb.auth.signOut();location.reload()}
async function bootstrap(){
  const u=await sb.auth.getUser();
  me=u.data.user;
  if(!me){showScreen("authScreen");await loadConsultants();return}
  const p=await sb.from("ps_profiles").select("*").eq("id",me.id).maybeSingle();
  if(p.error)return setMessage(p.error.message);
  if(!p.data){showScreen("authScreen");$("loginBox").classList.add("hidden");$("registerBox").classList.remove("hidden");return setMessage("Для этого аккаунта ещё нет профиля клиента. Завершите регистрацию.")}
  profile=p.data;
  if(!profile.onboarding_completed){
    const saved=await sb.from("ps_assessments").select("goals,primary_goal").eq("user_id",me.id).maybeSingle();
    selectedGoals=saved.data?.goals?.length?saved.data.goals:(saved.data?.primary_goal?[saved.data.primary_goal]:[]);
    document.querySelectorAll("#goalChoices button").forEach(b=>b.classList.toggle("selected",selectedGoals.includes(b.dataset.goal)));
    setStep(1);showScreen("onboardingScreen");return
  }
  const [a,pl,c]=await Promise.all([
    sb.from("ps_assessments").select("*").eq("user_id",me.id).maybeSingle(),
    sb.from("ps_plans").select("*").eq("user_id",me.id).eq("status","active").order("created_at",{ascending:false}).limit(1).maybeSingle(),
    profile.consultant_id?sb.from("ps_consultants").select("*").eq("id",profile.consultant_id).maybeSingle():Promise.resolve({data:null})
  ]);
  assessment=a.data;plan=pl.data;consultant=c.data;
  showScreen("appScreen");
  $("drawerPerson").textContent=profile.full_name+(consultant?" · "+consultant.display_name:"");
  openPage("plan");
}
async function finishOnboarding(){
  if(selectedGoals.length===0)return alert("Выберите хотя бы одну цель.");

  const btn=$("finishOnboardingBtn");
  const message=$("onboardingMessage");
  btn.disabled=true;
  btn.textContent="Создаём...";
  if(message)message.textContent="Сохраняем профиль и создаём ваш план…";

  try{
    const payload={
      user_id:me.id,
      primary_goal:selectedGoals[0],
      goals:selectedGoals,
      height_cm:numberValue("height"),
      starting_weight_kg:numberValue("weight"),
      waist_cm:numberValue("waist"),
      hips_cm:numberValue("hips"),
      clothing_size:$("clothing").value.trim()||null,
      workouts_per_week:numberValue("workouts")||0,
      minutes_available:numberValue("minutes")||15,
      training_place:$("place").value,
      water_glasses_per_day:numberValue("water")||0,
      completed_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    };

    let q=await sb.from("ps_assessments").upsert(payload);
    if(q.error)throw q.error;

    const planData={
      goals:selectedGoals,
      nutrition:{enabled:true,meals:5},
      workouts:{enabled:true,minutes:payload.minutes_available,place:payload.training_place},
      marathon:{enabled:false},
      water:{target:8},
      steps:{target:8000}
    };

    const existing=await sb.from("ps_plans")
      .select("id")
      .eq("user_id",me.id)
      .eq("status","active")
      .order("created_at",{ascending:false})
      .limit(1)
      .maybeSingle();
    if(existing.error)throw existing.error;

    if(existing.data){
      q=await sb.from("ps_plans").update({
        goal:selectedGoals[0],
        plan_data:planData,
        updated_at:new Date().toISOString()
      }).eq("id",existing.data.id);
    }else{
      q=await sb.from("ps_plans").insert({
        user_id:me.id,
        title:"Мой план",
        goal:selectedGoals[0],
        duration_days:30,
        plan_data:planData
      });
    }
    if(q.error)throw q.error;

    q=await sb.from("ps_notification_settings").upsert({user_id:me.id,updated_at:new Date().toISOString()});
    if(q.error)throw q.error;

    q=await sb.from("ps_profiles").update({
      onboarding_completed:true,
      updated_at:new Date().toISOString()
    }).eq("id",me.id);
    if(q.error)throw q.error;

    if(message)message.textContent="Готово 🌿 Открываем «Мой план»…";
    await bootstrap();
  }catch(err){
    console.error(err);
    if(message)message.textContent="Не удалось создать план: "+(err?.message||"попробуйте ещё раз");
    alert("Не удалось создать план: "+(err?.message||"попробуйте ещё раз"));
  }finally{
    btn.disabled=false;
    btn.textContent="Создать мой план";
  }
}
function openPage(page){
  toggleDrawer(false);
  document.querySelectorAll(".nav[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  const titles={plan:"Мой план",nutrition:"Питание",workouts:"Тренировки",marathon:"Марафон",progress:"Прогресс",achievements:"Достижения",community:"Сообщество",consultant:"Мой консультант",notifications:"Уведомления",profile:"Профиль"};
  $("pageTitle").textContent=titles[page]||"PROTEIN STUDIO";
  const fn=pages[page]||(()=>soon(titles[page]));
  $("content").innerHTML=fn();
  if(page==="notifications")bindNotificationToggles();
  if(page==="marathon")loadMarathonDays();
  if(page==="progress")bindProgressPhotoActions();
}
function pagePlan(){
  const goalList=assessment?.goals?.length?assessment.goals:[assessment?.primary_goal||plan?.goal||"Моя цель"];
  const goal=goalList.join(" · ");
  const start=assessment?.starting_weight_kg?assessment.starting_weight_kg+" кг":"—";
  const mins=assessment?.minutes_available||15;
  const place=assessment?.training_place||"по плану";
  return `
  <section class="card hero">
    <div class="eyebrow">Ваш персональный маршрут</div>
    <h1>${goal}</h1>
    <p class="muted">День ${plan?.current_day||1} из ${plan?.duration_days||30}. Из «Моего плана» идут питание, тренировки, марафон и прогресс.</p>
    <span class="pill">PROTEIN STUDIO</span>
  </section>
  <div class="grid2">
    <div class="mini"><small>Стартовый вес</small><b>${start}</b></div>
    <div class="mini"><small>Сегодня</small><b>0%</b></div>
  </div>
  <section class="card">
    <h3>Сегодня</h3>
    ${task("🥗","Питание","Открыть план питания на сегодня")}
    ${task("🏋🏻‍♀️","Тренировка",mins+" минут · "+place)}
    ${task("🔥","Марафон","Подключается к вашему личному плану")}
    ${task("💧","Вода","Цель по умолчанию: 8 стаканов")}
    ${task("🚶🏻‍♀️","Активность","Цель по умолчанию: 8 000 шагов")}
  </section>`;
}
function task(icon,title,sub){return `<div class="task"><div class="task-icon">${icon}</div><div><b>${title}</b><small>${sub}</small></div></div>`}
function pageNutrition(){return `<h2 class="section-title">Питание</h2><section class="card"><b>Питание идёт из «Моего плана»</b><p class="muted">Здесь будут завтрак, перекусы, обед, ужин, вода, рецепты и отметки выполнения. Следующим модулем добавим персональные варианты по профиль-оценке.</p></section>`}
function pageWorkouts(){return `<h2 class="section-title">Тренировки</h2><section class="card"><b>Тренировка по вашему плану</b><p class="muted">${assessment?.minutes_available||15} минут · ${assessment?.training_place||"Дома"}. Здесь появятся видео упражнений, таймер, повторы и более лёгкие варианты.</p></section>`}
function pageMarathon(){
  const current=plan?.current_day||1;
  return `<h2 class="section-title">Марафон</h2>
  <section class="card hero">
    <div class="eyebrow">30 дней PROTEIN STUDIO</div>
    <h1>День ${current} из 30</h1>
    <p class="muted">Используем ваш сохранённый набор из 30 тем. Каждый день связан с исходным материалом и будет адаптирован под приложение.</p>
  </section>
  <section class="card">
    <h3>Темы 30 дней</h3>
    <div id="marathonDays"><p class="muted">Загружаем темы…</p></div>
  </section>`
}
async function loadMarathonDays(){
  const box=$("marathonDays");
  if(!box)return;
  const {data,error}=await sb.from("ps_marathon_days").select("*").order("day_number");
  if(error){box.innerHTML='<p class="message">Не удалось загрузить темы.</p>';return}
  const current=plan?.current_day||1;
  box.innerHTML=(data||[]).map(d=>`
    <div class="day-row ${d.day_number===current?'current':''}">
      <div class="day-num">${d.day_number}</div>
      <div class="day-copy">
        <b>${escapeHtml(d.title||('День '+d.day_number))}</b>
        ${d.summary?`<small>${escapeHtml(d.summary)}</small>`:''}
      </div>
      <a class="day-link" href="${d.source_url}" target="_blank" rel="noopener">Открыть</a>
    </div>
  `).join('');
}
function escapeHtml(v){
  return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}

function pageProgress(){
  return `<h2 class="section-title">Прогресс</h2>
  <section class="card">
    <div class="metric"><span>Стартовый вес</span><b>${assessment?.starting_weight_kg||"—"} кг</b></div>
    <div class="metric"><span>Талия</span><b>${assessment?.waist_cm||"—"} см</b></div>
    <div class="metric"><span>Бёдра</span><b>${assessment?.hips_cm||"—"} см</b></div>
    <button class="btn ghost" onclick="alert('Форму новых замеров добавим следующим модулем')">Добавить замер</button>
  </section>

  <section class="card">
    <div class="row">
      <div>
        <div class="eyebrow">Фото прогресса</div>
        <h3 class="photo-title">До / После</h3>
      </div>
      <span class="pill">Приватно</span>
    </div>
    <p class="muted">Фото хранятся отдельно для вашего аккаунта и не публикуются в сообществе.</p>

    <div class="photo-grid">
      <div class="photo-slot">
        <div class="photo-frame" id="beforePhotoFrame"><span>Фото ДО</span></div>
        <input class="hidden" id="beforePhotoInput" type="file" accept="image/jpeg,image/png,image/webp">
        <button class="btn ghost photo-btn" id="beforePhotoBtn">Добавить фото ДО</button>
      </div>
      <div class="photo-slot">
        <div class="photo-frame" id="afterPhotoFrame"><span>Фото ПОСЛЕ</span></div>
        <input class="hidden" id="afterPhotoInput" type="file" accept="image/jpeg,image/png,image/webp">
        <button class="btn ghost photo-btn" id="afterPhotoBtn">Добавить фото ПОСЛЕ</button>
      </div>
    </div>

    <button class="btn primary" id="makeCollageBtn">Сделать коллаж ДО / ПОСЛЕ</button>
    <p id="photoMessage" class="message"></p>
  </section>`;
}

async function bindProgressPhotoActions(){
  const beforeBtn=$("beforePhotoBtn"),afterBtn=$("afterPhotoBtn");
  const beforeInput=$("beforePhotoInput"),afterInput=$("afterPhotoInput");
  if(!beforeBtn||!afterBtn)return;

  beforeBtn.addEventListener("click",()=>beforeInput.click());
  afterBtn.addEventListener("click",()=>afterInput.click());
  beforeInput.addEventListener("change",()=>uploadProgressPhoto("before",beforeInput.files?.[0]));
  afterInput.addEventListener("change",()=>uploadProgressPhoto("after",afterInput.files?.[0]));
  $("makeCollageBtn")?.addEventListener("click",makeBeforeAfterCollage);
  await loadProgressPhotos();
}

async function uploadProgressPhoto(kind,file){
  if(!file)return;
  const message=$("photoMessage");
  if(file.size>10*1024*1024){message.textContent="Фото слишком большое. Максимум 10 МБ.";return}
  if(!["image/jpeg","image/png","image/webp"].includes(file.type)){message.textContent="Поддерживаются JPG, PNG и WEBP.";return}

  const btn=$(kind==="before"?"beforePhotoBtn":"afterPhotoBtn");
  btn.disabled=true;
  btn.textContent="Загружаем…";
  message.textContent="Сохраняем фото приватно…";

  try{
    const existing=await sb.from("ps_progress_photos").select("storage_path").eq("user_id",me.id).eq("kind",kind).maybeSingle();
    if(existing.error)throw existing.error;

    const ext=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg";
    const path=`${me.id}/${kind}-${Date.now()}.${ext}`;
    const upload=await sb.storage.from("ps-progress-photos").upload(path,file,{contentType:file.type,cacheControl:"3600"});
    if(upload.error)throw upload.error;

    const saved=await sb.from("ps_progress_photos").upsert({
      user_id:me.id,
      kind,
      storage_path:path
    },{onConflict:"user_id,kind"});
    if(saved.error)throw saved.error;

    if(existing.data?.storage_path&&existing.data.storage_path!==path){
      await sb.storage.from("ps-progress-photos").remove([existing.data.storage_path]);
    }

    message.textContent=kind==="before"?"Фото ДО сохранено ✓":"Фото ПОСЛЕ сохранено ✓";
    await loadProgressPhotos();
  }catch(err){
    console.error(err);
    message.textContent="Не удалось загрузить фото: "+(err?.message||"попробуйте ещё раз");
  }finally{
    btn.disabled=false;
    btn.textContent=kind==="before"?"Добавить фото ДО":"Добавить фото ПОСЛЕ";
  }
}

async function loadProgressPhotos(){
  const {data,error}=await sb.from("ps_progress_photos").select("kind,storage_path").eq("user_id",me.id);
  if(error)return;
  for(const row of data||[]){
    const dl=await sb.storage.from("ps-progress-photos").download(row.storage_path);
    if(dl.error)continue;
    const url=URL.createObjectURL(dl.data);
    const frame=$(row.kind==="before"?"beforePhotoFrame":"afterPhotoFrame");
    if(frame)frame.innerHTML=`<img src="${url}" alt="${row.kind==="before"?"Фото до":"Фото после"}">`;
  }
}

async function getProgressPhotoBlobs(){
  const {data,error}=await sb.from("ps_progress_photos").select("kind,storage_path").eq("user_id",me.id);
  if(error)throw error;
  const byKind=Object.fromEntries((data||[]).map(x=>[x.kind,x.storage_path]));
  if(!byKind.before||!byKind.after)return null;
  const [before,after]=await Promise.all([
    sb.storage.from("ps-progress-photos").download(byKind.before),
    sb.storage.from("ps-progress-photos").download(byKind.after)
  ]);
  if(before.error)throw before.error;
  if(after.error)throw after.error;
  return {before:before.data,after:after.data};
}

function imageFromBlob(blob){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(blob);
    const img=new Image();
    img.onload=()=>{resolve({img,url})};
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Не удалось открыть фото"))};
    img.src=url;
  });
}

function drawCover(ctx,img,x,y,w,h){
  const scale=Math.max(w/img.width,h/img.height);
  const sw=w/scale,sh=h/scale;
  const sx=(img.width-sw)/2,sy=(img.height-sh)/2;
  ctx.drawImage(img,sx,sy,sw,sh,x,y,w,h);
}

async function makeBeforeAfterCollage(){
  const btn=$("makeCollageBtn"),message=$("photoMessage");
  btn.disabled=true;
  btn.textContent="Создаём коллаж…";
  try{
    const blobs=await getProgressPhotoBlobs();
    if(!blobs){message.textContent="Сначала добавьте и фото ДО, и фото ПОСЛЕ.";return}

    const [a,b]=await Promise.all([imageFromBlob(blobs.before),imageFromBlob(blobs.after)]);
    const canvas=document.createElement("canvas");
    canvas.width=1080;canvas.height=1350;
    const ctx=canvas.getContext("2d");
    ctx.fillStyle="#f4f1e8";ctx.fillRect(0,0,1080,1350);

    ctx.fillStyle="#26362d";
    ctx.font="700 54px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign="center";
    ctx.fillText("PROTEIN STUDIO",540,78);

    drawCover(ctx,a.img,0,130,535,1120);
    drawCover(ctx,b.img,545,130,535,1120);

    ctx.fillStyle="rgba(255,255,255,.90)";
    ctx.fillRect(0,1160,535,90);ctx.fillRect(545,1160,535,90);
    ctx.fillStyle="#26362d";ctx.font="700 38px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("ДО",267,1218);ctx.fillText("ПОСЛЕ",812,1218);

    ctx.fillStyle="#5f8d66";ctx.font="600 28px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(profile?.full_name||"",540,1310);

    URL.revokeObjectURL(a.url);URL.revokeObjectURL(b.url);

    const collageBlob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",0.92));
    if(!collageBlob)throw new Error("Не удалось создать изображение");
    const file=new File([collageBlob],"protein-studio-before-after.jpg",{type:"image/jpeg"});

    if(navigator.share&&navigator.canShare?.({files:[file]})){
      await navigator.share({files:[file],title:"PROTEIN STUDIO — До / После"});
      message.textContent="Коллаж готов ✓";
    }else{
      const url=URL.createObjectURL(collageBlob);
      const aLink=document.createElement("a");
      aLink.href=url;aLink.download="protein-studio-before-after.jpg";
      document.body.appendChild(aLink);aLink.click();aLink.remove();
      setTimeout(()=>URL.revokeObjectURL(url),30000);
      message.textContent="Коллаж сохранён ✓";
    }
  }catch(err){
    console.error(err);
    message.textContent="Не удалось создать коллаж: "+(err?.message||"попробуйте ещё раз");
  }finally{
    btn.disabled=false;
    btn.textContent="Сделать коллаж ДО / ПОСЛЕ";
  }
}

function pageConsultant(){return `<h2 class="section-title">Мой консультант</h2><section class="card"><b>${consultant?.display_name||"Консультант не выбран"}</b><p class="muted">Здесь будут рекомендации, сообщения и корректировки вашего плана.</p></section>`}
function pageNotifications(){
  return `<h2 class="section-title">Уведомления</h2><section class="card">
  ${toggle("notifWater","💧 Вода")}
  ${toggle("notifNutrition","🥗 Питание")}
  ${toggle("notifWorkouts","🏋🏻‍♀️ Тренировки")}
  ${toggle("notifMarathon","🔥 Марафон")}
  ${toggle("notifMeasurements","📈 Замеры")}
  ${toggle("notifConsultant","💬 Консультант")}
  </section><p class="muted">Сейчас сохраняем предпочтения. Настоящие push-уведомления подключим отдельным этапом.</p>`;
}
function toggle(id,label){return `<div class="toggle-row"><b>${label}</b><input id="${id}" type="checkbox" checked></div>`}
async function bindNotificationToggles(){
  const q=await sb.from("ps_notification_settings").select("*").eq("user_id",me.id).maybeSingle();
  const d=q.data||{};
  const map={notifWater:"water",notifNutrition:"nutrition",notifWorkouts:"workouts",notifMarathon:"marathon",notifMeasurements:"measurements",notifConsultant:"consultant_messages"};
  for(const [id,key] of Object.entries(map)){
    if($(id))$(id).checked=d[key]!==false;
    $(id)?.addEventListener("change",async e=>{await sb.from("ps_notification_settings").upsert({user_id:me.id,[key]:e.target.checked,updated_at:new Date().toISOString()})});
  }
}
function pageProfile(){const goals=assessment?.goals?.length?assessment.goals.join(", "):(assessment?.primary_goal||"—");return `<h2 class="section-title">Профиль</h2><section class="card"><b>${profile?.full_name||""}</b><p class="muted">Цели: ${goals}<br>Консультант: ${consultant?.display_name||"—"}<br>Профиль-оценка: пройдена ✓</p></section>`}
function soon(name){return `<h2 class="section-title">${name}</h2><section class="card"><b>Раздел уже заложен в структуру.</b><p class="muted">Наполнение добавим следующим этапом без переделки основы приложения.</p></section>`}
const pages={plan:pagePlan,nutrition:pageNutrition,workouts:pageWorkouts,marathon:pageMarathon,progress:pageProgress,achievements:()=>soon("Достижения"),community:()=>soon("Сообщество"),consultant:pageConsultant,notifications:pageNotifications,profile:pageProfile};

$("saveSetupBtn").addEventListener("click",()=>{
  const url=$("setupUrl").value.trim(),key=$("setupKey").value.trim();
  if(!url||!key)return alert("Заполните URL и publishable key.");
  localStorage.setItem(CONFIG_KEY,JSON.stringify({url,key}));
  location.reload();
});
$("showRegisterBtn").addEventListener("click",()=>{$("loginBox").classList.add("hidden");$("registerBox").classList.remove("hidden")});
$("showLoginBtn").addEventListener("click",()=>{$("registerBox").classList.add("hidden");$("loginBox").classList.remove("hidden")});
$("registerBtn").addEventListener("click",registerClient);
$("loginBtn").addEventListener("click",login);
$("finishOnboardingBtn").addEventListener("click",finishOnboarding);
$("menuBtn").addEventListener("click",()=>toggleDrawer(true));
$("backdrop").addEventListener("click",()=>toggleDrawer(false));
$("logoutBtn").addEventListener("click",logout);
document.querySelectorAll(".nav[data-page]").forEach(b=>b.addEventListener("click",()=>openPage(b.dataset.page)));
document.querySelectorAll("#goalChoices button").forEach(b=>b.addEventListener("click",()=>{
  const goal=b.dataset.goal;
  if(selectedGoals.includes(goal)){
    selectedGoals=selectedGoals.filter(x=>x!==goal);
    b.classList.remove("selected");
  }else{
    selectedGoals.push(goal);
    b.classList.add("selected");
  }
}));
document.querySelectorAll(".next-step").forEach(b=>b.addEventListener("click",()=>{
  const n=Number(b.dataset.next);
  if(n===2&&selectedGoals.length===0)return alert("Выберите хотя бы одну цель.");
  setStep(n);
}));
document.querySelectorAll(".back-step").forEach(b=>b.addEventListener("click",()=>{
  setStep(Number(b.dataset.prev));
}));

(async()=>{
  if(!initClient())return;
  await loadConsultants();
  const {data}=await sb.auth.getSession();
  if(data.session){me=data.session.user;await bootstrap()}else showScreen("authScreen");
  if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
})();