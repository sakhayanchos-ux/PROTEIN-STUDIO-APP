// Shared community chat: only messages explicitly sent here are shared.
let communityState=null;
const COMMUNITY_EMOJI=["❤️","👏🏻","🔥"];
function pageCommunity(){
 return '<section class="community-chat" id="communityChat">'+
 '<div id="communityPins"></div><div class="community-log" id="communityLog" tabindex="0" aria-label="Общий чат"><button type="button" class="chat-older hidden" id="communityOlder">Ранее</button><div id="communityMessages"><p class="chat-empty">Загружаем сообщения…</p></div></div>'+
 '<form id="communityForm" class="community-composer"><div id="communityReply" hidden></div><div id="communityAttachment" hidden></div>'+
 '<label class="hidden" for="communityText">Сообщение в общий чат</label><textarea id="communityText" rows="2" maxlength="3000" placeholder="Сообщение…"></textarea>'+
 '<div class="community-compose-actions"><button type="button" class="chat-photo-btn" id="communityPhotoBtn">＋ Фото</button><input id="communityPhoto" type="file" class="hidden" accept="image/jpeg,image/png,image/webp"><button type="submit" class="btn primary" id="communitySend">Отправить</button></div>'+
 '<p class="chat-status" id="communityStatus" role="status"></p><button type="button" class="chat-text-button hidden" id="communityRetry">Обновить чат</button></form></section>';
}
function stopCommunity(){
 const s=communityState;if(!s)return;communityState=null;
 clearInterval(s.poll);clearTimeout(s.refreshTimer);
 if(s.channel)sb.removeChannel(s.channel);
 if(s.preview)URL.revokeObjectURL(s.preview);
 document.removeEventListener("visibilitychange",s.visible);
 window.removeEventListener("online",s.online);
}
function communityMessage(text){const el=$("communityStatus");if(el)el.textContent=text}
function communityActive(s){return communityState===s&&!!$("communityMessages")&&me?.id===s.uid}
function queueCommunityRefresh(s){
 if(!communityActive(s))return;
 clearTimeout(s.refreshTimer);
 s.refreshTimer=setTimeout(()=>loadCommunity(s),250);
}
async function bindCommunity(){
 const s=communityState={uid:me.id,rows:[],pins:[],reactions:[],urls:new Map(),canModerate:false,reply:null,file:null,preview:null,pending:null,sending:false,loading:false,needsRefresh:false,hasMore:true,initial:true};
 $("communityForm").addEventListener("submit",sendCommunityMessage);
 $("communityPhotoBtn").addEventListener("click",()=>$("communityPhoto").click());
 $("communityPhoto").addEventListener("change",event=>{
   if(s.sending)return;
   const file=event.target.files?.[0];if(!file)return;
   if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>10485760){communityMessage("Выберите JPG, PNG или WEBP до 10 МБ.");event.target.value="";return}
   if(s.preview)URL.revokeObjectURL(s.preview);
   s.file=file;s.preview=URL.createObjectURL(file);
   $("communityAttachment").hidden=false;
   $("communityAttachment").innerHTML='<img alt="Фото к сообщению"><button type="button" data-chat-action="remove-photo" aria-label="Убрать фото">×</button>';
   $("communityAttachment").querySelector("img").src=s.preview;
   communityMessage("");
 });
 $("communityOlder").addEventListener("click",()=>loadCommunity(s,true));
 $("communityRetry").addEventListener("click",()=>loadCommunity(s));
 $("communityChat").addEventListener("click",event=>communityAction(event,s));
 s.visible=()=>{if(document.visibilityState==="visible")queueCommunityRefresh(s)};
 s.online=()=>queueCommunityRefresh(s);
 document.addEventListener("visibilitychange",s.visible);window.addEventListener("online",s.online);
 s.channel=sb.channel("ps-community-"+s.uid)
  .on("postgres_changes",{event:"*",schema:"public",table:"ps_community_messages"},()=>queueCommunityRefresh(s))
  .on("postgres_changes",{event:"*",schema:"public",table:"ps_community_reactions"},()=>queueCommunityRefresh(s))
  .subscribe(status=>{if(status==="SUBSCRIBED")queueCommunityRefresh(s)});
 s.poll=setInterval(()=>{if(document.visibilityState==="visible")loadCommunity(s)},30000);
 try{const role=await sb.rpc("ps_community_moderator");if(!role.error)s.canModerate=role.data===true}catch{}
 if(communityActive(s))await loadCommunity(s);
}
async function loadCommunity(s,older=false,forceBottom=false){
 if(!communityActive(s))return;
 if(s.loading){s.needsRefresh=true;return}
 s.loading=true;
 const log=$("communityLog"),oldHeight=log.scrollHeight,oldTop=log.scrollTop;
 const bottom=forceBottom||s.initial||oldHeight-oldTop-log.clientHeight<100;
 try{
  let query=sb.from("ps_community_messages").select("*").order("created_at",{ascending:false}).order("id",{ascending:false}).limit(50);
  if(older&&s.rows.length){
   const first=s.rows[0];
   query=query.or("created_at.lt."+first.created_at+",and(created_at.eq."+first.created_at+",id.lt."+first.id+")");
  }
  const [result,pinned]=await Promise.all([query,sb.from("ps_community_messages").select("*").eq("pinned",true).order("created_at",{ascending:false}).limit(50)]);
  if(result.error||pinned.error)throw result.error||pinned.error;
  if(!communityActive(s))return;
  // Refresh previously loaded rows too, so deletions are caught after reconnecting.
  const retained=[];
  for(let i=0;i<s.rows.length;i+=100){
   const current=await sb.from("ps_community_messages").select("*").in("id",s.rows.slice(i,i+100).map(m=>m.id));
   if(current.error)throw current.error;retained.push(...current.data);
  }
  if(s.initial||older)s.hasMore=result.data.length===50;
  const map=new Map([...retained,...result.data].map(m=>[m.id,m]));
  s.rows=Array.from(map.values()).sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
  s.pins=pinned.data;
  const ids=[...new Set([...s.rows,...s.pins].map(m=>m.id))];
  const reactions=[];
  for(let i=0;i<ids.length;i+=50){
   let from=0;
   while(true){
    const response=await sb.from("ps_community_reactions").select("*").in("message_id",ids.slice(i,i+50)).range(from,from+999);
    if(response.error)throw response.error;
    reactions.push(...response.data);if(response.data.length<1000)break;from+=1000;
   }
  }
  const paths=[...new Set([...s.rows,...s.pins].map(m=>m.image_path).filter(Boolean))];
  const missing=paths.filter(p=>!s.urls.has(p)||s.urls.get(p).expires<Date.now());
  for(let i=0;i<missing.length;i+=50){
   const signed=await sb.storage.from("ps-community").createSignedUrls(missing.slice(i,i+50),3600);
   if(!signed.error)for(const item of signed.data||[])if(item.signedUrl)s.urls.set(item.path,{url:item.signedUrl,expires:Date.now()+3300000});
  }
  if(!communityActive(s))return;
  s.reactions=reactions;renderCommunity(s);
  $("communityRetry").classList.add("hidden");
  if($("communityStatus").dataset.loadError){communityMessage("");delete $("communityStatus").dataset.loadError}
  if(older)log.scrollTop=oldTop+log.scrollHeight-oldHeight;else if(bottom)log.scrollTop=log.scrollHeight;else log.scrollTop=oldTop;
  s.initial=false;
 }catch{
  if(communityActive(s)){
   communityMessage("Не удалось обновить чат. Проверьте подключение.");
   $("communityStatus").dataset.loadError="true";$("communityRetry").classList.remove("hidden");
   if(s.initial)$("communityMessages").innerHTML='<p class="chat-empty">Сообщения пока не загружены</p>';
  }
 }finally{s.loading=false;if(s.needsRefresh){s.needsRefresh=false;queueCommunityRefresh(s)}}
}
function renderCommunity(s){
 const all=new Map([...s.rows,...s.pins].map(m=>[m.id,m]));
 $("communityPins").innerHTML=s.pins.length?'<details class="chat-pins"><summary>📌 Закреплённые · '+s.pins.length+'</summary>'+s.pins.map(m=>'<div class="chat-pin"><b>'+escapeHtml(m.author_name)+'</b><p>'+escapeHtml(m.body||"Фото")+'</p>'+(s.canModerate?'<button type="button" data-chat-action="pin" data-id="'+m.id+'">Открепить</button>':"")+'</div>').join("")+'</details>':"";
 $("communityMessages").innerHTML=s.rows.length?s.rows.map(m=>{
   const own=m.author_id===s.uid;
   const parent=all.get(m.reply_to);
   const reactions=s.reactions.filter(r=>r.message_id===m.id);
   const initials=m.author_name.trim().split(/\s+/).slice(0,2).map(x=>Array.from(x)[0]||"").join("");
   const stamp=new Date(m.created_at);
   const time=stamp.toLocaleString("ru-RU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
   const photo=m.image_path?s.urls.get(m.image_path)?.url:null;
   return '<article class="chat-message '+(own?"chat-own":"")+'" id="chat-'+m.id+'">'+
    '<div class="chat-message-head"><span class="chat-avatar" aria-hidden="true">'+escapeHtml(initials)+'</span><div><b>'+escapeHtml(m.author_name)+'</b>'+(m.author_is_consultant?'<span class="chat-role">Консультант</span>':"")+'</div><time datetime="'+escapeHtml(m.created_at)+'">'+escapeHtml(time)+'</time></div>'+
    (m.reply_to?'<div class="chat-quote">'+(parent?'<b>'+escapeHtml(parent.author_name)+'</b><span>'+escapeHtml((parent.body||"Фото").slice(0,140))+'</span>':"Ответ на более раннее сообщение")+'</div>':"")+
    (m.body?'<p class="chat-body">'+escapeHtml(m.body)+'</p>':"")+
    (m.image_path?(photo?'<a href="'+escapeHtml(photo)+'" target="_blank" rel="noopener"><img class="chat-image" loading="lazy" src="'+escapeHtml(photo)+'" alt="Фото в сообщении"></a>':'<p class="chat-photo-error">Фото недоступно</p>'):"")+
    '<div class="chat-message-actions">'+COMMUNITY_EMOJI.map(emoji=>{
      const group=reactions.filter(r=>r.emoji===emoji),pressed=group.some(r=>r.user_id===s.uid);
      return '<button type="button" class="chat-reaction" data-chat-action="react" data-id="'+m.id+'" data-emoji="'+emoji+'" aria-label="Реакция '+emoji+'" aria-pressed="'+pressed+'">'+emoji+(group.length?' '+group.length:"")+'</button>';
    }).join("")+'<button type="button" data-chat-action="reply" data-id="'+m.id+'">Ответить</button>'+
    (s.canModerate?'<button type="button" data-chat-action="pin" data-id="'+m.id+'">'+(m.pinned?"Открепить":"Закрепить")+'</button>':"")+
    (own||s.canModerate?'<button type="button" data-chat-action="delete" data-id="'+m.id+'">Удалить</button>':"")+
    '</div></article>';
 }).join(""):'<div class="chat-empty"><span>💬</span><b>Общий чат</b><p>Поделитесь первым сообщением</p></div>';
 $("communityOlder").classList.toggle("hidden",!s.hasMore||!s.rows.length);
}
function clearCommunityReply(s){s.reply=null;$("communityReply").hidden=true;$("communityReply").textContent=""}
function clearCommunityPhoto(s){
 if(s.preview)URL.revokeObjectURL(s.preview);
 s.preview=null;s.file=null;$("communityAttachment").hidden=true;$("communityAttachment").textContent="";$("communityPhoto").value="";
}
async function communityAction(event,s){
 const button=event.target.closest("[data-chat-action]");if(!button||!communityActive(s))return;
 const action=button.dataset.chatAction;
 if(action==="remove-photo"){if(!s.sending&&!s.pending)clearCommunityPhoto(s);return}
 if(action==="cancel-reply"){if(!s.sending&&!s.pending)clearCommunityReply(s);return}
 const row=[...s.rows,...s.pins].find(m=>m.id===button.dataset.id);if(!row)return;
 if(action==="reply"){
  if(s.sending||s.pending)return;
  s.reply=row.id;
  $("communityReply").hidden=false;
  $("communityReply").innerHTML='<span><b>'+escapeHtml(row.author_name)+'</b> '+escapeHtml((row.body||"Фото").slice(0,100))+'</span><button type="button" data-chat-action="cancel-reply" aria-label="Отменить ответ">×</button>';
  $("communityText").focus();return;
 }
 button.disabled=true;
 try{
  if(action==="react"){
    const emoji=button.dataset.emoji;if(!COMMUNITY_EMOJI.includes(emoji))return;
    const existing=s.reactions.some(r=>r.message_id===row.id&&r.user_id===s.uid&&r.emoji===emoji);
    const result=existing?await sb.from("ps_community_reactions").delete().eq("message_id",row.id).eq("user_id",s.uid).eq("emoji",emoji):await sb.from("ps_community_reactions").insert({message_id:row.id,emoji});
    if(result.error&&result.error.code!=="23505")throw result.error;
  }else if(action==="pin"&&s.canModerate){
    const result=await sb.from("ps_community_messages").update({pinned:!row.pinned}).eq("id",row.id).select("id").single();if(result.error)throw result.error;
  }else if(action==="delete"&&(row.author_id===s.uid||s.canModerate)){
    if(!confirm("Удалить сообщение для всех участников?"))return;
    const result=await sb.from("ps_community_messages").delete().eq("id",row.id).select("id").single();if(result.error)throw result.error;
    if(row.image_path)await sb.storage.from("ps-community").remove([row.image_path]);
    if(s.reply===row.id)clearCommunityReply(s);
  }
  if(communityActive(s))await loadCommunity(s);
 }catch{communityMessage("Не удалось выполнить действие. Попробуйте снова.")}
 finally{button.disabled=false}
}
async function sendCommunityMessage(event){
 event.preventDefault();const s=communityState;if(!s||s.sending)return;
 const text=$("communityText").value.trim();if(!s.pending&&!text&&!s.file)return;
 if(text.length>3000){communityMessage("Сообщение — до 3000 символов.");return}
 s.sending=true;const btn=$("communitySend");btn.disabled=true;$("communityPhotoBtn").disabled=true;$("communityText").disabled=true;
 communityMessage("Отправляем…");
 try{
  if(!s.pending)s.pending={id:crypto.randomUUID(),body:text,reply_to:s.reply,image_path:null,uploaded:false};
  const p=s.pending;
  // Recheck after a lost response: a retry must never create a second message.
  const exists=await sb.from("ps_community_messages").select("id").eq("id",p.id).maybeSingle();
  if(exists.error)throw exists.error;
  if(!exists.data){
   if(s.file&&!p.uploaded){
    const ext={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"}[s.file.type];
    p.image_path=s.uid+"/"+p.id+"."+ext;
    const upload=await sb.storage.from("ps-community").upload(p.image_path,s.file,{contentType:s.file.type});
    if(upload.error&&String(upload.error.statusCode)!=="409"&&!/already exists|duplicate/i.test(upload.error.message))throw upload.error;
    p.uploaded=true;
   }
   const result=await sb.from("ps_community_messages").insert({id:p.id,body:p.body,reply_to:p.reply_to,image_path:p.image_path});
   if(result.error&&result.error.code!=="23505"){
    if(result.error.code==="23503"){p.reply_to=null;s.reply=null}
    throw result.error;
   }
  }
  s.pending=null;
  if(communityActive(s)){
   $("communityText").value="";clearCommunityPhoto(s);clearCommunityReply(s);communityMessage("");
   await loadCommunity(s,false,true);
  }
 }catch{if(communityActive(s))communityMessage("Не отправлено. Нажмите «Повторить» — текст и фото сохранены здесь.")}
 finally{
  s.sending=false;
  if(communityActive(s)){btn.disabled=false;btn.textContent=s.pending?"Повторить":"Отправить";$("communityPhotoBtn").disabled=!!s.pending;$("communityText").disabled=!!s.pending}
 }
}

