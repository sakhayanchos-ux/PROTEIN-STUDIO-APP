const CONFIG_KEY="protein_studio_supabase_config";
let sb=null,me=null,profile=null,assessment=null,plan=null,consultant=null,selectedGoals=[],progressSummary=null,onboardingStep=1,onboardingDraft={};

const $=id=>document.getElementById(id);
const screens=["authScreen","setupScreen","onboardingScreen","appScreen"];
function showScreen(id){screens.forEach(x=>$(x).classList.toggle("hidden",x!==id))}

const THEME_KEY="ps_theme";
const THEMES=["classic","neon","crystal","flowers"];
const THEME_META={
  classic:{color:"#f4f1e8",background:""},
  neon:{color:"#05060d",background:""},
  crystal:{color:"#d8d4d2",background:"theme-crystal.svg?v=31"},
  flowers:{color:"#eee3d8",background:"theme-flowers.svg?v=31"}
};

function currentTheme(){
  const value=document.documentElement.dataset.theme;
  return THEMES.includes(value)?value:"classic";
}

function applyTheme(theme,saveLocal=true){
  const value=THEMES.includes(theme)?theme:"classic";
  document.documentElement.dataset.theme=value;
  if(saveLocal)localStorage.setItem(THEME_KEY,value);

  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.setAttribute("content",THEME_META[value].color);

  updateThemeAssets();
}

function portionGuideSrc(){
  return currentTheme()==="neon" ? "portion-guide-neon.svg?v=31" : "portion-guide.svg?v=31";
}

function themeBackgroundSrc(theme){
  return THEME_META[theme]?.background||"";
}

function updateThemeAssets(){
  const guide=$("portionGuide");
  if(guide)guide.src=portionGuideSrc();

  const bg=$("themeBgImage");
  const src=themeBackgroundSrc(currentTheme());
  if(bg){
    if(src){
      if(bg.getAttribute("src")!==src)bg.setAttribute("src",src);
      bg.classList.add("visible");
    }else{
      bg.classList.remove("visible");
      bg.removeAttribute("src");
    }
  }

  document.querySelectorAll(".theme-preview-photo").forEach(function(img){
    const src=themeBackgroundSrc(img.dataset.themePhoto);
    if(src&&img.getAttribute("src")!==src)img.setAttribute("src",src);
  });
}

async function chooseTheme(theme){
  if(!THEMES.includes(theme))return;
  applyTheme(theme,true);

  document.querySelectorAll("[data-theme-choice]").forEach(function(btn){
    btn.classList.toggle("selected",btn.dataset.themeChoice===theme);
  });

  const label=$("themeSavedMessage");
  if(label)label.textContent="Тема применена сразу ✓";

  if(me&&profile){
    const {data,error}=await sb.from("ps_profiles")
      .update({theme_preference:theme,updated_at:new Date().toISOString()})
      .eq("id",me.id)
      .select("theme_preference")
      .single();

    if(error){
      console.error("Theme save failed",error);
      if(label)label.textContent="Тема применена на этом телефоне.";
    }else{
      profile.theme_preference=data?.theme_preference||theme;
      if(label)label.textContent="Тема сохранена ✓";
    }
  }
}

function readConfig(){
  if(window.PROTEIN_STUDIO_CONFIG?.url&&window.PROTEIN_STUDIO_CONFIG?.key)return window.PROTEIN_STUDIO_CONFIG;
  try{return JSON.parse(localStorage.getItem(CONFIG_KEY)||"null")}catch{return null}
}
function initClient(){
  applyTheme(localStorage.getItem(THEME_KEY)||"classic",false);
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
  try{
    const {data,error}=await sb.auth.signInWithPassword({email,password});
    if(error)return setMessage(error.message);
    me=data.user;
    await bootstrap();
  }catch(err){
    console.error(err);
    setMessage("Не удалось открыть профиль. Попробуйте ещё раз.");
  }
}
async function logout(){await sb.auth.signOut();location.reload()}
async function bootstrap(){
  try{
    if(!me){
      const session=await sb.auth.getSession();
      me=session.data.session?.user||null;
    }
    if(!me){
      showScreen("authScreen");
      await loadConsultants();
      return;
    }

    const [p,a]=await Promise.all([
      sb.from("ps_profiles").select("*").eq("id",me.id).maybeSingle(),
      sb.from("ps_assessments").select("*").eq("user_id",me.id).maybeSingle()
    ]);

    if(p.error)throw p.error;
    if(a.error)throw a.error;

    if(!p.data){
      showScreen("authScreen");
      $("loginBox").classList.add("hidden");
      $("registerBox").classList.remove("hidden");
      setMessage("Для этого аккаунта ещё нет профиля клиента. Завершите регистрацию.");
      return;
    }

    profile=p.data;
    assessment=a.data||null;
    const localTheme=localStorage.getItem(THEME_KEY);
    const profileTheme=THEMES.includes(profile.theme_preference)?profile.theme_preference:null;
    const savedTheme=profileTheme||localTheme||"classic";
    applyTheme(savedTheme,true);
    selectedGoals=assessment?.goals?.length?assessment.goals:(assessment?.primary_goal?[assessment.primary_goal]:[]);

    const needsShortWellness=
      !profile.onboarding_completed ||
      !assessment ||
      !assessment.readiness_score ||
      ((selectedGoals.includes("Снижение веса")||selectedGoals.includes("Улучшить фигуру"))&&!assessment.target_weight_kg);

    if(needsShortWellness){
      onboardingDraft={
        weight:assessment?.starting_weight_kg??null,
        waist:assessment?.waist_cm??null,
        targetWeight:assessment?.target_weight_kg??null,
        goalResult:assessment?.goal_result_text||"",
        readiness:assessment?.readiness_score??null,
        trainingPlace:assessment?.training_place||"Дома",
        minutes:assessment?.minutes_available??10
      };
      onboardingStep=1;
      setMessage("");
      showScreen("onboardingScreen");
      renderOnboarding();
      return;
    }

    const [pl,c]=await Promise.all([
      sb.from("ps_plans").select("*").eq("user_id",me.id).eq("status","active").order("created_at",{ascending:false}).limit(1).maybeSingle(),
      profile.consultant_id?sb.from("ps_consultants").select("*").eq("id",profile.consultant_id).maybeSingle():Promise.resolve({data:null,error:null})
    ]);
    if(pl.error)throw pl.error;
    if(c.error)throw c.error;

    plan=pl.data;
    consultant=c.data;

    const marathon=await sb.rpc("ps_start_marathon");
    if(marathon.error)console.warn("Marathon start:",marathon.error);

    setMessage("");
    showScreen("appScreen");
    $("drawerPerson").textContent=profile.full_name+(consultant?" · "+consultant.display_name:"");
    openPage("plan");
  }catch(err){
    console.error("bootstrap failed",err);
    showScreen("authScreen");
    setMessage("Не удалось открыть профиль: "+(err?.message||"попробуйте ещё раз."));
  }
}

function hasWeightGoal(){
  return selectedGoals.includes("Снижение веса") || selectedGoals.includes("Улучшить фигуру");
}

function goalChoiceHtml(value,label){
  const selected=selectedGoals.includes(value)?" selected":"";
  return '<button type="button" class="'+selected+'" data-short-goal="'+value+'">'+label+'</button>';
}

function renderOnboarding(){
  const counter=$("wellnessCounter");
  const bar=$("wellnessBar");
  const content=$("wellnessContent");
  const back=$("wellnessBackBtn");
  const next=$("wellnessNextBtn");
  if(!counter||!bar||!content||!back||!next)return;

  counter.textContent="Шаг "+onboardingStep+" из 4";
  bar.style.width=((onboardingStep/4)*100)+"%";
  back.style.visibility=onboardingStep===1?"hidden":"visible";
  next.textContent=onboardingStep===4?"Создать мой план":"Продолжить";

  if(onboardingStep===1){
    content.innerHTML=
      '<h2>Какая у вас цель?</h2>'+
      '<p class="muted">Можно выбрать несколько вариантов.</p>'+
      '<div class="choices" id="shortGoalChoices">'+
        goalChoiceHtml("Снижение веса","Снижение веса")+
        goalChoiceHtml("Улучшить фигуру","Улучшить фигуру")+
        goalChoiceHtml("Набор мышечной массы","Набор мышечной массы")+
        goalChoiceHtml("Больше энергии","Больше энергии")+
        goalChoiceHtml("Улучшить самочувствие","Улучшить самочувствие")+
        goalChoiceHtml("Наладить питание","Наладить питание")+
      '</div>';
    content.querySelectorAll("[data-short-goal]").forEach(function(btn){
      btn.addEventListener("click",function(){
        const goal=btn.dataset.shortGoal;
        if(selectedGoals.includes(goal))selectedGoals=selectedGoals.filter(function(x){return x!==goal});
        else selectedGoals.push(goal);
        renderOnboarding();
      });
    });
    return;
  }

  if(onboardingStep===2){
    let extra="";
    if(hasWeightGoal()){
      extra=
        '<label>Хочу прийти к весу, кг'+
          '<input id="shortTargetWeight" type="number" step="0.1" inputmode="decimal" value="'+(onboardingDraft.targetWeight??"")+'">'+
        '</label>'+
        '<p class="muted">Например: сейчас 96 кг → цель 75 кг.</p>';
    }else{
      extra=
        '<label>Какого результата вы хотите?'+
          '<textarea id="shortGoalResult" rows="3" placeholder="Например: больше энергии и лучшее самочувствие">'+escapeHtml(onboardingDraft.goalResult||"")+'</textarea>'+
        '</label>';
    }

    content.innerHTML=
      '<h2>Ваш старт и цель</h2>'+
      '<p class="muted">Только основные данные для отслеживания результата.</p>'+
      '<div class="two-col">'+
        '<label>Сейчас, кг<input id="shortWeight" type="number" step="0.1" inputmode="decimal" value="'+(onboardingDraft.weight??"")+'"></label>'+
        '<label>Талия, см<input id="shortWaist" type="number" step="0.1" inputmode="decimal" value="'+(onboardingDraft.waist??"")+'"></label>'+
      '</div>'+extra+
      '<div class="two-col wellness-movement">'+
        '<label>Где удобнее двигаться?<select id="shortTrainingPlace">'+
          '<option'+(onboardingDraft.trainingPlace==="Дома"?" selected":"")+'>Дома</option>'+
          '<option'+(onboardingDraft.trainingPlace==="В клубе"?" selected":"")+'>В клубе</option>'+
          '<option'+(onboardingDraft.trainingPlace==="На улице"?" selected":"")+'>На улице</option>'+
          '<option'+(onboardingDraft.trainingPlace==="В зале"?" selected":"")+'>В зале</option>'+
        '</select></label>'+
        '<label>Сколько минут реально?<select id="shortMinutes">'+
          [5,10,15,20,30].map(function(n){return '<option value="'+n+'"'+(Number(onboardingDraft.minutes)===n?" selected":"")+'>'+n+' минут</option>'}).join("")+
        '</select></label>'+
      '</div>';
    return;
  }

  if(onboardingStep===3){
    let buttons="";
    for(let i=1;i<=10;i++){
      buttons+='<button type="button" class="readiness-btn'+(Number(onboardingDraft.readiness)===i?" selected":"")+'" data-readiness="'+i+'">'+i+'</button>';
    }
    content.innerHTML=
      '<h2>Насколько вы готовы идти к результату?</h2>'+
      '<p class="muted">1 — пока присматриваюсь, 10 — готов(а) действовать.</p>'+
      '<div class="readiness-grid">'+buttons+'</div>'+
      '<div class="readiness-labels"><span>1</span><span>Готовность</span><span>10</span></div>';
    content.querySelectorAll("[data-readiness]").forEach(function(btn){
      btn.addEventListener("click",function(){
        onboardingDraft.readiness=Number(btn.dataset.readiness);
        renderOnboarding();
      });
    });
    return;
  }

  const weightText=hasWeightGoal()&&onboardingDraft.targetWeight
    ? ruNumber(onboardingDraft.weight)+" → "+ruNumber(onboardingDraft.targetWeight)+" кг"
    : ruNumber(onboardingDraft.weight)+" кг";

  content.innerHTML=
    '<h2>Профиль готов 🌿</h2>'+
    '<p class="muted">Полную Wellness-оценку вы пройдёте в клубе с консультантом. Здесь сохраняем только основные данные.</p>'+
    '<div class="short-summary">'+
      '<div class="summary-row"><span>Цель</span><b>'+escapeHtml(selectedGoals.join(", "))+'</b></div>'+
      '<div class="summary-row"><span>Вес / цель</span><b>'+weightText+'</b></div>'+
      '<div class="summary-row"><span>Талия</span><b>'+ruNumber(onboardingDraft.waist)+' см</b></div>'+
      '<div class="summary-row"><span>Готовность</span><b>'+onboardingDraft.readiness+'/10</b></div>'+
      '<div class="summary-row"><span>Движение</span><b>'+escapeHtml(onboardingDraft.trainingPlace||"Дома")+' · '+(onboardingDraft.minutes||10)+' мин</b></div>'+
    '</div>';
}

function collectOnboardingStep(){
  if(onboardingStep!==2)return;
  const w=$("shortWeight");
  const waist=$("shortWaist");
  const tw=$("shortTargetWeight");
  const gr=$("shortGoalResult");
  const tp=$("shortTrainingPlace");
  const mins=$("shortMinutes");
  if(w)onboardingDraft.weight=w.value===""?null:Number(w.value);
  if(waist)onboardingDraft.waist=waist.value===""?null:Number(waist.value);
  if(tw)onboardingDraft.targetWeight=tw.value===""?null:Number(tw.value);
  if(gr)onboardingDraft.goalResult=gr.value.trim();
  if(tp)onboardingDraft.trainingPlace=tp.value;
  if(mins)onboardingDraft.minutes=Number(mins.value)||10;
}

function validateOnboardingStep(){
  if(onboardingStep===1&&!selectedGoals.length){
    alert("Выберите хотя бы одну цель.");
    return false;
  }
  if(onboardingStep===2){
    collectOnboardingStep();
    if(!(Number(onboardingDraft.weight)>0)){
      alert("Укажите текущий вес.");
      return false;
    }
    if(!(Number(onboardingDraft.waist)>0)){
      alert("Укажите талию.");
      return false;
    }
    if(hasWeightGoal()&&!(Number(onboardingDraft.targetWeight)>0)){
      alert("Укажите желаемый вес.");
      return false;
    }
    if(!hasWeightGoal()&&!onboardingDraft.goalResult){
      alert("Коротко укажите желаемый результат.");
      return false;
    }
  }
  if(onboardingStep===3&&!(Number(onboardingDraft.readiness)>=1&&Number(onboardingDraft.readiness)<=10)){
    alert("Выберите готовность от 1 до 10.");
    return false;
  }
  return true;
}

async function finishOnboarding(){
  const next=$("wellnessNextBtn");
  const message=$("onboardingMessage");
  next.disabled=true;
  next.textContent="Создаём...";
  if(message)message.textContent="Сохраняем данные и создаём ваш план…";

  try{
    const now=new Date().toISOString();
    const payload={
      user_id:me.id,
      primary_goal:selectedGoals[0],
      goals:selectedGoals,
      starting_weight_kg:Number(onboardingDraft.weight),
      target_weight_kg:hasWeightGoal()?Number(onboardingDraft.targetWeight):null,
      waist_cm:Number(onboardingDraft.waist),
      goal_result_text:hasWeightGoal()?null:(onboardingDraft.goalResult||null),
      readiness_score:Number(onboardingDraft.readiness),
      wellness_completed_at:now,
      workouts_per_week:0,
      minutes_available:Number(onboardingDraft.minutes)||10,
      training_place:onboardingDraft.trainingPlace||"Дома",
      water_glasses_per_day:4,
      completed_at:now,
      updated_at:now
    };

    let q=await sb.from("ps_assessments").upsert(payload);
    if(q.error)throw q.error;

    const planData={
      goals:selectedGoals,
      target_weight_kg:payload.target_weight_kg,
      goal_result_text:payload.goal_result_text,
      readiness_score:payload.readiness_score,
      nutrition:{enabled:true,meals:5},
      workouts:{enabled:true,minutes:payload.minutes_available,place:payload.training_place},
      marathon:{enabled:true},
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
        updated_at:now
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

    q=await sb.from("ps_notification_settings").upsert({user_id:me.id,updated_at:now});
    if(q.error)throw q.error;

    q=await sb.rpc("ps_start_marathon");
    if(q.error)throw q.error;

    q=await sb.rpc("ps_save_progress",{
      p_weight_kg:payload.starting_weight_kg,
      p_waist_cm:payload.waist_cm,
      p_hips_cm:null,
      p_chest_cm:null
    });
    if(q.error)throw q.error;

    q=await sb.from("ps_profiles").update({
      onboarding_completed:true,
      updated_at:now
    }).eq("id",me.id);
    if(q.error)throw q.error;

    if(message)message.textContent="Готово 🌿 Открываем «Мой план»…";
    await bootstrap();
  }catch(err){
    console.error(err);
    if(message)message.textContent="Не удалось создать план: "+(err?.message||"попробуйте ещё раз");
  }finally{
    next.disabled=false;
    next.textContent="Создать мой план";
  }
}

async function nextOnboarding(){
  if(!validateOnboardingStep())return;
  if(onboardingStep<4){
    onboardingStep++;
    renderOnboarding();
  }else{
    await finishOnboarding();
  }
}

function prevOnboarding(){
  collectOnboardingStep();
  if(onboardingStep>1){
    onboardingStep--;
    renderOnboarding();
  }
}

function openPage(page){
  toggleDrawer(false);
  document.querySelectorAll(".nav[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  const titles={plan:"Мой план",nutrition:"Питание",workouts:"Тренировки",marathon:"Марафон",progress:"Прогресс",achievements:"Достижения",community:"Сообщество",consultant:"Мой консультант",notifications:"Уведомления",profile:"Профиль",themes:"Оформление"};
  $("pageTitle").textContent=titles[page]||"PROTEIN STUDIO";
  const fn=pages[page]||(()=>soon(titles[page]));
  $("content").innerHTML=fn();
  if(page==="notifications")bindNotificationToggles();
  if(page==="marathon")loadMarathonDays();
  if(page==="progress")bindProgressPhotoActions();
  if(page==="plan")loadPlanProgress();
  if(page==="nutrition")loadNutritionTargets();
  if(page==="workouts")loadWorkoutPlan();
  if(page==="themes")bindThemePicker();
}
function pagePlan(){
  const goalList=assessment?.goals?.length?assessment.goals:[assessment?.primary_goal||plan?.goal||"Моя цель"];
  const goal=goalList.join(" · ");
  const targetWeight=assessment?.target_weight_kg!=null?Number(assessment.target_weight_kg):null;
  const goalResult=assessment?.goal_result_text||"";
  const finalGoal=targetWeight ? "Цель: "+ruNumber(targetWeight)+" кг" : (goalResult?escapeHtml(goalResult):goal);

  return '<section class="card hero plan-hero">'+
    '<div class="eyebrow">Мой путь</div>'+
    '<h1>'+escapeHtml(goal)+'</h1>'+
    '<p class="plan-final-goal">'+finalGoal+'</p>'+
    '<div id="planProgressContent"><div class="plan-loading">Считаем ваш прогресс…</div></div>'+
  '</section>'+

  '<section class="card">'+
    '<div class="row"><div><div class="eyebrow">Что делать сегодня</div><h3 class="photo-title">План на день</h3></div><span class="pill">Шаг за шагом</span></div>'+
    planActionCard("🥗","Питание","Утром: Алоэ + Травяной напиток + коктейль. Днём: белковые перекусы и правильная тарелка. Вечером: белок + овощи без гарнира.","Белковая цель пересчитывается автоматически по текущему весу.","nutrition")+
    planActionCard("🏋🏻‍♀️","Движение",(assessment?.minutes_available||10)+" минут · "+(assessment?.training_place||"Дома")+". Начинаем с уровня, который можно повторять регулярно.","Нагрузка растёт постепенно по мере прогресса.","workouts")+
    planActionCard("💧","Вода","Суточный ориентир рассчитывается по текущему весу. Алоэ можно включить в ваш водный ритуал по инструкции продукта.","CR7 Drive — только как спортивный напиток при подходящей нагрузке, не вместо всей воды.","nutrition")+
    planActionCard("🔥","30 дней","Каждый день открывается новая тема. Выполняйте только сегодняшний день — следующие пока закрыты 🔒.","Почему: маленькие ежедневные действия легче превратить в привычку.","marathon")+
    '<div id="planDailyTargets" class="daily-targets"><span>Белок: считаем…</span><span>Вода: считаем…</span></div>'+
  '</section>'+

  '<section class="card product-plan-card">'+
    '<div class="row"><div><div class="eyebrow">Продукты клуба</div><h3 class="photo-title">Herbalife в вашем плане</h3></div><span class="pill">С консультантом</span></div>'+
    '<div class="product-plan-row"><div class="product-plan-icon">🥤</div><div><b>Завтрак клуба</b><small>Алоэ + Травяной напиток + Формула 1. Если белка по расчёту не хватает — консультант может добавить дополнительный белковый компонент.</small></div></div>'+
    '<div class="product-plan-row"><div class="product-plan-icon">🌿</div><div><b>Растительный напиток Алоэ</b><small>Можно включить в водный ритуал по инструкции продукта и рекомендации консультанта.</small></div></div>'+
    '<div class="product-plan-row"><div class="product-plan-icon">⚡</div><div><b>CR7 Drive</b><small>Для тренировочных дней и интенсивной физической нагрузки — использовать согласно инструкции продукта.</small></div></div>'+
    '<div class="discount-note"><b>Ваша скидка на продукты</b><span>15–50% в зависимости от статуса клиента. Точный процент укажет ваш консультант.</span></div>'+
    '<p class="product-disclaimer">Используйте продукты согласно маркировке конкретного продукта и рекомендациям консультанта. При индивидуальных ограничениях учитывайте рекомендации врача.</p>'+
  '</section>';
}

function planActionCard(icon,title,body,why,page){
  return '<button class="plan-action" type="button" data-plan-page="'+page+'">'+
    '<div class="plan-action-icon">'+icon+'</div>'+
    '<div class="plan-action-copy"><b>'+title+'</b><span>'+body+'</span><small>'+why+'</small></div>'+
    '<div class="plan-action-arrow">›</div></button>';
}

async function loadPlanProgress(){
  const box=$("planProgressContent");
  if(!box)return;
  document.querySelectorAll("[data-plan-page]").forEach(function(btn){
    btn.addEventListener("click",function(){openPage(btn.dataset.planPage)});
  });
  try{
    const s=await getProgressSummary();
    const target=assessment?.target_weight_kg!=null?Number(assessment.target_weight_kg):null;
    const targets=buildNutritionTargets(s.latestWeight);
    const dailyTargets=$("planDailyTargets");
    if(dailyTargets){
      const proteinText=targets.proteinMin
        ? ("Белок: "+targets.proteinMin+"–"+targets.proteinMax+" г/сут.")
        : "Белок: источник в каждом основном приёме";
      dailyTargets.innerHTML="<span>"+proteinText+"</span><span>Вода: ~"+ruNumber(targets.waterLiters)+" л/сут.</span>";
    }
    const start=s.startWeight;
    const current=s.latestWeight;
    const startWaist=s.startWaist;
    const currentWaist=s.latestWaist;

    if(target!=null&&start!=null&&current!=null&&start!==target){
      const total=Math.abs(start-target);
      const towardGoal=target<start ? (start-current) : (current-start);
      const done=Math.max(0,Math.min(total,towardGoal));
      const percent=Math.max(0,Math.min(100,Math.round((done/total)*100)));
      const remaining=Math.max(0,Math.abs(current-target));
      const weightChange=current-start;
      const waistChange=(startWaist!=null&&currentWaist!=null)?currentWaist-startWaist:null;
      box.innerHTML=
        '<div class="plan-weight-route"><div><small>Старт</small><b>'+ruNumber(start)+' кг</b></div><div class="plan-route-center"><small>Сейчас</small><b>'+ruNumber(current)+' кг</b></div><div><small>Цель</small><b>'+ruNumber(target)+' кг</b></div></div>'+
        '<div class="plan-progress-line"><i style="width:'+percent+'%"></i></div>'+
        '<div class="plan-progress-meta"><b>Пройдено '+percent+'%</b><span>Осталось '+ruNumber(remaining)+' кг</span></div>'+
        '<div class="plan-change-grid"><div><small>Вес</small><b>'+deltaText(weightChange," кг")+'</b></div><div><small>Талия</small><b>'+(waistChange==null?"—":deltaText(waistChange," см"))+'</b></div><div><small>Дней</small><b>'+s.days+'</b></div></div>';
    }else{
      const waistChange=(startWaist!=null&&currentWaist!=null)?currentWaist-startWaist:null;
      box.innerHTML=
        '<div class="plan-change-grid"><div><small>Текущий вес</small><b>'+(current!=null?ruNumber(current)+" кг":"—")+'</b></div><div><small>Талия</small><b>'+(waistChange==null?"—":deltaText(waistChange," см"))+'</b></div><div><small>Дней</small><b>'+s.days+'</b></div></div>'+
        '<p class="muted">Для этой цели прогресс будем показывать по вашим замерам и выполнению плана.</p>';
    }
  }catch(err){
    console.error(err);
    box.innerHTML='<p class="message">Не удалось загрузить прогресс.</p>';
  }
}


function buildNutritionTargets(currentWeight){
  const current=Number(currentWeight||assessment?.starting_weight_kg||0);
  const proteinWeight=current;

  let proteinMin=null,proteinMax=null;
  if(proteinWeight>0){
    proteinMin=Math.round(proteinWeight*1.5);
    proteinMax=Math.round(proteinWeight*1.8);
  }

  const waterLiters=current>0 ? Math.round(current*0.03*10)/10 : null;
  return {proteinMin,proteinMax,waterLiters,proteinWeight};
}

function mealStep(time,title,text,note){
  return '<div class="meal-step">'+
    '<div class="meal-time">'+time+'</div>'+
    '<div class="meal-copy"><b>'+title+'</b><span>'+text+'</span>'+(note?'<small>'+note+'</small>':'')+'</div>'+
  '</div>';
}

function menuSuggestion(name,protein,note){
  return '<div class="menu-suggestion"><div><b>'+name+'</b><small>'+note+'</small></div><span>'+protein+' г белка</span></div>';
}

function pageNutrition(){
  return '<h2 class="section-title">Питание</h2>'+
  '<section class="card nutrition-hero">'+
    '<div class="eyebrow">Ваш персональный план</div>'+
    '<h3>Питание на каждый день</h3>'+
    '<p class="muted">База: структурированный завтрак, белковые перекусы, правильная тарелка в обед и понятный ужин.</p>'+
    '<div id="nutritionTargetBox" class="nutrition-target-box"><span>Считаем белок…</span><span>Считаем воду…</span></div>'+
  '</section>'+

  '<section class="card">'+
    '<div class="eyebrow">По порядку</div><h3>Как выглядит день</h3>'+
    mealStep("Утро","Алоэ + Травяной напиток + коктейль","Сначала Растительный напиток Алоэ, затем Травяной напиток и протеиновый коктейль. Ягоды или фрукт можно добавить утром. Если по дневному расчёту не хватает белка — добавьте дополнительный белковый компонент, например Протеиновую смесь Формула 3 или другой согласованный с консультантом вариант.","Базовый минимум клуба: Алоэ + чай + коктейль. Дополнительный белок — только если его нужно добрать до вашей дневной цели.")+
    mealStep("Перекус","Белковый перекус","Выберите один белковый вариант: Protein Bites, протеиновый батончик, Formula 1 Express или протеиновые чипсы.","Смысл перекуса — не «добрать сладкое», а помочь удержать структуру питания.")+
    mealStep("Обед","Правильная тарелка","Половина тарелки — овощи/салат, четверть — источник белка, четверть — гарнир.","Если нет весов, используйте ориентир по ладони ниже.")+
    '<img id="portionGuide" class="portion-guide" src="'+portionGuideSrc()+'" alt="Правильная тарелка и ориентир порций по руке">'+
    mealStep("Перекус","Ещё один белковый вариант","Если между обедом и ужином большой промежуток — используйте белковый перекус из меню клуба или обычную белковую еду.","Количество перекусов можно уменьшить, если вам комфортно без них.")+
    mealStep("Ужин","Белок + овощи, без гарнира","Вариант 1 — протеиновый коктейль. Вариант 2 — мясо, рыба, яйца или другой белковый продукт + овощи/салат. Гарнир вечером в этом плане не используем.","Сохраняем ужин простым: белок + овощи или коктейль.")+
  '</section>'+

  '<section class="card">'+
    '<div class="row"><div><div class="eyebrow">Белок</div><h3 class="photo-title">Ваш ориентир</h3></div><span class="pill">Автоматически</span></div>'+
    '<div id="proteinTargetDetail" class="target-detail"><p class="muted">Считаем по вашей цели…</p></div>'+
    '<div class="menu-suggestions">'+
      menuSuggestion("Протеиновый коктейль","10","из текущего меню PROTEIN STUDIO")+
      menuSuggestion("Кофе с протеином","15","удобный белковый напиток")+
      menuSuggestion("Protein Bites","8","мини-перекус")+
      menuSuggestion("Протеиновые чипсы","11–12","несладкий перекус")+
      menuSuggestion("Formula 1 Express","14–16","порционный перекус")+
      menuSuggestion("H24 Achieve","21","спортивный высокобелковый батончик")+
    '</div>'+
    '<a class="btn ghost app-link" href="https://sakhayanchos-ux.github.io/PROTEIN-STUDIO-MENU/" target="_blank" rel="noopener">Открыть меню PROTEIN STUDIO</a>'+
  '</section>'+

  '<section class="card">'+
    '<div class="eyebrow">Водный баланс</div><h3 id="waterTargetTitle">Ваш ориентир</h3>'+
    '<p id="waterTargetText" class="muted">Считаем по текущему весу…</p>'+
    '<div class="hydration-note"><b>🌿 Алоэ</b><span>Можно включить в водный ритуал: Растительный напиток Алоэ в российских материалах Herbalife используется для поддержки водного баланса и пищеварения.</span></div>'+
    '<div class="hydration-note"><b>⚡ CR7 Drive</b><span>Гипотонический спортивный напиток с электролитами для восполнения водного баланса до и после физической нагрузки. Используйте согласно инструкции продукта.</span></div>'+
  '</section>'+

  '<p class="plan-health-note">Ориентиры в приложении предназначены для здоровых взрослых и не заменяют медицинские рекомендации. При заболеваниях почек/сердца, ограничении жидкости, беременности или других особых состояниях план нужно согласовать с врачом.</p>';
}

async function loadNutritionTargets(){
  try{
    const s=await getProgressSummary();
    const t=buildNutritionTargets(s.latestWeight);
    const box=$("nutritionTargetBox");
    if(box){
      box.innerHTML='<span>'+(t.proteinMin?('Белок '+t.proteinMin+'–'+t.proteinMax+' г'):'Белок — по структуре приёмов')+'</span>'+
        '<span>'+(t.waterLiters?('Вода ~'+ruNumber(t.waterLiters)+' л'):'Вода — индивидуально')+'</span>';
    }

    const pd=$("proteinTargetDetail");
    if(pd){
      if(t.proteinMin){
        const basis='Расчёт: текущий вес '+ruNumber(t.proteinWeight)+' кг × 1,5–1,8. После каждого нового замера приложение пересчитывает цель автоматически.';
        pd.innerHTML='<div class="big-target">'+t.proteinMin+'–'+t.proteinMax+' г <small>белка в сутки</small></div>'+
          '<p class="muted">'+basis+'</p>';
      }else{
        pd.innerHTML='<p class="muted">Для вашей цели пока используем простое правило: добавляйте источник белка в каждый основной приём пищи. Точный диапазон консультант сможет настроить отдельно.</p>';
      }
    }

    const wt=$("waterTargetTitle"),wp=$("waterTargetText");
    if(wt&&t.waterLiters)wt.textContent='Около '+ruNumber(t.waterLiters)+' л жидкости в сутки';
    if(wp&&t.waterLiters)wp.textContent='Расчётный ориентир: текущий вес × 30 мл/кг. При тренировках, жаре и других условиях потребность меняется.';
  }catch(err){
    console.error(err);
  }
}

function exerciseItem(icon,title,text){
  return '<div class="exercise-item"><div class="exercise-icon">'+icon+'</div><div><b>'+title+'</b><span>'+text+'</span></div></div>';
}

function pageWorkouts(){
  return '<h2 class="section-title">Тренировки</h2>'+
  '<section class="card workout-hero">'+
    '<div class="eyebrow">План из вашей анкеты</div>'+
    '<h3 id="workoutPlanTitle">Собираем вашу нагрузку…</h3>'+
    '<p id="workoutPlanIntro" class="muted"></p>'+
  '</section>'+
  '<section class="card">'+
    '<div class="eyebrow">Сегодня</div><h3>Простая тренировка</h3>'+
    '<div id="workoutExercises"><p class="muted">Подбираем упражнения…</p></div>'+
  '</section>'+
  '<section class="card">'+
    '<div class="eyebrow">Правило прогресса</div>'+
    '<p class="muted">Начинаем с уровня, который можно повторять регулярно. Когда этот объём становится комфортным — прибавляем несколько минут или усложняем упражнения.</p>'+
    '<div class="notice">Если во время нагрузки появляется боль в груди, выраженная одышка, головокружение или необычная боль — остановитесь. При хронических заболеваниях и перед интенсивной нагрузкой лучше обсудить допустимый уровень активности с врачом.</div>'+
  '</section>';
}

async function loadWorkoutPlan(){
  try{
    const s=await getProgressSummary();
    const weight=Number(s.latestWeight||assessment?.starting_weight_kg||0);
    const readiness=Number(assessment?.readiness_score||5);
    const place=assessment?.training_place||"Дома";
    const minutes=Number(assessment?.minutes_available||10);
    const lowImpact=(weight>=80||readiness<=5);
    const title=$("workoutPlanTitle"),intro=$("workoutPlanIntro"),box=$("workoutExercises");

    if(title)title.textContent=minutes+' минут · '+place;
    if(intro)intro.textContent=lowImpact
      ? 'Стартуем мягко: без прыжков и резких ударных движений. Вес — только один из факторов; важны также самочувствие и привычка к нагрузке.'
      : 'Можно начать с короткого смешанного комплекса: ходьба/разминка + простые силовые движения.';

    let items=[];
    if(place==="На улице"){
      items=[
        ["🚶","Ходьба","Начните спокойным темпом 2–3 минуты, затем идите чуть быстрее."],
        ["⏱️","Интервалы","Чередуйте 1 минуту бодрее и 1 минуту спокойнее."],
        ["🧍","Финиш","2 минуты спокойной ходьбы и лёгкая разминка."]
      ];
    }else if(lowImpact){
      items=[
        ["🚶","Шаги на месте","1–2 минуты в удобном темпе, без прыжков."],
        ["🪑","Встать со стула","Медленно встать и сесть 6–10 раз, держась за опору при необходимости."],
        ["🧱","Отжимания от стены","6–10 спокойных повторов."],
        ["↔️","Шаги в сторону","По 6–10 шагов в каждую сторону."],
        ["🪽","«Самолёт» у опоры","Лёгкое упражнение на баланс: держитесь за опору и отводите ногу назад/в сторону."]
      ];
    }else{
      items=[
        ["🚶","Разминка","2 минуты ходьбы или шагов на месте."],
        ["🪑","Присед к стулу","8–12 повторов в комфортной амплитуде."],
        ["🧱","Отжимания от стены/опоры","8–12 повторов."],
        ["↔️","Шаги в сторону","10 шагов в каждую сторону."],
        ["🧘","Спокойная заминка","1–2 минуты дыхания и лёгкой растяжки."]
      ];
    }

    const loops=minutes>=20?2:1;
    if(box)box.innerHTML=items.map(function(x){return exerciseItem(x[0],x[1],x[2])}).join("")+
      '<div class="workout-loop-note">'+(loops===2?'Пройдите этот круг 2 раза.':'Одного круга на старте достаточно.')+'</div>';
  }catch(err){
    console.error(err);
  }
}

function pageMarathon(){
  return `<h2 class="section-title">Марафон</h2>
  <section class="card hero">
    <div class="eyebrow">30 дней PROTEIN STUDIO</div>
    <h1 id="marathonCurrentTitle">День 1 из 30</h1>
    <p class="muted">Новый день открывается после полуночи. Будущие дни закрыты ключиком 🔒.</p>
  </section>
  <section class="card">
    <div class="row"><h3>30 дней</h3><span class="pill">1 день = 1 тема</span></div>
    <div id="marathonDays"><p class="muted">Загружаем дни…</p></div>
  </section>`
}
async function loadMarathonDays(){
  const box=$("marathonDays");
  if(!box)return;

  await sb.rpc("ps_start_marathon");
  const {data,error}=await sb.rpc("ps_get_marathon_days");
  if(error){box.innerHTML='<p class="message">Не удалось загрузить марафон: '+escapeHtml(error.message)+'</p>';return}

  const rows=data||[];
  const todayRow=rows.find(d=>d.is_today) || [...rows].reverse().find(d=>d.unlocked) || rows[0];
  const currentDay=todayRow?.day_number||1;
  const title=$("marathonCurrentTitle");
  if(title)title.textContent=`День ${currentDay} из 30`;

  box.innerHTML=rows.map(d=>`
    <div class="day-row ${d.is_today?'current':''} ${d.unlocked?'':'locked'}">
      <div class="day-num">${d.day_number}</div>
      <div class="day-copy">
        <b>День ${d.day_number}</b>
        <small>${d.unlocked?(d.is_today?'Открыт сегодня':'Открыт'):'Откроется '+formatShortDate(d.unlock_date)}</small>
      </div>
      ${d.unlocked&&d.source_url
        ?`<a class="day-link" href="${d.source_url}" target="_blank" rel="noopener">Открыть</a>`
        :'<span class="day-lock" aria-label="Закрыто">🔒</span>'}
    </div>
  `).join('');
}
function formatShortDate(value){
  if(!value)return "";
  const [y,m,d]=String(value).split("-");
  return `${d}.${m}`;
}

function escapeHtml(v){
  return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}

function pageProgress(){
  return `<h2 class="section-title">Прогресс</h2>

  <section class="card">
    <div class="row">
      <div>
        <div class="eyebrow">Результат</div>
        <h3 class="photo-title">Мои изменения</h3>
      </div>
      <span class="pill" id="progressDaysPill">Старт</span>
    </div>
    <div id="progressSummaryBox">
      <p class="muted">Считаем изменения…</p>
    </div>
    <button class="btn ghost" id="toggleMeasurementBtn">+ Добавить замер</button>
    <div id="measurementForm" class="measurement-form hidden">
      <div class="two-col">
        <label>Вес, кг<input id="measureWeight" type="number" step="0.1" inputmode="decimal"></label>
        <label>Талия, см<input id="measureWaist" type="number" step="0.1" inputmode="decimal"></label>
      </div>
      <button class="btn primary" id="saveMeasurementBtn">Сохранить сегодняшний замер</button>
      <p id="measurementMessage" class="message"></p>
    </div>
  </section>

  <section class="card">
    <div class="row">
      <div>
        <div class="eyebrow">Фото прогресса</div>
        <h3 class="photo-title">До / После</h3>
      </div>
      <span class="pill">Приватно</span>
    </div>
    <p class="muted">Фото ДО и ПОСЛЕ всегда сохраняются в вашем аккаунте.</p>

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

    <button class="btn primary" id="makeCollageBtn">Создать и сохранить коллаж</button>
    <p id="photoMessage" class="message"></p>
  </section>

  <section class="card">
    <div class="row">
      <div>
        <div class="eyebrow">История</div>
        <h3 class="photo-title">Мои коллажи</h3>
      </div>
    </div>
    <div id="savedCollages"><p class="muted">Пока сохранённых коллажей нет.</p></div>
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

  $("toggleMeasurementBtn")?.addEventListener("click",()=>{
    $("measurementForm")?.classList.toggle("hidden");
  });
  $("saveMeasurementBtn")?.addEventListener("click",saveMeasurement);

  await Promise.all([loadProgressPhotos(),loadProgressStats(),loadSavedCollages()]);
}

function inputNumberOrNull(id){
  const el=$(id);
  if(!el||el.value.trim()==="")return null;
  const n=Number(el.value.replace(",","."));
  return Number.isFinite(n)?n:null;
}

async function saveMeasurement(){
  const btn=$("saveMeasurementBtn"),message=$("measurementMessage");
  const values={
    p_weight_kg:inputNumberOrNull("measureWeight"),
    p_waist_cm:inputNumberOrNull("measureWaist"),
    p_hips_cm:null,
    p_chest_cm:null
  };
  if(Object.values(values).every(v=>v===null)){
    message.textContent="Введите хотя бы один показатель.";
    return;
  }
  btn.disabled=true;btn.textContent="Сохраняем…";
  const {error}=await sb.rpc("ps_save_progress",values);
  if(error){
    message.textContent="Не удалось сохранить: "+error.message;
  }else{
    message.textContent="Сегодняшний замер сохранён ✓";
    await loadProgressStats();
  }
  btn.disabled=false;btn.textContent="Сохранить сегодняшний замер";
}

function dateDiffDays(a,b){
  if(!a||!b)return 0;
  const A=Date.parse(a+"T00:00:00Z"),B=Date.parse(b+"T00:00:00Z");
  return Math.max(0,Math.round((B-A)/86400000));
}
function ruNumber(v,digits=1){
  if(v===null||v===undefined||Number.isNaN(Number(v)))return "—";
  return Number(v).toLocaleString("ru-RU",{maximumFractionDigits:digits,minimumFractionDigits:0});
}
function deltaText(v,unit){
  if(v===null||v===undefined||Number.isNaN(Number(v)))return "—";
  const n=Number(v);
  const sign=n>0?"+":n<0?"−":"";
  return sign+ruNumber(Math.abs(n))+unit;
}

async function getProgressSummary(){
  const {data,error}=await sb.from("ps_progress_entries").select("*").eq("user_id",me.id).order("entry_date",{ascending:true});
  if(error)throw error;
  const rows=data||[];

  const startDate=(assessment?.completed_at||"").slice(0,10) || plan?.start_date || rows[0]?.entry_date || null;
  const last=rows.length?rows[rows.length-1]:null;
  const latestDate=last?.entry_date||startDate;

  const startWeight=assessment?.starting_weight_kg!=null?Number(assessment.starting_weight_kg):null;
  const startWaist=assessment?.waist_cm!=null?Number(assessment.waist_cm):null;
  const latestWeight=last?.weight_kg!=null?Number(last.weight_kg):startWeight;
  const latestWaist=last?.waist_cm!=null?Number(last.waist_cm):startWaist;

  return {
    startDate,latestDate,
    days:dateDiffDays(startDate,latestDate),
    startWeight,latestWeight,weightChange:(startWeight!=null&&latestWeight!=null)?latestWeight-startWeight:null,
    startWaist,latestWaist,waistChange:(startWaist!=null&&latestWaist!=null)?latestWaist-startWaist:null
  };
}

async function loadProgressStats(){
  try{
    progressSummary=await getProgressSummary();
    const s=progressSummary;
    const box=$("progressSummaryBox"),pill=$("progressDaysPill");
    if(pill)pill.textContent=s.days===0?"Сегодня":s.days+" дн.";
    if(box)box.innerHTML=`
      <div class="progress-highlight">
        <small>Вес</small>
        <b>${deltaText(s.weightChange," кг")}</b>
        <span>${s.startWeight!=null?ruNumber(s.startWeight)+" → "+ruNumber(s.latestWeight)+" кг":"Нет данных"}</span>
      </div>
      <div class="progress-deltas two">
        <div><small>Вес</small><b>${deltaText(s.weightChange," кг")}</b></div>
        <div><small>Талия</small><b>${deltaText(s.waistChange," см")}</b></div>
      </div>`;
  }catch(err){
    const box=$("progressSummaryBox");
    if(box)box.innerHTML='<p class="message">Не удалось посчитать прогресс.</p>';
  }
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
    img.onload=()=>resolve({img,url});
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
  btn.disabled=true;btn.textContent="Создаём и сохраняем…";
  try{
    const blobs=await getProgressPhotoBlobs();
    if(!blobs){message.textContent="Сначала добавьте и фото ДО, и фото ПОСЛЕ.";return}

    progressSummary=await getProgressSummary();
    const s=progressSummary;
    const [a,b]=await Promise.all([imageFromBlob(blobs.before),imageFromBlob(blobs.after)]);

    const canvas=document.createElement("canvas");
    canvas.width=1080;canvas.height=1350;
    const ctx=canvas.getContext("2d");
    ctx.fillStyle="#f4f1e8";ctx.fillRect(0,0,1080,1350);

    ctx.fillStyle="#26362d";
    ctx.font="700 54px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign="center";
    ctx.fillText("PROTEIN STUDIO",540,74);

    drawCover(ctx,a.img,0,115,535,900);
    drawCover(ctx,b.img,545,115,535,900);

    ctx.fillStyle="rgba(255,255,255,.90)";
    ctx.fillRect(0,925,535,90);ctx.fillRect(545,925,535,90);
    ctx.fillStyle="#26362d";ctx.font="700 38px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("ДО",267,982);ctx.fillText("ПОСЛЕ",812,982);

    ctx.fillStyle="#fffdf8";ctx.fillRect(0,1015,1080,335);
    ctx.fillStyle="#5f8d66";
    ctx.font="800 54px -apple-system, BlinkMacSystemFont, sans-serif";
    const weightLine=s.weightChange!=null?`${deltaText(s.weightChange," кг")} за ${s.days} дн.`:`${s.days} дн.`;
    ctx.fillText(weightLine,540,1100);

    const detailParts=[];
    if(s.waistChange!=null)detailParts.push("Талия "+deltaText(s.waistChange," см"));
    ctx.fillStyle="#26362d";ctx.font="600 34px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(detailParts.join("   •   ")||"Мой прогресс",540,1160);

    ctx.fillStyle="#26362d";ctx.font="700 40px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(profile?.full_name||"",540,1205);

    ctx.fillStyle="#5f8d66";ctx.font="600 25px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(consultant?.display_name?("Консультант: "+consultant.display_name):"",540,1247);

    ctx.fillStyle="#6f746f";ctx.font="500 20px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("Все результаты индивидуальны и могут различаться.",540,1288);

    ctx.fillStyle="#8a8f89";ctx.font="500 21px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(`${formatShortDate(s.startDate)} → ${formatShortDate(s.latestDate)}`,540,1325);

    URL.revokeObjectURL(a.url);URL.revokeObjectURL(b.url);

    const collageBlob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",0.92));
    if(!collageBlob)throw new Error("Не удалось создать изображение");

    const path=`${me.id}/collages/collage-${Date.now()}.jpg`;
    const upload=await sb.storage.from("ps-progress-photos").upload(path,collageBlob,{contentType:"image/jpeg",cacheControl:"3600"});
    if(upload.error)throw upload.error;

    const saved=await sb.from("ps_progress_collages").insert({
      user_id:me.id,
      storage_path:path,
      from_date:s.startDate,
      to_date:s.latestDate,
      days_count:s.days,
      weight_change_kg:s.weightChange,
      waist_change_cm:s.waistChange,
      hips_change_cm:null
    });
    if(saved.error)throw saved.error;

    message.textContent="Коллаж создан и сохранён в «Мои коллажи» ✓";
    await loadSavedCollages();
  }catch(err){
    console.error(err);
    message.textContent="Не удалось создать коллаж: "+(err?.message||"попробуйте ещё раз");
  }finally{
    btn.disabled=false;btn.textContent="Создать и сохранить коллаж";
  }
}

async function loadSavedCollages(){
  const box=$("savedCollages");
  if(!box)return;
  const {data,error}=await sb.from("ps_progress_collages").select("*").eq("user_id",me.id).order("created_at",{ascending:false});
  if(error){box.innerHTML='<p class="message">Не удалось загрузить коллажи.</p>';return}
  if(!(data||[]).length){box.innerHTML='<p class="muted">Пока сохранённых коллажей нет.</p>';return}

  const items=[];
  for(const row of data){
    const dl=await sb.storage.from("ps-progress-photos").download(row.storage_path);
    if(dl.error)continue;
    const url=URL.createObjectURL(dl.data);
    items.push({row,url});
  }
  box.innerHTML=items.map(({row,url})=>`
    <div class="saved-collage">
      <img src="${url}" alt="Коллаж прогресса">
      <div class="saved-collage-info">
        <b>${row.weight_change_kg!=null?deltaText(row.weight_change_kg," кг"):"Прогресс"} · ${row.days_count||0} дн.</b>
        <small>${formatShortDate(row.from_date)} → ${formatShortDate(row.to_date)}</small>
        <button class="btn ghost share-collage-btn" data-path="${row.storage_path}">Поделиться / сохранить</button>
      </div>
    </div>
  `).join("");
  box.querySelectorAll(".share-collage-btn").forEach(btn=>btn.addEventListener("click",()=>shareSavedCollage(btn.dataset.path)));
}

async function shareSavedCollage(path){
  const dl=await sb.storage.from("ps-progress-photos").download(path);
  if(dl.error)return alert("Не удалось открыть коллаж.");
  const file=new File([dl.data],"protein-studio-progress.jpg",{type:"image/jpeg"});
  if(navigator.share&&navigator.canShare?.({files:[file]})){
    await navigator.share({files:[file],title:"PROTEIN STUDIO — Мой прогресс"});
  }else{
    const url=URL.createObjectURL(dl.data);
    const a=document.createElement("a");a.href=url;a.download="protein-studio-progress.jpg";
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
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

function themePreview(type,label,subtitle,emoji){
  const selected=(document.documentElement.dataset.theme||"classic")===type?" selected":"";
  const photo=(type==="crystal"||type==="flowers")
    ? '<img class="theme-preview-photo" data-theme-photo="'+type+'" src="'+themeBackgroundSrc(type)+'" alt="">'
    : '';
  return '<button type="button" class="theme-choice'+selected+'" data-theme-choice="'+type+'">'+
    '<div class="theme-preview '+type+'">'+photo+'<span>'+emoji+'</span><i></i><i></i><i></i></div>'+
    '<div class="theme-choice-copy"><b>'+label+'</b><small>'+subtitle+'</small></div>'+
    '<div class="theme-check">✓</div>'+
  '</button>';
}
function pageThemes(){
  return '<h2 class="section-title">Оформление</h2>'+
    '<section class="card theme-picker-card">'+
      '<div class="eyebrow">Выберите свой стиль</div>'+
      '<h3>Тема приложения</h3>'+
      '<p class="muted">Нажмите на вариант — всё приложение изменится сразу, без перезагрузки.</p>'+
      '<div class="theme-grid">'+
        themePreview("classic","Классика","Светлый бежево-зелёный wellness","🌿")+
        themePreview("neon","Неон","Тёмный фон и яркое свечение","⚡")+
        themePreview("crystal","Стразы","Перламутр, блеск и кристаллы","💎")+
        themePreview("flowers","Цветы","Нежные цветочные акценты","🌸")+
      '</div>'+
      '<p id="themeSavedMessage" class="message"></p>'+
    '</section>';
}
function bindThemePicker(){
  updateThemeAssets();
  document.querySelectorAll("[data-theme-choice]").forEach(function(btn){
    btn.addEventListener("click",function(){chooseTheme(btn.dataset.themeChoice)});
  });
}
function pageProfile(){const goals=assessment?.goals?.length?assessment.goals.join(", "):(assessment?.primary_goal||"—");return `<h2 class="section-title">Профиль</h2><section class="card"><b>${profile?.full_name||""}</b><p class="muted">Цели: ${goals}<br>Консультант: ${consultant?.display_name||"—"}<br>Профиль-оценка: пройдена ✓</p></section>`}
function soon(name){return `<h2 class="section-title">${name}</h2><section class="card"><b>Раздел уже заложен в структуру.</b><p class="muted">Наполнение добавим следующим этапом без переделки основы приложения.</p></section>`}
const pages={plan:pagePlan,nutrition:pageNutrition,workouts:pageWorkouts,marathon:pageMarathon,progress:pageProgress,achievements:()=>soon("Достижения"),community:()=>soon("Сообщество"),consultant:pageConsultant,notifications:pageNotifications,profile:pageProfile,themes:pageThemes};

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
$("menuBtn").addEventListener("click",()=>toggleDrawer(true));
$("backdrop").addEventListener("click",()=>toggleDrawer(false));
$("logoutBtn").addEventListener("click",logout);
document.querySelectorAll(".nav[data-page]").forEach(b=>b.addEventListener("click",()=>openPage(b.dataset.page)));
$("wellnessNextBtn").addEventListener("click",nextOnboarding);
$("wellnessBackBtn").addEventListener("click",prevOnboarding);

(async()=>{
  if(!initClient())return;
  await loadConsultants();
  const {data}=await sb.auth.getSession();
  if(data.session){me=data.session.user;await bootstrap()}else showScreen("authScreen");
  if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
})();