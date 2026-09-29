create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
create function public.ps_push_server(p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if (select auth.role())<>'service_role' then raise exception 'Нет доступа';end if;
 if p_action='config' then select settings into result from ps_private.push_config where id;return result;
 elsif p_action='subscribe' then
 insert into public.ps_push_subscriptions(user_id,endpoint,subscription) values((p_data->>'user_id')::uuid,p_data->'subscription'->>'endpoint',p_data->'subscription') on conflict(endpoint) do update set user_id=excluded.user_id,subscription=excluded.subscription;return '{}'::jsonb;
 elsif p_action='unsubscribe' then delete from public.ps_push_subscriptions where user_id=(p_data->>'user_id')::uuid and endpoint=p_data->>'endpoint';return '{}'::jsonb;
 elsif p_action='claim' then
 with jobs as (select id from ps_private.push_queue where sent_at is null and attempts<5 and (locked_until is null or locked_until<now()) order by id limit 30 for update skip locked), claimed as(update ps_private.push_queue q set locked_until=now()+interval '2 minutes',attempts=attempts+1 from jobs where q.id=jobs.id returning q.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'payload',c.payload,'subscriptions',(select coalesce(jsonb_agg(s),'[]') from public.ps_push_subscriptions s where s.user_id=c.user_id))),'[]') into result from claimed c;return result;
 elsif p_action='finish' then update ps_private.push_queue set sent_at=case when p_data->>'error' is null then now() else null end,last_error=left(p_data->>'error',300),locked_until=now()+interval '5 minutes' where id=(p_data->>'id')::bigint;return '{}';
 elsif p_action='expired' then delete from public.ps_push_subscriptions where id=(p_data->>'id')::uuid;return '{}';
 else raise exception 'Unknown action';end if;
end $$;
revoke all on function public.ps_push_server(text,jsonb) from public,anon,authenticated;
grant execute on function public.ps_push_server(text,jsonb) to service_role;
create function ps_private.wake_push() returns void language plpgsql security definer set search_path='' as $$
declare token text;
begin
 select settings->>'hookToken' into token from ps_private.push_config where id;
 if token is not null and exists(select 1 from ps_private.push_queue where sent_at is null and attempts<5 and (locked_until is null or locked_until<now())) then
 perform net.http_post(url:='https://xprobrrrpybmzbucakws.supabase.co/functions/v1/ps-delivery',headers:=jsonb_build_object('Content-Type','application/json','X-Push-Token',token),body:='{"action":"dispatch"}',timeout_milliseconds:=10000);end if;
end $$;
create function ps_private.enqueue_push() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='ps_notifications' then
 insert into ps_private.push_queue(user_id,payload) select new.recipient_id,jsonb_build_object('title',new.title,'body',new.body,'route',case when new.route='{}' then jsonb_build_object('page','notifications') else new.route end,'tag','notice-'||new.id) where exists(select 1 from public.ps_push_subscriptions where user_id=new.recipient_id);
 else
 insert into ps_private.push_queue(user_id,payload) select distinct s.user_id,jsonb_build_object('title','Группа поддержки','body',new.author_name||': '||case when new.image_path is not null then 'Фото' else left(new.body,100) end,'route',jsonb_build_object('page','community'),'tag','community') from public.ps_push_subscriptions s where s.user_id<>new.author_id;
 end if;perform ps_private.wake_push();return new;
end $$;
create trigger notification_push after insert on public.ps_notifications for each row execute function ps_private.enqueue_push();
create trigger community_push after insert on public.ps_community_messages for each row execute function ps_private.enqueue_push();
revoke all on function ps_private.wake_push(),ps_private.enqueue_push() from public,anon,authenticated;
select cron.schedule('ps-push-retry','* * * * *','select ps_private.wake_push()');
