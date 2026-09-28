let staffConsultants=[];
let adminRows=[];
let adminViewVersion=0;
async function loadStaffAccess(){
 const {data,error}=await sb.from("ps_consultants").select("id,display_name").eq("user_id",me.id).eq("active",true);
 if(error)throw error;
 staffConsultants=data||[];
 const nav=$("adminNav");if(nav)nav.classList.toggle("hidden",!staffConsultants.length);
}
function pageAdmin(){
 if(!staffConsultants.length)return '<section class="card"><h3>Доступ не подключён</h3><p>Панель доступна консультантам.</p></section>';
 return '<section class="card admin-intro"><div class="eyebrow">Рабочий кабинет</div><h1>'+escapeHtml(staffConsultants.map(x=>x.display_name).join(" · "))+'</h1>'+
 '<div class="admin-shortcuts"><button class="btn primary" id="adminChat">Общий чат</button><button class="btn ghost" id="adminClientView">Клиентский экран</button></div></section>'+
 '<section class="card"><div class="row"><h3>Мои клиенты <span id="adminClientCount"></span></h3><button class="admin-small" id="adminRefresh">Обновить</button></div>'+
 '<label for="adminSearch">Поиск по имени или телефону</label><input id="adminSearch" type="search" autocomplete="off">'+
 '<p id="adminStatus" role="status"></p><div id="adminClientList"></div></section><div id="adminClientDetail"></div>';
}
function bindAdmin(){
 const version=++adminViewVersion;
 if(!staffConsultants.length)return;
 $("adminChat").addEventListener("click",()=>openPage("community"));
 $("adminClientView").addEventListener("click",()=>openPage("plan"));
 $("adminRefresh").addEventListener("click",()=>loadAdminClients(version));
 $("adminSearch").addEventListener("input",renderAdminClients);
 $("adminClientList").addEventListener("click",event=>{
  const button=event.target.closest("[data-admin-client]");
  if(button)loadAdminClientDetail(button.dataset.adminClient,version);
 });
 loadAdminClients(version);
}
async function loadAdminClients(version){
 const button=$("adminRefresh"),status=$("adminStatus");if(!button)return;
 button.disabled=true;status.textContent="Загружаем…";
 try{
  let rows=[],offset=0;
  while(true){
   const {data,error}=await sb.from("ps_profiles")
    .select("id,full_name,phone,bio,birth_date,height_cm,onboarding_completed,created_at,consultant_id")
    .in("consultant_id",staffConsultants.map(c=>c.id)).order("created_at",{ascending:false}).order("id").range(offset,offset+199);
   if(error)throw error;rows.push(...data);if(data.length<200)break;offset+=200;
  }
  if(version!==adminViewVersion||!$("adminClientList"))return;
  adminRows=rows;$("adminClientCount").textContent="· "+rows.length;renderAdminClients();status.textContent="";
 }catch{status.textContent="Не удалось загрузить клиентов. Нажмите «Обновить»."}
 finally{button.disabled=false}
}
function renderAdminClients(){
 const box=$("adminClientList");if(!box)return;
 const search=$("adminSearch").value.trim().toLocaleLowerCase("ru");
 const digits=search.replace(/\D/g,"");
 const rows=adminRows.filter(p=>!search||p.full_name.toLocaleLowerCase("ru").includes(search)||(digits&&String(p.phone||"").replace(/\D/g,"").includes(digits)));
 box.innerHTML=rows.length?rows.map(p=>'<button type="button" class="admin-client-row" data-admin-client="'+p.id+'"><span><b>'+escapeHtml(p.full_name)+'</b><span>'+escapeHtml(p.phone||"Телефон не указан")+'</span></span><span class="admin-badge">'+(p.onboarding_completed?"Профиль готов":"Заполняет профиль")+'</span></button>').join(""):'<p>Клиенты не найдены.</p>';
}
async function loadAdminClientDetail(id,version){
 const p=adminRows.find(row=>row.id===id);if(!p)return;
 const box=$("adminClientDetail");box.dataset.client=id;box.innerHTML='<section class="card">Загружаем карточку…</section>';
 try{
  const [assessmentResult,progressResult]=await Promise.all([
   sb.from("ps_assessments").select("goals,primary_goal,starting_weight_kg,waist_cm,target_weight_kg,goal_result_text,height_cm").eq("user_id",id).maybeSingle(),
   sb.from("ps_progress_entries").select("entry_date,weight_kg,waist_cm").eq("user_id",id).order("entry_date",{ascending:false}).limit(30)
  ]);
  if(assessmentResult.error||progressResult.error)throw assessmentResult.error||progressResult.error;
  if(version!==adminViewVersion||!box.isConnected||box.dataset.client!==id)return;
  const a=assessmentResult.data||{},rows=progressResult.data||[];
  const latest=rows[0]||{};
  const show=(v,suffix="")=>v==null?"—":escapeHtml(v)+suffix;
  box.innerHTML='<section class="card admin-detail"><h3>'+escapeHtml(p.full_name)+'</h3>'+
   (p.bio?'<p>'+escapeHtml(p.bio)+'</p>':"")+
   '<div class="admin-detail-line"><span>Телефон</span><b>'+escapeHtml(p.phone||"—")+'</b></div>'+
   '<div class="admin-detail-line"><span>Дата рождения</span><b>'+escapeHtml(p.birth_date?new Date(p.birth_date+"T12:00:00").toLocaleDateString("ru-RU"):"—")+'</b></div>'+
   '<div class="admin-detail-line"><span>Рост</span><b>'+show(p.height_cm??a.height_cm," см")+'</b></div>'+
   '<p><b>Цели</b><br>'+escapeHtml(a.goals?.join(", ")||a.primary_goal||"Пока не выбраны")+'</p>'+
   (a.goal_result_text?'<p>'+escapeHtml(a.goal_result_text)+'</p>':"")+
   '<div class="admin-detail-line"><span>Начальный вес</span><b>'+show(a.starting_weight_kg," кг")+'</b></div>'+
   '<div class="admin-detail-line"><span>Целевой вес</span><b>'+show(a.target_weight_kg," кг")+'</b></div>'+
   '<div class="admin-detail-line"><span>Последний вес</span><b>'+show(latest.weight_kg," кг")+'</b></div>'+
   '<div class="admin-detail-line"><span>Последняя талия</span><b>'+show(latest.waist_cm," см")+'</b></div>'+
   '<h3>Последние замеры</h3>'+
   (rows.length?'<div class="admin-measurements"><table><thead><tr><th>Дата</th><th>Вес, кг</th><th>Талия, см</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+escapeHtml(new Date(r.entry_date+"T12:00:00").toLocaleDateString("ru-RU"))+'</td><td>'+show(r.weight_kg)+'</td><td>'+show(r.waist_cm)+'</td></tr>').join("")+'</tbody></table></div>':'<p>Замеров пока нет.</p>')+'</section>';
  box.scrollIntoView({behavior:"smooth",block:"start"});
 }catch{if(box.isConnected)box.innerHTML='<section class="card"><p>Не удалось открыть карточку. Выберите клиента ещё раз.</p></section>'}
}
