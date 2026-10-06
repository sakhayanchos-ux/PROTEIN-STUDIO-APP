/* Release 72: personal marathon stage labels are indicators, not buttons. */
const journeyHeader72=journeyHeader;
journeyHeader=function(s){
  if(!s?.enrollment)return '<p>Марафон ещё не начат.</p>';
  const personal=!!s.enrollment?.data?.personal;
  if(!personal)return journeyHeader72(s);
  const day=Math.max(1,Math.min(30,s.day));
  const stage=Math.ceil(day/10);
  const symbol=journeyRewardSymbol(s);
  const labels=['Режим','Результат','Уверенность'];
  const stages='<div class="personal-stages72" aria-label="Этапы марафона">'+[1,2,3].map(n=>{
    const state=n===stage?'current':n<stage?'done':'future';
    const icon=n<stage?'✓ ':n>stage?'🔒 ':'';
    return '<div class="personal-stage72 '+state+'"><b>'+icon+n+'. '+labels[n-1]+'</b><small>Дни '+((n-1)*10+1)+'–'+(n*10)+(n===stage?' · сейчас':'')+'</small></div>';
  }).join('')+'</div>';
  return '<section class="card marathon-dashboard">'+
    '<div class="eyebrow">❄️ '+escapeHtml(s.enrollment.title||'Мой марафон')+'</div>'+
    stages+
    '<div class="marathon-heading"><div><div class="eyebrow">Этап '+stage+' из 3</div><h1>День '+day+' из 30</h1></div><span class="star-total">'+symbol+' '+s.enrollment.stars+'</span></div>'+
    '<div class="marathon-percent">'+s.percent+'<span>%</span></div>'+
    '<div class="plan-progress-line" role="progressbar" aria-label="Общий прогресс марафона" aria-valuenow="'+s.percent+'" aria-valuemin="0" aria-valuemax="100"><i style="width:'+s.percent+'%"></i></div>'+
    '<p>Общий прогресс · 30 дней</p></section>';
};