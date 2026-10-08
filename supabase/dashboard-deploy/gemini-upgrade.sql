-- Existing Lexi projects: run this in the Supabase SQL Editor before deploying Gemini functions.
begin;
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
