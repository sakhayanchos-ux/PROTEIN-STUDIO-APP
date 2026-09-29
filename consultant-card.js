
function consultantCardForm(){
 return '<section class="card consultant-editor"><h3>Моя карточка консультанта</h3>'+
 '<label for="consultantCardSelect">Карточка</label><select id="consultantCardSelect">'+staffConsultants.map(c=>'<option value="'+c.id+'">'+escapeHtml(c.display_name)+'</option>').join("")+'</select>'+
 '<form id="consultantCardForm"><fieldset id="consultantCardFields" disabled>'+
 '<div class="profile-avatar" id="consultantEditorPhoto">♡</div>'+
 '<label for="consultantCardPhoto">Фото</label><input id="consultantCardPhoto" type="file" accept="image/jpeg,image/png,image/webp">'+
 '<label class="consultant-remove-photo"><input id="consultantRemovePhoto" type="checkbox"> Убрать фото</label>'+
 '<label for="consultantNameInput">Имя и фамилия</label><input id="consultantNameInput" required maxlength="100">'+
 '<label for="consultantBioInput">О себе</label><textarea id="consultantBioInput" rows="4" maxlength="1200"></textarea>'+
 '<label for="consultantPhoneInput">Телефон</label><input id="consultantPhoneInput" type="tel" inputmode="tel">'+
 '<label for="consultantWhatsappInput">WhatsApp</label><input id="consultantWhatsappInput" type="tel" inputmode="tel">'+
 '<label for="consultantHoursInput">Время для связи</label><input id="consultantHoursInput" maxlength="160">'+
 '<label for="consultantClubInput">Название клуба</label><input id="consultantClubInput" maxlength="160">'+
 '<label for="consultantAddressInput">Адрес клуба</label><input id="consultantAddressInput" maxlength="300">'+
 '<label for="consultantClubHoursInput">Часы работы клуба</label><input id="consultantClubHoursInput" maxlength="160">'+
 '<button class="btn primary" id="consultantCardSave">Сохранить карточку</button></fieldset></form>'+
 '<p id="consultantCardStatus" class="profile-status" role="status"></p><button id="consultantCardReload" type="button" class="btn ghost">Обновить карточку</button></section>';
}
const CONSULTANT_INPUTS={display_name:"consultantNameInput",bio:"consultantBioInput",contact_phone:"consultantPhoneInput",whatsapp_phone:"consultantWhatsappInput",contact_hours:"consultantHoursInput",club_name:"consultantClubInput",club_address:"consultantAddressInput",club_hours:"consultantClubHoursInput"};
function cardPhone(value){if(!value?.trim())return null;const normalized=normalizePhone(value);if(!/^\+7\d{10}$/.test(normalized))throw new Error("Введите телефон в формате +7 999 000-00-00.");return normalized}
async function showConsultantPhoto(frame,path,name){
 if(!frame)return;
 frame.textContent=(name||"♡").trim().split(/\s+/).slice(0,2).map(x=>Array.from(x)[0]||"").join("");
 frame.dataset.photo=path||"";
 if(!path)return;
 try{
  const {data,error}=await sb.storage.from("ps-consultant-cards").createSignedUrl(path,3600);
  if(error||!data?.signedUrl||!frame.isConnected||frame.dataset.photo!==path)return;
  const img=document.createElement("img");img.alt="Фото консультанта";img.src=data.signedUrl;frame.replaceChildren(img);
 }catch{}
}
function bindConsultantCardEditor(){
 const form=$("consultantCardForm");if(!form)return;
 let current=null,revision=0;
 const select=$("consultantCardSelect"),fields=$("consultantCardFields"),status=$("consultantCardStatus");
 if(staffConsultants.length===1){select.hidden=true;document.querySelector('label[for="consultantCardSelect"]').hidden=true}
 async function read(){
  const run=++revision;fields.disabled=true;status.textContent="Загружаем…";current=null;
  try{
   const {data,error}=await sb.from("ps_consultants").select("*").eq("id",select.value).eq("user_id",me.id).eq("active",true).single();
   if(error)throw error;if(run!==revision||!form.isConnected)return;
   current=data;
   for(const [key,id] of Object.entries(CONSULTANT_INPUTS))$(id).value=data[key]||"";
   $("consultantCardPhoto").value="";$("consultantRemovePhoto").checked=false;
   showConsultantPhoto($("consultantEditorPhoto"),data.avatar_path,data.display_name);
   fields.disabled=false;status.textContent="";
  }catch{if(form.isConnected)status.textContent="Не удалось загрузить карточку. Нажмите «Обновить карточку»."}
 }
 select.addEventListener("change",read);
 $("consultantCardReload").addEventListener("click",read);
 form.addEventListener("submit",async event=>{
  event.preventDefault();if(!current)return;
  const uid=me.id,id=current.id,oldPhoto=current.avatar_path;
  let newPhoto=null,saved=false;
  try{
   const update={};
   for(const [key,input] of Object.entries(CONSULTANT_INPUTS))update[key]=$(input).value.trim()||null;
   if(!update.display_name)throw new Error("Введите имя и фамилию.");
   update.contact_phone=cardPhone(update.contact_phone);update.whatsapp_phone=cardPhone(update.whatsapp_phone);
   const file=$("consultantCardPhoto").files?.[0],remove=$("consultantRemovePhoto").checked;
   if(file&&remove)throw new Error("Выберите новое фото или отметьте «Убрать фото».");
   if(file&&(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>10485760))throw new Error("Фото — JPG, PNG или WEBP до 10 МБ.");
   fields.disabled=true;select.disabled=true;$("consultantCardReload").disabled=true;status.textContent="Сохраняем…";
   update.avatar_path=remove?null:oldPhoto;
   if(file){
    const ext={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"}[file.type];
    newPhoto=uid+"/"+id+"/"+crypto.randomUUID()+"."+ext;
    const upload=await sb.storage.from("ps-consultant-cards").upload(newPhoto,file,{contentType:file.type});
    if(upload.error)throw new Error("Не удалось загрузить фото. Попробуйте снова.");
    update.avatar_path=newPhoto;
   }
   const {data,error}=await sb.from("ps_consultants").update(update).eq("id",id).eq("user_id",uid).select("*").single();
   if(error)throw new Error("Не удалось сохранить карточку. Проверьте подключение.");
   saved=true;current=data;
   if(oldPhoto&&oldPhoto!==data.avatar_path&&oldPhoto.startsWith(uid+"/"))await sb.storage.from("ps-consultant-cards").remove([oldPhoto]);
   const entry=staffConsultants.find(c=>c.id===id);if(entry)entry.display_name=data.display_name;
   if(consultant?.id===id)consultant=data;
   if(!form.isConnected)return;
   $("consultantCardPhoto").value="";$("consultantRemovePhoto").checked=false;
   showConsultantPhoto($("consultantEditorPhoto"),data.avatar_path,data.display_name);
   const heading=document.querySelector(".admin-intro h1");if(heading)heading.textContent=staffConsultants.map(c=>c.display_name).join(" · ");
   status.textContent="Сохранено. Карточка доступна вашим клиентам ✓";
  }catch(error){
   if(newPhoto&&!saved)await sb.storage.from("ps-consultant-cards").remove([newPhoto]).catch(()=>{});
   if(form.isConnected)status.textContent=error.message||"Не удалось сохранить. Попробуйте снова.";
  }finally{if(form.isConnected){fields.disabled=false;select.disabled=false;$("consultantCardReload").disabled=false}}
 });
 read();
}
function consultantCardHtml(c){
 const name=c.display_name||"Мой консультант";
 const phone=/^\+7\d{10}$/.test(c.contact_phone||"")?c.contact_phone:null;
 const wa=/^\+7\d{10}$/.test(c.whatsapp_phone||"")?c.whatsapp_phone:phone;
 const about=c.bio?'<section class="card consultant-info"><h3>О себе</h3><p class="consultant-bio">'+escapeHtml(c.bio)+'</p></section>':"";
 const club=c.club_name||c.club_address||c.club_hours;
 return '<section class="card consultant-hero"><div class="profile-avatar" id="clientConsultantPhoto">♡</div><h1>'+escapeHtml(name)+'</h1>'+
 '<div class="consultant-contact-buttons">'+
 '<button class="btn primary" id="writeConsultant">Написать консультанту</button>'+
 (phone?'<a class="btn ghost app-link" href="tel:'+phone+'">Позвонить</a>':"")+'</div></section>'+about+
 (c.contact_hours?'<section class="card consultant-info"><h3>На связи</h3><p class="consultant-bio">'+escapeHtml(c.contact_hours)+'</p></section>':"")+
 (club?'<section class="card consultant-info"><h3>'+escapeHtml(c.club_name||"Мой клуб")+'</h3>'+
 (c.club_address?'<p class="consultant-bio">'+escapeHtml(c.club_address)+'</p>':"")+
 (c.club_hours?'<div class="consultant-detail"><span>Часы работы</span><b>'+escapeHtml(c.club_hours)+'</b></div>':"")+'</section>':"");
}
async function loadClientConsultantCard(){
 const box=$("clientConsultantCard");if(!box)return;
 if(!profile?.consultant_id){box.innerHTML='<section class="card">Консультант не выбран</section>';return}
 try{
  const {data,error}=await sb.from("ps_consultants").select("*").eq("id",profile.consultant_id).eq("active",true).single();
  if(error)throw error;if(!box.isConnected)return;
  consultant=data;box.innerHTML=consultantCardHtml(data);$('writeConsultant').onclick=()=>openClientDialog();
  await showConsultantPhoto($("clientConsultantPhoto"),data.avatar_path,data.display_name);
 }catch{
  if(box.isConnected){
   box.innerHTML='<section class="card"><p>Не удалось загрузить карточку.</p><button class="btn ghost" id="retryConsultantCard">Повторить</button></section>';
   $("retryConsultantCard").addEventListener("click",loadClientConsultantCard);
  }
 }
}


