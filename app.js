const CONFIG_KEY="protein_studio_supabase_config";
let sb=null,me=null,profile=null,assessment=null,plan=null,consultant=null,selectedGoal="";

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
function setMessage(t){$("authMessage").textContent=t||""}
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
  selectedGoal="";
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
  if(!profile.onboarding_completed){setStep(1);showScreen("onboardingScreen");return}
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
  if(!selectedGoal)return alert("Сначала выберите главную цель.");
  const payload={
    user_id:me.id,
    primary_goal:selectedGoal,
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
  if(q.error)return alert(q.error.message);
  const planData={
    nutrition:{enabled:true,meals:5},
    workouts:{enabled:true,minutes:payload.minutes_available,place:payload.training_place},
    marathon:{enabled:false},
    water:{target:8},
    steps:{target:8000}
  };
  q=await sb.from("ps_plans").insert({user_id:me.id,title:"Мой план",goal:selectedGoal,duration_days:30,plan_data:planData});
  if(q.error)return alert(q.error.message);
  await sb.from("ps_notification_settings").upsert({user_id:me.id});
  q=await sb.from("ps_profiles").update({onboarding_completed:true,updated_at:new Date().toISOString()}).eq("id",me.id);
  if(q.error)return alert(q.error.message);
  await bootstrap();
}
function openPage(page){
  toggleDrawer(false);
  document.querySelectorAll(".nav[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  const titles={plan:"Мой план",nutrition:"Питание",workouts:"Тренировки",marathon:"Марафон",progress:"Прогресс",achievements:"Достижения",community:"Сообщество",consultant:"Мой консультант",notifications:"Уведомления",profile:"Профиль"};
  $("pageTitle").textContent=titles[page]||"PROTEIN STUDIO";
  const fn=pages[page]||(()=>soon(titles[page]));
  $("content").innerHTML=fn();
  if(page==="notifications")bindNotificationToggles();
}
function pagePlan(){
  const goal=assessment?.primary_goal||plan?.goal||"Моя цель";
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
function pageMarathon(){return `<h2 class="section-title">Марафон</h2><section class="card"><b>Марафон — часть личного плана</b><p class="muted">После подключения консультантом здесь будут день марафона, задания, темы, звёзды, награды и кнопка следующего марафона.</p></section>`}
function pageProgress(){
  return `<h2 class="section-title">Прогресс</h2><section class="card">
  <div class="metric"><span>Стартовый вес</span><b>${assessment?.starting_weight_kg||"—"} кг</b></div>
  <div class="metric"><span>Талия</span><b>${assessment?.waist_cm||"—"} см</b></div>
  <div class="metric"><span>Бёдра</span><b>${assessment?.hips_cm||"—"} см</b></div>
  <button class="btn ghost" onclick="alert('Форму новых замеров добавим следующим модулем')">Добавить замер</button>
  </section>`;
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
function pageProfile(){return `<h2 class="section-title">Профиль</h2><section class="card"><b>${profile?.full_name||""}</b><p class="muted">Цель: ${assessment?.primary_goal||"—"}<br>Консультант: ${consultant?.display_name||"—"}<br>Профиль-оценка: пройдена ✓</p></section>`}
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
  selectedGoal=b.dataset.goal;
  document.querySelectorAll("#goalChoices button").forEach(x=>x.classList.toggle("selected",x===b));
}));
document.querySelectorAll(".next-step").forEach(b=>b.addEventListener("click",()=>{
  const n=Number(b.dataset.next);
  if(n===2&&!selectedGoal)return alert("Выберите главную цель.");
  setStep(n);
}));

(async()=>{
  if(!initClient())return;
  await loadConsultants();
  const {data}=await sb.auth.getSession();
  if(data.session){me=data.session.user;await bootstrap()}else showScreen("authScreen");
  if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
})();