create function public.validate_timezone() returns trigger language plpgsql set search_path=public as $$
begin
 if not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'Invalid timezone'; end if;
 return new;
end $$;
create trigger valid_timezone before insert or update on public.profiles for each row execute function public.validate_timezone();
create trigger valid_timezone before insert or update on public.reminder_preferences for each row execute function public.validate_timezone();
revoke all on function public.validate_timezone() from public,anon,authenticated;
-- Prevent direct client edits from changing canonical references or resetting discovery history.
revoke update on public.user_words from authenticated;
grant update(status,personal_note,source,encounter_context) on public.user_words to authenticated;
revoke update on public.profiles from authenticated;
grant update(display_name,timezone,avatar_url) on public.profiles to authenticated;
