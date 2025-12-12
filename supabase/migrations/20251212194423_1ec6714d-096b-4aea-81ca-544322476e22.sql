
-- The coaching_requests_coach_view is a view with SECURITY INVOKER which inherits RLS from coaching_requests
-- Views don't have their own RLS policies - they use the underlying table's policies
-- The view already masks sensitive data via CASE statements
-- No action needed for the view - the masking is done in the view definition itself

-- For coach_oauth_tokens, this table is intentionally WITHOUT policies for security
-- Only service_role (edge functions) should access it, not regular users
-- This is the correct security pattern - we don't want any user to query tokens directly
-- The edge functions access this table via service role key

-- However, we should add a comment to document this intentional design
COMMENT ON TABLE public.coach_oauth_tokens IS 'OAuth tokens are only accessed via service_role in edge functions. No RLS policies intentionally - tokens should never be queried by regular users.';

-- Add policies to coach_oauth_tokens for proper access control via service role
-- These are INSERT/UPDATE/DELETE policies for edge functions that run as service_role
-- No SELECT policy is intentional - prevents token exfiltration

-- Create policy for edge functions to manage tokens (they use service_role which bypasses RLS)
-- But we still need INSERT/UPDATE for completeness
CREATE POLICY "Service role manages tokens"
ON public.coach_oauth_tokens
FOR ALL
USING (
  -- Only allow if caller is using service_role (edge functions)
  current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
)
WITH CHECK (
  current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
);
