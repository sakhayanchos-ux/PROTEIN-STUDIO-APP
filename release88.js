/* Release 88: private chat scoped to one marathon and authorized participants. */
(function(){
 const previous=loadCommonMarathon75;
 let refreshTimer=null;
 async function refreshChat(campaignId,card){
  const list=card.querySelector('#psMarathonChatList88');if(!list||!card.isConnected)return;
  try{
   const response=await sb.rpc('ps_campaign_chat_feed',{p_campaign:campaignId});
   if(response.error)throw response.error;
   if(!list.isConnected)return;
   const messages=response.data||[];
   const html=messages.length?messages.map(m=>{
    const own=m.sender_id===me.id;
    const when=new Date(m.created_at).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
    return '<div class="ps-chat-message88 '+(own?'own':'')+'"><div class="ps-chat-author88">'+escapeHtml(own?'Вы':m.sender_name||'Участник')+'</div><p>'+escapeHtml(m.body||'').replace(/\\n/g,'<br>')+'</p><time>'+escapeHtml(when)+'</time></div>';
   }).join(''):'<p class="muted">Пока сообщений нет. Начните общение!</p>';
   if(list.innerHTML!==html){const nearBottom=list.scrollTop+list.clientHeight>=list.scrollHeight-120;list.innerHTML=html;if(nearBottom)list.scrollTop=list.scrollHeight}
  }catch(e){if(list.isConnected&&list.textContent==='Загружаем сообщения…')list.textContent='Не удалось загрузить сообщения: '+(e.message||'ошибка')}
 }
 loadCommonMarathon75=async function(){
  if(refreshTimer){clearInterval(refreshTimer);refreshTimer=null}
  await previous();
  if(!common75State?.campaign||!common75State?.participant||!me||appRoute!=='marathon')return;
  if(isStaffWorkspace()&&!clientPreview)return;
  const box=document.getElementById('commonMarathon75')||document.getElementById('journeyView');
  if(!box||!box.isConnected)return;
  const cid=common75State.campaign.id;
  const card=document.createElement('section');
  card.className='card ps-marathon-chat88';
  card.innerHTML='<h2>💬 Чат нашего марафона</h2><p class="muted">Только для зарегистрированных участников этого марафона. Другие группы и чаты не затрагиваются.</p>'+
   '<div class="ps-chat-list88" id="psMarathonChatList88">Загружаем сообщения…</div>'+
   '<form id="psMarathonChatForm88"><label for="psMarathonChatText88">Ваше сообщение</label><textarea id="psMarathonChatText88" maxlength="2000" rows="2" required placeholder="Поделитесь успехами или задайте вопрос"></textarea>'+
   '<button class="btn primary" type="submit">Отправить</button><p id="psMarathonChatStatus88" role="status"></p></form>';
  box.appendChild(card);
  const form=card.querySelector('form'),area=card.querySelector('textarea'),button=card.querySelector('button'),status=card.querySelector('[role=status]');
  form.onsubmit=async e=>{
   e.preventDefault();const content=area.value.trim();if(!content)return;
   button.disabled=true;status.textContent='';
   try{const result=await sb.rpc('ps_campaign_chat_send',{p_campaign:cid,p_body:content});if(result.error)throw result.error;area.value='';await refreshChat(cid,card)}
   catch(err){status.textContent=err.message||'Не удалось отправить сообщение'}
   finally{if(button.isConnected)button.disabled=false}
  };
  await refreshChat(cid,card);
  refreshTimer=setInterval(()=>{
   if(!card.isConnected||appRoute!=='marathon'){clearInterval(refreshTimer);refreshTimer=null;return}
   if(!document.hidden)refreshChat(cid,card);
  },15000);
 };
})();
