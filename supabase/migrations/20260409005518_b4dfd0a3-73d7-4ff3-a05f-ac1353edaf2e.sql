-- Composite index for dashboard laudo listing (user + status filter)
CREATE INDEX IF NOT EXISTS idx_laudos_user_status ON public.laudos (user_id, status);

-- Composite index for history pagination (user + created_at desc)
CREATE INDEX IF NOT EXISTS idx_laudos_user_created ON public.laudos (user_id, created_at DESC);

-- Composite index for subscription guard (user + status)
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON public.subscriptions (user_id, status);