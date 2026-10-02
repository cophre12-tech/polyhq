-- RLS isolation fix for PolyHQ
-- Run in Supabase Dashboard → SQL Editor
--
-- Fixes three issues:
--   1. user_businesses had RLS enabled but NO policies (all access blocked silently)
--   2. profiles UPDATE policy had no WITH CHECK (users could change business_id to any value)
--   3. businesses SELECT policy didn't include other businesses the user owns

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. USER_BUSINESSES — add missing policies
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "users can view their own business memberships"   on public.user_businesses;
drop policy if exists "users can insert their own business memberships" on public.user_businesses;
drop policy if exists "users can update their own business memberships" on public.user_businesses;
drop policy if exists "users can delete their own business memberships" on public.user_businesses;

create policy "users can view their own business memberships"
  on public.user_businesses for select
  using (user_id = auth.uid());

create policy "users can insert their own business memberships"
  on public.user_businesses for insert
  with check (user_id = auth.uid());

create policy "users can update their own business memberships"
  on public.user_businesses for update
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users can delete their own business memberships"
  on public.user_businesses for delete
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PROFILES — harden SELECT and UPDATE policies
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop every existing profiles policy so we start clean (catches any dev-era
-- permissive policies like "using (true)" that might be on the live database).
drop policy if exists "business members can view all profiles"    on public.profiles;
drop policy if exists "users can insert their own profile"        on public.profiles;
drop policy if exists "business members can update profiles"      on public.profiles;
drop policy if exists "owners can delete profiles"                on public.profiles;
drop policy if exists "users can update own profile"              on public.profiles;
drop policy if exists "business members can update team profiles" on public.profiles;

-- SELECT: only profiles in the same business
create policy "business members can view all profiles"
  on public.profiles for select
  using (business_id = current_business_id());

-- INSERT: users can only create their own profile row
create policy "users can insert their own profile"
  on public.profiles for insert
  with check (id = auth.uid());

-- UPDATE (own row): allows switchBusiness — but only to a business the user
-- already belongs to in user_businesses, preventing arbitrary tenant hopping.
create policy "users can update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid() AND (
      business_id = current_business_id()
      OR business_id IN (
        select business_id from public.user_businesses where user_id = auth.uid()
      )
    )
  );

-- UPDATE (other rows): owners/co-owners can update team members, but only
-- within their own business and cannot move profiles to another business.
create policy "business members can update team profiles"
  on public.profiles for update
  using  (id <> auth.uid() AND business_id = current_business_id())
  with check (business_id = current_business_id());

-- DELETE: only within the current business
create policy "owners can delete profiles"
  on public.profiles for delete
  using (business_id = current_business_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. BUSINESSES — allow owners to see ALL businesses they own, not just current
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "business members can view their business"  on public.businesses;
drop policy if exists "any authenticated user can create a business" on public.businesses;
drop policy if exists "business members can update their business" on public.businesses;

create policy "any authenticated user can create a business"
  on public.businesses for insert
  with check (auth.uid() is not null);

-- Owners can see both their current business AND any other businesses they own
-- (needed for the multi-business switcher to show business names).
create policy "business members can view their business"
  on public.businesses for select
  using (
    id = current_business_id()
    OR id IN (
      select business_id from public.user_businesses where user_id = auth.uid()
    )
  );

create policy "business members can update their business"
  on public.businesses for update
  using  (id = current_business_id())
  with check (id = current_business_id());
