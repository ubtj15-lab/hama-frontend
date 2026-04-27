-- Add capability columns and AI classification metadata for stores.
-- Safe to run multiple times.

alter table if exists public.stores
  add column if not exists solo_friendly boolean,
  add column if not exists group_seating boolean,
  add column if not exists private_room boolean,
  add column if not exists alcohol_available boolean,
  add column if not exists fast_food boolean,
  add column if not exists formal_atmosphere boolean,
  add column if not exists quick_service boolean,
  add column if not exists vegan_available boolean,
  add column if not exists halal_available boolean,
  add column if not exists max_group_size integer,
  add column if not exists ai_classified boolean not null default false,
  add column if not exists ai_classified_at timestamptz,
  add column if not exists ai_confidence double precision;

create index if not exists idx_stores_ai_classified on public.stores(ai_classified);
create index if not exists idx_stores_category on public.stores(category);
