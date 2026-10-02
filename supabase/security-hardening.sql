-- Security hardening: fix function search_path + private photos bucket
-- Run in Supabase Dashboard → SQL Editor
-- Safe to run multiple times.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SECURITY DEFINER FUNCTIONS — pin search_path to prevent schema injection
-- ─────────────────────────────────────────────────────────────────────────────

-- Reads the calling user's business_id from profiles (bypasses profiles RLS
-- because security definer runs as the function owner, not the caller).
create or replace function public.current_business_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select business_id from public.profiles where id = auth.uid()
$$;

-- Looks up a business by invite code. Called during employee signup before a
-- profile row exists, so it cannot rely on current_business_id().
create or replace function public.business_id_from_invite(code text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.businesses where upper(invite_code) = upper(code) limit 1
$$;

-- Auto-creates a free subscription row when a new business is inserted.
create or replace function public.on_business_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.subscriptions (business_id, plan)
  values (new.id, 'free')
  on conflict (business_id) do nothing;
  return new;
end;
$$;

-- Timestamp trigger — not security definer but Supabase flags it without a
-- fixed search_path, so pin it here too.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PHOTOS STORAGE BUCKET — make private (removes public listing / bypass)
-- ─────────────────────────────────────────────────────────────────────────────

-- Flip the bucket from public to private. Files are no longer accessible via
-- the /object/public/ endpoint without auth. The app will use signed URLs
-- (createSignedUrl) instead of getPublicUrl for all photo display.
update storage.buckets
  set public = false
  where id = 'photos';

-- Drop the old open-to-everyone SELECT policy.
drop policy if exists "photos are publicly readable" on storage.objects;

-- New policy: only authenticated users can read photos.
-- The app uses signed URLs so the browser presents the user's JWT automatically.
create policy "authenticated users can read photos"
  on storage.objects for select
  using (bucket_id = 'photos' and auth.uid() is not null);

-- Keep the existing upload/delete policies (no change needed — they already
-- require auth.uid() is not null).
