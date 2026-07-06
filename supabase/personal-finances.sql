-- Personal Financials for PolyHQ
-- Run in Supabase Dashboard → SQL Editor
-- RLS: user_id = auth.uid() only — completely private, no business scope

-- Owner manual take-home pay entries
create table if not exists public.personal_income (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  amount     numeric(10,2) not null default 0,
  date       text not null,
  notes      text not null default '',
  created_at timestamptz not null default now()
);

alter table public.personal_income enable row level security;

create policy "users own their personal income"
  on public.personal_income for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Personal expenses for both owners and employees
create table if not exists public.personal_expenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  description text not null default '',
  amount      numeric(10,2) not null default 0,
  category    text not null default 'Other',
  date        text not null,
  recurring   boolean not null default false,
  frequency   text not null default 'monthly',
  created_at  timestamptz not null default now()
);

alter table public.personal_expenses enable row level security;

create policy "users own their personal expenses"
  on public.personal_expenses for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());
