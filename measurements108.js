/* Wellness measurement corrections take priority over legacy diary values for the same date. */
async function psLoadUnifiedMeasurements(){
 const [old,w]=await Promise.all([
  sb.from("ps_progress_entries").select("entry_date,weight_kg,waist_cm").eq("user_id",me.id).order("entry_date"),
  sb.from("ps_wellness_measurements").select("entry_date,body,tape").eq("user_id",me.id).order("entry_date")
 ]);
 if(old.error)throw old.error;if(w.error)throw w.error;
 const num=x=>x===null||x===undefined||x===""?null:Number.isFinite(Number(x))?Number(x):null;
 const byDate=new Map();
 const row=d=>{if(!byDate.has(d))byDate.set(d,{entry_date:d,weight_kg:null,waist_cm:null});return byDate.get(d)};
 for(const r of old.data||[]){if(!r.entry_date)continue;const target=row(r.entry_date);target.weight_kg=num(r.weight_kg);target.waist_cm=num(r.waist_cm)}
 for(const r of w.data||[]){if(!r.entry_date)continue;const target=row(r.entry_date),weight=num(r.body?.weight),waist=num(r.tape?.waist);if(weight!==null)target.weight_kg=weight;if(waist!==null)target.waist_cm=waist}
 return [...byDate.values()].sort((a,b)=>a.entry_date.localeCompare(b.entry_date));
}
