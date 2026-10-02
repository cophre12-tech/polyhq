-- Add Venmo username to businesses table
-- Run in Supabase Dashboard → SQL Editor

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS venmo_username text;
