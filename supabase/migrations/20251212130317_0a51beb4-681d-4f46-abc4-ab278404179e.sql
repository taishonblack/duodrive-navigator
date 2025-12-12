
-- Update the coaching_requests_coach_view to mask ALL contact information
-- Only the customer themselves can see their own contact details
-- Coaches and admins will see masked data

DROP VIEW IF EXISTS public.coaching_requests_coach_view;

CREATE VIEW public.coaching_requests_coach_view 
WITH (security_invoker = true)
AS
SELECT 
  id,
  session_type,
  status,
  scheduled_date,
  scheduled_time,
  created_at,
  claimed_at,
  completed_at,
  deal_id,
  customer_id,
  coach_id,
  updated_at,
  -- Only the customer can see their own email - everyone else sees masked
  CASE
    WHEN customer_id = auth.uid() THEN email
    ELSE '***@***.***'::text
  END AS email,
  -- Only the customer can see their own phone - everyone else sees masked
  CASE
    WHEN customer_id = auth.uid() THEN phone_number
    ELSE '***-***-****'::text
  END AS phone_number,
  -- Only the customer can see their own notes - everyone else sees null
  CASE
    WHEN customer_id = auth.uid() THEN notes
    ELSE NULL::text
  END AS notes
FROM coaching_requests cr;

-- Also update the coaching_sessions table to remove/mask the masked_phone_number column
-- Since this is a Twilio masked number, it's less sensitive but should still be protected
-- Create a function to mask phone numbers in sessions for non-participants
CREATE OR REPLACE FUNCTION public.get_masked_session_phone(session_customer_id uuid, session_coach_id uuid, phone text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    -- Only the customer can see the masked phone number
    WHEN session_customer_id = auth.uid() THEN phone
    -- Coaches who own the session can see it (needed for phone coaching)
    WHEN EXISTS (SELECT 1 FROM coaches c WHERE c.id = session_coach_id AND c.user_id = auth.uid()) THEN phone
    ELSE '***-***-****'::text
  END
$$;

COMMENT ON FUNCTION public.get_masked_session_phone IS 'Returns masked phone number unless viewer is the session customer or assigned coach';
