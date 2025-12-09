-- Drop and recreate the view with explicit SECURITY INVOKER
DROP VIEW IF EXISTS public.coaching_requests_coach_view;

CREATE VIEW public.coaching_requests_coach_view
WITH (security_invoker = true) AS
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
  -- Only show contact info if coach has claimed the request
  CASE 
    WHEN cr.coach_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM coaches c WHERE c.id = cr.coach_id AND c.user_id = auth.uid()
    ) THEN cr.email
    WHEN has_role(auth.uid(), 'admin'::app_role) THEN cr.email
    WHEN cr.customer_id = auth.uid() THEN cr.email
    ELSE '***@***.***'
  END as email,
  CASE 
    WHEN cr.coach_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM coaches c WHERE c.id = cr.coach_id AND c.user_id = auth.uid()
    ) THEN cr.phone_number
    WHEN has_role(auth.uid(), 'admin'::app_role) THEN cr.phone_number
    WHEN cr.customer_id = auth.uid() THEN cr.phone_number
    ELSE '***-***-****'
  END as phone_number,
  CASE 
    WHEN cr.coach_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM coaches c WHERE c.id = cr.coach_id AND c.user_id = auth.uid()
    ) THEN cr.notes
    WHEN has_role(auth.uid(), 'admin'::app_role) THEN cr.notes
    WHEN cr.customer_id = auth.uid() THEN cr.notes
    ELSE NULL
  END as notes
FROM public.coaching_requests cr;

-- Grant access to the view
GRANT SELECT ON public.coaching_requests_coach_view TO authenticated;