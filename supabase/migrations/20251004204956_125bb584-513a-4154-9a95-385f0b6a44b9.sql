-- Fix 1: Add INSERT policy to profiles table to prevent unauthorized profile creation
CREATE POLICY "Users can only insert their own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Fix 2: Add DELETE policy to profiles table for LGPD compliance
CREATE POLICY "Users can delete their own profile"
ON public.profiles FOR DELETE
TO authenticated
USING (auth.uid() = id);

-- Fix 3: Prevent direct subscription manipulation by users (critical payment bypass)
-- Only backend services with service_role_key should write to subscriptions
CREATE POLICY "No direct subscription creation"
ON public.subscriptions FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "No direct subscription updates"
ON public.subscriptions FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "No direct subscription deletion"
ON public.subscriptions FOR DELETE
TO authenticated
USING (false);

-- Fix 4: Lock down audit_logs to prevent tampering
-- Only allow writes through the security definer function
CREATE POLICY "Only security definer can write audit logs"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "No audit log updates"
ON public.audit_logs FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "No audit log deletions"
ON public.audit_logs FOR DELETE
TO authenticated
USING (false);

-- Fix 5: Add LGPD consent fields to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lgpd_consent_given boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lgpd_consent_date timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lgpd_consent_version text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lgpd_consent_ip text;

-- Fix 6: Update log_audit_action function to validate entity ownership
CREATE OR REPLACE FUNCTION public.log_audit_action(p_entity text, p_entity_id uuid, p_action text, p_diff jsonb DEFAULT NULL::jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_log_id UUID;
  v_owner_id UUID;
BEGIN
  -- Verify caller owns the entity for REPORT type
  IF p_entity = 'REPORT' THEN
    SELECT user_id INTO v_owner_id
    FROM public.laudos
    WHERE id = p_entity_id;
    
    IF v_owner_id IS NULL THEN
      RAISE EXCEPTION 'Entity not found';
    END IF;
    
    IF v_owner_id != auth.uid() THEN
      RAISE EXCEPTION 'Not authorized to log actions for this entity';
    END IF;
  END IF;
  
  -- Insert audit log
  INSERT INTO public.audit_logs (
    entity,
    entity_id,
    user_id,
    action,
    diff
  )
  VALUES (
    p_entity,
    p_entity_id,
    auth.uid(),
    p_action,
    p_diff
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$function$;