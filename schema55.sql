-- Separate staff communication; existing accounts and client data remain untouched.
create function public.ps_staff_member(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.ps_profiles where id=p_user and role in('consultant','admin')) or exists(select 1 from public.ps_consultants where user_id=p_user and active) $$;
create table public.ps_staff_threads(id uuid primary key default gen_random_uuid(),member_a uuid references public.ps_profiles(id),member_b uuid references public.ps_profiles(id),created_at timestamptz not null default now(),check((member_a is null and member_b is null) or (member_a is not null and member_b is not null and member_a<member_b)),unique(member_a,member_b));
create unique index staff_one_group on public.ps_staff_threads((true)) where member_a is null;
insert into public.ps_staff_threads default values;
create table public.ps_staff_messages(id uuid primary key,thread_id uuid not null references public.ps_staff_threads(id),sender_id uuid not null references public.ps_profiles(id),body text not null default '' check(length(body)<=3000),image_path text,reply_to uuid references public.ps_staff_messages(id),created_at timestamptz not null default now(),check(length(trim(body))>0 or image_path is not null));
create index staff_messages_thread_date on public.ps_staff_messages(thread_id,created_at,id);
create table public.ps_staff_reactions(message_id uuid not null references public.ps_staff_messages(id),user_id uuid not null references public.ps_profiles(id),emoji text not null check(emoji in('❤️','👏','🔥','👍','🎉')),primary key(message_id,user_id,emoji));
create function public.ps_staff_access(p_thread uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and public.ps_staff_member(auth.uid()) and exists(select 1 from public.ps_staff_threads where id=p_thread and (member_a is null or auth.uid() in(member_a,member_b))) $$;
create function public.ps_staff_directory() returns table(id uuid,full_name text) language sql stable security definer set search_path='' as $$
 select p.id,p.full_name from public.ps_profiles p where public.ps_staff_member(auth.uid()) and public.ps_staff_member(p.id) order by p.full_name $$;
create function public.ps_open_staff_dialog(p_person uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare tid uuid;a uuid;b uuid;
begin
 if not public.ps_staff_member(auth.uid()) then raise exception 'Нет доступа';end if;
 if p_person is null then select id into tid from public.ps_staff_threads where member_a is null;return tid;end if;
 if p_person=auth.uid() or not public.ps_staff_member(p_person) then raise exception 'Диалог недоступен';end if;
 a:=least(auth.uid(),p_person);b:=greatest(auth.uid(),p_person);
 insert into public.ps_staff_threads(member_a,member_b) values(a,b) on conflict(member_a,member_b) do nothing;
 select id into tid from public.ps_staff_threads where member_a=a and member_b=b;return tid;
end $$;
create function public.ps_send_staff(p_thread uuid,p_id uuid,p_body text default '',p_photo text default null,p_reply uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
begin
 if not public.ps_staff_access(p_thread) then raise exception 'Нет доступа';end if;
 if p_reply is not null and not exists(select 1 from public.ps_staff_messages where id=p_reply and thread_id=p_thread) then raise exception 'Ответ недоступен';end if;
 if p_photo is not null and (split_part(p_photo,'/',1)<>auth.uid()::text or split_part(p_photo,'/',2)<>p_thread::text or not exists(select 1 from storage.objects where bucket_id='ps-staff-chat' and name=p_photo)) then raise exception 'Фото недоступно';end if;
 if exists(select 1 from public.ps_staff_messages where id=p_id and (sender_id<>auth.uid() or thread_id<>p_thread)) then raise exception 'Нет доступа';end if;
 insert into public.ps_staff_messages(id,thread_id,sender_id,body,image_path,reply_to) values(p_id,p_thread,auth.uid(),trim(coalesce(p_body,'')),p_photo,p_reply) on conflict(id) do nothing;return p_id;
end $$;
create function public.ps_react_staff(p_message uuid,p_emoji text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.ps_staff_messages where id=p_message and public.ps_staff_access(thread_id)) then raise exception 'Нет доступа';end if;
 if exists(select 1 from public.ps_staff_reactions where message_id=p_message and user_id=auth.uid() and emoji=p_emoji) then delete from public.ps_staff_reactions where message_id=p_message and user_id=auth.uid() and emoji=p_emoji;
 else insert into public.ps_staff_reactions values(p_message,auth.uid(),p_emoji);end if;
end $$;
alter table public.ps_staff_threads enable row level security;
alter table public.ps_staff_messages enable row level security;
alter table public.ps_staff_reactions enable row level security;
revoke all on public.ps_staff_threads,public.ps_staff_messages,public.ps_staff_reactions from anon,authenticated;
grant select on public.ps_staff_threads,public.ps_staff_messages,public.ps_staff_reactions to authenticated;
create policy staff_threads_read on public.ps_staff_threads for select to authenticated using(public.ps_staff_access(id));
create policy staff_messages_read on public.ps_staff_messages for select to authenticated using(public.ps_staff_access(thread_id));
create policy staff_reactions_read on public.ps_staff_reactions for select to authenticated using(exists(select 1 from public.ps_staff_messages m where m.id=message_id and public.ps_staff_access(m.thread_id)));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('ps-staff-chat','ps-staff-chat',false,10485760,array['image/jpeg','image/png','image/webp']);
create function public.ps_staff_photo_access(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.ps_staff_threads t where t.id::text=split_part(p_name,'/',2) and public.ps_staff_access(t.id)) $$;
create policy staff_photo_read on storage.objects for select to authenticated using(bucket_id='ps-staff-chat' and public.ps_staff_photo_access(name));
create policy staff_photo_upload on storage.objects for insert to authenticated with check(bucket_id='ps-staff-chat' and split_part(name,'/',1)=auth.uid()::text and public.ps_staff_photo_access(name));
create or replace function public.ps_mark_chat_read(p_channel text,p_until timestamptz) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Нет доступа';end if;
 if left(p_channel,6)='staff:' then
  if not public.ps_staff_access(substring(p_channel from 7)::uuid) then raise exception 'Нет доступа';end if;
 elsif p_channel<>'community' and not public.ps_thread_access(p_channel::uuid) then raise exception 'Нет доступа';end if;
 insert into public.ps_chat_reads(user_id,channel,last_read_at) values(auth.uid(),p_channel,least(p_until,now())) on conflict(user_id,channel) do update set last_read_at=greatest(public.ps_chat_reads.last_read_at,excluded.last_read_at);
end $$;
create or replace function public.ps_unread_counts() returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object('community',(select count(*) from public.ps_community_messages m where auth.uid() is not null and m.author_id<>auth.uid() and m.created_at>coalesce((select last_read_at from public.ps_chat_reads where user_id=auth.uid() and channel='community'),'-infinity')),'messages',(select count(*) from public.ps_direct_messages m where public.ps_thread_access(m.thread_id) and m.sender_id<>auth.uid() and m.created_at>coalesce((select last_read_at from public.ps_chat_reads where user_id=auth.uid() and channel=m.thread_id::text),'-infinity')),'consultants',(select count(*) from public.ps_staff_messages m where public.ps_staff_access(m.thread_id) and m.sender_id<>auth.uid() and m.created_at>coalesce((select last_read_at from public.ps_chat_reads where user_id=auth.uid() and channel='staff:'||m.thread_id::text),'-infinity')),'notifications',(select count(*) from public.ps_notifications where recipient_id=auth.uid() and read_at is null)) $$;
create or replace function public.ps_chat_people(p_ids uuid[]) returns table(id uuid,full_name text,avatar_path text) language sql stable security definer set search_path='' as $$
select p.id,p.full_name,case when p.avatar_path like p.id::text||'/avatar-%' then p.avatar_path end from public.ps_profiles p where auth.uid() is not null and p.id=any(p_ids) and (p.id=auth.uid() or (public.ps_staff_member(auth.uid()) and public.ps_staff_member(p.id)) or exists(select 1 from public.ps_community_messages m where m.author_id=p.id) or exists(select 1 from public.ps_direct_threads t where p.id in(t.client_id,t.coach_id) and public.ps_thread_access(t.id))) $$;
create or replace function public.ps_chat_avatar_visible(p_path text) returns boolean language sql stable security definer set search_path='' as $$
select auth.uid() is not null and exists(select 1 from public.ps_profiles p where p.avatar_path=p_path and p_path like p.id::text||'/avatar-%' and (p.id=auth.uid() or (public.ps_staff_member(auth.uid()) and public.ps_staff_member(p.id)) or exists(select 1 from public.ps_community_messages m where m.author_id=p.id) or exists(select 1 from public.ps_direct_threads t where p.id in(t.client_id,t.coach_id) and public.ps_thread_access(t.id)))) $$;
create function ps_private.staff_message_notice() returns trigger language plpgsql security definer set search_path='' as $$
declare t public.ps_staff_threads;sender text;
begin
 select * into t from public.ps_staff_threads where id=new.thread_id;
 select full_name into sender from public.ps_profiles where id=new.sender_id;
 insert into public.ps_notifications(recipient_id,title,body,event_key,route)
 select p.id,case when t.member_a is null then 'Чат консультантов' else 'Личное сообщение консультанта' end,coalesce(sender,'Консультант')||': '||case when new.image_path is not null then 'Фото' else left(new.body,120) end,'staff-message:'||new.id,jsonb_build_object('page','consultants','thread',new.thread_id)
 from public.ps_profiles p where p.id<>new.sender_id and public.ps_staff_member(p.id) and (t.member_a is null or p.id in(t.member_a,t.member_b));
 return new;
end $$;
create trigger staff_message_notice after insert on public.ps_staff_messages for each row execute function ps_private.staff_message_notice();
revoke all on function public.ps_staff_member(uuid),public.ps_staff_access(uuid),public.ps_staff_directory(),public.ps_open_staff_dialog(uuid),public.ps_send_staff(uuid,uuid,text,text,uuid),public.ps_react_staff(uuid,text),public.ps_staff_photo_access(text) from public,anon;
grant execute on function public.ps_staff_member(uuid),public.ps_staff_access(uuid),public.ps_staff_directory(),public.ps_open_staff_dialog(uuid),public.ps_send_staff(uuid,uuid,text,text,uuid),public.ps_react_staff(uuid,text),public.ps_staff_photo_access(text) to authenticated;
revoke all on function ps_private.staff_message_notice() from public,anon,authenticated;
alter publication supabase_realtime add table public.ps_staff_messages;
