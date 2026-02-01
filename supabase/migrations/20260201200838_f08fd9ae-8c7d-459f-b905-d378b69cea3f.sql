-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service role can update entitlements" ON public.deal_entitlements;

-- Create a more restrictive policy - users can only update their own entitlements
-- The webhook uses service_role key which bypasses RLS, so this is fine
CREATE POLICY "Users can update their own entitlements"
ON public.deal_entitlements
FOR UPDATE
USING (auth.uid() = user_id);