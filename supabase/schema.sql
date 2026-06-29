-- PolyHQ Supabase Schema
-- Run this entire file in Supabase SQL Editor (Dashboard → SQL Editor → New query)
--
-- IMPORTANT: Before running, go to Authentication → Settings and set
-- "Enable email confirmations" to OFF so users can log in immediately after signup.

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: CREATE ALL TABLES  (no functions referenced yet)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.businesses (
  id             uuid primary key default gen_random_uuid(),
  name           text not null default '',
  logo           text,
  address        text not null default '',
  phone          text not null default '',
  service_radius integer not null default 25,
  pay_period     text not null default 'biweekly',
  pay_day        integer not null default 5,
  tax_method     text not null default 'single',
  invite_code    text unique not null default upper(substring(encode(gen_random_bytes(4), 'hex') from 1 for 6)),
  created_at     timestamptz default now()
);

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  name        text not null default '',
  email       text not null default '',
  role        text not null default 'employee',
  hourly_rate numeric(10,2),
  created_at  timestamptz default now()
);

create table public.pending_invites (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  email       text not null,
  name        text not null default '',
  role        text not null default 'employee',
  hourly_rate numeric(10,2) default 0,
  created_at  timestamptz default now(),
  unique(business_id, email)
);

create table public.services (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses(id) on delete cascade,
  name             text not null,
  default_price    numeric(10,2) default 0,
  duration_minutes integer default 60,
  created_at       timestamptz default now()
);

create table public.clock_records (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  clock_in    timestamptz not null default now(),
  clock_out   timestamptz,
  created_at  timestamptz default now()
);

create table public.jobs (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses(id) on delete cascade,
  parent_id      uuid references public.jobs(id) on delete set null,
  client_name    text default '',
  client_address text default '',
  service_type   text default '',
  date           text,
  start_time     text,
  end_time       text,
  assigned_to    uuid[] default '{}',
  status         text default 'scheduled',
  recurring      text default '',
  recurring_end  text,
  notes          text default '',
  created_at     timestamptz default now()
);

create table public.invoices (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses(id) on delete cascade,
  number         text default '',
  client_name    text default '',
  client_email   text default '',
  client_address text default '',
  service_date   text,
  due_date       text,
  line_items     jsonb default '[]',
  total          numeric(10,2) default 0,
  status         text default 'draft',
  notes          text default '',
  sent_at        timestamptz,
  paid_at        timestamptz,
  created_at     timestamptz default now()
);

create table public.expenses (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  description text default '',
  amount      numeric(10,2) default 0,
  category    text default 'Other',
  date        text default to_char(now(), 'YYYY-MM-DD'),
  created_at  timestamptz default now()
);

create table public.revenue (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  client       text default '',
  service_type text default '',
  amount       numeric(10,2) default 0,
  date         text default to_char(now(), 'YYYY-MM-DD'),
  created_at   timestamptz default now()
);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        text default 'default',
  title       text not null,
  message     text not null,
  job_id      uuid references public.jobs(id) on delete set null,
  read        boolean default false,
  created_at  timestamptz default now()
);

create table public.announcements (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  sender_id   uuid references public.profiles(id) on delete set null,
  body        text not null,
  read_by     uuid[] default '{}',
  created_at  timestamptz default now()
);

create table public.direct_messages (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  from_id     uuid references public.profiles(id) on delete set null,
  to_id       uuid references public.profiles(id) on delete set null,
  body        text not null,
  read        boolean default false,
  created_at  timestamptz default now()
);

create table public.job_notes (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  job_id      uuid references public.jobs(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete set null,
  body        text not null,
  created_at  timestamptz default now()
);

create table public.photos (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  job_id       uuid references public.jobs(id) on delete set null,
  user_id      uuid references public.profiles(id) on delete set null,
  storage_path text not null,
  label        text default 'general',
  caption      text default '',
  created_at   timestamptz default now()
);

create table public.availability (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  date        text not null,
  created_at  timestamptz default now(),
  unique(user_id, date)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: GRANT TABLE PERMISSIONS
-- Supabase doesn't auto-grant these when tables are created via SQL.
-- anon  = unauthenticated requests
-- authenticated = requests with a valid JWT (logged-in users)
-- ─────────────────────────────────────────────────────────────────────────────

grant usage on schema public to anon, authenticated;
grant all on all tables    in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: CREATE HELPER FUNCTIONS  (tables and grants exist now)
-- ─────────────────────────────────────────────────────────────────────────────

-- Returns the business_id for the currently authenticated user.
-- Used inside RLS policies (security definer bypasses RLS on profiles).
create or replace function public.current_business_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select business_id from public.profiles where id = auth.uid()
$$;

-- Returns a business_id by invite code — used during employee signup before
-- a profile row exists, so it cannot rely on current_business_id().
create or replace function public.business_id_from_invite(code text)
returns uuid
language sql stable security definer
set search_path = public
as $$
  select id from public.businesses where upper(invite_code) = upper(code) limit 1
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: ENABLE RLS AND ATTACH POLICIES  (functions are defined now)
-- ─────────────────────────────────────────────────────────────────────────────

-- BUSINESSES
alter table public.businesses enable row level security;

create policy "any authenticated user can create a business"
  on public.businesses for insert
  with check (auth.uid() is not null);

create policy "business members can view their business"
  on public.businesses for select
  using (id = current_business_id());

create policy "business members can update their business"
  on public.businesses for update
  using (id = current_business_id());

-- PROFILES
alter table public.profiles enable row level security;

create policy "users can insert their own profile"
  on public.profiles for insert
  with check (id = auth.uid());

create policy "business members can view all profiles"
  on public.profiles for select
  using (business_id = current_business_id());

create policy "business members can update profiles"
  on public.profiles for update
  using (business_id = current_business_id());

create policy "owners can delete profiles"
  on public.profiles for delete
  using (business_id = current_business_id());

-- PENDING INVITES
alter table public.pending_invites enable row level security;

create policy "business members can manage pending invites"
  on public.pending_invites for all
  using  (business_id = current_business_id())
  with check (business_id = current_business_id());

-- Allow any authenticated user to read invites by business_id.
-- Needed during signup before a profile row exists.
create policy "authenticated users can read invites"
  on public.pending_invites for select
  using (auth.uid() is not null);

-- SERVICES
alter table public.services enable row level security;

create policy "business members can manage services"
  on public.services for all
  using  (business_id = current_business_id())
  with check (business_id = current_business_id());

-- CLOCK RECORDS
alter table public.clock_records enable row level security;

create policy "business members can manage clock records"
  on public.clock_records for all
  using  (business_id = current_business_id())
  with check (business_id = current_business_id());

-- JOBS
alter table public.jobs enable row level security;

create policy "business members can manage jobs"
  on public.jobs for all
  using  (business_id = current_business_id())
  with check (business_id = current_business_id());

-- INVOICES
alter table public.invoices enable row level security;

create policy "business members can manage invoices"
  on public.invoices for all
  using  (business_id = current_business_id())
  with check (business_id = current_business_id());

-- EXPENSES
alter table public.expenses enable row level security;

create policy "business members can manage expenses"
  on public.expenses for all
  using  (business_id = current_business_id())
  with check (business_id = current_business_id());

-- REVENUE
alter table public.revenue enable row level security;

create policy "business members can manage revenue"
  on public.revenue for all
  using  (business_id = current_business_id())
  with check (business_id = current_business_id());

-- NOTIFICATIONS  (scoped to the individual user, not business)
alter table public.notifications enable row level security;

create policy "users can manage their own notifications"
  on public.notifications for all
  using (user_id = auth.uid());

-- ANNOUNCEMENTS
alter table public.announcements enable row level security;

create policy "business members can manage announcements"
  on public.announcements for all
  using  (business_id = current_business_id())
  with check (business_id = current_business_id());

-- DIRECT MESSAGES
alter table public.direct_messages enable row level security;

create policy "business members can manage direct messages"
  on public.direct_messages for all
  using  (business_id = current_business_id())
  with check (business_id = current_business_id());

-- JOB NOTES
alter table public.job_notes enable row level security;

create policy "business members can manage job notes"
  on public.job_notes for all
  using  (business_id = current_business_id())
  with check (business_id = current_business_id());

-- PHOTOS
alter table public.photos enable row level security;

create policy "business members can manage photos"
  on public.photos for all
  using  (business_id = current_business_id())
  with check (business_id = current_business_id());

-- AVAILABILITY
alter table public.availability enable row level security;

create policy "business members can manage availability"
  on public.availability for all
  using  (business_id = current_business_id())
  with check (business_id = current_business_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5: STORAGE BUCKET
-- ─────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
  values ('photos', 'photos', true)
  on conflict (id) do nothing;

create policy "photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'photos');

create policy "authenticated users can upload photos"
  on storage.objects for insert
  with check (bucket_id = 'photos' and auth.uid() is not null);

create policy "authenticated users can delete own photos"
  on storage.objects for delete
  using (bucket_id = 'photos' and auth.uid() is not null);
