-- Adds a security-definer RPC that any authenticated user can call to fetch
-- their own business's subscription plan. Runs as the function owner (bypasses
-- RLS on subscriptions), but enforces that the caller can only look up their
-- own business by matching p_business_id against their profile's business_id.
--
-- Run in Supabase Dashboard → SQL Editor

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
        -- caller must belong to this business
        and p_business_id = (
          select business_id from public.profiles where id = auth.uid()
        )
    ),
    'free'
  )
$$;
