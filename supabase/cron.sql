-- PolyHQ scheduled push notifications via pg_cron + pg_net
-- Run this in Supabase Dashboard → SQL Editor
--
-- Prerequisites:
--   1. Enable pg_cron and pg_net in Dashboard → Database → Extensions
--   2. Deploy the 'scheduled-push' edge function
--   3. Set CRON_SECRET in that function's environment variables
--   4. Replace YOUR_CRON_SECRET below with the same value
--
-- Times are UTC. Adjust the hours for your timezone:
--   EST (UTC-5): 8:55am → 13:55, 4:30pm → 21:30
--   EDT (UTC-4): 8:55am → 12:55, 4:30pm → 20:30
--   CST (UTC-6): 8:55am → 14:55, 4:30pm → 22:30
--   PST (UTC-8): 8:55am → 16:55, 4:30pm → 00:30 (+1 day, use 0 30 * * *)
--   MST (UTC-7): 8:55am → 15:55, 4:30pm → 23:30

-- ── 8:55am clock-in reminder ──────────────────────────────────────────────────
select cron.schedule(
  'polyhq-clock-in-reminder',
  '55 13 * * *',
  $$
  select net.http_post(
    url     := 'https://nrzngxbmshyuijkwjvbs.supabase.co/functions/v1/scheduled-push',
    headers := '{"Content-Type":"application/json","x-cron-secret":"YOUR_CRON_SECRET"}'::jsonb,
    body    := '{"type":"clock_in_reminder"}'::jsonb
  );
  $$
);

-- ── 4:30pm clock-out reminder ─────────────────────────────────────────────────
select cron.schedule(
  'polyhq-clock-out-reminder',
  '30 21 * * *',
  $$
  select net.http_post(
    url     := 'https://nrzngxbmshyuijkwjvbs.supabase.co/functions/v1/scheduled-push',
    headers := '{"Content-Type":"application/json","x-cron-secret":"YOUR_CRON_SECRET"}'::jsonb,
    body    := '{"type":"clock_out_reminder"}'::jsonb
  );
  $$
);

-- ── 30-min job reminder (runs every minute, checks jobs starting in ~30 min) ──
-- Uses PostgreSQL's AT TIME ZONE to convert UTC→local time before passing to
-- the edge function, so job start times (stored as local HH:MM) match correctly.
-- Change 'America/New_York' to your timezone if needed.
select cron.schedule(
  'polyhq-job-reminder',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://nrzngxbmshyuijkwjvbs.supabase.co/functions/v1/scheduled-push',
    headers := '{"Content-Type":"application/json","x-cron-secret":"YOUR_CRON_SECRET"}'::jsonb,
    body    := jsonb_build_object(
      'type',       'job_reminder',
      'check_time', to_char((now() at time zone 'America/New_York') + interval '30 minutes', 'HH24:MI'),
      'today',      to_char(now() at time zone 'America/New_York', 'YYYY-MM-DD')
    )
  );
  $$
);

-- ── To remove these jobs later ────────────────────────────────────────────────
-- select cron.unschedule('polyhq-clock-in-reminder');
-- select cron.unschedule('polyhq-clock-out-reminder');
-- select cron.unschedule('polyhq-job-reminder');
