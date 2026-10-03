/* Release 58: image scale/crop editor for all photo uploads. */
let ps58Editing=false;
function ps58ImageRatioFor(input){
 const id=(input.id||'').toLowerCase();
 if(id.includes('avatar')||id.includes('consultantcardphoto'))return '1';
 if(id.includes('before')||id.includes('after'))return '0.75';
 return 'original'
}
function ps58LoadImage(file){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(file),img=new Image();img.onload=()=>resolve({img,url});img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Не удалось открыть фото'))};img.src=url})}
async function editImageFile58(file,input){
 const {img,url}=await ps58LoadImage(file);
 return await new Promise(resolve=>{
  const d=document.createElement('dialog');d.className='image-editor58';
  d.innerHTML='<form method="dialog"><h2>Настроить фото</h2><p>Увеличьте и подвигайте фото так, как хотите его сохранить.</p><div class="image-editor-stage58"><canvas width="720" height="900"></canvas></div><div class="image-editor-controls58"><label>Формат<select id="ratio58"><option value="original">Оригинал</option><option value="1">Квадрат 1:1</option><option value="0.75">Вертикальный 3:4</option><option value="1.333333">Горизонтальный 4:3</option></select></label><label>Масштаб<input id="zoom58" type="range" min="1" max="3" step="0.01" value="1"></label></div><div class="step-actions"><button class="btn ghost" type="button" data-cancel58>Отмена</button><button class="btn primary" type="button" data-done58>Готово</button></div></form>';
  document.body.append(d);const canvas=d.querySelector('canvas'),ctx=canvas.getContext('2d'),ratio=d.querySelector('#ratio58'),zoom=d.querySelector('#zoom58');ratio.value=ps58ImageRatioFor(input);
  let ox=0,oy=0,drag=false,px=0,py=0;
  function dims(){let r=ratio.value==='original'?img.width/img.height:Number(ratio.value);if(!Number.isFinite(r)||r<=0)r=1;const max=900;if(r>=1)return {w:max,h:Math.round(max/r)};return {w:Math.round(max*r),h:max}}
  function draw(){const dm=dims(),w=dm.w,h=dm.h,z=Number(zoom.value),base=Math.max(w/img.width,h/img.height),scale=base*z,dw=img.width*scale,dh=img.height*scale,maxX=Math.max(0,(dw-w)/2),maxY=Math.max(0,(dh-h)/2);canvas.width=w;canvas.height=h;ox=Math.max(-maxX,Math.min(maxX,ox));oy=Math.max(-maxY,Math.min(maxY,oy));ctx.clearRect(0,0,w,h);ctx.drawImage(img,(w-dw)/2+ox,(h-dh)/2+oy,dw,dh)}
  ratio.onchange=()=>{ox=0;oy=0;draw()};zoom.oninput=draw;
  canvas.onpointerdown=e=>{drag=true;px=e.clientX;py=e.clientY;canvas.setPointerCapture(e.pointerId)};
  canvas.onpointermove=e=>{if(!drag)return;ox+=e.clientX-px;oy+=e.clientY-py;px=e.clientX;py=e.clientY;draw()};
  canvas.onpointerup=()=>drag=false;canvas.onpointercancel=()=>drag=false;
  d.querySelector('[data-cancel58]').onclick=()=>{URL.revokeObjectURL(url);d.close();d.remove();resolve(null)};
  d.querySelector('[data-done58]').onclick=async()=>{draw();const blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',0.9));URL.revokeObjectURL(url);d.close();d.remove();if(!blob)return resolve(file);resolve(new File([blob],(file.name.replace(/\.[^.]+$/,'')||'photo')+'-edited.jpg',{type:'image/jpeg',lastModified:Date.now()}))};
  draw();d.showModal()
 })
}
function installImageEditor58(){
 document.addEventListener('change',async e=>{
  const input=e.target;if(!(input instanceof HTMLInputElement)||input.type!=='file'||input.dataset.noImageEditor==='1'||!String(input.accept||'').includes('image'))return;
  if(input.dataset.ps58Ready==='1'){delete input.dataset.ps58Ready;return}
  const file=input.files?.[0];if(!file||!file.type.startsWith('image/')||ps58Editing)return;
  e.stopImmediatePropagation();e.preventDefault();ps58Editing=true;
  try{
   const edited=await editImageFile58(file,input);if(!edited){input.value='';return}
   const dt=new DataTransfer();dt.items.add(edited);input.files=dt.files;input.dataset.ps58Ready='1';input.dispatchEvent(new Event('change',{bubbles:true}))
  }catch(err){console.error(err);input.dataset.ps58Ready='1';input.dispatchEvent(new Event('change',{bubbles:true}))}
  finally{ps58Editing=false}
 },true)
}
installImageEditor58();