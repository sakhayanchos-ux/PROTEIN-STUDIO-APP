-- Additive release 52: existing auth, chat, progress and photos are retained.
create schema if not exists ps_private;
revoke all on schema ps_private from public,anon,authenticated;
grant select on public.ps_marathon_days to authenticated;
alter table public.ps_marathon_enrollments add column if not exists task_plan_ready boolean not null default false;
alter table public.ps_marathon_enrollments add column if not exists weight_baseline numeric;
alter table public.ps_marathon_enrollments add column if not exists legacy_stars integer;
update public.ps_marathon_enrollments set legacy_stars=stars where legacy_stars is null;

create table public.ps_workouts(
 id uuid primary key default gen_random_uuid(), consultant_id uuid references public.ps_consultants(id),
 title text not null check(length(title) between 1 and 160),cover_path text,minutes integer not null check(minutes between 1 and 180),
 level text not null check(level in ('Начальный','Средний','Продвинутый')),place text not null check(place in ('Дома','Зал','Везде')),
 description text not null default '' check(length(description)<=2000),source_type text not null check(source_type in ('youtube','upload')),
 video_url text,video_path text,active boolean not null default true,created_at timestamptz not null default now(),
 check((source_type='youtube' and video_url ~ '^https://(www\.)?(youtube\.com/|youtu\.be/)' and video_path is null) or (source_type='upload' and video_path is not null and video_url is null))
);
create table public.ps_workout_logs(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.ps_profiles(id),workout_id uuid references public.ps_workouts(id),
 log_date date not null,completed_at timestamptz not null default now(),photo_path text,
 unique nulls not distinct(user_id,workout_id,log_date)
);
create table public.ps_marathon_task_templates(
 id uuid primary key default gen_random_uuid(),consultant_id uuid references public.ps_consultants(id),task_key text not null check(task_key ~ '^[a-z0-9_]{1,60}$'),
 title text not null check(length(title) between 1 and 160),kind text not null check(kind in ('check','workout','workout_photo','food_photo','steps','topic')),
 stars integer not null default 1 check(stars between 0 and 10),target integer not null default 0 check(target between 0 and 100000),active boolean not null default true,
 unique nulls not distinct(consultant_id,task_key)
);
insert into public.ps_marathon_task_templates(task_key,title,kind,target) values
 ('workout','Тренировка выполнена','workout',0),('workout_photo','Фото тренировки','workout_photo',0),('food_photo','Фото дневника питания','food_photo',0),('daily_plan','План дня выполнен','check',0),('steps','Пройти 5 000 шагов','steps',5000),('topic','Посмотреть тему дня','topic',0);
create table public.ps_marathon_tasks(
 enrollment_id uuid not null references public.ps_marathon_enrollments(id) on delete cascade,day_number integer not null check(day_number between 1 and 30),task_key text not null,
 title text not null,kind text not null,stars integer not null check(stars>=0),target integer not null default 0,
 completed_at timestamptz,photo_path text,value integer,primary key(enrollment_id,day_number,task_key)
);
create table public.ps_marathon_weight_checks(
 enrollment_id uuid not null references public.ps_marathon_enrollments(id) on delete cascade,day_number integer not null check(day_number in (10,20,30)),
 weight_kg numeric not null check(weight_kg between 25 and 400),stars integer not null check(stars>=0),created_at timestamptz not null default now(),primary key(enrollment_id,day_number)
);
create table public.ps_marathon_rewards(
 id uuid primary key default gen_random_uuid(),enrollment_id uuid not null references public.ps_marathon_enrollments(id) on delete cascade,
 milestone integer not null check(milestone in (10,25,50,75,100)),gift text check(length(gift) between 1 and 200),
 unlocked_at timestamptz,requested_at timestamptz,issued_at timestamptz,issued_by uuid references public.ps_profiles(id),announced_at timestamptz,
 unique(enrollment_id,milestone)
);
create table public.ps_notifications(
 id uuid primary key default gen_random_uuid(),recipient_id uuid not null references public.ps_profiles(id),reward_id uuid references public.ps_marathon_rewards(id),
 title text not null,body text not null,created_at timestamptz not null default now(),read_at timestamptz,
 unique(recipient_id,reward_id,title)
);
create index on public.ps_workouts(consultant_id);
create index on public.ps_workout_logs(user_id,log_date);
create index on public.ps_notifications(recipient_id,created_at desc);
create index on public.ps_notifications(reward_id);
create index on public.ps_marathon_rewards(issued_by);

-- Only own clients can be coached. No reliance on editable auth metadata.
create function public.ps_can_coach(p_user uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.ps_profiles p join public.ps_consultants c on c.id=p.consultant_id where p.id=p_user and c.user_id=auth.uid() and c.active)
$$;
revoke all on function public.ps_can_coach(uuid) from public,anon;grant execute on function public.ps_can_coach(uuid) to authenticated;

do $$ declare t text;begin
 foreach t in array array['ps_workouts','ps_workout_logs','ps_marathon_task_templates','ps_marathon_tasks','ps_marathon_weight_checks','ps_marathon_rewards','ps_notifications'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on table public.%I from anon,authenticated',t);
 execute format('grant select on table public.%I to authenticated',t);
 end loop;
end $$;
create policy workouts_read on public.ps_workouts for select to authenticated using (
 consultant_id is null or consultant_id in(select consultant_id from public.ps_profiles where id=auth.uid()) or consultant_id in(select id from public.ps_consultants where user_id=auth.uid() and active));
create policy logs_read on public.ps_workout_logs for select to authenticated using(user_id=auth.uid() or public.ps_can_coach(user_id));
create policy templates_read on public.ps_marathon_task_templates for select to authenticated using(consultant_id is null or consultant_id in(select id from public.ps_consultants where user_id=auth.uid() and active));
create policy tasks_read on public.ps_marathon_tasks for select to authenticated using(exists(select 1 from public.ps_marathon_enrollments e where e.id=enrollment_id));
create policy checks_read on public.ps_marathon_weight_checks for select to authenticated using(exists(select 1 from public.ps_marathon_enrollments e where e.id=enrollment_id));
create policy rewards_read on public.ps_marathon_rewards for select to authenticated using(exists(select 1 from public.ps_marathon_enrollments e where e.id=enrollment_id));
create policy notifications_read on public.ps_notifications for select to authenticated using(recipient_id=auth.uid());
grant update(read_at) on public.ps_notifications to authenticated;
create policy notifications_update on public.ps_notifications for update to authenticated using(recipient_id=auth.uid()) with check(recipient_id=auth.uid());

-- Internal routines have no API grants; public wrappers authenticate and authorize before use.
create function ps_private.prepare(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare e public.ps_marathon_enrollments;cid uuid;
begin
 select * into e from public.ps_marathon_enrollments where id=p_id for update;
 if e.id is null then raise exception 'Марафон не найден';end if;
 if not e.task_plan_ready then
 select consultant_id into cid from public.ps_profiles where id=e.user_id;
 insert into public.ps_marathon_tasks(enrollment_id,day_number,task_key,title,kind,stars,target)
 select e.id,d,t.task_key,t.title,t.kind,t.stars,t.target from generate_series(1,30)d cross join (
 select distinct on(task_key) * from public.ps_marathon_task_templates where consultant_id is null or consultant_id=cid order by task_key,consultant_id nulls last
 )t where t.active on conflict do nothing;
 update public.ps_marathon_enrollments set task_plan_ready=true,legacy_stars=coalesce(legacy_stars,stars),weight_baseline=(select starting_weight_kg from public.ps_assessments where user_id=e.user_id) where id=e.id;
 end if;
 insert into public.ps_marathon_rewards(enrollment_id,milestone) select e.id,n from unnest(array[10,25,50,75,100])n on conflict do nothing;
end $$;
create function ps_private.refresh(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare pct integer;uid uuid;r record;
begin
 select user_id into uid from public.ps_marathon_enrollments where id=p_id for update;
 select coalesce(floor(100.0*count(*) filter(where completed_at is not null)/nullif(count(*),0)),0)::int into pct from public.ps_marathon_tasks where enrollment_id=p_id;
 update public.ps_marathon_enrollments set stars=coalesce(legacy_stars,0)+(select coalesce(sum(stars),0) from public.ps_marathon_tasks where enrollment_id=p_id and completed_at is not null)+(select coalesce(sum(stars),0) from public.ps_marathon_weight_checks where enrollment_id=p_id) where id=p_id;
 for r in update public.ps_marathon_rewards set unlocked_at=now() where enrollment_id=p_id and milestone<=pct and unlocked_at is null returning * loop
 insert into public.ps_notifications(recipient_id,reward_id,title,body) values(uid,r.id,'🎉 Новое достижение!','Марафон пройден на '||r.milestone||'%. Откройте «Достижения».') on conflict do nothing;
 end loop;
end $$;
create function public.ps_marathon_state(p_user uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=coalesce(p_user,auth.uid());e public.ps_marathon_enrollments;result jsonb;
begin
 if auth.uid() is null or not(uid=auth.uid() or public.ps_can_coach(uid)) then raise exception 'Нет доступа';end if;
 select * into e from public.ps_marathon_enrollments where user_id=uid and status='active' order by created_at desc limit 1;
 if e.id is null then return jsonb_build_object('enrollment',null);end if;
 perform ps_private.prepare(e.id);perform ps_private.refresh(e.id);
 select jsonb_build_object('enrollment',to_jsonb(x),'day',least(30,greatest(0,(now() at time zone 'Asia/Yakutsk')::date-x.start_date+1)),
 'actual_day',(now() at time zone 'Asia/Yakutsk')::date-x.start_date+1,
 'percent',(select coalesce(floor(100.0*count(*) filter(where completed_at is not null)/nullif(count(*),0)),0) from public.ps_marathon_tasks where enrollment_id=e.id),
 'tasks',(select coalesce(jsonb_agg(t order by day_number,task_key),'[]'::jsonb) from public.ps_marathon_tasks t where enrollment_id=e.id),
 'rewards',(select jsonb_agg(r order by milestone) from public.ps_marathon_rewards r where enrollment_id=e.id),
 'checks',(select coalesce(jsonb_agg(w order by day_number),'[]'::jsonb) from public.ps_marathon_weight_checks w where enrollment_id=e.id)) into result from public.ps_marathon_enrollments x where id=e.id;
 return result;
end $$;
create function public.ps_complete_marathon_task(p_enrollment uuid,p_day integer,p_key text,p_photo text default null,p_value integer default null) returns void language plpgsql security definer set search_path='' as $$
declare e public.ps_marathon_enrollments;t public.ps_marathon_tasks;day_date date;
begin
 if auth.uid() is null then raise exception 'Нет доступа';end if;
 select * into e from public.ps_marathon_enrollments where id=p_enrollment and user_id=auth.uid() and status='active' for update;
 if e.id is null or exists(select 1 from public.ps_consultants where user_id=auth.uid() and active) then raise exception 'Нет доступа';end if;
 day_date:=e.start_date+p_day-1;
 if p_day not between 1 and 30 or day_date>(now() at time zone 'Asia/Yakutsk')::date then raise exception 'День пока закрыт';end if;
 perform ps_private.prepare(e.id);
 select * into t from public.ps_marathon_tasks where enrollment_id=e.id and day_number=p_day and task_key=p_key;
 if t.task_key is null then raise exception 'Задание не найдено';end if;
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
end $$;
create function public.ps_log_workout(p_workout uuid default null,p_photo text default null) returns void language plpgsql security definer set search_path='' as $$
declare e public.ps_marathon_enrollments;d integer;t record;
begin
 if auth.uid() is null or exists(select 1 from public.ps_consultants where user_id=auth.uid() and active) then raise exception 'Нет доступа';end if;
 if p_workout is not null and not exists(select 1 from public.ps_workouts w where w.id=p_workout and active and (consultant_id is null or consultant_id=(select consultant_id from public.ps_profiles where id=auth.uid()))) then raise exception 'Тренировка недоступна';end if;
 if p_photo is not null and (split_part(p_photo,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='ps-task-photos' and name=p_photo)) then raise exception 'Фото недоступно';end if;
 insert into public.ps_workout_logs(user_id,workout_id,log_date,photo_path) values(auth.uid(),p_workout,(now() at time zone 'Asia/Yakutsk')::date,p_photo)
 on conflict(user_id,workout_id,log_date) do update set photo_path=coalesce(excluded.photo_path,public.ps_workout_logs.photo_path);
 select * into e from public.ps_marathon_enrollments where user_id=auth.uid() and status='active' order by created_at desc limit 1 for update;
 if e.id is not null then
 d:=(now() at time zone 'Asia/Yakutsk')::date-e.start_date+1;
 if d between 1 and 30 then
 perform ps_private.prepare(e.id);
 for t in select task_key,kind from public.ps_marathon_tasks where enrollment_id=e.id and day_number=d and (kind='workout' or (kind='workout_photo' and p_photo is not null)) loop
 perform public.ps_complete_marathon_task(e.id,d,t.task_key,p_photo,null);
 end loop;
 end if;end if;
end $$;
create function public.ps_marathon_weigh(p_enrollment uuid,p_weight numeric) returns void language plpgsql security definer set search_path='' as $$
declare e public.ps_marathon_enrollments;d integer;earned integer;previous integer;
begin
 if auth.uid() is null or exists(select 1 from public.ps_consultants where user_id=auth.uid() and active) then raise exception 'Нет доступа';end if;
 select * into e from public.ps_marathon_enrollments where id=p_enrollment and user_id=auth.uid() and status='active' for update;
 if e.id is null then raise exception 'Нет доступа';end if;
 perform ps_private.prepare(e.id);select * into e from public.ps_marathon_enrollments where id=e.id;
 d:=(now() at time zone 'Asia/Yakutsk')::date-e.start_date+1;
 if d not in (10,20,30) then raise exception 'Контроль веса доступен в дни 10, 20 и 30';end if;
 if p_weight is null or p_weight not between 25 and 400 then raise exception 'Проверьте вес';end if;
 if exists(select 1 from public.ps_marathon_weight_checks where enrollment_id=e.id and day_number=d) then return;end if;
 if e.weight_baseline is null then raise exception 'Не указан стартовый вес. Обратитесь к консультанту';end if;
 select coalesce(sum(stars),0) into previous from public.ps_marathon_weight_checks where enrollment_id=e.id;
 earned:=greatest(0,floor((e.weight_baseline-p_weight)/0.5)::int-previous);
 insert into public.ps_marathon_weight_checks(enrollment_id,day_number,weight_kg,stars) values(e.id,d,p_weight,earned);
 perform public.ps_save_progress(p_weight,null,null,null);
 perform ps_private.refresh(e.id);
end $$;
create function public.ps_reward_action(p_reward uuid,p_action text,p_gift text default null) returns void language plpgsql security definer set search_path='' as $$
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
 if r.unlocked_at is not null and r.gift is not null then raise exception 'Подарок уже зафиксирован';end if;
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
end $$;
create function public.ps_save_workout(p_id uuid,p_consultant uuid,p_title text,p_minutes integer,p_level text,p_place text,p_description text,p_source text,p_url text,p_video text,p_cover text,p_active boolean default true) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;path text;
begin
 if auth.uid() is null or not exists(select 1 from public.ps_consultants where id=p_consultant and user_id=auth.uid() and active) then raise exception 'Нет доступа';end if;
 foreach path in array array[p_video,p_cover] loop
 if path is not null and (split_part(path,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='ps-workout-media' and name=path)) then raise exception 'Файл недоступен';end if;
 end loop;
 if p_id is null then
 insert into public.ps_workouts(consultant_id,title,minutes,level,place,description,source_type,video_url,video_path,cover_path,active) values(p_consultant,trim(p_title),p_minutes,p_level,p_place,p_description,p_source,p_url,p_video,p_cover,p_active) returning id into result;
 else
 update public.ps_workouts set title=trim(p_title),minutes=p_minutes,level=p_level,place=p_place,description=p_description,source_type=p_source,video_url=p_url,video_path=p_video,cover_path=p_cover,active=p_active where id=p_id and consultant_id=p_consultant returning id into result;
 if result is null then raise exception 'Тренировка не найдена';end if;
 end if;return result;
end $$;
create function public.ps_save_task_template(p_consultant uuid,p_key text,p_title text,p_kind text,p_stars integer,p_target integer,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.ps_consultants where id=p_consultant and user_id=auth.uid() and active) then raise exception 'Нет доступа';end if;
 insert into public.ps_marathon_task_templates(consultant_id,task_key,title,kind,stars,target,active) values(p_consultant,p_key,p_title,p_kind,p_stars,p_target,p_active)
 on conflict(consultant_id,task_key) do update set title=excluded.title,kind=excluded.kind,stars=excluded.stars,target=excluded.target,active=excluded.active;
end $$;
revoke all on all functions in schema ps_private from public,anon,authenticated;
do $$ declare f record;begin
 for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('ps_marathon_state','ps_complete_marathon_task','ps_log_workout','ps_marathon_weigh','ps_reward_action','ps_save_workout','ps_save_task_template') loop
 execute 'revoke all on function '||f.sig||' from public,anon';execute 'grant execute on function '||f.sig||' to authenticated';
 end loop;
end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('ps-task-photos','ps-task-photos',false,10485760,array['image/jpeg','image/png','image/webp']),
 ('ps-workout-media','ps-workout-media',false,52428800,array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/webm']) on conflict(id) do nothing;
create policy task_photos_insert on storage.objects for insert to authenticated with check(bucket_id='ps-task-photos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy task_photos_read on storage.objects for select to authenticated using(bucket_id='ps-task-photos' and ((storage.foldername(name))[1]=auth.uid()::text or exists(select 1 from public.ps_profiles p where p.id::text=(storage.foldername(name))[1] and public.ps_can_coach(p.id))));
create policy workout_media_insert on storage.objects for insert to authenticated with check(bucket_id='ps-workout-media' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.ps_consultants where user_id=auth.uid() and active));
create policy workout_media_read on storage.objects for select to authenticated using(bucket_id='ps-workout-media' and ((storage.foldername(name))[1]=auth.uid()::text or exists(select 1 from public.ps_workouts w where w.cover_path=name or w.video_path=name)));
