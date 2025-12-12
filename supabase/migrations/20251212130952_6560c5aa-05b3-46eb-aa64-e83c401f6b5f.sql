
-- Remove coach SELECT policies from the base coaching_requests table
-- Coaches must use the coaching_requests_coach_view which masks PII

DROP POLICY IF EXISTS "Coaches can view their claimed requests" ON public.coaching_requests;
DROP POLICY IF EXISTS "Coaches can only view their claimed requests" ON public.coaching_requests;

-- Keep the UPDATE policies for coaches (they need to claim/update requests)
-- But they won't be able to SELECT the raw data - only through the masked view

-- Create a new policy that allows coaches to see ONLY non-sensitive columns
-- This is done by creating a security definer function that returns safe data

CREATE OR REPLACE FUNCTION public.get_coaching_request_safe(request_id uuid)
RETURNS TABLE(
  id uuid,
  session_type session_type,
  status request_status,
  scheduled_date date,
  scheduled_time time,
  created_at timestamptz,
  claimed_at timestamptz,
  completed_at timestamptz,
  deal_id uuid,
  customer_id uuid,
  coach_id uuid,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    updated_at
  FROM coaching_requests
  WHERE coaching_requests.id = request_id
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_coaching_request_safe(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_coaching_request_safe IS 'Returns coaching request data without sensitive PII (email, phone, notes)';
