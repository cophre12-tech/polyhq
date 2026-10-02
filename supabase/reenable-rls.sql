-- Re-enable RLS on businesses and profiles
-- Run in Supabase Dashboard → SQL Editor
--
-- Safe to run multiple times (DROP IF EXISTS + CREATE OR REPLACE).
-- Does NOT touch any other tables.

-- ─────────────────────────────────────────────────────────────────────────────
-- BUSINESSES
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.businesses enable row level security;

-- Drop all existing policies so we start clean
drop policy if exists "any authenticated user can create a business"   on public.businesses;
drop policy if exists "business members can view their business"        on public.businesses;
drop policy if exists "business members can update their business"      on public.businesses;
drop policy if exists "owners can delete their business"               on public.businesses;

-- Any logged-in user can create a business (needed for owner signup flow)
create policy "any authenticated user can create a business"
  on public.businesses for insert
  with check (auth.uid() is not null);

-- Members can read their current business; owners can also see other businesses
-- they own (needed for the multi-business switcher to show all business names)
create policy "business members can view their business"
  on public.businesses for select
  using (
    id = public.current_business_id()
    OR id IN (
      select business_id from public.user_businesses where user_id = auth.uid()
    )
  );

-- Only members of the business can update it
create policy "business members can update their business"
  on public.businesses for update
  using  (id = public.current_business_id())
  with check (id = public.current_business_id());

-- Only members of the business can delete it
create policy "owners can delete their business"
  on public.businesses for delete
  using (id = public.current_business_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;

-- Drop all existing policies so we start clean
drop policy if exists "users can insert their own profile"           on public.profiles;
drop policy if exists "business members can view all profiles"       on public.profiles;
drop policy if exists "users can update own profile"                 on public.profiles;
drop policy if exists "business members can update team profiles"    on public.profiles;
drop policy if exists "owners can delete profiles"                   on public.profiles;
-- Legacy names that may exist on older deployments
drop policy if exists "users can update their own profile"           on public.profiles;
drop policy if exists "business members can update profiles"         on public.profiles;

-- Users can only insert a row for themselves
create policy "users can insert their own profile"
  on public.profiles for insert
  with check (id = auth.uid());

-- All members of the same business can see each other
create policy "business members can view all profiles"
  on public.profiles for select
  using (business_id = public.current_business_id());

-- Own-profile update: user can only move themselves to a business they already
-- belong to — prevents arbitrary tenant hopping via switchBusiness
create policy "users can update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    AND (
      business_id = public.current_business_id()
      OR business_id IN (
        select business_id from public.user_businesses where user_id = auth.uid()
      )
    )
  );

-- Team update: owners can edit other profiles within the same business and
-- cannot move those profiles to a different business
create policy "business members can update team profiles"
  on public.profiles for update
  using  (id <> auth.uid() AND business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

-- Members can delete profiles within their business (owners removing employees)
create policy "owners can delete profiles"
  on public.profiles for delete
  using (business_id = public.current_business_id());
