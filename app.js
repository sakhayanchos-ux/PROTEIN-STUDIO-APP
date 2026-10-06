const CONFIG_KEY="protein_studio_supabase_config";
const LAST_ROUTE_KEY="protein_studio_last_route_v56";
let sb=null,me=null,profile=null,assessment=null,plan=null,consultant=null,selectedGoals=[],progressSummary=null,onboardingStep=1,onboardingDraft={};

const $=id=>document.getElementById(id);
const screens=["authScreen","setupScreen","onboardingScreen","appScreen"];
function showScreen(id){screens.forEach(x=>$(x).classList.toggle("hidden",x!==id))}

const THEME_KEY="protein_studio_theme";
const THEMES={
  jewel:{name:"Стразы",image:"rhinestones.jpg",color:"#fffafc"},
  kpop:{name:"K-pop",image:"theme-kpop.jpg",color:"#f9d5e5"},
  neon:{name:"Неон",image:"theme-neon.jpg",color:"#100c23"},
  sunset:{name:"Закат",image:"theme-sunset.jpg",color:"#e9d8ef"},
  blackgold:{name:"Black Gold",image:"theme-blackgold.svg",color:"#121212"}
};
let selectedTheme="jewel";
try{const saved=localStorage.getItem(THEME_KEY);if(Object.hasOwn(THEMES,saved))selectedTheme=saved}catch{}
function applyTheme(){
  document.documentElement.dataset.theme=selectedTheme;
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.setAttribute("content",THEMES[selectedTheme].color);
  updateThemeAssets();
  document.querySelectorAll("[data-theme-choice]").forEach(button=>{
    const active=button.dataset.themeChoice===selectedTheme;
    button.setAttribute("aria-pressed",String(active));
  });
}
function portionGuideSrc(){return "portion-guide.svg?v=56"}
function updateThemeAssets(){
  const guide=$("portionGuide");if(guide)guide.src=portionGuideSrc();
  const bg=$("themeBgImage");
  if(bg){bg.src=THEMES[selectedTheme].image;bg.classList.add("visible")}
}
document.addEventListener("click",event=>{
  const button=event.target.closest("[data-theme-choice]");
  if(!button||!Object.hasOwn(THEMES,button.dataset.themeChoice))return;
  selectedTheme=button.dataset.themeChoice;
  let saved=true;
  try{localStorage.setItem(THEME_KEY,selectedTheme)}catch{saved=false}
  applyTheme();
  const status=$("themeStatus");
  if(status)status.textContent=saved?"Оформление сохранено на этом устройстве ✓":"Оформление применено. Браузер не разрешил сохранить выбор.";
});

function readConfig(){
  if(window.PROTEIN_STUDIO_CONFIG?.url&&window.PROTEIN_STUDIO_CONFIG?.key)return window.PROTEIN_STUDIO_CONFIG;
  try{return JSON.parse(localStorage.getItem(CONFIG_KEY)||"null")}catch{return null}
}
function initClient(){
  applyTheme();
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
  const {data,error}=await sb.from("ps_consultants").select("id,display_name,referral_code").eq("active",true).order("display_name");
  if(error)return setMessage("Не удалось загрузить консультантов");
  $("regConsultant").innerHTML=(data||[]).map(x=>`<option value="${x.id}">${escapeHtml(x.display_name)}</option>`).join("");
  await applyIncomingRegistration(data||[]);
}
async function registerClient(){
  setMessage("Создаём аккаунт...");
  const full_name=$("regName").value.trim();
  const phone=$("regPhone").value.trim();
  const normalizedPhone=normalizePhone(phone);
  const password=$("regPassword").value;
  const consultant_id=pendingCoachInvitation?null:$("regConsultant").value||null;
  if(!full_name||normalizedPhone.length<12||password.length<6)return setMessage("Заполните имя, телефон и пароль минимум из 6 символов.");

  const technicalEmail=phoneLoginEmail(normalizedPhone);
  const {data,error}=await sb.auth.signUp({
    email:technicalEmail,
    password,
    options:{data:{full_name,phone:normalizedPhone,consultant_id,...(typeof incomingHeart!=="undefined"&&incomingHeart?{heart_token:incomingHeart}: {})}}
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
async function logout(){await detachPushOnLogout();await sb.auth.signOut();location.reload()}
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

    await acceptPendingCoachInvitation();
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
    await loadStaffAccess();
    if(staffConsultants.length){
      const ownMarathon=await sb.rpc("ps_marathon_state");
      personalMarathonAvailable=!ownMarathon.error&&!!ownMarathon.data?.enrollment?.data?.personal;
      staffNavigation();
    }
    if(profile.access_paused&&!staffConsultants.length){
      showScreen("appScreen");
      $("drawer").classList.add("hidden");
      $("content").innerHTML='<section class="card client-paused56"><h2>Доступ приостановлен</h2><p>Ваши данные и прогресс сохранены. Чтобы возобновить доступ, свяжитесь со своим консультантом.</p><button class="btn ghost" id="pausedLogout56">Выйти</button></section>';
      $("pageTitle").textContent="PROTEIN STUDIO";
      $("pausedLogout56").onclick=logout;
      return;
    }
    $("drawer").classList.remove("hidden");
    applyTheme();
    selectedGoals=assessment?.goals?.length?assessment.goals:(assessment?.primary_goal?[assessment.primary_goal]:[]);

    const needsShortWellness=
      !profile.onboarding_completed ||
      !assessment ||
      !assessment.readiness_score ||
      ((selectedGoals.includes("Снижение веса")||selectedGoals.includes("Улучшить фигуру"))&&!assessment.target_weight_kg);

    if(needsShortWellness&&!staffConsultants.length){
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

    const marathon=staffConsultants.length?{error:null}:await sb.rpc("ps_start_marathon");
    if(marathon.error)console.warn("Marathon start:",marathon.error);

    setMessage("");
    showScreen("appScreen");
    $("drawerPerson").textContent=profile.full_name+(consultant?" · "+consultant.display_name:"");
    let savedRoute=null;try{savedRoute=localStorage.getItem(LAST_ROUTE_KEY)}catch{}
    const staffAllowed=["coachPlan","personalMarathon","admin","staffCard","workouts","marathon","topics","achievements","events","training","links","consultants","messages","community","notifications","myQR","profile","story"];
    const clientAllowed=["plan","workouts","marathon","topics","progress","achievements","events","training","links","invitations","story","messages","community","consultant","notifications","profile"];
    const fallback=staffConsultants.length?"coachPlan":"plan";
    const startRoute=(staffConsultants.length?staffAllowed:clientAllowed).includes(savedRoute)?savedRoute:fallback;
    openPage(startRoute);consumePushRoute();
    startJourneyUpdates();
    if(!staffConsultants.length)getJourney().then(showNewReward).catch(()=>{});
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
  stopDirect();stopStaffChat();
  if(page==="consultants"&&!canStaffChat())page="plan";
  document.getElementById("rewardDialog")?.remove();
  if(isStaffWorkspace()&&["plan","nutrition","water","progress","consultant"].includes(page)){if(page==="progress")coachTab="result";page="coachPlan";}
  if(!isStaffWorkspace()&&["admin","staffCard","coachPlan","myQR","personalMarathon"].includes(page))page="plan";
  appRoute=page;
  if(!clientPreview){try{localStorage.setItem(LAST_ROUTE_KEY,page)}catch{}}
  adminViewVersion++;
  stopCommunity();
  toggleDrawer(false);
  document.querySelectorAll(".nav[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  const titles={consultants:"Консультанты",invitations:"Приглашения",story:"Моя история",events:"Мероприятия",training:"Обучение",links:"Полезные ссылки",messages:"Личные сообщения",coachPlan:"Мой план",personalMarathon:"Мой марафон",myQR:"Мои QR-коды",admin:"Клиенты",staffCard:"О себе",topics:"Темы",water:"Вода",plan:"Мой план",nutrition:"Питание",workouts:"Тренировки",marathon:"МАРАФОН",progress:"Прогресс",achievements:"Достижения",community:"Группа поддержки",consultant:"Мой консультант",notifications:"Уведомления",profile:"Профиль"};
  $("pageTitle").textContent=titles[page]||"PROTEIN STUDIO";
  const fn=(isStaffWorkspace()&&["marathon","achievements"].includes(page)?pageStaffCollection:pages[page])||(()=>soon(titles[page]));
  $("content").innerHTML=fn();
  if(!isStaffWorkspace()&&!clientPreview&&["nutrition","water","workouts","topics"].includes(page)){
    const back=document.createElement("button");back.className="btn ghost plan-back58";back.textContent="← Назад в «Мой план»";back.onclick=()=>openPage("plan");$("content").prepend(back);
  }
  if(page==="profile")bindPersonalProfile();
  if(page==="consultant")loadClientConsultantCard();
  if(page==="admin")bindAdmin();
  if(page==="community")bindCommunity();
  if(page==="messages")bindMessages();
  if(page==="consultants")bindStaffChat();
  if(page==="invitations"&&typeof bindInvitations56==="function")bindInvitations56();
  if(page==="story"&&typeof bindStory56==="function")bindStory56();
  if(page==="events"&&typeof bindEvents62==="function")bindEvents62("event");
  if(page==="training"&&typeof bindEvents62==="function")bindEvents62("training");
  if(page==="notifications"){bindNotificationToggles();loadJourneyNotifications();bindPush();}
  if(page==="coachPlan")bindCoachPlan();
  if(page==="myQR")bindMyQR();
  if(page==="staffCard")bindConsultantCardEditor();
  if(page==="topics")loadTopics();
  if(page==="personalMarathon")loadMarathonTracker();
  else if(page==="marathon"&&typeof loadCommonMarathon75==="function")loadCommonMarathon75();
  else if(isStaffWorkspace()&&page==="achievements")loadStaffCollection(page);
  else if(page==="marathon")loadMarathonTracker();
  else if(page==="achievements")loadAchievements();
  if(page==="progress")bindProgressPhotoActions();
  if(page==="plan"){loadPlanProgress();if(typeof bindWaterQuick56==="function")bindWaterQuick56();}
  if(page==="nutrition"||page==="water"){loadNutritionTargets();if(page==="water")$("waterTargetTitle")?.closest("section")?.scrollIntoView({block:"start"})}
  if(page==="workouts"){loadWorkoutLibrary()}
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
  '<div id="programEstimate"></div>'+
  '<section class="card">'+
    '<h3 class="photo-title">План на день</h3>'+
    planActionCard("🥗","Питание","Утром: Алоэ + Травяной напиток + коктейль. Днём: белковые перекусы и правильная тарелка. Вечером: белок + овощи без гарнира.","Белковая цель рассчитывается по текущему весу.","nutrition")+
    planActionCard("🏋🏻‍♀️","Движение",(assessment?.minutes_available||10)+" минут · "+(assessment?.training_place||"Дома")+". Начинаем с уровня, который можно повторять регулярно.","Нагрузка растёт постепенно по мере прогресса.","workouts")+
    planActionCard("💧","Вода","Суточная цель рассчитывается по текущему весу. Алоэ можно включить в водный ритуал по инструкции продукта.","CR7 Drive — спортивный напиток при подходящей нагрузке, не вместо всей воды.","water")+
    planActionCard("🔥","30 дней","Каждый день открывается новая тема. Выполняйте задания и собирайте звёзды. Следующие дни пока закрыты 🔒.","","marathon")+
    '<div id="planDailyTargets" class="daily-targets"><span>Белок: считаем…</span><span>Вода: считаем…</span></div>'+
  '</section>'+
  '<div id="waterQuick56"></div>'+
  '<section class="card"><h3>Важно</h3><p>Если по расчёту не хватает белка, можно использовать Протеиновую смесь Формула 3 в количестве, соответствующем вашей дневной потребности и инструкции продукта.</p><p>При увеличении количества белка следите, чтобы в рационе также хватало жидкости и клетчатки.</p></section>'+
  '<p class="plan-health-note">План носит информационный характер. Индивидуальные рекомендации зависят от целей, состояния здоровья и рекомендаций специалиста.</p>';
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
    const estimate=$("programEstimate");if(estimate)estimate.innerHTML=programHtml(s.startWeight,target);
    const start=s.startWeight;
    const current=s.latestWeight;
    const startWaist=s.startWaist;
    const currentWaist=s.latestWaist;

    if(target!=null&&start!=null&&current!=null&&start!==target){
      const total=Math.abs(start-target);
      const towardGoal=target<start ? (start-current) : (current-start);
      const done=Math.max(0,Math.min(total,towardGoal));
      const percent=Math.max(0,Math.min(100,Math.round((done/total)*100)));
      const remaining=Math.max(0,target<start?current-target:target-current);
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
    '<div class="meal-copy"><b>'+title+'</b><span>'+text+'</span>'+''+'</div>'+
  '</div>';
}

function menuSuggestion(name,protein,note){
  return '<div class="menu-suggestion"><div><b>'+name+'</b></div><span>'+protein+' г белка</span></div>';
}
function proteinMenuUrl(){
  const raw=consultant?.referral_code||"";
  const ref=raw==="SAKHAYANA"?"SS":raw;
  const url=new URL("https://sakhayanchos-ux.github.io/PROTEIN-STUDIO-MENU/");
  if(ref)url.searchParams.set("ref",ref);
  return url.href;
}

function pageNutrition(){
  return ''+
  '<section class="card nutrition-hero">'+
    '<div class="eyebrow">Ваш персональный план</div>'+
    '<h3>Питание на каждый день</h3>'+
    '<p class="muted">База: структурированный завтрак, белковые перекусы, правильная тарелка в обед и понятный ужин.</p>'+
    '<div id="nutritionTargetBox" class="nutrition-target-box"><span>Считаем белок…</span><span>Считаем воду…</span></div>'+
  '</section>'+

  '<section class="card">'+
    '<h3>Как выглядит день</h3>'+
    mealStep("Утро","Алоэ + Травяной напиток + коктейль","Сначала Растительный напиток Алоэ, затем Травяной напиток и протеиновый коктейль. Ягоды или фрукт можно добавить утром. Если по дневному расчёту не хватает белка — добавьте дополнительный белковый компонент, например Протеиновую смесь Формула 3 или другой согласованный с консультантом вариант.","Базовый минимум клуба: Алоэ + чай + коктейль. Дополнительный белок — только если его нужно добрать до вашей дневной цели.")+
    mealStep("Перекус","Утренний перекус","Фрукт + белковый вариант: яйцо, Protein Bites, протеиновый батончик, Formula 1 Express или другой подходящий белковый продукт.","") +
    mealStep("Обед","Правильная тарелка","Половина тарелки — овощи/салат, четверть — источник белка, четверть — гарнир.","Если нет весов, используйте ориентир по ладони ниже.")+
    '<img id="portionGuide" class="portion-guide" src="'+portionGuideSrc()+'" alt="Правильная тарелка и ориентир порций по руке">'+
    mealStep("Перекус","Белковый перекус","Если между обедом и ужином большой промежуток — используйте белковый перекус из меню клуба или обычную белковую еду.","")+
    mealStep("Ужин","Белок + овощи, без гарнира","Вариант 1 — протеиновый коктейль. Вариант 2 — мясо, рыба, яйца или другой белковый продукт + овощи/салат. Гарнир вечером в этом плане не используем.","Сохраняем ужин простым: белок + овощи или коктейль.")+
  '</section>'+

  '<section class="card">'+
    '<h3>Белок</h3>'+
    '<div id="proteinTargetDetail" class="target-detail"><p class="muted">Считаем по вашей цели…</p></div>'+
    '<div class="menu-suggestions">'+
      menuSuggestion("Протеиновый коктейль","10","из текущего меню PROTEIN STUDIO")+
      menuSuggestion("Кофе с протеином","15","удобный белковый напиток")+
      menuSuggestion("Protein Bites · 1 шт.","4","")+
      menuSuggestion("Протеиновые чипсы","11–12","несладкий перекус")+
      menuSuggestion("Formula 1 Express","14–16","порционный перекус")+
      menuSuggestion("H24 Achieve","21","спортивный высокобелковый батончик")+
    '</div>'+
    '<a class="btn ghost app-link" href="'+proteinMenuUrl()+'" target="_blank" rel="noopener">Открыть меню PROTEIN STUDIO</a>'+
    '<div class="hydration-note"><b>Протеиновая смесь Формула 3</b><span>Если по расчёту не хватает белка, добавьте её в количестве, соответствующем вашей дневной потребности и инструкции продукта.</span></div>'+
    '<div class="hydration-note"><b>Важно</b><span>При увеличении количества белка следите, чтобы также хватало жидкости и клетчатки.</span></div>'+
  '</section>'+

  '<section class="card">'+
    '<div class="eyebrow">Водный баланс</div><h3 id="waterTargetTitle">Ваш ориентир</h3>'+
    '<p id="waterTargetText" class="muted">Считаем по текущему весу…</p>'+
    '<div class="hydration-note"><b>🌿 Алоэ</b><span>Можно включить в водный ритуал: Растительный напиток Алоэ в российских материалах Herbalife используется для поддержки водного баланса и пищеварения.</span></div>'+
    '<div class="hydration-note"><b>⚡ CR7 Drive</b><span>Гипотонический спортивный напиток с электролитами для восполнения водного баланса до и после физической нагрузки. Используйте согласно инструкции продукта.</span></div>'+
  '</section>'+

  '<p class="plan-health-note">Ориентиры индивидуальны и не заменяют рекомендации врача. При заболеваниях почек/сердца, ограничении жидкости и беременности согласуйте план с врачом.</p>';
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
        const basis='Рассчитано по текущему весу';
        pd.innerHTML='<div class="big-target">'+t.proteinMin+'–'+t.proteinMax+' г <small>белка в сутки</small></div>'+
          '<p class="muted">'+basis+'</p>';
      }else{
        pd.innerHTML='<p class="muted">Для вашей цели пока используем простое правило: добавляйте источник белка в каждый основной приём пищи. Точный диапазон консультант сможет настроить отдельно.</p>';
      }
    }

    const wt=$("waterTargetTitle"),wp=$("waterTargetText");
    if(wt&&t.waterLiters)wt.textContent='Около '+ruNumber(t.waterLiters)+' л жидкости в сутки';
    if(wp&&t.waterLiters)wp.textContent='';
  }catch(err){
    console.error(err);
  }
}

function pageWorkouts(){return workoutLibraryHtml()+(isStaffWorkspace()?workoutEditorHtml():'<p class="plan-health-note">При боли в груди, выраженной одышке или головокружении остановитесь. При хронических заболеваниях согласуйте нагрузку с врачом.</p>')}

function formatShortDate(value){
  if(!value)return "";
  const [y,m,d]=String(value).split("-");
  return `${d}.${m}`;
}

function escapeHtml(v){
  return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}

function pageProgress(){
  return `

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
    <div class="progress-start58">
      <span>Начало пути</span>
      <b id="progressStartInfo58">Загружаем…</b>
      <label>Дата начала<input id="progressStartDate58" type="date" min="2000-01-01" max="${profileToday()}"></label>
      <button class="btn ghost" id="saveProgressStart58">Сохранить дату начала</button>
      <p id="progressStartMessage58" class="message"></p>
    </div>
    <button class="btn ghost" id="toggleMeasurementBtn">+ Добавить замер</button>
    <div id="measurementForm" class="measurement-form hidden">
      <div class="two-col">
        <label>Вес, кг<input id="measureWeight" type="number" min="25" max="400" step="0.1" inputmode="decimal"></label>
        <label>Талия, см<input id="measureWaist" type="number" min="30" max="250" step="0.1" inputmode="decimal"></label>
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
  $("saveProgressStart58")?.addEventListener("click",saveProgressStart58);

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
  if((values.p_weight_kg!==null&&(values.p_weight_kg<25||values.p_weight_kg>400))||(values.p_waist_cm!==null&&(values.p_waist_cm<30||values.p_waist_cm>250))){message.textContent="Проверьте вес и талию.";return;}
  btn.disabled=true;btn.textContent="Сохраняем…";
  const {error}=await sb.rpc("ps_save_progress",values);
  if(error){
    message.textContent="Не удалось сохранить: "+error.message;
  }else{
    message.textContent="Сегодняшний замер сохранён ✓";
    await loadProgressStats();
    if($("coachWeightRoute"))await refreshCoachResult();
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

  const fallbackDates=[(assessment?.completed_at||"").slice(0,10),plan?.start_date,rows[0]?.entry_date].filter(Boolean).sort();
  const startDate=assessment?.progress_start_date || fallbackDates[0] || null;
  const last=rows.length?rows[rows.length-1]:null;
  const lastWeight=[...rows].reverse().find(r=>r.weight_kg!=null);
  const lastWaist=[...rows].reverse().find(r=>r.waist_cm!=null);
  const latestMeasurementDate=last?.entry_date||startDate;
  const latestDate=profileToday();

  const startWeight=assessment?.starting_weight_kg!=null?Number(assessment.starting_weight_kg):null;
  const startWaist=assessment?.waist_cm!=null?Number(assessment.waist_cm):null;
  const latestWeight=lastWeight?.weight_kg!=null?Number(lastWeight.weight_kg):startWeight;
  const latestWaist=lastWaist?.waist_cm!=null?Number(lastWaist.waist_cm):startWaist;

  return {
    startDate,latestDate,latestMeasurementDate,
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
    const startInfo=$("progressStartInfo58"),startDateInput=$("progressStartDate58");
    if(startInfo)startInfo.textContent=(s.startDate?dateLabel(s.startDate):"Дата не указана")+" · "+(s.startWeight!=null?ruNumber(s.startWeight)+" кг":"вес не указан")+(s.startWaist!=null?" · талия "+ruNumber(s.startWaist)+" см":"");
    if(startDateInput)startDateInput.value=s.startDate||"";
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

async function saveProgressStart58(){
  const input=$("progressStartDate58"),msg=$("progressStartMessage58"),btn=$("saveProgressStart58");
  const value=input?.value||null;if(!value){msg.textContent="Укажите дату начала.";return}
  btn.disabled=true;msg.textContent="Сохраняем…";
  try{
    const {data,error}=await sb.from("ps_assessments").update({progress_start_date:value,updated_at:new Date().toISOString()}).eq("user_id",me.id).select("*").single();
    if(error)throw error;assessment=data;msg.textContent="Дата начала сохранена ✓";await loadProgressStats();if($("coachGraphs"))await refreshCoachResult();
  }catch(e){msg.textContent="Не удалось сохранить дату. Попробуйте снова."}
  finally{btn.disabled=false}
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
    const editBtn=$(row.kind==="before"?"beforePhotoBtn":"afterPhotoBtn");if(editBtn)editBtn.textContent=row.kind==="before"?"Изменить фото ДО":"Изменить фото ПОСЛЕ";
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
    if(s.startWeight!=null&&s.latestWeight!=null)detailParts.push("Вес "+ruNumber(s.startWeight)+" → "+ruNumber(s.latestWeight)+" кг");
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
      <button class="saved-collage-delete" type="button" aria-label="Удалить результат" data-collage-id="${row.id}" data-path="${row.storage_path}">×</button>
      <img src="${url}" alt="Коллаж прогресса">
      <div class="saved-collage-info">
        <b>${row.weight_change_kg!=null?deltaText(row.weight_change_kg," кг"):"Прогресс"} · ${row.days_count||0} дн.</b>
        <small>${formatShortDate(row.from_date)} → ${formatShortDate(row.to_date)}</small>
        <button class="btn ghost share-collage-btn" data-path="${row.storage_path}">Поделиться / сохранить</button>
      </div>
    </div>
  `).join("");
  box.querySelectorAll(".share-collage-btn").forEach(btn=>btn.addEventListener("click",()=>shareSavedCollage(btn.dataset.path)));
  box.querySelectorAll(".saved-collage-delete").forEach(btn=>btn.addEventListener("click",()=>deleteSavedCollage(btn.dataset.collageId,btn.dataset.path,btn)));
}

async function deleteSavedCollage(id,path,button){
  if(!confirm("Удалить этот результат из истории?"))return;
  button.disabled=true;
  try{
    const del=await sb.from("ps_progress_collages").delete().eq("id",id).eq("user_id",me.id);
    if(del.error)throw del.error;
    const rm=await sb.storage.from("ps-progress-photos").remove([path]);
    if(rm.error)console.warn("Collage storage cleanup:",rm.error);
    await loadSavedCollages();
  }catch(e){
    button.disabled=false;
    alert("Не удалось удалить результат. Попробуйте ещё раз.");
  }
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

function pageConsultant(){return '<div id="clientConsultantCard"><section class="card">Загружаем карточку…</section></div>'}
function pageUsefulLinks(){return '<section class="card useful-links62"><div class="eyebrow">Официальные ресурсы</div><h1>Полезные ссылки</h1><a class="btn primary" href="https://www.herbalife.ru/" target="_blank" rel="noopener">Herbalife.ru · Официальный сайт</a><p class="muted">Информация о компании и продуктах.</p><a class="btn ghost" href="https://www.myherbalife.com/" target="_blank" rel="noopener">MyHerbalife.com · Мой кабинет</a><p class="muted"><b>Заказы · регистрация · доход</b></p></section>'}
function pageNotifications(){
  if(isStaffWorkspace())return pushMarkup()+'<section class="card"><h3>События клиентов</h3><div id="journeyNotifications">Загружаем…</div></section>';
  return pushMarkup()+`<section class="card"><div id="journeyNotifications">Загружаем…</div></section><section class="card">
  ${toggle("notifWater","💧 Вода")}
  ${toggle("notifNutrition","🥗 Питание")}
  ${toggle("notifWorkouts","🏋🏻‍♀️ Тренировки")}
  ${toggle("notifMarathon","🔥 Марафон")}
  ${toggle("notifMeasurements","📈 Замеры")}
  ${toggle("notifConsultant","💬 Консультант")}
  </section><section class="card" id="waterReminder56"></section>`;
}
function toggle(id,label){return `<div class="toggle-row"><b>${label}</b><input id="${id}" type="checkbox" checked></div>`}
async function bindNotificationToggles(){
  if(isStaffWorkspace())return;
  const q=await sb.from("ps_notification_settings").select("*").eq("user_id",me.id).maybeSingle();
  const d=q.data||{};
  const map={notifWater:"water",notifNutrition:"nutrition",notifWorkouts:"workouts",notifMarathon:"marathon",notifMeasurements:"measurements",notifConsultant:"consultant_messages"};
  for(const [id,key] of Object.entries(map)){
    if($(id))$(id).checked=d[key]!==false;
    $(id)?.addEventListener("change",async e=>{await sb.from("ps_notification_settings").upsert({user_id:me.id,[key]:e.target.checked,updated_at:new Date().toISOString()})});
  }
  if(typeof bindWaterReminderSettings56==="function")bindWaterReminderSettings56();
}


let profileAvatarURL=null;
function profileToday(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")}
function pageProfile(){
  const name=profile?.full_name||"Мой профиль";
  const initials=name.trim().split(/\s+/).slice(0,2).map(x=>Array.from(x)[0]||"").join("");
  return `<section class="card profile-hero">
  <div class="profile-avatar" id="profileAvatar" aria-label="Фото профиля">${escapeHtml(initials)}</div>
  <h1 id="profileDisplayName">${escapeHtml(name)}</h1>${profile?.ambassador_at?'<div class="ambassador56">🎉 Амбассадор PROTEIN STUDIO</div>':''}
  <p id="profileDisplayBio" class="profile-bio">${escapeHtml(profile?.bio||"")}</p>
  <div class="profile-photo-actions"><button type="button" class="btn ghost" id="profilePhotoBtn">Изменить фото</button><button type="button" class="btn ghost" id="removeProfilePhotoBtn" ${profile?.avatar_path?"":"hidden"}>Убрать фото</button></div>
  <input class="hidden" id="profilePhotoInput" type="file" accept="image/jpeg,image/png,image/webp">
  <p id="avatarMessage" class="profile-status" role="status"></p></section>
  <section class="card"><h3>Личные данные</h3>
  <form id="personalForm">
  <label for="personalName">Имя и фамилия</label><input id="personalName" required maxlength="100" autocomplete="name" value="${escapeHtml(name)}">
  <label for="personalBio">О себе</label><textarea id="personalBio" maxlength="160" rows="2">${escapeHtml(profile?.bio||"")}</textarea>
  <label for="personalPhone">Телефон для связи</label><input id="personalPhone" type="tel" inputmode="tel" autocomplete="tel" value="${escapeHtml(profile?.phone||"")}">
  <div class="profile-fields"><div><label for="personalBirthday">Дата рождения</label><input id="personalBirthday" type="date" min="1900-01-01" max="${profileToday()}" value="${escapeHtml(profile?.birth_date||"")}"></div>
  <div><label for="personalHeight">Рост, см</label><input id="personalHeight" type="number" inputmode="decimal" min="50" max="250" step="0.1" value="${escapeHtml(profile?.height_cm??"")}"></div></div>
  <button class="btn primary" id="savePersonalBtn">Сохранить</button><p class="profile-status" id="personalMessage" role="status"></p>
  </form></section>
  <section class="card profile-discount62"><h3>Моя скидка / статус</h3><div class="fact-grid"><div><span>Скидка</span><b>${escapeHtml(profile?.discount_level?profile.discount_level+"%":"Не назначена")}</b></div><div><span>Статус</span><b>${escapeHtml(profile?.member_status||"—")}</b></div></div><p class="muted">Скидку назначает ваш консультант.</p></section>
  <section class="card theme-settings"><h3>Оформление</h3>
  <div class="theme-options">${Object.entries(THEMES).map(([id,theme])=>`<button type="button" class="theme-choice" data-theme-choice="${id}" aria-pressed="${selectedTheme===id}"><span class="theme-preview theme-preview-${id}" style="background-image:url('${theme.image}')"></span><span>${theme.name}</span><span class="theme-check" aria-hidden="true">✓</span></button>`).join("")}</div>
  <p class="profile-status" id="themeStatus" role="status"></p></section>
  <section class="card profile-account"><h3>Аккаунт</h3>
  <div class="profile-login"><span>Номер для входа</span><b>${escapeHtml(me?.email?.match(/^phone\.([0-9]+)@/)?.[1]? "+"+me.email.match(/^phone\.([0-9]+)@/)[1] : me?.phone||me?.email||"")}</b></div>
  <details><summary>Изменить пароль</summary><form id="profilePasswordForm">
  <label for="profileCurrentPassword">Текущий пароль</label><input id="profileCurrentPassword" type="password" autocomplete="current-password" required>
  <label for="profileNewPassword">Новый пароль</label><input id="profileNewPassword" type="password" autocomplete="new-password" minlength="8" required>
  <label for="profileConfirmPassword">Повторите новый пароль</label><input id="profileConfirmPassword" type="password" autocomplete="new-password" minlength="8" required>
  <button class="btn primary" id="savePasswordBtn">Сохранить пароль</button><p class="profile-status" id="passwordMessage" role="status"></p>
  </form></details><button type="button" class="btn ghost" id="profileLogoutBtn">Выйти из аккаунта</button></section>`;
}
function bindPersonalProfile(){
  $("personalForm").addEventListener("submit",savePersonalProfile);
  $("profilePasswordForm").addEventListener("submit",changeProfilePassword);
  $("profilePhotoBtn").addEventListener("click",()=>$("profilePhotoInput").click());
  $("profilePhotoInput").addEventListener("change",e=>saveProfileAvatar(e.target.files?.[0]));
  $("removeProfilePhotoBtn").addEventListener("click",()=>saveProfileAvatar(null,true));
  $("profileLogoutBtn").addEventListener("click",async()=>{
    const btn=$("profileLogoutBtn");btn.disabled=true;
    clearInterval(journeyTimer);
    await detachPushOnLogout();const {error}=await sb.auth.signOut();
    if(error){btn.disabled=false;btn.textContent="Не удалось выйти. Повторить";return}
    if(profileAvatarURL)URL.revokeObjectURL(profileAvatarURL);
    location.reload();
  });
  loadProfileAvatar();
}
async function savePersonalProfile(event){
  event.preventDefault();
  const btn=$("savePersonalBtn"),message=$("personalMessage");
  const full_name=$("personalName").value.trim(),bio=$("personalBio").value.trim();
  const rawPhone=$("personalPhone").value.trim(),phone=rawPhone?normalizePhone(rawPhone):null;
  const birth_date=$("personalBirthday").value||null;
  const height_cm=$("personalHeight").value===""?null:Number($("personalHeight").value);
  if(!full_name||full_name.length>100){message.textContent="Введите имя и фамилию.";return}
  if(rawPhone&&!/^\+7\d{10}$/.test(phone)){message.textContent="Введите телефон в формате +7 999 000-00-00.";return}
  if(birth_date&&(birth_date<"1900-01-01"||birth_date>profileToday())){message.textContent="Проверьте дату рождения.";return}
  if(height_cm!==null&&(!Number.isFinite(height_cm)||height_cm<50||height_cm>250)){message.textContent="Рост должен быть от 50 до 250 см.";return}
  btn.disabled=true;message.textContent="Сохраняем…";
  try{
    const {data,error}=await sb.from("ps_profiles").update({full_name,bio,phone,birth_date,height_cm,updated_at:new Date().toISOString()}).eq("id",me.id).select("*").single();
    if(error||!data)throw error||new Error("Профиль не найден");
    profile=data;
    if($("profileDisplayName"))$("profileDisplayName").textContent=profile.full_name;
    if($("profileDisplayBio"))$("profileDisplayBio").textContent=profile.bio||"";
    if(!profile.avatar_path)await loadProfileAvatar();
    $("drawerPerson").textContent=profile.full_name+(consultant?" · "+consultant.display_name:"");
    message.textContent="Сохранено ✓";
  }catch{message.textContent="Не удалось сохранить. Проверьте интернет и попробуйте снова."}
  finally{btn.disabled=false}
}
async function loadProfileAvatar(){
  const frame=$("profileAvatar"),path=profile?.avatar_path,uid=me?.id;
  if(!frame)return;
  if(profileAvatarURL){URL.revokeObjectURL(profileAvatarURL);profileAvatarURL=null}
  if(!path){frame.textContent=(profile?.full_name||"").trim().split(/\s+/).slice(0,2).map(x=>Array.from(x)[0]||"").join("");return}
  if(!path.startsWith(uid+"/"))return;
  const {data,error}=await sb.storage.from("ps-progress-photos").download(path);
  if(error||!data||!frame.isConnected||me?.id!==uid)return;
  profileAvatarURL=URL.createObjectURL(data);
  const img=document.createElement("img");img.src=profileAvatarURL;img.alt="Фото профиля";frame.replaceChildren(img);
}
async function saveProfileAvatar(file,remove=false){
  if(!remove&&!file)return;
  const message=$("avatarMessage"),btn=$("profilePhotoBtn"),removeBtn=$("removeProfilePhotoBtn");
  if(file&&(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>10*1024*1024)){message.textContent="Выберите JPG, PNG или WEBP до 10 МБ.";return}
  btn.disabled=true;removeBtn.disabled=true;message.textContent="Сохраняем…";
  const uid=me.id,oldPath=profile.avatar_path;let newPath=null,committed=false;
  try{
    if(file){
      newPath=uid+"/avatar-"+crypto.randomUUID()+"."+({ "image/jpeg":"jpg","image/png":"png","image/webp":"webp"}[file.type]);
      const upload=await sb.storage.from("ps-progress-photos").upload(newPath,file,{contentType:file.type});
      if(upload.error)throw upload.error;
    }
    const {data,error}=await sb.from("ps_profiles").update({avatar_path:newPath,updated_at:new Date().toISOString()}).eq("id",uid).select("*").single();
    if(error||!data)throw error||new Error("Не сохранено");
    committed=true;profile=data;
    if(oldPath?.startsWith(uid+"/avatar-"))await sb.storage.from("ps-progress-photos").remove([oldPath]);
    await loadProfileAvatar();removeBtn.hidden=!newPath;message.textContent=remove?"Фото удалено":"Фото сохранено ✓";
  }catch{
    if(newPath&&!committed)await sb.storage.from("ps-progress-photos").remove([newPath]);
    message.textContent="Не удалось сохранить фото. Попробуйте снова.";
  }finally{btn.disabled=false;removeBtn.disabled=false;if($("profilePhotoInput"))$("profilePhotoInput").value=""}
}
async function changeProfilePassword(event){
  event.preventDefault();
  const form=$("profilePasswordForm"),message=$("passwordMessage"),btn=$("savePasswordBtn");
  const current=$("profileCurrentPassword").value,password=$("profileNewPassword").value,confirm=$("profileConfirmPassword").value;
  if(password.length<8){message.textContent="Новый пароль — минимум 8 символов.";return}
  if(password!==confirm){message.textContent="Новые пароли не совпадают.";return}
  if(password===current){message.textContent="Выберите другой пароль.";return}
  btn.disabled=true;message.textContent="Сохраняем…";
  try{
    const uid=me.id;
    const verified=await sb.auth.signInWithPassword({... (me.email?{email:me.email}:{phone:me.phone}),password:current});
    if(verified.error||verified.data.user?.id!==uid){message.textContent="Проверьте текущий пароль.";return}
    const {error}=await sb.auth.updateUser({password});
    if(error){message.textContent=/weak|short|length/i.test(error.message)?"Выберите более сложный пароль.":"Не удалось изменить пароль. Войдите заново и повторите.";return}
    form.reset();message.textContent="Пароль изменён ✓";
  }catch{message.textContent="Нет связи. Попробуйте снова."}
  finally{btn.disabled=false}
}

function soon(name){return `<section class="card"><b>Раздел уже заложен в структуру.</b><p class="muted">Наполнение добавим следующим этапом без переделки основы приложения.</p></section>`}
const pages={consultants:pageStaffChat,messages:pageMessages,coachPlan:coachPlan,personalMarathon:journeyShell,myQR:pageMyQR,admin:pageAdmin,staffCard:consultantCardForm,topics:journeyShell,water:pageNutrition,plan:pagePlan,nutrition:pageNutrition,workouts:pageWorkouts,marathon:journeyShell,progress:pageProgress,achievements:journeyShell,events:()=>pageEvents62("event"),training:()=>pageEvents62("training"),links:pageUsefulLinks,community:pageCommunity,consultant:pageConsultant,notifications:pageNotifications,profile:pageProfile};

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
$("clientPreviewNav").addEventListener("click",enterClientPreview);
$("returnCoachBtn").addEventListener("click",exitClientPreview);
$("clearInvitationBtn").addEventListener("click",clearIncomingInvitation);
$("menuBtn").addEventListener("click",()=>toggleDrawer(true));
$("backdrop").addEventListener("click",()=>toggleDrawer(false));
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


