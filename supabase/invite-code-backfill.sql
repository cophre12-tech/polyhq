-- Invite code backfill for PolyHQ
-- Run in Supabase Dashboard → SQL Editor
--
-- Businesses can end up with a null invite_code when:
--   1. The businesses table was created before the invite_code column was added
--      (no DEFAULT was applied to pre-existing rows).
--   2. The DEFAULT expression (gen_random_bytes) couldn't resolve at INSERT time
--      because pgcrypto wasn't in the search_path — the INSERT failed or the
--      column was added as nullable, leaving NULL for early rows.
--
-- This one-time update generates a unique code for every affected row.
-- The ON CONFLICT is not needed here — UPDATE doesn't conflict on UNIQUE.
-- gen_random_bytes is pgcrypto; Supabase pre-installs it in the extensions schema.

UPDATE public.businesses
SET invite_code = upper(substr(encode(extensions.gen_random_bytes(3), 'hex'), 1, 6))
WHERE invite_code IS NULL OR trim(invite_code) = '';

-- If the above fails because gen_random_bytes is already in the public search path
-- (older Supabase or pgcrypto installed in public schema), use:
--   UPDATE public.businesses
--   SET invite_code = upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 6))
--   WHERE invite_code IS NULL OR trim(invite_code) = '';
