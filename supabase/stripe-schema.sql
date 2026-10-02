-- Stripe integration schema additions
-- Run in Supabase Dashboard → SQL Editor
--
-- Adds stripe_customer_id and stripe_subscription_id to the subscriptions table.
-- These are written by the stripe-webhook edge function (using service role) and
-- never touched by client code. stripe_customer_id is indexed for fast lookups
-- in customer.subscription.updated / deleted webhook events.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id     text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

CREATE INDEX IF NOT EXISTS subscriptions_stripe_customer_id_idx
  ON public.subscriptions (stripe_customer_id);
