-- Separate coach workspace from client participation. No accounts or result records are deleted.
create table public.ps_coach_self_profiles(consultant_id uuid not null references public.ps_consultants(id),profile_id uuid not null references public.ps_profiles(id),primary key(consultant_id,profile_id));
alter table public.ps_coach_self_profiles enable row level security;
revoke all on public.ps_coach_self_profiles from anon,authenticated;
grant select on public.ps_coach_self_profiles to authenticated;
create policy self_exclusions_read on public.ps_coach_self_profiles for select to authenticated using(consultant_id in(select id from public.ps_consultants where user_id=auth.uid() and active));
insert into public.ps_coach_self_profiles select id,user_id from public.ps_consultants where user_id is not null on conflict do nothing;
-- Explicitly identified legacy self record, excluded without granting it staff rights.
insert into public.ps_coach_self_profiles select c.id,p.id from public.ps_consultants c join public.ps_profiles p on p.consultant_id=c.id and p.phone=c.contact_phone where c.referral_code='SAKHAYANA' and p.full_name='Сахаяна Дмитриевна Скрябина' on conflict do nothing;
update public.ps_profiles p set role='consultant' where role='client' and exists(select 1 from public.ps_consultants c where c.user_id=p.id and c.active);
create function public.ps_my_clients(p_offset integer default 0) returns setof public.ps_profiles language sql stable security invoker set search_path='' as $$
 select p.* from public.ps_profiles p where p.id<>auth.uid() and p.consultant_id in(select id from public.ps_consultants where user_id=auth.uid() and active)
 and not exists(select 1 from public.ps_consultants c where c.user_id=p.id and c.id=p.consultant_id and c.active)
 and not exists(select 1 from public.ps_coach_self_profiles x where x.consultant_id=p.consultant_id and x.profile_id=p.id)
 order by p.created_at desc,p.id limit 200 offset greatest(0,p_offset)
$$;

create table public.ps_business_months(user_id uuid not null references public.ps_profiles(id),month_start date not null check(extract(day from month_start)=1),targets jsonb not null default '{}',updated_at timestamptz not null default now(),primary key(user_id,month_start));
create table public.ps_business_days(user_id uuid not null references public.ps_profiles(id),entry_date date not null,results jsonb not null default '{}',updated_at timestamptz not null default now(),primary key(user_id,entry_date));
create table public.ps_business_weeks(user_id uuid not null references public.ps_profiles(id),week_start date not null check(extract(isodow from week_start)=1),targets jsonb not null default '{}',analysis text not null default '' check(length(analysis)<=4000),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),primary key(user_id,week_start));
do $$ declare t text;begin foreach t in array array['ps_business_months','ps_business_days','ps_business_weeks'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);
 execute format('create policy own_business_read on public.%I for select to authenticated using(user_id=(select auth.uid()))',t);
end loop;end $$;
create function ps_private.business_values(p_data jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare k text;v numeric;r jsonb:='{}';begin
 foreach k in array array['points','wellness','scans','meetings','talks','contacts','clients'] loop
 if p_data?k and jsonb_typeof(p_data->k)<>'number' then raise exception 'Показатели должны быть числами';end if;
 v:=coalesce((p_data->>k)::numeric,0);
 if v<0 or v>10000000 or (k<>'points' and trunc(v)<>v) then raise exception 'Проверьте значения показателей';end if;
 r:=r||jsonb_build_object(k,v);end loop;return r;
end $$;
create function ps_private.business_facts(p_user uuid,p_from date,p_to date) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_object_agg(key,total),'{}') from (select j.key,sum(j.value::numeric) total from public.ps_business_days d cross join lateral jsonb_each_text(d.results)j where d.user_id=p_user and entry_date between p_from and p_to group by j.key)x
$$;
create function ps_private.business_prepare(p_user uuid) returns void language plpgsql security definer set search_path='' as $$
declare current_week date:=date_trunc('week',now() at time zone 'Asia/Yakutsk')::date;first_week date;w date;goals jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,5301));
 select coalesce(min(week_start),current_week) into first_week from public.ps_business_weeks where user_id=p_user;
 for w in select generate_series(first_week,current_week,'7 days')::date loop
 if not exists(select 1 from public.ps_business_weeks where user_id=p_user and week_start=w) then
 select coalesce(jsonb_object_agg(key,ceil(amount)),'{}') into goals from (
 select j.key,sum(j.value::numeric/extract(day from (date_trunc('month',d)+'1 month'::interval-'1 day'::interval))) amount
 from generate_series(w,w+6,'1 day')d join public.ps_business_months m on m.user_id=p_user and m.month_start=date_trunc('month',d)::date cross join lateral jsonb_each_text(m.targets)j group by j.key)x;
 insert into public.ps_business_weeks(user_id,week_start,targets) values(p_user,w,goals) on conflict do nothing;
 end if;end loop;
end $$;
create function public.ps_business_state() returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();today date:=(now() at time zone 'Asia/Yakutsk')::date;mon date:=date_trunc('month',today)::date;wk date:=date_trunc('week',today)::date;
begin
 if uid is null or not exists(select 1 from public.ps_consultants where user_id=uid and active) then raise exception 'Нет доступа';end if;
 perform ps_private.business_prepare(uid);
 return jsonb_build_object('today',today,'month',mon,'week',wk,'next_monday',wk+7,
 'month_targets',coalesce((select targets from public.ps_business_months where user_id=uid and month_start=mon),'{}'::jsonb),
 'month_facts',ps_private.business_facts(uid,mon,(mon+'1 month'::interval-'1 day'::interval)::date),
 'days',coalesce((select jsonb_agg(d order by entry_date) from public.ps_business_days d where user_id=uid and entry_date>=wk),'[]'::jsonb),
 'weeks',(select jsonb_agg(to_jsonb(w)||jsonb_build_object('closed',w.week_start<wk,'facts',ps_private.business_facts(uid,w.week_start,w.week_start+6)) order by w.week_start desc) from public.ps_business_weeks w where user_id=uid));
end $$;
create function public.ps_save_business(p_kind text,p_date date,p_values jsonb default '{}',p_analysis text default '') returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();today date:=(now() at time zone 'Asia/Yakutsk')::date;wk date:=date_trunc('week',today)::date;v jsonb;
begin
 if uid is null or not exists(select 1 from public.ps_consultants where user_id=uid and active) then raise exception 'Нет доступа';end if;
 perform ps_private.business_prepare(uid);v:=ps_private.business_values(p_values);
 if p_kind='month' then
 if p_date is distinct from date_trunc('month',today)::date then raise exception 'Можно изменить только план текущего месяца';end if;
 insert into public.ps_business_months(user_id,month_start,targets) values(uid,p_date,v) on conflict(user_id,month_start) do update set targets=excluded.targets,updated_at=now();
 elsif p_kind='day' then
 if p_date is null or p_date<wk or p_date>today then raise exception 'Закрытая неделя не редактируется';end if;
 insert into public.ps_business_days(user_id,entry_date,results) values(uid,p_date,v) on conflict(user_id,entry_date) do update set results=excluded.results,updated_at=now();
 elsif p_kind='week' then
 if p_date is distinct from wk then raise exception 'Неделя закрыта';end if;
 update public.ps_business_weeks set targets=v,analysis=coalesce(p_analysis,''),updated_at=now() where user_id=uid and week_start=wk;
 else raise exception 'Неизвестный раздел';end if;
end $$;
create function public.ps_save_coach_goal(p_start numeric,p_target numeric,p_waist numeric default null) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.ps_consultants where user_id=auth.uid() and active) then raise exception 'Нет доступа';end if;
 if p_start is null or p_target is null or p_start not between 25 and 400 or p_target not between 25 and 400 or (p_waist is not null and p_waist not between 30 and 250) then raise exception 'Проверьте вес и талию';end if;
 insert into public.ps_assessments(user_id,starting_weight_kg,target_weight_kg,waist_cm,completed_at) values(auth.uid(),p_start,p_target,p_waist,now())
 on conflict(user_id) do update set starting_weight_kg=excluded.starting_weight_kg,target_weight_kg=excluded.target_weight_kg,waist_cm=coalesce(excluded.waist_cm,public.ps_assessments.waist_cm),updated_at=now();
end $$;

-- Single-use, revocable, phone-bound invitations. Only a digest is stored.
create table ps_private.coach_invitations(id uuid primary key default gen_random_uuid(),created_by uuid not null references public.ps_profiles(id),token_hash text not null unique,name text not null,phone text not null,target_consultant uuid references public.ps_consultants(id),expires_at timestamptz not null default now()+'7 days'::interval,created_at timestamptz not null default now(),used_by uuid references public.ps_profiles(id),used_at timestamptz,revoked_at timestamptz);
alter table ps_private.coach_invitations enable row level security;
revoke all on ps_private.coach_invitations from public,anon,authenticated;
create function public.ps_create_coach_invitation(p_name text,p_phone text,p_target uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare token text:=encode(extensions.gen_random_bytes(32),'hex');iid uuid;phone text;target uuid:=p_target;
begin
 if auth.uid() is null or not exists(select 1 from public.ps_consultants where user_id=auth.uid() and active) then raise exception 'Нет доступа';end if;
 phone:=regexp_replace(p_phone,'[^0-9]','','g');if length(phone)=11 and left(phone,1)='8' then phone:='7'||substr(phone,2);end if;
 if phone is null or phone!~'^7[0-9]{10}$' or p_name is null or length(trim(p_name)) not between 1 and 100 then raise exception 'Введите имя и телефон +7';end if;
 if target is not null and not exists(select 1 from public.ps_consultants where id=target and user_id is null and active and regexp_replace(contact_phone,'[^0-9]','','g')=phone) then raise exception 'Эта карточка уже подключена или номер не совпадает';end if;
 if target is null then select id into target from public.ps_consultants where user_id is null and active and regexp_replace(contact_phone,'[^0-9]','','g')=phone limit 1;end if;
 insert into ps_private.coach_invitations(created_by,token_hash,name,phone,target_consultant) values(auth.uid(),encode(extensions.digest(token,'sha256'),'hex'),trim(p_name),'+'||phone,target) returning id into iid;
 return jsonb_build_object('id',iid,'token',token,'expires_at',now()+'7 days'::interval);
end $$;
create function public.ps_my_coach_invitations() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.ps_consultants where user_id=auth.uid() and active) then raise exception 'Нет доступа';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'phone',phone,'expires_at',expires_at,'used_at',used_at,'revoked_at',revoked_at) order by created_at desc) from ps_private.coach_invitations where created_by=auth.uid()),'[]');
end $$;
create function public.ps_revoke_coach_invitation(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.ps_consultants where user_id=auth.uid() and active) then raise exception 'Нет доступа';end if;
 update ps_private.coach_invitations set revoked_at=now() where id=p_id and created_by=auth.uid() and used_at is null;
end $$;
create function public.ps_accept_coach_invitation(p_token text) returns uuid language plpgsql security definer set search_path='' as $$
declare i ps_private.coach_invitations;uid uuid:=auth.uid();email text;cid uuid;
begin
 if uid is null then raise exception 'Сначала войдите в аккаунт';end if;
 if p_token is null or p_token!~'^[a-f0-9]{64}$' then raise exception 'Приглашение недействительно';end if;
 select * into i from ps_private.coach_invitations where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if i.id is null or i.revoked_at is not null or i.expires_at<=now() then raise exception 'Приглашение недействительно или срок истёк';end if;
 if i.used_by=uid then select id into cid from public.ps_consultants where user_id=uid and active;return cid;end if;
 if i.used_at is not null then raise exception 'Приглашение уже использовано';end if;
 select u.email into email from auth.users u where u.id=uid;
 if email is distinct from 'phone.'||substr(i.phone,2)||'@protein-studio.app' then raise exception 'Войдите по номеру, для которого создано приглашение';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,5302));
 if exists(select 1 from public.ps_consultants where user_id=uid) then raise exception 'Ваш кабинет консультанта уже подключён';end if;
 if i.target_consultant is not null then
 update public.ps_consultants set user_id=uid where id=i.target_consultant and user_id is null and active returning id into cid;
 if cid is null then raise exception 'Карточка уже занята. Запросите новое приглашение';end if;
 else
 insert into public.ps_consultants(user_id,display_name,contact_phone,referral_code,active) values(uid,i.name,i.phone,'C'||upper(substr(encode(extensions.gen_random_bytes(12),'hex'),1,16)),true) returning id into cid;
 end if;
 update public.ps_profiles set role='consultant' where id=uid;
 insert into public.ps_coach_self_profiles(consultant_id,profile_id) values(cid,uid) on conflict do nothing;
 update ps_private.coach_invitations set used_at=now(),used_by=uid where id=i.id;
 return cid;
end $$;
revoke all on all functions in schema ps_private from public,anon,authenticated;
do $$ declare f record;begin
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('ps_my_clients','ps_business_state','ps_save_business','ps_save_coach_goal','ps_create_coach_invitation','ps_my_coach_invitations','ps_revoke_coach_invitation','ps_accept_coach_invitation') loop
 execute 'revoke all on function '||f.sig||' from public,anon';execute 'grant execute on function '||f.sig||' to authenticated';end loop;
end $$;
