-- Fresh projects only. Run once as postgres in the Supabase SQL Editor.
-- Includes all migrations in order, in one transaction.
begin;
-- 202610080001_lexi.sql
create extension if not exists vector with schema extensions;

create table public.profiles (
 id uuid primary key references auth.users on delete cascade,
 display_name text not null default '', avatar_url text,
 timezone text not null default 'Africa/Lagos',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.words (
 id uuid primary key default gen_random_uuid(), word text not null,
 language text not null default 'en', normalized_word text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(language, normalized_word)
);
create table public.word_senses (
 id uuid primary key default gen_random_uuid(), word_id uuid not null references public.words on delete cascade,
 part_of_speech text not null, definition text not null, simple_definition text not null,
 usage_note text not null default '', register text not null default 'neutral', difficulty text not null default 'intermediate',
 synonyms text[] not null default '{}', phrases text[] not null default '{}', lexical_source text not null,
 source_url text, source_license text, ai_enriched boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.word_senses(word_id);
create index word_senses_fts on public.word_senses using gin(to_tsvector('english', definition || ' ' || simple_definition));
create table public.word_examples (
 id uuid primary key default gen_random_uuid(), sense_id uuid not null references public.word_senses on delete cascade,
 sentence text not null, source text not null, created_at timestamptz not null default now()
);
create index on public.word_examples(sense_id);
create table public.pronunciations (
 id uuid primary key default gen_random_uuid(), word_id uuid not null references public.words on delete cascade,
 accent text not null default 'English', ipa text not null default '', audio_url text,
 created_at timestamptz not null default now()
);
create index on public.pronunciations(word_id);
create table public.user_words (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 word_id uuid not null references public.words, status text not null default 'new' check(status in ('new','learning','reviewing','mastered','archived')),
 personal_note text not null default '', source text not null default '', encounter_context text not null default '',
 discovered_at timestamptz not null default now(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id, word_id)
);
create table public.user_sense_progress (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 sense_id uuid not null references public.word_senses,
 understanding_score integer not null default 0 check(understanding_score between 0 and 100),
 recall_score integer not null default 0 check(recall_score between 0 and 100),
 usage_score integer not null default 0 check(usage_score between 0 and 100),
 pronunciation_score integer not null default 0 check(pronunciation_score between 0 and 100),
 times_reviewed integer not null default 0, times_forgotten integer not null default 0,
 times_correct integer not null default 0, times_used integer not null default 0,
 interval_index integer not null default 0 check(interval_index between 0 and 5),
 last_reviewed_at timestamptz, next_review_at timestamptz not null default now() + interval '1 day',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,sense_id)
);
create index on public.user_sense_progress(user_id,next_review_at);
create table public.review_events (
 id uuid primary key default gen_random_uuid(), request_id uuid not null,
 user_id uuid not null references auth.users on delete cascade, sense_id uuid not null references public.word_senses,
 review_type text not null check(review_type in ('meaning','recognition','active_recall','fill_blank','usage','pronunciation','reverse_recall')),
 result boolean not null, difficulty text not null default 'normal', response_time_ms integer not null check(response_time_ms >= 0),
 answer text not null default '', feedback text not null default '', created_at timestamptz not null default now(), unique(user_id, request_id)
);
create index on public.review_events(user_id,created_at);
create table public.ai_sessions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 title text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.ai_messages (
 id uuid primary key default gen_random_uuid(), session_id uuid not null references public.ai_sessions on delete cascade,
 role text not null check(role in ('user','assistant')), content text not null, structured_content jsonb,
 created_at timestamptz not null default now()
);
create index on public.ai_messages(session_id,created_at);
create table public.reminder_preferences (
 id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users on delete cascade,
 enabled boolean not null default false, preferred_time time not null default '09:00', timezone text not null default 'Africa/Lagos',
 daily_limit integer not null default 10 check(daily_limit between 1 and 100),
 frequency text not null default 'daily' check(frequency in ('daily','weekdays')),
 quiet_start time not null default '22:00', quiet_end time not null default '07:00',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.reminders (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 type text not null default 'review', title text not null, body text not null,
 scheduled_for timestamptz not null, local_date date not null,
 status text not null default 'pending' check(status in ('pending','sending','sent','failed')),
 attempts integer not null default 0, created_at timestamptz not null default now(), sent_at timestamptz,
 unique(user_id,local_date,type)
);
create table public.push_subscriptions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 endpoint text not null, p256dh text not null, auth text not null,
 created_at timestamptz not null default now(), unique(user_id,endpoint)
);
create table public.word_sense_embeddings (
 id uuid primary key default gen_random_uuid(), sense_id uuid not null unique references public.word_senses on delete cascade,
 content text not null, embedding extensions.vector(1536) not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.word_sense_embeddings using hnsw(embedding extensions.vector_cosine_ops);
create table public.api_usage (
 user_id uuid not null references auth.users on delete cascade, bucket timestamptz not null,
 requests integer not null default 0, primary key(user_id,bucket)
);

-- All grants are explicit; user-owned writes to progress/history are server-only.
revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.words,public.word_senses,public.word_examples,public.pronunciations to authenticated;
grant select,update on public.profiles to authenticated;
grant select,update on public.user_words to authenticated;
grant select on public.user_sense_progress,public.review_events,public.ai_sessions,public.ai_messages,public.reminders to authenticated;
grant select,insert,update on public.reminder_preferences to authenticated;
grant select,insert,update,delete on public.push_subscriptions to authenticated;
grant all on all tables in schema public to service_role;

do $$ declare t text; begin
 foreach t in array array['profiles','user_words','user_sense_progress','review_events','ai_sessions','reminder_preferences','reminders','push_subscriptions','api_usage'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy own_rows on public.%I for all to authenticated using ((select auth.uid()) = %I) with check ((select auth.uid()) = %I)',t,case when t='profiles' then 'id' else 'user_id' end,case when t='profiles' then 'id' else 'user_id' end);
 end loop;
 foreach t in array array['words','word_senses','word_examples','pronunciations'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy lexical_read on public.%I for select to authenticated using (true)',t);
 end loop;
end $$;
alter table public.ai_messages enable row level security;
create policy own_session_messages on public.ai_messages for select to authenticated using(exists(select 1 from public.ai_sessions s where s.id = session_id and s.user_id = (select auth.uid())));
alter table public.word_sense_embeddings enable row level security;

create function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$ begin new.updated_at=now(); return new; end $$;
do $$ declare t text; begin
 foreach t in array array['profiles','words','word_senses','user_words','user_sense_progress','ai_sessions','reminder_preferences','word_sense_embeddings'] loop
  execute format('create trigger touch before update on public.%I for each row execute function public.touch_updated_at()',t);
 end loop;
end $$;
create function public.on_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.profiles(id,display_name) values(new.id, left(coalesce(new.raw_user_meta_data->>'display_name',''),80));
 insert into public.reminder_preferences(user_id) values(new.id);
 return new;
end $$;
create trigger lexi_new_user after insert on auth.users for each row execute function public.on_new_user();

-- One transaction for canonical data, the user's association, and initial schedules.
create function public.save_lexical_word(p_user uuid,p_entry jsonb,p_note text,p_source text,p_context text) returns uuid
language plpgsql security definer set search_path=public,extensions as $$
declare wid uuid; sid uuid; s jsonb; e jsonb; pron jsonb;
begin
 perform pg_advisory_xact_lock(hashtext('lexi:' || lower(p_entry->>'word')));
 select id into wid from public.words where language='en' and normalized_word=lower(trim(p_entry->>'word'));
 if wid is null then
  insert into public.words(word,normalized_word) values(p_entry->>'word',lower(trim(p_entry->>'word'))) returning id into wid;
  for s in select * from jsonb_array_elements(p_entry->'senses') loop
   insert into public.word_senses(word_id,part_of_speech,definition,simple_definition,usage_note,register,difficulty,synonyms,phrases,lexical_source,source_url,source_license,ai_enriched)
   values(wid,s->>'part_of_speech',s->>'definition',s->>'simple_definition',coalesce(s->>'usage_note',''),coalesce(s->>'register','neutral'),coalesce(s->>'difficulty','intermediate'),array(select jsonb_array_elements_text(coalesce(s->'synonyms','[]'))),array(select jsonb_array_elements_text(coalesce(s->'phrases','[]'))),s->>'lexical_source',s->>'source_url',s->>'source_license',coalesce((s->>'ai_enriched')::boolean,false)) returning id into sid;
   for e in select * from jsonb_array_elements(coalesce(s->'examples','[]')) loop
    insert into public.word_examples(sense_id,sentence,source) values(sid,e->>'sentence',e->>'source');
   end loop;
  end loop;
  for pron in select * from jsonb_array_elements(coalesce(p_entry->'pronunciations','[]')) loop
   insert into public.pronunciations(word_id,accent,ipa,audio_url) values(wid,coalesce(pron->>'accent','English'),coalesce(pron->>'ipa',''),pron->>'audio_url');
  end loop;
 end if;
 -- A server-only lexical lookup may cache the validated canonical entry without saving it to a user's collection.
 if p_user is null then return wid; end if;
 insert into public.user_words(user_id,word_id,personal_note,source,encounter_context) values(p_user,wid,p_note,p_source,p_context)
 on conflict(user_id,word_id) do update set status=case when user_words.status='archived' then 'learning' else user_words.status end,personal_note=excluded.personal_note,source=excluded.source,encounter_context=excluded.encounter_context;
 insert into public.user_sense_progress(user_id,sense_id) select p_user,id from public.word_senses where word_id=wid on conflict(user_id,sense_id) do nothing;
 return wid;
end $$;

create function public.record_review(p_user uuid,p_request uuid,p_sense uuid,p_type text,p_correct boolean,p_answer text,p_feedback text,p_response_ms integer) returns jsonb
language plpgsql security definer set search_path=public as $$
declare pr public.user_sense_progress; ev public.review_events; step integer; days integer; wid uuid;
begin
 select * into pr from public.user_sense_progress where user_id=p_user and sense_id=p_sense for update;
 if not found then raise exception 'Word is not in your vocabulary'; end if;
 select * into ev from public.review_events where user_id=p_user and request_id=p_request;
 if found then
  if ev.sense_id<>p_sense then raise exception 'Request already used'; end if;
  return jsonb_build_object('correct',ev.result,'feedback',ev.feedback,'progress',to_jsonb(pr),'duplicate',true);
 end if;
 select word_id into wid from public.word_senses where id=p_sense;
 if not exists(select 1 from public.user_words where user_id=p_user and word_id=wid and status<>'archived') then raise exception 'Word is archived'; end if;
 step=case when p_correct then least(pr.interval_index+1,5) else 0 end;
 days=(array[1,3,7,14,30,60])[step+1];
 update public.user_sense_progress set
 interval_index=step,times_reviewed=times_reviewed+1,times_correct=times_correct+case when p_correct then 1 else 0 end,
 times_forgotten=times_forgotten+case when p_correct then 0 else 1 end,
 times_used=times_used+case when p_type='usage' then 1 else 0 end,
 understanding_score=case when p_type in ('meaning','recognition') then greatest(0,least(100,understanding_score+case when p_correct then 20 else -20 end)) else understanding_score end,
 recall_score=case when p_type in ('active_recall','reverse_recall','fill_blank') then greatest(0,least(100,recall_score+case when p_correct then 20 else -20 end)) else recall_score end,
 usage_score=case when p_type='usage' then greatest(0,least(100,usage_score+case when p_correct then 20 else -20 end)) else usage_score end,
 pronunciation_score=case when p_type='pronunciation' then greatest(0,least(100,pronunciation_score+case when p_correct then 20 else -20 end)) else pronunciation_score end,
 last_reviewed_at=now(),next_review_at=now()+make_interval(days=>days)
 where id=pr.id returning * into pr;
 insert into public.review_events(request_id,user_id,sense_id,review_type,result,answer,feedback,response_time_ms)
 values(p_request,p_user,p_sense,p_type,p_correct,p_answer,p_feedback,greatest(0,least(p_response_ms,3600000)));
 update public.user_words set status=case when
 not exists(select 1 from public.user_sense_progress p join public.word_senses s on s.id=p.sense_id where p.user_id=p_user and s.word_id=wid and p.interval_index<4) then 'mastered' else 'reviewing' end where user_id=p_user and word_id=wid;
 return jsonb_build_object('correct',p_correct,'feedback',p_feedback,'progress',to_jsonb(pr),'duplicate',false);
end $$;

create function public.consume_api_quota(p_user uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare count integer; begin
 insert into public.api_usage(user_id,bucket,requests) values(p_user,date_trunc('hour',now()),1)
 on conflict(user_id,bucket) do update set requests=api_usage.requests+1 returning requests into count;
 return count<=100;
end $$;

create function public.hybrid_search(p_user uuid,p_query text,p_embedding extensions.vector(1536) default null,p_mine boolean default true)
returns table(sense_id uuid,word_id uuid,word text,part_of_speech text,definition text,simple_definition text,in_vocabulary boolean,discovered_at timestamptz,score double precision)
language sql stable security definer set search_path=public,extensions as $$
 select s.id,w.id,w.word,s.part_of_speech,s.definition,s.simple_definition,uw.id is not null,uw.discovered_at,
 ((case when w.normalized_word=lower(trim(p_query)) then 2.0 else 0 end)+
 ts_rank_cd(to_tsvector('english',s.definition||' '||s.simple_definition),plainto_tsquery('english',p_query))+
 coalesce(case when p_embedding is not null then greatest(0,1-(e.embedding <=> p_embedding)) else 0 end,0))::double precision as rank
 from public.word_senses s join public.words w on w.id=s.word_id
 left join public.user_words uw on uw.word_id=w.id and uw.user_id=p_user and uw.status<>'archived'
 left join public.word_sense_embeddings e on e.sense_id=s.id
 where (not p_mine or uw.id is not null) and
 (w.normalized_word=lower(trim(p_query)) or to_tsvector('english',s.definition||' '||s.simple_definition) @@ plainto_tsquery('english',p_query) or (p_embedding is not null and 1-(e.embedding <=> p_embedding)>0.25))
 order by rank desc limit 12;
$$;

-- Claim reminders atomically. A stale sending claim can be retried after 15 minutes.
create function public.claim_due_reminders() returns setof public.reminders language plpgsql security definer set search_path=public as $$
begin
 insert into public.reminders(user_id,title,body,scheduled_for,local_date)
 select pref.user_id,'A few words are waiting',format('%s words are ready for review. %s need extra attention. Five minutes is a good start.',least(c.due,pref.daily_limit),c.weak),now(),(now() at time zone pref.timezone)::date
 from public.reminder_preferences pref cross join lateral(
 select count(*) due,count(*) filter(where p.times_forgotten>0) weak from public.user_sense_progress p
 join public.word_senses s on s.id=p.sense_id join public.user_words uw on uw.word_id=s.word_id and uw.user_id=p.user_id
 where p.user_id=pref.user_id and p.next_review_at<=now() and uw.status<>'archived') c
 where pref.enabled and c.due>0 and exists(select 1 from public.push_subscriptions ps where ps.user_id=pref.user_id)
 and (now() at time zone pref.timezone)::time>=pref.preferred_time
 and (pref.frequency='daily' or extract(isodow from now() at time zone pref.timezone)<6)
 and not(case when pref.quiet_start<pref.quiet_end then (now() at time zone pref.timezone)::time>=pref.quiet_start and (now() at time zone pref.timezone)::time<pref.quiet_end
 else (now() at time zone pref.timezone)::time>=pref.quiet_start or (now() at time zone pref.timezone)::time<pref.quiet_end end)
 on conflict(user_id,local_date,type) do nothing;
 return query update public.reminders set status='sending',attempts=attempts+1,scheduled_for=now()
 where id in (
  select r.id from public.reminders r join public.reminder_preferences pref on pref.user_id=r.user_id
  where r.attempts<3 and (r.status in ('pending','failed') or (r.status='sending' and r.scheduled_for<now()-interval '15 minutes'))
  and pref.enabled and r.local_date=(now() at time zone pref.timezone)::date
  and (now() at time zone pref.timezone)::time>=pref.preferred_time
  and (pref.frequency='daily' or extract(isodow from now() at time zone pref.timezone)<6)
  and not(case when pref.quiet_start<pref.quiet_end then (now() at time zone pref.timezone)::time>=pref.quiet_start and (now() at time zone pref.timezone)::time<pref.quiet_end
  else (now() at time zone pref.timezone)::time>=pref.quiet_start or (now() at time zone pref.timezone)::time<pref.quiet_end end)
  order by r.scheduled_for for update of r skip locked limit 50
 ) returning *;
end $$;

-- Functions accepting a user ID are callable only by the authenticated server.
revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function public.save_lexical_word(uuid,jsonb,text,text,text),public.record_review(uuid,uuid,uuid,text,boolean,text,text,integer),public.consume_api_quota(uuid),public.hybrid_search(uuid,text,extensions.vector,boolean),public.claim_due_reminders() to service_role;


-- 202610080002_delete.sql
create function public.delete_user_word(p_user uuid,p_word uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 delete from public.review_events where user_id=p_user and sense_id in (select id from public.word_senses where word_id=p_word);
 delete from public.user_sense_progress where user_id=p_user and sense_id in (select id from public.word_senses where word_id=p_word);
 delete from public.user_words where user_id=p_user and word_id=p_word;
end $$;
revoke all on function public.delete_user_word(uuid,uuid) from public,anon,authenticated;
grant execute on function public.delete_user_word(uuid,uuid) to service_role;


-- 202610080003_validation.sql
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


-- 202610080004_existing_users.sql
-- Projects may already contain accounts before Lexi's first deployment.
insert into public.profiles(id,display_name)
select id,left(coalesce(raw_user_meta_data->>'display_name',''),80) from auth.users
on conflict(id) do nothing;
insert into public.reminder_preferences(user_id)
select id from auth.users on conflict(user_id) do nothing;


-- 202610080005_embedding_models.sql
-- Keep vectors from different providers/models out of the same similarity search.
-- Existing vectors are marked legacy; Prepare meaning search rebuilds them safely.
alter table public.word_sense_embeddings
  add column if not exists model text not null default 'legacy';

create or replace function public.hybrid_search_v2(
  p_user uuid, p_query text,
  p_embedding extensions.vector(1536) default null,
  p_mine boolean default true,
  p_embedding_model text default null
)
returns table(sense_id uuid,word_id uuid,word text,part_of_speech text,definition text,simple_definition text,in_vocabulary boolean,discovered_at timestamptz,score double precision)
language sql stable security definer set search_path=public,extensions as $$
 select s.id,w.id,w.word,s.part_of_speech,s.definition,s.simple_definition,uw.id is not null,uw.discovered_at,
 ((case when w.normalized_word=lower(trim(p_query)) then 2.0 else 0 end)+
 ts_rank_cd(to_tsvector('english',s.definition||' '||s.simple_definition),plainto_tsquery('english',p_query))+
 coalesce(case when p_embedding is not null then greatest(0,1-(e.embedding <=> p_embedding)) else 0 end,0))::double precision as rank
 from public.word_senses s join public.words w on w.id=s.word_id
 left join public.user_words uw on uw.word_id=w.id and uw.user_id=p_user and uw.status<>'archived'
 left join public.word_sense_embeddings e on e.sense_id=s.id and e.model=p_embedding_model
 where (not p_mine or uw.id is not null) and
 (w.normalized_word=lower(trim(p_query)) or to_tsvector('english',s.definition||' '||s.simple_definition) @@ plainto_tsquery('english',p_query) or (p_embedding is not null and 1-(e.embedding <=> p_embedding)>0.25))
 order by rank desc limit 12;
$$;
revoke all on function public.hybrid_search_v2(uuid,text,extensions.vector,boolean,text) from public,anon,authenticated;
grant execute on function public.hybrid_search_v2(uuid,text,extensions.vector,boolean,text) to service_role;

commit;
