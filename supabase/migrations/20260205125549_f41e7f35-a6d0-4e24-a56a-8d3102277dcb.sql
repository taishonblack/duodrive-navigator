-- Block anonymous access to coaching_requests
CREATE POLICY "Block anonymous access"
  ON public.coaching_requests
  FOR SELECT
  TO anon
  USING (false);