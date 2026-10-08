-- Projects may already contain accounts before Lexi's first deployment.
insert into public.profiles(id,display_name)
select id,left(coalesce(raw_user_meta_data->>'display_name',''),80) from auth.users
on conflict(id) do nothing;
insert into public.reminder_preferences(user_id)
select id from auth.users on conflict(user_id) do nothing;
