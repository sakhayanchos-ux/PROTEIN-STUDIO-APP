-- Additive communication and individual task configuration. No user data deletion.
alter table public.ps_notifications add column if not exists event_key text;
alter table public.ps_notifications add column if not exists route jsonb not null default '{}';
create unique index if not exists ps_notification_event on public.ps_notifications(recipient_id,event_key) where event_key is not null;
alter table public.ps_marathon_tasks add column if not exists active boolean not null default true;
create table public.ps_direct_threads(id uuid primary key default gen_random_uuid(),client_id uuid not null references public.ps_profiles(id),consultant_id uuid not null references public.ps_consultants(id),coach_id uuid not null references public.ps_profiles(id),created_at timestamptz not null default now(),unique(client_id,consultant_id),check(client_id<>coach_id));
create table public.ps_direct_messages(id uuid primary key default gen_random_uuid(),thread_id uuid not null references public.ps_direct_threads(id),sender_id uuid not null references public.ps_profiles(id),body text not null default '' check(length(body)<=3000),image_path text,reply_to uuid references public.ps_direct_messages(id),consent_id uuid,created_at timestamptz not null default now(),check(length(trim(body))>0 or image_path is not null or consent_id is not null));
create index on public.ps_direct_messages(thread_id,created_at,id);
create table public.ps_result_consents(id uuid primary key default gen_random_uuid(),thread_id uuid not null references public.ps_direct_threads(id),client_id uuid not null references public.ps_profiles(id),coach_id uuid not null references public.ps_profiles(id),status text not null default 'pending' check(status in('pending','granted','denied','revoked')),scope text not null default 'Скачать и использовать сохранённые фото До/После и коллаж результата',assets jsonb not null,created_at timestamptz not null default now(),answered_at timestamptz);
alter table public.ps_direct_messages add foreign key(consent_id) references public.ps_result_consents(id);
create table public.ps_chat_reads(user_id uuid not null references public.ps_profiles(id),channel text not null,last_read_at timestamptz not null default now(),primary key(user_id,channel));
create table ps_private.push_config(id boolean primary key default true check(id),settings jsonb not null);
create table public.ps_push_subscriptions(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.ps_profiles(id),endpoint text not null unique,subscription jsonb not null,created_at timestamptz not null default now());
create table ps_private.push_queue(id bigint generated always as identity primary key,user_id uuid not null references public.ps_profiles(id),payload jsonb not null,created_at timestamptz not null default now(),attempts integer not null default 0,locked_until timestamptz,sent_at timestamptz,last_error text);

create function public.ps_thread_access(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
select auth.uid() is not null and exists(select 1 from public.ps_direct_threads t join public.ps_profiles p on p.id=t.client_id join public.ps_consultants c on c.id=t.consultant_id where t.id=p_id and auth.uid() in(t.client_id,t.coach_id) and p.consultant_id=c.id and c.user_id=t.coach_id and c.active) $$;
create function public.ps_open_dialog(p_client uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=coalesce(p_client,auth.uid());cid uuid;coach uuid;tid uuid;
begin
 if auth.uid() is null then raise exception 'Нет доступа';end if;
 select p.consultant_id,c.user_id into cid,coach from public.ps_profiles p join public.ps_consultants c on c.id=p.consultant_id and c.active where p.id=uid;
 if coach is null or coach=uid or auth.uid() not in(uid,coach) then raise exception 'Диалог недоступен: консультант ещё не подключён';end if;
 insert into public.ps_direct_threads(client_id,consultant_id,coach_id) values(uid,cid,coach) on conflict(client_id,consultant_id) do nothing;
 select id into tid from public.ps_direct_threads where client_id=uid and consultant_id=cid;
 if not public.ps_thread_access(tid) then raise exception 'Нет доступа';end if;return tid;
end $$;
create function public.ps_send_direct(p_thread uuid,p_id uuid,p_body text default '',p_photo text default null,p_reply uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
begin
 if not public.ps_thread_access(p_thread) then raise exception 'Нет доступа';end if;
 if p_reply is not null and not exists(select 1 from public.ps_direct_messages where id=p_reply and thread_id=p_thread) then raise exception 'Ответ недоступен';end if;
 if p_photo is not null and (split_part(p_photo,'/',1)<>auth.uid()::text or split_part(p_photo,'/',2)<>p_thread::text or not exists(select 1 from storage.objects where bucket_id='ps-direct' and name=p_photo)) then raise exception 'Фото недоступно';end if;
 if exists(select 1 from public.ps_direct_messages where id=p_id and sender_id<>auth.uid()) then raise exception 'Нет доступа';end if;
 insert into public.ps_direct_messages(id,thread_id,sender_id,body,image_path,reply_to) values(p_id,p_thread,auth.uid(),trim(coalesce(p_body,'')),p_photo,p_reply) on conflict(id) do nothing;return p_id;
end $$;
create function public.ps_mark_chat_read(p_channel text,p_until timestamptz) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or (p_channel<>'community' and not public.ps_thread_access(p_channel::uuid)) then raise exception 'Нет доступа';end if;
 insert into public.ps_chat_reads(user_id,channel,last_read_at) values(auth.uid(),p_channel,least(p_until,now())) on conflict(user_id,channel) do update set last_read_at=greatest(public.ps_chat_reads.last_read_at,excluded.last_read_at);
end $$;
create function public.ps_unread_counts() returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object('community',(select count(*) from public.ps_community_messages m where auth.uid() is not null and m.author_id<>auth.uid() and m.created_at>coalesce((select last_read_at from public.ps_chat_reads where user_id=auth.uid() and channel='community'),'-infinity')),'messages',(select count(*) from public.ps_direct_messages m where public.ps_thread_access(m.thread_id) and m.sender_id<>auth.uid() and m.created_at>coalesce((select last_read_at from public.ps_chat_reads where user_id=auth.uid() and channel=m.thread_id::text),'-infinity')),'notifications',(select count(*) from public.ps_notifications where recipient_id=auth.uid() and read_at is null)) $$;
create function public.ps_chat_people(p_ids uuid[]) returns table(id uuid,full_name text,avatar_path text) language sql stable security definer set search_path='' as $$
select p.id,p.full_name,p.avatar_path from public.ps_profiles p where auth.uid() is not null and p.id=any(p_ids) and (p.id=auth.uid() or exists(select 1 from public.ps_community_messages m where m.author_id=p.id) or exists(select 1 from public.ps_direct_threads t where p.id in(t.client_id,t.coach_id) and public.ps_thread_access(t.id))) $$;

create function public.ps_request_result_consent(p_client uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare tid uuid;rid uuid;assets jsonb;
begin
 if auth.uid() is null or not public.ps_can_coach(p_client) or p_client=auth.uid() then raise exception 'Нет доступа';end if;
 tid:=public.ps_open_dialog(p_client);
 select id into rid from public.ps_result_consents where thread_id=tid and status='pending' order by created_at desc limit 1;if rid is not null then return rid;end if;
 select coalesce(jsonb_agg(path),'[]') into assets from (select storage_path path from public.ps_progress_photos where user_id=p_client union select storage_path from public.ps_progress_collages where user_id=p_client)x;
 if jsonb_array_length(assets)=0 then raise exception 'У клиента пока нет сохранённых фото результата';end if;
 insert into public.ps_result_consents(thread_id,client_id,coach_id,assets) values(tid,p_client,auth.uid(),assets) returning id into rid;
 insert into public.ps_direct_messages(thread_id,sender_id,body,consent_id) values(tid,auth.uid(),'Разрешите скачать и использовать ваши сохранённые фото До/После и коллаж результата? Согласие можно отозвать.',rid);return rid;
end $$;
create function public.ps_answer_result_consent(p_id uuid,p_answer text) returns void language plpgsql security definer set search_path='' as $$
declare c public.ps_result_consents;
begin
 select * into c from public.ps_result_consents where id=p_id for update;
 if c.client_id<>auth.uid() or auth.uid() is null or not public.ps_thread_access(c.thread_id) then raise exception 'Нет доступа';end if;
 if not ((c.status='pending' and p_answer in('granted','denied')) or (c.status='granted' and p_answer='revoked')) then raise exception 'Ответ уже сохранён';end if;
 update public.ps_result_consents set status=p_answer,answered_at=now() where id=p_id;
 insert into public.ps_direct_messages(thread_id,sender_id,body) values(c.thread_id,auth.uid(),case p_answer when 'granted' then 'Разрешаю использовать указанные фото результата.' when 'denied' then 'Не разрешаю использовать фото результата.' else 'Отзываю разрешение на использование результата.' end);
end $$;
create function public.ps_result_access(p_client uuid,p_path text,p_download boolean) returns boolean language sql stable security definer set search_path='' as $$
select auth.uid() is not null and (auth.uid()=p_client or (public.ps_can_coach(p_client) and (not p_download or exists(select 1 from public.ps_result_consents c where c.client_id=p_client and c.coach_id=auth.uid() and c.status='granted' and c.assets ? p_path)))) and exists(select 1 from public.ps_progress_photos where user_id=p_client and storage_path=p_path union all select 1 from public.ps_progress_collages where user_id=p_client and storage_path=p_path) $$;
create policy coach_result_photos on public.ps_progress_photos for select to authenticated using(public.ps_can_coach(user_id));
create policy coach_result_collages on public.ps_progress_collages for select to authenticated using(public.ps_can_coach(user_id));
-- Only profile avatar objects become readable to authenticated chat members; result photos do not.
create policy chat_avatars on storage.objects for select to authenticated using(bucket_id='ps-progress-photos' and exists(select 1 from public.ps_chat_people(array[(split_part(name,'/',1))::uuid]) p where p.avatar_path=name));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('ps-direct','ps-direct',false,10485760,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy direct_photo_insert on storage.objects for insert to authenticated with check(bucket_id='ps-direct' and split_part(name,'/',1)=auth.uid()::text and public.ps_thread_access(split_part(name,'/',2)::uuid));
create policy direct_photo_read on storage.objects for select to authenticated using(bucket_id='ps-direct' and public.ps_thread_access(split_part(name,'/',2)::uuid));

create function ps_private.coach_event(p_user uuid,p_key text,p_title text,p_body text default '',p_route jsonb default '{}') returns void language plpgsql security definer set search_path='' as $$
declare coach uuid;name text;
begin
 select c.user_id,p.full_name into coach,name from public.ps_profiles p join public.ps_consultants c on c.id=p.consultant_id and c.active where p.id=p_user;
 if coach is null or coach=p_user then return;end if;
 insert into public.ps_notifications(recipient_id,event_key,title,body,route) values(coach,p_key,coalesce(name,'Клиент')||' '||p_title,p_body,jsonb_build_object('page','admin','client',p_user)||p_route) on conflict do nothing;
end $$;
create function ps_private.client_events() returns trigger language plpgsql security definer set search_path='' as $$
declare uid uuid;d integer;
begin
 if tg_table_name='ps_progress_entries' then
 if new.weight_kg is not null and (tg_op='INSERT' or new.weight_kg is distinct from old.weight_kg) then perform ps_private.coach_event(new.user_id,'weight:'||new.id||':'||new.weight_kg,'добавил новый вес: '||replace(new.weight_kg::text,'.',',')||' кг');end if;
 if new.waist_cm is not null and (tg_op='INSERT' or new.waist_cm is distinct from old.waist_cm) then perform ps_private.coach_event(new.user_id,'waist:'||new.id||':'||new.waist_cm,'добавил замер талии: '||replace(new.waist_cm::text,'.',',')||' см');end if;
 elsif tg_table_name='ps_workout_logs' then
 if tg_op='INSERT' then perform ps_private.coach_event(new.user_id,'workout:'||new.id,'завершил тренировку'||case when new.photo_path is not null then ' и добавил фото' else '' end);
 elsif new.photo_path is distinct from old.photo_path and new.photo_path is not null then perform ps_private.coach_event(new.user_id,'workout-photo:'||new.id||':'||new.photo_path,'добавил фото тренировки');end if;
 elsif tg_table_name='ps_marathon_tasks' then
 if old.completed_at is null and new.completed_at is not null then
 select user_id into uid from public.ps_marathon_enrollments where id=new.enrollment_id;
 if new.kind in('food_photo','workout_photo') then perform ps_private.coach_event(uid,'task:'||new.enrollment_id||':'||new.day_number||':'||new.task_key,case when new.kind='food_photo' then 'заполнил дневник питания' else 'добавил фото тренировки' end);end if;
 if not exists(select 1 from public.ps_marathon_tasks where enrollment_id=new.enrollment_id and day_number=new.day_number and active and completed_at is null) then perform ps_private.coach_event(uid,'day:'||new.enrollment_id||':'||new.day_number,'завершил День '||new.day_number||' марафона');end if;
 end if;
 elsif tg_table_name='ps_marathon_rewards' then
 if old.unlocked_at is null and new.unlocked_at is not null then select user_id into uid from public.ps_marathon_enrollments where id=new.enrollment_id;perform ps_private.coach_event(uid,'unlock:'||new.id,'открыл награду '||new.milestone||'%',coalesce(new.gift,'Подарок'));end if;
 end if;return new;
end $$;
create trigger client_measure_events after insert or update on public.ps_progress_entries for each row execute function ps_private.client_events();
create trigger client_workout_events after insert or update on public.ps_workout_logs for each row execute function ps_private.client_events();
create trigger client_task_events after update on public.ps_marathon_tasks for each row execute function ps_private.client_events();
create trigger client_reward_events after update on public.ps_marathon_rewards for each row execute function ps_private.client_events();
create function ps_private.direct_notice() returns trigger language plpgsql security definer set search_path='' as $$
declare t public.ps_direct_threads;recipient uuid;name text;
begin
 select * into t from public.ps_direct_threads where id=new.thread_id;recipient:=case when new.sender_id=t.client_id then t.coach_id else t.client_id end;
 select full_name into name from public.ps_profiles where id=new.sender_id;
 insert into public.ps_notifications(recipient_id,event_key,title,body,route) values(recipient,'dm:'||new.id,'Новое личное сообщение от '||name,case when new.consent_id is not null then 'Запрос разрешения на использование результата' when new.image_path is not null then 'Фото' else left(new.body,140) end,jsonb_build_object('page','messages','thread',t.id)) on conflict do nothing;return new;
end $$;
create trigger direct_notice after insert on public.ps_direct_messages for each row execute function ps_private.direct_notice();

create function public.ps_set_client_task(p_enrollment uuid,p_key text,p_title text,p_kind text,p_stars int,p_target int,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
declare e public.ps_marathon_enrollments;d int;
begin
 select * into e from public.ps_marathon_enrollments where id=p_enrollment for update;
 if auth.uid() is null or not public.ps_can_coach(e.user_id) or e.user_id=auth.uid() then raise exception 'Нет доступа';end if;
 if length(trim(p_title)) not between 1 and 160 or p_stars not between 0 and 10 or p_target not between 0 and 100000 or p_kind not in('check','food_photo','workout_photo','workout','steps','topic') or p_key !~ '^[a-z0-9_]{1,80}$' then raise exception 'Проверьте задание';end if;
 perform ps_private.prepare(e.id);d:=greatest(1,(now() at time zone 'Asia/Yakutsk')::date-e.start_date+1);
 insert into public.ps_marathon_tasks(enrollment_id,day_number,task_key,title,kind,stars,target,active) select e.id,n,p_key,trim(p_title),p_kind,p_stars,p_target,p_active from generate_series(d,30)n
 on conflict(enrollment_id,day_number,task_key) do update set title=excluded.title,stars=excluded.stars,target=excluded.target,active=excluded.active where public.ps_marathon_tasks.completed_at is null;
 perform ps_private.refresh(e.id);
end $$;

-- Explicit grants, owner/participant RLS.
do $$declare t text;begin foreach t in array array['ps_direct_threads','ps_direct_messages','ps_result_consents','ps_chat_reads','ps_push_subscriptions'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);end loop;end $$;
alter table ps_private.push_config enable row level security;
alter table ps_private.push_queue enable row level security;
create policy direct_threads_read on public.ps_direct_threads for select to authenticated using(public.ps_thread_access(id));
create policy direct_messages_read on public.ps_direct_messages for select to authenticated using(public.ps_thread_access(thread_id));
create policy consent_read on public.ps_result_consents for select to authenticated using(public.ps_thread_access(thread_id));
create policy chat_reads_own on public.ps_chat_reads for select to authenticated using(user_id=auth.uid());
create policy push_subscriptions_own on public.ps_push_subscriptions for select to authenticated using(user_id=auth.uid());
CREATE OR REPLACE FUNCTION public.ps_complete_marathon_task(p_enrollment uuid, p_day integer, p_key text, p_photo text DEFAULT NULL::text, p_value integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e public.ps_marathon_enrollments;t public.ps_marathon_tasks;day_date date;
begin
 if auth.uid() is null then raise exception 'Нет доступа';end if;
 select * into e from public.ps_marathon_enrollments where id=p_enrollment and user_id=auth.uid() and status='active' for update;
 if e.id is null or exists(select 1 from public.ps_consultants where user_id=auth.uid() and active) then raise exception 'Нет доступа';end if;
 day_date:=e.start_date+p_day-1;
 if p_day not between 1 and 30 or day_date>(now() at time zone 'Asia/Yakutsk')::date then raise exception 'День пока закрыт';end if;
 perform ps_private.prepare(e.id);
 select * into t from public.ps_marathon_tasks where enrollment_id=e.id and day_number=p_day and task_key=p_key;
 if t.task_key is null or not t.active then raise exception 'Задание не найдено';end if;
 if t.completed_at is not null then return;end if;
 if t.kind in('workout_photo','food_photo') and (p_photo is null or split_part(p_photo,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='ps-task-photos' and name=p_photo)) then raise exception 'Добавьте фото';end if;
 if t.kind='steps' and (p_value is null or p_value<t.target or p_value>100000) then raise exception 'Укажите количество шагов не меньше цели';end if;
 if t.kind='workout' and not exists(select 1 from public.ps_workout_logs where user_id=auth.uid() and log_date=day_date) then raise exception 'Сначала отметьте тренировку в разделе «Тренировки»';end if;
 if t.kind='topic' then
 insert into public.ps_marathon_activity(enrollment_id,day_number) values(e.id,p_day) on conflict do nothing;
 update public.ps_marathon_activity set read_at=now() where enrollment_id=e.id and day_number=p_day;
 end if;
 update public.ps_marathon_tasks set completed_at=now(),photo_path=case when t.kind in('workout_photo','food_photo') then p_photo else null end,value=p_value where enrollment_id=e.id and day_number=p_day and task_key=p_key;
 perform ps_private.refresh(e.id);
end $function$;
CREATE OR REPLACE FUNCTION public.ps_log_workout(p_workout uuid DEFAULT NULL::uuid, p_photo text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e public.ps_marathon_enrollments;d integer;t record;
begin
 if auth.uid() is null or exists(select 1 from public.ps_consultants where user_id=auth.uid() and active) then raise exception 'Нет доступа';end if;
 if p_workout is null then raise exception 'Выберите видеотренировку';end if;
 if p_workout is not null and not exists(select 1 from public.ps_workouts w where w.id=p_workout and active and (consultant_id is null or consultant_id=(select consultant_id from public.ps_profiles where id=auth.uid()))) then raise exception 'Тренировка недоступна';end if;
 if p_photo is not null and (split_part(p_photo,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='ps-task-photos' and name=p_photo)) then raise exception 'Фото недоступно';end if;
 insert into public.ps_workout_logs(user_id,workout_id,log_date,photo_path) values(auth.uid(),p_workout,(now() at time zone 'Asia/Yakutsk')::date,p_photo)
 on conflict(user_id,workout_id,log_date) do update set photo_path=coalesce(excluded.photo_path,public.ps_workout_logs.photo_path);
 select * into e from public.ps_marathon_enrollments where user_id=auth.uid() and status='active' order by created_at desc limit 1 for update;
 if e.id is not null then
 d:=(now() at time zone 'Asia/Yakutsk')::date-e.start_date+1;
 if d between 1 and 30 then
 perform ps_private.prepare(e.id);
 for t in select task_key,kind from public.ps_marathon_tasks where enrollment_id=e.id and day_number=d and active and (kind='workout' or (kind='workout_photo' and p_photo is not null)) loop
 perform public.ps_complete_marathon_task(e.id,d,t.task_key,p_photo,null);
 end loop;
 end if;end if;
end $function$;
CREATE OR REPLACE FUNCTION ps_private.refresh(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare pct integer;uid uuid;r record;
begin
 select user_id into uid from public.ps_marathon_enrollments where id=p_id for update;
 select coalesce(floor(100.0*count(*) filter(where completed_at is not null and active)/nullif(count(*) filter(where active),0)),0)::int into pct from public.ps_marathon_tasks where enrollment_id=p_id;
 update public.ps_marathon_enrollments set stars=coalesce(legacy_stars,0)+(select coalesce(sum(stars),0) from public.ps_marathon_tasks where enrollment_id=p_id and completed_at is not null)+(select coalesce(sum(stars),0) from public.ps_marathon_weight_checks where enrollment_id=p_id) where id=p_id;
 for r in update public.ps_marathon_rewards set unlocked_at=now() where enrollment_id=p_id and milestone<=pct and unlocked_at is null returning * loop
 insert into public.ps_notifications(recipient_id,reward_id,title,body) values(uid,r.id,'🎉 Новое достижение!','Марафон пройден на '||r.milestone||'%. Откройте «Достижения».') on conflict do nothing;
 end loop;
end $function$;
CREATE OR REPLACE FUNCTION public.ps_marathon_state(p_user uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid:=coalesce(p_user,auth.uid());e public.ps_marathon_enrollments;result jsonb;
begin
 if auth.uid() is null or not(uid=auth.uid() or public.ps_can_coach(uid)) then raise exception 'Нет доступа';end if;
 select * into e from public.ps_marathon_enrollments where user_id=uid and status='active' order by created_at desc limit 1;
 if e.id is null then return jsonb_build_object('enrollment',null);end if;
 perform ps_private.prepare(e.id);perform ps_private.refresh(e.id);
 select jsonb_build_object('enrollment',to_jsonb(x),'day',least(30,greatest(0,(now() at time zone 'Asia/Yakutsk')::date-x.start_date+1)),
 'actual_day',(now() at time zone 'Asia/Yakutsk')::date-x.start_date+1,
 'percent',(select coalesce(floor(100.0*count(*) filter(where completed_at is not null and active)/nullif(count(*) filter(where active),0)),0) from public.ps_marathon_tasks where enrollment_id=e.id),
 'tasks',(select coalesce(jsonb_agg(t order by day_number,task_key),'[]'::jsonb) from public.ps_marathon_tasks t where enrollment_id=e.id),
 'rewards',(select jsonb_agg(r order by milestone) from public.ps_marathon_rewards r where enrollment_id=e.id),
 'checks',(select coalesce(jsonb_agg(w order by day_number),'[]'::jsonb) from public.ps_marathon_weight_checks w where enrollment_id=e.id)) into result from public.ps_marathon_enrollments x where id=e.id;
 return result;
end $function$;
CREATE OR REPLACE FUNCTION public.ps_reward_action(p_reward uuid, p_action text, p_gift text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.ps_marathon_rewards;e public.ps_marathon_enrollments;cid uuid;name text;
begin
 if auth.uid() is null then raise exception 'Нет доступа';end if;
 select * into r from public.ps_marathon_rewards where id=p_reward;
 select * into e from public.ps_marathon_enrollments where id=r.enrollment_id for update;
 if e.id is null then raise exception 'Награда не найдена';end if;
 perform ps_private.refresh(e.id);
 select * into r from public.ps_marathon_rewards where id=p_reward for update;
 if p_action in('set','issue') then
 if not public.ps_can_coach(e.user_id) then raise exception 'Нет доступа';end if;
 if p_action='set' then
 if r.unlocked_at is not null then raise exception 'Подарок уже зафиксирован';end if;
 if p_gift is null or length(trim(p_gift)) not between 1 and 200 then raise exception 'Укажите подарок';end if;
 update public.ps_marathon_rewards set gift=trim(p_gift) where id=r.id;
 else
 if r.requested_at is null then raise exception 'Клиент ещё не запросил подарок';end if;
 if r.issued_at is not null then return;end if;
 update public.ps_marathon_rewards set issued_at=now(),issued_by=auth.uid() where id=r.id;
 insert into public.ps_notifications(recipient_id,reward_id,title,body) values(e.user_id,r.id,'🎁 Подарок выдан','Ваш подарок: '||r.gift) on conflict do nothing;
 end if;
 elsif p_action in('claim','seen') then
 if e.user_id<>auth.uid() then raise exception 'Нет доступа';end if;
 if r.unlocked_at is null then raise exception 'Награда ещё закрыта';end if;
 if p_action='seen' then update public.ps_marathon_rewards set announced_at=coalesce(announced_at,now()) where id=r.id;
 else
 if r.gift is null then raise exception 'Консультант ещё выбирает подарок';end if;
 if r.requested_at is not null or r.issued_at is not null then return;end if;
 select c.user_id,p.full_name into cid,name from public.ps_profiles p join public.ps_consultants c on c.id=p.consultant_id where p.id=e.user_id and c.active;
 if cid is null then raise exception 'Консультант пока не подключил кабинет';end if;
 update public.ps_marathon_rewards set requested_at=now() where id=r.id;
 insert into public.ps_notifications(recipient_id,reward_id,title,body) values(cid,r.id,'🎁 Награда ожидает выдачи',name||' · '||r.milestone||'% · '||r.gift) on conflict do nothing;
 end if;
 else raise exception 'Неизвестное действие';end if;
end $function$;

do $$declare r record;begin for r in select p.oid::regprocedure fn from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('ps_thread_access','ps_open_dialog','ps_send_direct','ps_mark_chat_read','ps_unread_counts','ps_chat_people','ps_request_result_consent','ps_answer_result_consent','ps_result_access','ps_set_client_task') loop execute format('revoke all on function %s from public,anon',r.fn);execute format('grant execute on function %s to authenticated',r.fn);end loop;end $$;
revoke all on function ps_private.coach_event(uuid,text,text,text,jsonb),ps_private.client_events(),ps_private.direct_notice() from public,anon,authenticated;
