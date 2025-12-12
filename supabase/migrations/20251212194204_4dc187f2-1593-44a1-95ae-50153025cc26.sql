
-- Drop existing coach view and recreate with stricter masking
DROP VIEW IF EXISTS public.coaching_requests_coach_view;

-- Create a stricter view that masks ALL PII for coaches
-- Coaches can only see unmasked PII if they are the assigned coach AND the request is not just 'pending'
CREATE VIEW public.coaching_requests_coach_view
WITH (security_invoker = true)
AS
SELECT
  cr.id,
  cr.session_type,
  cr.status,
  cr.scheduled_date,
  cr.scheduled_time,
  cr.created_at,
  cr.claimed_at,
  cr.completed_at,
  cr.deal_id,
  cr.customer_id,
  cr.coach_id,
  cr.updated_at,
  -- Only show email if: user is the customer, OR user is the assigned coach AND status is NOT 'pending'
  CASE 
    WHEN cr.customer_id = auth.uid() THEN cr.email
    WHEN EXISTS (
      SELECT 1 FROM coaches c 
      WHERE c.user_id = auth.uid() 
      AND c.id = cr.coach_id 
      AND cr.status != 'pending'
    ) THEN cr.email
    WHEN has_role(auth.uid(), 'admin') THEN cr.email
    ELSE '***@***.***'::text
  END as email,
  -- Only show phone if: user is the customer, OR user is the assigned coach AND status is NOT 'pending'
  CASE 
    WHEN cr.customer_id = auth.uid() THEN cr.phone_number
    WHEN EXISTS (
      SELECT 1 FROM coaches c 
      WHERE c.user_id = auth.uid() 
      AND c.id = cr.coach_id 
      AND cr.status != 'pending'
    ) THEN cr.phone_number
    WHEN has_role(auth.uid(), 'admin') THEN cr.phone_number
    ELSE '***-***-****'::text
  END as phone_number,
  -- Only show notes if: user is the customer, OR user is the assigned coach AND status is NOT 'pending'
  CASE 
    WHEN cr.customer_id = auth.uid() THEN cr.notes
    WHEN EXISTS (
      SELECT 1 FROM coaches c 
      WHERE c.user_id = auth.uid() 
      AND c.id = cr.coach_id 
      AND cr.status != 'pending'
    ) THEN cr.notes
    WHEN has_role(auth.uid(), 'admin') THEN cr.notes
    ELSE NULL
  END as notes
FROM coaching_requests cr;

-- Drop the existing policies that allow coaches to view raw coaching_requests
DROP POLICY IF EXISTS "Coaches can view pending requests" ON coaching_requests;

-- Create a policy that ONLY allows coaches to view requests they are assigned to (not pending ones)
CREATE POLICY "Coaches can view their assigned requests only"
ON coaching_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM coaches c 
    WHERE c.user_id = auth.uid() 
    AND c.id = coaching_requests.coach_id
  )
);

-- Update the claim policy - coaches can only claim if status is pending, but this is now admin-controlled
-- Remove the self-claim policy for coaches
DROP POLICY IF EXISTS "Coaches can claim pending requests" ON coaching_requests;

-- Create a function for admins to assign coaches to requests
CREATE OR REPLACE FUNCTION public.admin_assign_coach_to_request(
  p_request_id uuid,
  p_coach_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can assign coaches to requests';
  END IF;

  -- Update the request
  UPDATE coaching_requests
  SET 
    coach_id = p_coach_id,
    status = 'claimed',
    claimed_at = now(),
    updated_at = now()
  WHERE id = p_request_id AND status = 'pending';

  RETURN FOUND;
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.admin_assign_coach_to_request(uuid, uuid) TO authenticated;
