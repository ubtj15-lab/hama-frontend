-- Beta event MVP tables
create extension if not exists pgcrypto;

create table if not exists public.beta_user_state (
  user_id uuid primary key,
  visit_count int not null default 0,
  last_visit_at timestamp with time zone null,
  is_rewarded boolean not null default false,
  notification_opt_in boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists idx_beta_user_state_rewarded
  on public.beta_user_state (is_rewarded, updated_at desc);

create table if not exists public.selected_place_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  place_id text not null,
  place_name text,
  recommendation_id text null,
  context_json jsonb,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_selected_place_logs_user_created
  on public.selected_place_logs (user_id, created_at desc);

create index if not exists idx_selected_place_logs_place
  on public.selected_place_logs (place_id);

create table if not exists public.receipt_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  selected_place_id text not null,
  receipt_image_url text null,
  receipt_place_name text null,
  matched boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_receipt_verifications_user_created
  on public.receipt_verifications (user_id, created_at desc);

create index if not exists idx_receipt_verifications_selected_place
  on public.receipt_verifications (selected_place_id);

-- 동일 selected_place_id 승인 1회 제한(중복 인증 카운트 방지)
create unique index if not exists uq_receipt_verifications_user_selected_approved
  on public.receipt_verifications (user_id, selected_place_id)
  where status = 'approved';
