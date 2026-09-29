create or replace function ps_private.enqueue_push() returns trigger language plpgsql security definer set search_path='' as $$
declare pref jsonb;category text;
begin
 if tg_table_name='ps_notifications' then
 category:=case when new.event_key like 'dm:%' then 'consultant_messages' when new.event_key like 'weight:%' or new.event_key like 'waist:%' then 'measurements' when new.event_key like 'workout%' then 'workouts' when new.title like '%дневник питания%' then 'nutrition' else 'marathon' end;
 select to_jsonb(s) into pref from public.ps_notification_settings s where user_id=new.recipient_id;
 if coalesce((pref->>category)::boolean,true)=false then return new;end if;
 insert into ps_private.push_queue(user_id,payload) select new.recipient_id,jsonb_build_object('title',new.title,'body',new.body,'route',case when new.route='{}' then jsonb_build_object('page','notifications') else new.route end,'tag','notice-'||new.id) where exists(select 1 from public.ps_push_subscriptions where user_id=new.recipient_id);
 else
 insert into ps_private.push_queue(user_id,payload) select distinct s.user_id,jsonb_build_object('title','Группа поддержки','body',new.author_name||': '||case when new.image_path is not null then 'Фото' else left(new.body,100) end,'route',jsonb_build_object('page','community'),'tag','community') from public.ps_push_subscriptions s where s.user_id<>new.author_id;
 end if;perform ps_private.wake_push();return new;
end $$;