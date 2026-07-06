-- Multi-business support for PolyHQ
-- Run in Supabase Dashboard → SQL Editor

-- Track all businesses each auth user owns or belongs to (many-to-many catalog)
create table if not exists public.user_businesses (
  user_id     uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  role        text not null default 'owner',
  primary key (user_id, business_id)
);

alter table public.user_businesses enable row level security;

-- Add state column if missing (existing databases pre-dating the payroll state feature)
alter table public.businesses add column if not exists state text not null default 'VT';

-- Seed user_businesses from existing owner/co-owner profiles
insert into public.user_businesses (user_id, business_id, role)
  select id, business_id, role
  from public.profiles
  where role in ('owner', 'co_owner') and business_id is not null
  on conflict do nothing;
