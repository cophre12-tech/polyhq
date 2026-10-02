-- Fix owner signup / "add business" RLS failure + grants hygiene
-- Run in Supabase Dashboard → SQL Editor (or `supabase db query --linked -f`)
-- Safe to run multiple times.
--
-- Root cause: the client did `insert(...).select()`, i.e. INSERT ... RETURNING.
-- RETURNING requires the new row to pass the SELECT policy, which only allows
-- businesses linked via profiles / user_businesses — rows that don't exist yet
-- at that point. Postgres reports this as "new row violates row-level security
-- policy". This function creates the business and the caller's membership in
-- one transaction instead.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. create_owned_business — atomic business + owner profile + membership
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.create_owned_business(p_name text, p_owner_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_biz   uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  insert into public.businesses (name)
  values (coalesce(nullif(trim(p_name), ''), 'My Business'))
  returning id into v_biz;

  -- First business for a brand-new user: create their owner profile.
  -- Existing users keep their profile; switchBusiness() moves them over.
  if not exists (select 1 from public.profiles where id = v_uid) then
    select email into v_email from auth.users where id = v_uid;
    insert into public.profiles (id, business_id, name, email, role)
    values (v_uid, v_biz, coalesce(trim(p_owner_name), ''), lower(coalesce(v_email, '')), 'owner');
  end if;

  insert into public.user_businesses (user_id, business_id, role)
  values (v_uid, v_biz, 'owner')
  on conflict (user_id, business_id) do nothing;

  return v_biz;
end;
$$;

revoke all on function public.create_owned_business(text, text) from public, anon;
grant execute on function public.create_owned_business(text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Remove the loosened duplicate policies on businesses
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "enable insert for authenticated users"         on public.businesses;
drop policy if exists "members and owners can view their businesses"  on public.businesses;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Future tables created in SQL should also be usable by service_role
--    (edge functions). authenticated is already covered.
-- ─────────────────────────────────────────────────────────────────────────────

alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;
