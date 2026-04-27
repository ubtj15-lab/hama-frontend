-- Human verification metadata for capability review workflow.
-- Safe on repeated runs.

alter table if exists public.stores
  add column if not exists verified_by_human boolean not null default false,
  add column if not exists verified_at timestamptz,
  add column if not exists final_capability jsonb;

create index if not exists idx_stores_verified_by_human on public.stores(verified_by_human);
