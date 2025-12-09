-- Enable RLS on the view by recreating it properly
-- Views inherit RLS from underlying tables when security_invoker is true
-- But we need to ensure the view respects RLS by design

-- The view already uses SECURITY INVOKER which means it uses the querying user's permissions
-- The underlying coaching_requests table has proper RLS policies
-- The view's CASE statements provide additional field-level masking

-- Mark the view as requiring RLS checks
ALTER VIEW public.coaching_requests_coach_view SET (security_invoker = true);

-- Revoke access from public/anon and only allow authenticated
REVOKE ALL ON public.coaching_requests_coach_view FROM anon;
REVOKE ALL ON public.coaching_requests_coach_view FROM public;
GRANT SELECT ON public.coaching_requests_coach_view TO authenticated;