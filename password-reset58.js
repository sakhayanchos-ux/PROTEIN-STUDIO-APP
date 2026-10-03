/* Release 58: secure consultant-assisted password recovery. */
async function ps58PasswordFn(body){
 const {data,error}=await sb.functions.invoke('ps-password-reset',{body});
 if(error)throw Error(data?.error||error.message||'Не удалось выполнить запрос.');
 if(data?.error)throw Error(data.error);return data
}
function openPasswordReset58(){
 $('loginBox').classList.add('hidden');$('registerBox').classList.add('hidden');$('passwordReset58').classList.remove('hidden');$('authMessage').textContent='';
 const p=$('loginPhone').value||'';$('resetPhone58').value=p;$('resetPhoneComplete58').value=p
}
function closePasswordReset58(){
 $('passwordReset58').classList.add('hidden');$('loginBox').classList.remove('hidden');$('authMessage').textContent=''
}
function bindPasswordReset58(){
 if(!$('forgotPassword58'))return;
 $('forgotPassword58').onclick=openPasswordReset58;$('resetBack58').onclick=closePasswordReset58;
 $('requestReset58').onclick=()=>buttonAction($('requestReset58'),async()=>{
  const phone=normalizePhone($('resetPhone58').value);if(phone.length<12)throw Error('Введите номер телефона.');
  await ps58PasswordFn({action:'request',phone});$('resetPhoneComplete58').value=phone;$('resetStep2_58').classList.remove('hidden');$('resetMessage58').textContent='Запрос отправлен. Получите 6-значный код у своего консультанта.'
 },$('resetMessage58'));
 $('completeReset58').onclick=()=>buttonAction($('completeReset58'),async()=>{
  const phone=normalizePhone($('resetPhoneComplete58').value),code=$('resetCode58').value.trim(),pw=$('resetPassword58').value,confirm=$('resetPasswordConfirm58').value;
  if(pw.length<8)throw Error('Новый пароль — минимум 8 символов.');if(pw!==confirm)throw Error('Пароли не совпадают.');
  await ps58PasswordFn({action:'complete',phone,code,password:pw});$('loginPhone').value=phone;$('loginPassword').value='';closePasswordReset58();$('authMessage').textContent='Пароль изменён ✓ Теперь войдите с новым паролем.'
 },$('resetCompleteMessage58'))
}
async function loadPasswordResetRequests58(){
 if(!isStaffWorkspace())return;
 let box=$('passwordResetCoach58');
 if(!box){box=document.createElement('section');box.id='passwordResetCoach58';box.className='card';const content=$('content');content?.insertBefore(box,content.children[1]||null)}
 box.innerHTML='<h3>Восстановление пароля</h3><p>Загружаем запросы…</p>';
 try{
  const data=await ps58PasswordFn({action:'consultant_list'}),items=data.items||[];
  box.innerHTML='<h3>Восстановление пароля</h3>'+(items.length?items.map(r=>'<div class="reset-request58"><div><b>'+escapeHtml(r.profile?.full_name||'Клиент')+'</b><small>'+escapeHtml(r.profile?.phone||'')+' · '+dateLabel(r.requested_at)+'</small></div><div>'+(r.approved_at?'<span>Код уже выдавался</span>':'<button class="btn ghost" data-approve-reset58="'+r.id+'">Выдать код</button>')+'</div></div>').join(''):'<p>Новых запросов нет.</p>')+'<div id="resetCodeCoach58"></div>';
  box.querySelectorAll('[data-approve-reset58]').forEach(b=>b.onclick=()=>buttonAction(b,async()=>{const d=await ps58PasswordFn({action:'approve',id:b.dataset.approveReset58});$('resetCodeCoach58').innerHTML='<div class="reset-code58"><b>'+escapeHtml(d.name)+'</b><span>Код действует 20 минут</span><strong>'+escapeHtml(d.code)+'</strong><button class="btn ghost" id="copyResetCode58">Скопировать код</button></div>';$('copyResetCode58').onclick=async()=>{await navigator.clipboard.writeText(d.code);$('copyResetCode58').textContent='Скопировано ✓'}},box))
 }catch(e){box.innerHTML='<h3>Восстановление пароля</h3><p>Не удалось загрузить запросы.</p>'}
}
if(typeof bindAdmin==='function'){
 const ps58BaseBindAdmin=bindAdmin;
 bindAdmin=function(){ps58BaseBindAdmin();loadPasswordResetRequests58()}
}
bindPasswordReset58();