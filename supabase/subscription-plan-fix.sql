-- Subscription plan fix for PolyHQ
-- Run in Supabase Dashboard → SQL Editor
--
-- Fixes two database-side bugs that caused paid-plan owners to be shown the
-- free tier on login:
--
-- 1. get_business_plan security check was too strict: it only allowed a caller
--    to read a plan if profiles.business_id matched p_business_id exactly.
--    This silently returned 'free' in three cases:
--      a) profiles.business_id is null (race during signup before profile is written)
--      b) multi-business owner querying a business they're not currently switched to
--      c) any timing window where the profile commit hasn't flushed yet
--    Fix: also accept membership via user_businesses.
--
-- 2. The subscriptions SELECT RLS policy used only current_business_id()
--    (which reads profiles.business_id). When profiles.business_id is null,
--    current_business_id() returns null and the RLS check blocks the row,
--    preventing the client-side fallback query from working.
--    Fix: also allow access if the user is in user_businesses for that business.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Update get_business_plan — add user_businesses as secondary auth check
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.get_business_plan(p_business_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select plan
      from public.subscriptions
      where business_id = p_business_id
        and (
          -- Primary check: caller's active business matches (fast path)
          p_business_id = (
            select business_id from public.profiles where id = auth.uid()
          )
          -- Secondary check: caller is a member of this business via user_businesses.
          -- Catches multi-business owners and signup timing races where
          -- profiles.business_id may not equal p_business_id yet.
          or exists (
            select 1 from public.user_businesses
            where user_id = auth.uid() and business_id = p_business_id
          )
        )
    ),
    'free'
  )
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Update subscriptions SELECT RLS — allow access via user_businesses too
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "Members can read their business subscription" on public.subscriptions;

create policy "Members can read their business subscription"
  on public.subscriptions for select
  using (
    -- Standard path: profiles.business_id matches (covers most cases)
    business_id = public.current_business_id()
    -- Fallback path: user is a member of this business in user_businesses.
    -- Required for the client-side direct-query fallback in fetchPlan when
    -- profiles.business_id is null or temporarily mismatched.
    or business_id in (
      select business_id from public.user_businesses where user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Ensure the trigger that auto-creates subscription rows is installed
-- ─────────────────────────────────────────────────────────────────────────────

-- Re-create the trigger function (idempotent — no harm if it already exists)
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

-- Drop and recreate the trigger to ensure it is bound to the current version
drop trigger if exists create_subscription_on_business_insert on public.businesses;

create trigger create_subscription_on_business_insert
  after insert on public.businesses
  for each row execute procedure public.on_business_created();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Back-fill any businesses that are missing a subscription row
--    (covers businesses created before the trigger was installed)
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.subscriptions (business_id, plan)
  select id, 'free' from public.businesses
  on conflict (business_id) do nothing;
