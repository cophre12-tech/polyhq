-- Subscription RLS & auto-seed fix for PolyHQ
-- Run in Supabase Dashboard → SQL Editor
--
-- Fixes two issues:
--   1. SELECT policy used a subquery through profiles RLS — co-owners hit a
--      chained-evaluation edge case and the query silently returned null,
--      defaulting every co-owner to the free plan.
--   2. No subscription row was created for businesses added after the initial
--      seed — fetchPlan got zero rows and returned 'free' for everyone.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Fix SELECT policy — use current_business_id() directly, same as all
--    other tables. Simpler, consistent, no RLS-chained subquery.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "Members can read their business subscription" on public.subscriptions;

create policy "Members can read their business subscription"
  on public.subscriptions for select
  using (business_id = public.current_business_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Trigger: auto-create a 'free' subscription row whenever a business is
--    created. Runs security definer so no INSERT RLS is needed client-side.
-- ─────────────────────────────────────────────────────────────────────────────

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

drop trigger if exists create_subscription_on_business_insert on public.businesses;

create trigger create_subscription_on_business_insert
  after insert on public.businesses
  for each row execute procedure public.on_business_created();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Back-fill any businesses that are missing a subscription row
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.subscriptions (business_id, plan)
  select id, 'free' from public.businesses
  on conflict (business_id) do nothing;
