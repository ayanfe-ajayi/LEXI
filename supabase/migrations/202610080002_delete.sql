create function public.delete_user_word(p_user uuid,p_word uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 delete from public.review_events where user_id=p_user and sense_id in (select id from public.word_senses where word_id=p_word);
 delete from public.user_sense_progress where user_id=p_user and sense_id in (select id from public.word_senses where word_id=p_word);
 delete from public.user_words where user_id=p_user and word_id=p_word;
end $$;
revoke all on function public.delete_user_word(uuid,uuid) from public,anon,authenticated;
grant execute on function public.delete_user_word(uuid,uuid) to service_role;
