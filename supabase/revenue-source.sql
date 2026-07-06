-- Add source tracking to revenue entries
-- Run in Supabase Dashboard → SQL Editor

-- source: 'job' for auto-logged entries, 'manual' for hand-entered ones
alter table public.revenue
  add column if not exists source  text default 'manual',
  add column if not exists job_id  uuid references public.jobs(id) on delete set null;

-- Unique index prevents duplicate entries for the same job
create unique index if not exists revenue_job_id_unique
  on public.revenue(job_id)
  where job_id is not null;

-- Backfill existing rows
update public.revenue set source = 'manual' where source is null;
