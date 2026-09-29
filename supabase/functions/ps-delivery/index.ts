import {createClient} from 'npm:@supabase/supabase-js@2.57.4';
import webpush from 'npm:web-push@3.6.7';
const origin='https://sakhayanchos-ux.github.io';
const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Content-Type':'application/json'};
const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
async function server(action:string,data:any={}){const r=await admin.rpc('ps_push_server',{p_action:action,p_data:data});if(r.error)throw Error('Delivery service unavailable');return r.data;}
function allowedEndpoint(value:string){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&(u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname.endsWith('.push.services.mozilla.com')||u.hostname==='web.push.apple.com'||u.hostname.endsWith('.push.apple.com')||u.hostname==='wns.windows.com'||u.hostname.endsWith('.notify.windows.com'));}catch{return false}}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return new Response('Method not allowed',{status:405,headers});
 try{
 const data=await req.json();const config=await server('config');
 if(data.action==='dispatch'){
 if(!config?.hookToken||req.headers.get('X-Push-Token')!==config.hookToken)return new Response('Unauthorized',{status:401});
 webpush.setVapidDetails('https://sakhayanchos-ux.github.io/PROTEIN-STUDIO-APP/',config.publicKey,config.privateKey);
 const jobs=await server('claim');let sent=0;
 for(const job of jobs){let error:string|null=null;for(const s of job.subscriptions){try{if(!allowedEndpoint(s.endpoint)){await server('expired',{id:s.id});continue;}await webpush.sendNotification(s.subscription,JSON.stringify(job.payload),{TTL:86400,timeout:8000});sent++;}catch(e){if([404,410].includes(e.statusCode))await server('expired',{id:s.id});else error='Push provider temporarily unavailable';}}await server('finish',{id:job.id,error});}
 return Response.json({sent});
 }
 const token=(req.headers.get('Authorization')||'').replace(/^Bearer /,'');const {data:auth,error}=await admin.auth.getUser(token);if(error||!auth.user)return new Response('Unauthorized',{status:401,headers});
 const uid=auth.user.id;
 if(data.action==='key')return Response.json({publicKey:config?.publicKey},{headers});
 if(data.action==='subscribe'){
 const s=data.subscription;if(!s||!allowedEndpoint(s.endpoint)||!/^[-_A-Za-z0-9]{80,100}$/.test(s.keys?.p256dh||'')||!/^[-_A-Za-z0-9]{20,30}$/.test(s.keys?.auth||''))return Response.json({error:'Недопустимая push-подписка'},{status:400,headers});
 await server('subscribe',{user_id:uid,subscription:s});return Response.json({ok:true},{headers});
 }
 if(data.action==='unsubscribe'){await server('unsubscribe',{user_id:uid,endpoint:data.endpoint});return Response.json({ok:true},{headers});}
 if(data.action==='result'){
 if(typeof data.path!=='string'||typeof data.client!=='string')throw Error('Invalid request');
 const user=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false}});
 const access=await user.rpc('ps_result_access',{p_client:data.client,p_path:data.path,p_download:data.download===true});
 if(access.error||!access.data)return Response.json({error:'Нет разрешения на использование результата'},{status:403,headers});
 const signed=await admin.storage.from('ps-progress-photos').createSignedUrl(data.path,60,{download:data.download===true?'protein-studio-result.jpg':false});if(signed.error)throw Error('Photo unavailable');
 return Response.json({url:signed.data.signedUrl},{headers});
 }
 return Response.json({error:'Unknown action'},{status:400,headers});
 }catch{return Response.json({error:'Не удалось выполнить запрос. Попробуйте ещё раз.'},{status:500,headers});}
});
