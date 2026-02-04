-- Fix permissive INSERT policy - restrict to service role only
DROP POLICY IF EXISTS "Service role can insert escalations" ON public.unknown_term_escalations;

-- Create a more restrictive policy that only allows service role inserts
CREATE POLICY "Service role can insert escalations"
ON public.unknown_term_escalations
FOR INSERT
WITH CHECK (
  (current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
);