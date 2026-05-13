-- 방문 인증/피드백 시 사용자가 올린 장소 사진 (비공개, 관리자 서명 URL로만 조회)
create extension if not exists pgcrypto;

create table if not exists public.user_place_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  receipt_verification_id uuid null references public.receipt_verifications (id) on delete set null,
  visit_feedback_id uuid null,
  photo_storage_path text not null,
  store_id text null,
  store_name text null,
  source text not null default 'receipt_verification'
    check (source in ('receipt_verification', 'visit_feedback')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_user_place_photos_receipt on public.user_place_photos (receipt_verification_id);
create index if not exists idx_user_place_photos_visit_feedback on public.user_place_photos (visit_feedback_id);
create index if not exists idx_user_place_photos_status_created on public.user_place_photos (status, created_at desc);

alter table public.user_place_photos enable row level security;
