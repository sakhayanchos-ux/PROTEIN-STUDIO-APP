/* Release 83: client measurement charts use only saved real measurements. */
function cm83Chart(rows,key,label,unit){
  const pts=(rows||[]).filter(r=>r[key]!=null&&Number.isFinite(Number(r[key]))).map(r=>({date:r.entry_date,value:Number(r[key])}));
  if(!pts.length)return '<p class="muted">Пока нет замеров.</p>';
  const vals=pts.map(p=>p.value),min=Math.min(...vals),max=Math.max(...vals),span=Math.max(max-min,1);
  const w=640,h=210,pad=28;
  const xy=pts.map((p,i)=>({x:pts.length===1?w/2:pad+i*(w-2*pad)/(pts.length-1),y:pad+(max-p.value)*(h-2*pad)/span,...p}));
  const path=xy.map((p,i)=>(i?'L':'M')+p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' ');
  return '<div class="cm83-chart"><h3>'+escapeHtml(label)+'</h3><svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+escapeHtml(label)+' по датам"><line x1="'+pad+'" y1="'+(h-pad)+'" x2="'+(w-pad)+'" y2="'+(h-pad)+'" class="cm83-axis"/><path d="'+path+'" class="cm83-line"/>'+xy.map(p=>'<circle cx="'+p.x+'" cy="'+p.y+'" r="6" class="cm83-dot"><title>'+escapeHtml(p.date+' · '+ruNumber(p.value)+' '+unit)+'</title></circle>').join('')+'</svg><div class="cm83-chart-meta"><span>'+escapeHtml(pts[0].date)+'</span><b>'+ruNumber(pts[pts.length-1].value)+' '+unit+'</b><span>'+escapeHtml(pts[pts.length-1].date)+'</span></div></div>';
}
async function cm83LoadClientCharts(){
  const host=document.getElementById('clientMeasurementCharts83');if(!host||!me)return;
  try{
    const q=await sb.from('ps_progress_entries').select('entry_date,weight_kg,waist_cm').eq('user_id',me.id).order('entry_date',{ascending:true});
    if(q.error)throw q.error;
    const rows=q.data||[];
    host.innerHTML=cm83Chart(rows,'weight_kg','Вес','кг')+cm83Chart(rows,'waist_cm','Талия','см')+
      '<details class="cm83-history"><summary>Все замеры</summary><div class="cm83-table"><div><b>Дата</b><b>Вес</b><b>Талия</b></div>'+rows.map(r=>'<div><span>'+escapeHtml(r.entry_date)+'</span><span>'+(r.weight_kg==null?'—':ruNumber(r.weight_kg)+' кг')+'</span><span>'+(r.waist_cm==null?'—':ruNumber(r.waist_cm)+' см')+'</span></div>').join('')+'</div></details>';
  }catch(e){host.innerHTML='<p class="message">Не удалось загрузить график.</p>'}
}
const cm83PagePlan=pagePlan;
pagePlan=function(){
  return cm83PagePlan()+'<section class="card"><div class="eyebrow">МОЙ РЕЗУЛЬТАТ</div><h2>Динамика замеров</h2><p class="muted">Графики строятся только по реально сохранённым замерам. Если в день внесён только вес, талия не подставляется автоматически.</p><div id="clientMeasurementCharts83">Загружаем графики…</div></section>';
};
const cm83OpenPage=openPage;
openPage=function(page){
  cm83OpenPage(page);
  if(appRoute==='plan'&&!isStaffWorkspace())cm83LoadClientCharts();
};
