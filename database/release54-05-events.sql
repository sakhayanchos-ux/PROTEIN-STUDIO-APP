create or replace function ps_private.client_events() returns trigger language plpgsql security definer set search_path='' as $$
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
 if new.kind='food_photo' or (new.kind='workout_photo' and not exists(select 1 from public.ps_workout_logs where user_id=uid and photo_path=new.photo_path)) then perform ps_private.coach_event(uid,'task:'||new.enrollment_id||':'||new.day_number||':'||new.task_key,case when new.kind='food_photo' then 'заполнил дневник питания' else 'добавил фото тренировки' end);end if;
 if not exists(select 1 from public.ps_marathon_tasks where enrollment_id=new.enrollment_id and day_number=new.day_number and active and completed_at is null) then perform ps_private.coach_event(uid,'day:'||new.enrollment_id||':'||new.day_number,'завершил День '||new.day_number||' марафона');end if;
 end if;
 elsif tg_table_name='ps_marathon_rewards' then
 if old.unlocked_at is null and new.unlocked_at is not null then select user_id into uid from public.ps_marathon_enrollments where id=new.enrollment_id;perform ps_private.coach_event(uid,'unlock:'||new.id,'открыл награду '||new.milestone||'%',coalesce(new.gift,'Подарок'));end if;
 end if;return new;
end $$;
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
end $function$;