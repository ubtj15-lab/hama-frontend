-- HAMA Pay MVP (Mock) tables
-- 실행 전: pgcrypto extension 필요
create extension if not exists pgcrypto;

create table if not exists public.hama_pay_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  place_id text not null,
  place_name text,
  amount int null,
  payment_method text default 'hama_pay_mock',
  status text default 'completed',
  context_json jsonb,
  created_at timestamp with time zone default now()
);

create index if not exists idx_hama_pay_transactions_user_created
  on public.hama_pay_transactions (user_id, created_at desc);

create index if not exists idx_hama_pay_transactions_place
  on public.hama_pay_transactions (place_id);

create table if not exists public.visit_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  place_id text not null,
  place_name text,
  source text default 'hama_pay',
  satisfaction text check (satisfaction in ('good','neutral','bad')),
  feedback_tags text[] null,
  memo text null,
  created_at timestamp with time zone default now()
);

create index if not exists idx_visit_feedback_user_created
  on public.visit_feedback (user_id, created_at desc);

create index if not exists idx_visit_feedback_place
  on public.visit_feedback (place_id);

-- 선택(권장): visit_count 적재 테이블이 없다면 최소 스키마 준비
create table if not exists public.beta_user_state (
  user_id uuid primary key,
  visit_count int not null default 0,
  updated_at timestamp with time zone default now()
);
