-- Enable RLS on the coaching_requests_coach_view
ALTER VIEW public.coaching_requests_coach_view SET (security_invoker = true);

-- Create RLS policies for coaching_requests_coach_view
-- Note: Views inherit RLS from their underlying tables when security_invoker is true
-- But we need to ensure the underlying coaching_requests table has proper policies

-- For extra safety, let's also ensure the view only shows data the user should see
-- by recreating it with proper security

DROP VIEW IF EXISTS public.coaching_requests_coach_view;

-- Recreate the view with SECURITY INVOKER (inherits caller's permissions)
CREATE VIEW public.coaching_requests_coach_view WITH (security_invoker = true) AS
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
  -- Mask PII: Only the customer themselves can see their own email
  CASE 
    WHEN cr.customer_id = auth.uid() THEN cr.email
    ELSE '***@***.***'::text
  END as email,
  -- Mask phone: Only the customer themselves can see their own phone
  CASE 
    WHEN cr.customer_id = auth.uid() THEN cr.phone_number
    ELSE '***-***-****'::text
  END as phone_number,
  -- Mask notes: Only the customer themselves can see their own notes
  CASE 
    WHEN cr.customer_id = auth.uid() THEN cr.notes
    ELSE NULL
  END as notes
FROM public.coaching_requests cr
WHERE 
  -- Customer can see their own requests
  cr.customer_id = auth.uid()
  -- Or coach can see requests assigned to them
  OR EXISTS (
    SELECT 1 FROM public.coaches c 
    WHERE c.user_id = auth.uid() AND c.id = cr.coach_id
  )
  -- Or admin can see all requests
  OR public.has_role(auth.uid(), 'admin'::app_role);

-- Grant access to authenticated users (RLS in underlying table + view WHERE clause handles security)
GRANT SELECT ON public.coaching_requests_coach_view TO authenticated;