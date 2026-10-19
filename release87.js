/* Release 87: one read-only measurements view shared by Marathon and My Result. */
(function(){
 const original=loadCommonMarathon75;
 loadCommonMarathon75=async function(){
  await original();
  if(isStaffWorkspace()&&!clientPreview)return;
  const box=document.getElementById('commonMarathon75')||document.getElementById('journeyView');
  if(!box||!box.isConnected||appRoute!=='marathon'||!me)return;
  try{
   const result=await sb.from('ps_progress_entries').select('entry_date,weight_kg,waist_cm')
      .eq('user_id',me.id).order('entry_date',{ascending:false}).limit(10);
   if(result.error)throw result.error;
   if(!box.isConnected||appRoute!=='marathon')return;
   let section=box.querySelector('#marathonMeasurements87');
   if(!section){section=document.createElement('section');section.id='marathonMeasurements87';section.className='card';
    const hero=box.querySelector('.cm75-hero');if(hero)hero.after(section);else box.prepend(section);}
   const rows=result.data||[];
   section.innerHTML='<h2>📏 Мои замеры</h2><p class="muted">Это те же реальные записи, что и в «Мой результат». Данные не копируются и не подставляются автоматически.</p>'+
    (rows.length?'<div class="cm83-table"><div><b>Дата</b><b>Вес</b><b>Талия</b></div>'+
    rows.map(r=>'<div><span>'+escapeHtml(r.entry_date)+'</span><span>'+(r.weight_kg==null?'—':ruNumber(r.weight_kg)+' кг')+'</span><span>'+(r.waist_cm==null?'—':ruNumber(r.waist_cm)+' см')+'</span></div>').join('')+'</div>':
    '<p>Замеров пока нет.</p>')+
    '<button class="btn ghost" id="marathonGoProgress87">Открыть все замеры и фото →</button>';
   section.querySelector('#marathonGoProgress87').onclick=()=>openPage('progress');
  }catch(e){console.warn('Saved marathon measurements unavailable',e)}
 };
})();
