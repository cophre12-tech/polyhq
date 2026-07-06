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

-- Any authenticated user can read the subscription for their own business
create policy "Members can read their business subscription"
  on public.subscriptions for select
  using (
    business_id in (
      select business_id from public.profiles where id = auth.uid()
    )
  );

-- Owners can update (future Stripe webhook will also need service-role access)
create policy "Owners can update their subscription"
  on public.subscriptions for update
  using (
    business_id in (
      select business_id from public.profiles
      where id = auth.uid() and role = 'owner'
    )
  );

-- Seed all existing businesses with the free plan
insert into public.subscriptions (business_id, plan)
  select id, 'free' from public.businesses
  on conflict (business_id) do nothing;
