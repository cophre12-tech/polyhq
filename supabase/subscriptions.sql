-- PolyHQ subscription plans
-- Run this in Supabase Dashboard → SQL Editor

create table if not exists public.subscriptions (
  id          uuid        primary key default gen_random_uuid(),
  business_id uuid        not null references public.businesses(id) on delete cascade,
  plan        text        not null default 'free'
                          check (plan in ('free', 'pro', 'business')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint subscriptions_business_id_key unique (business_id)
);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute procedure public.set_updated_at();

-- RLS
alter table public.subscriptions enable row level security;

-- All business members (owner, co_owner, employee) can read their business's
-- subscription. Uses current_business_id() directly — same pattern as all
-- other tables — to avoid a chained subquery-through-RLS evaluation.
create policy "Members can read their business subscription"
  on public.subscriptions for select
  using (business_id = public.current_business_id());

-- Only owners can upgrade/downgrade (Stripe webhook uses service role)
create policy "Owners can update their subscription"
  on public.subscriptions for update
  using (
    business_id in (
      select business_id from public.profiles
      where id = auth.uid() and role = 'owner'
    )
  );

-- Auto-create a 'free' subscription row whenever a business is created.
-- Runs security definer so no client-side INSERT permission is needed.
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

create trigger create_subscription_on_business_insert
  after insert on public.businesses
  for each row execute procedure public.on_business_created();

-- Seed subscription rows for all existing businesses
insert into public.subscriptions (business_id, plan)
  select id, 'free' from public.businesses
  on conflict (business_id) do nothing;
