-- Avoid casting arbitrary Storage object names in a policy.
create function public.ps_chat_avatar_visible(p_path text) returns boolean language sql stable security definer set search_path='' as $$
select auth.uid() is not null and exists(select 1 from public.ps_profiles p where p.avatar_path=p_path and (p.id=auth.uid() or exists(select 1 from public.ps_community_messages m where m.author_id=p.id) or exists(select 1 from public.ps_direct_threads t where p.id in(t.client_id,t.coach_id) and public.ps_thread_access(t.id)))) $$;
revoke all on function public.ps_chat_avatar_visible(text) from public,anon;
grant execute on function public.ps_chat_avatar_visible(text) to authenticated;
alter policy chat_avatars on storage.objects using(bucket_id='ps-progress-photos' and public.ps_chat_avatar_visible(name));
-- Photos may be viewed in the app; original download links are issued by the Edge function only after consent.
-- Add realtime events to the existing publication without changing existing tables.
do $$begin if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ps_direct_messages') then alter publication supabase_realtime add table public.ps_direct_messages;end if;end $$;
create index if not exists direct_threads_coach on public.ps_direct_threads(coach_id);
create index if not exists consent_client_coach on public.ps_result_consents(client_id,coach_id);
create index if not exists notifications_unread on public.ps_notifications(recipient_id,created_at) where read_at is null;
create index if not exists push_queue_pending on ps_private.push_queue(locked_until,id) where sent_at is null and attempts<5;
