-- Admin duplicate approve: allow marking current row without violating partial unique index
-- (uq_receipt_verifications_user_selected_approved only applies where status = 'approved')

alter table public.receipt_verifications
  add column if not exists rejection_reason text null;

alter table public.receipt_verifications
  drop constraint if exists receipt_verifications_status_check;

alter table public.receipt_verifications
  add constraint receipt_verifications_status_check
  check (status in ('pending', 'approved', 'rejected', 'duplicate'));

alter table public.user_place_photos
  drop constraint if exists user_place_photos_status_check;

alter table public.user_place_photos
  add constraint user_place_photos_status_check
  check (status in ('pending', 'approved', 'rejected', 'duplicate'));
