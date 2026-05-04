-- hama_events: unified client analytics (open beta)
-- Run manually in Supabase SQL editor when ready. Do not execute from CI by default.
-- RLS: enable and add policy for insert from authenticated/anon as needed for your deployment.

create table if not exists public.hama_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  session_id text,
  user_id text,
  query text,
  intent text,
  category text,
  mode text,
  source text,
  place_id text,
  place_name text,
  place_category text,
  rank_position integer,
  action text,
  situation_tags text[],
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.hama_events is 'Unified HAMA client events (impressions, clicks, funnel).';

create index if not exists hama_events_created_at_idx on public.hama_events (created_at desc);
create index if not exists hama_events_event_name_idx on public.hama_events (event_name);
create index if not exists hama_events_session_id_idx on public.hama_events (session_id);
create index if not exists hama_events_place_id_idx on public.hama_events (place_id);
create index if not exists hama_events_query_idx on public.hama_events (query);

-- Optional: text search on query (uncomment if using pg_trgm)
-- create extension if not exists pg_trgm;
-- create index if not exists hama_events_query_trgm_idx on public.hama_events using gin (query gin_trgm_ops);
