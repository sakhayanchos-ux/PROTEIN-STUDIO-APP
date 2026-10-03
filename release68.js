/* Release 68: clearer consultant view of the client's current marathon day. */
activityHtml=function(f){
  if(!f.journey?.enrollment)return '<p>Клиент ещё не начал марафон.</p>';
  const current=Math.max(1,Math.min(30,Number(f.journey.day||1)));
  const head='<div class="current-day-head68">📍 Сегодня у клиента: <b>День '+current+' из 30</b></div>';
  return head+Array.from({length:30},(_,i)=>{
    const n=i+1;
    const rows=f.journey.tasks.filter(t=>t.day_number===n);
    const done=rows.filter(t=>t.completed_at).length;
    const isCurrent=n===current;
    const isPast=n<current;
    const state=isCurrent
      ? '<span class="current-day-badge68">📍 Сегодня</span>'
      : isPast
        ? '<span class="day-state68">прошедший</span>'
        : '<span class="day-state68">🔒 впереди</span>';
    return '<details class="activity-row day-row68 '+(isCurrent?'current-day68':isPast?'past-day68':'future-day68')+'" '+(isCurrent?'open':'')+'>'+
      '<summary>'+state+' <b>День '+n+'</b> · '+done+' / '+rows.length+'</summary>'+
      rows.map(t=>'<div class="activity-row"><b>'+(t.completed_at?'✓ ':'○ ')+escapeHtml(t.title)+'</b><span>'+(t.completed_at?dateLabel(t.completed_at):'Не выполнено')+'</span>'+(t.value!=null?'<span>Шагов: '+t.value+'</span>':'')+(t.photo_path?'<img class="task-photo" data-task-photo="'+escapeHtml(t.photo_path)+'" alt="Фото задания клиента">':'')+'</div>').join('')+
      '</details>';
  }).join('');
};