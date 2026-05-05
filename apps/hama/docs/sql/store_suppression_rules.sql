create table if not exists public.store_suppression_rules (
  id uuid primary key default gen_random_uuid(),
  store_id text,
  store_name text,
  scope text not null,
  reason text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_suppression_rules_scope_idx
  on public.store_suppression_rules (scope);
create index if not exists store_suppression_rules_store_id_idx
  on public.store_suppression_rules (store_id);
create index if not exists store_suppression_rules_store_name_idx
  on public.store_suppression_rules (store_name);
create index if not exists store_suppression_rules_is_active_idx
  on public.store_suppression_rules (is_active);
create index if not exists store_suppression_rules_starts_at_idx
  on public.store_suppression_rules (starts_at);
create index if not exists store_suppression_rules_ends_at_idx
  on public.store_suppression_rules (ends_at);

-- KFC 오산DT점 food scope에서 30일 숨김 예시
-- insert into public.store_suppression_rules (
--   store_name, scope, reason, ends_at
-- ) values (
--   'KFC 오산DT점',
--   'food',
--   'fastfood_overexposed',
--   now() + interval '30 days'
-- );

-- 이자카야 춘 동탄점 kids_family에서 숨김 예시
-- insert into public.store_suppression_rules (
--   store_name, scope, reason, ends_at
-- ) values (
--   '이자카야 춘 동탄점',
--   'kids_family',
--   'alcohol_for_family',
--   now() + interval '180 days'
-- );
