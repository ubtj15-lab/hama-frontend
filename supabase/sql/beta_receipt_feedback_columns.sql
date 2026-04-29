alter table public.receipt_verifications
add column if not exists feedback_tags jsonb not null default '[]'::jsonb;

alter table public.receipt_verifications
add column if not exists feedback_text text null;
