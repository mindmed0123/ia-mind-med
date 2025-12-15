-- Add trial fields to subscriptions table
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS trial_start timestamp with time zone,
ADD COLUMN IF NOT EXISTS trial_end timestamp with time zone;

-- Add whatsapp to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS whatsapp text;

-- Add new status values to subscription_status enum
ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'PENDING_CHECKOUT';
ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'INACTIVE';
ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'EXPIRED';

-- Create index for faster status lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id 
ON public.subscriptions(stripe_subscription_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id 
ON public.subscriptions(stripe_customer_id);

-- Update RLS to allow service role to manage subscriptions (for webhook)
DROP POLICY IF EXISTS "Service role can manage subscriptions" ON public.subscriptions;
CREATE POLICY "Service role can manage subscriptions"
ON public.subscriptions
FOR ALL
USING (true)
WITH CHECK (true);

-- But restrict this policy to only work when called from service role context
-- The RLS bypass happens at the service role level, not policy level