let staffConsultants=[];
let adminRows=[];
let adminViewVersion=0;
async function loadStaffAccess(){
 const {data,error}=await sb.from("ps_consultants").select("id,display_name").eq("user_id",me.id).eq("active",true);
 if(error)throw error;
 staffConsultants=data||[];
 staffNavigation();
}
function pageAdmin(){
 if(!staffConsultants.length)return '<section class="card"><h3>Доступ не подключён</h3><p>Панель доступна консультантам.</p></section>';
 return '<section class="card admin-intro"><div class="eyebrow">Рабочий кабинет</div><h1>'+escapeHtml(staffConsultants.map(x=>x.display_name).join(" · "))+'</h1>'+
 '<div class="admin-shortcuts"><button class="btn primary" id="adminChat">Общий чат</button></div></section>'+

 '<section class="card"><div class="row"><h3>Мои клиенты <span id="adminClientCount"></span></h3><button class="admin-small" id="adminRefresh">Обновить</button></div>'+
 '<label for="adminSearch">Поиск по имени или телефону</label><input id="adminSearch" type="search" autocomplete="off">'+
 '<p id="adminStatus" role="status"></p><div id="adminClientList"></div></section><div id="adminClientDetail"></div>';
}
function bindAdmin(){
 const version=++adminViewVersion;
 if(!staffConsultants.length)return;

 $("adminChat").addEventListener("click",()=>openPage("community"));

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
  const rows=await fetchAdminRows();
  if(version!==adminViewVersion||!$("adminClientList"))return;
  adminRows=rows;$("adminClientCount").textContent="· "+rows.length;renderAdminClients();status.textContent="";
 }catch{status.textContent="Не удалось загрузить клиентов. Нажмите «Обновить»."}
 finally{button.disabled=false}
}
function renderAdminClients(){
 const box=$("adminClientList");if(!box)return;
 const search=$("adminSearch").value.trim().toLocaleLowerCase("ru");
 const digits=search.replace(/\D/g,"");
 const rows=adminRows.filter(p=>!search||(p.full_name||"").toLocaleLowerCase("ru").includes(search)||(digits&&String(p.phone||"").replace(/\D/g,"").includes(digits)));
 box.innerHTML=rows.length?rows.map(p=>'<button type="button" class="admin-client-row" data-admin-client="'+p.id+'"><span><b>'+escapeHtml(p.full_name)+'</b><span>'+escapeHtml(p.phone||"Телефон не указан")+'</span></span><span class="admin-badge">'+(p.onboarding_completed?"Профиль готов":"Заполняет профиль")+'</span></button>').join(""):'<p>Клиенты не найдены.</p>';
}

async function fetchAdminRows(){
  let rows=[],offset=0;
  while(true){
   const {data,error}=await sb.from("ps_profiles")
    .select("id,full_name,phone,bio,birth_date,height_cm,onboarding_completed,created_at,consultant_id")
    .in("consultant_id",staffConsultants.map(c=>c.id)).order("created_at",{ascending:false}).order("id").range(offset,offset+199);
   if(error)throw error;rows.push(...data);if(data.length<200)break;offset+=200;
  }
 return rows.filter(p=>p.id!==me.id);
}
