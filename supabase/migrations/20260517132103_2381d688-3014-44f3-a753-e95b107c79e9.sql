
-- 1. Remove profiles from Realtime publication to prevent broadcasting email changes to all subscribers
ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;

-- 2. Add INSERT policy on profiles (currently missing) — only the user themselves can create their profile row
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- 3. Tighten unknown_term_escalations policies
-- Drop fragile current_setting-based INSERT policy
DROP POLICY IF EXISTS "Service role can insert escalations" ON public.unknown_term_escalations;

-- Replace with a more reliable auth.jwt() check (service role only)
CREATE POLICY "Service role can insert escalations"
ON public.unknown_term_escalations
FOR INSERT
TO public
WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- Allow users to view their own submissions
CREATE POLICY "Users can view their own escalations"
ON public.unknown_term_escalations
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 4. Remove user self-insert on deal_entitlements (privilege escalation: user could self-grant 'unlocked' status)
-- Entitlement rows are created by the create_deal_entitlement trigger (SECURITY DEFINER) and updated by stripe-webhook (service role).
DROP POLICY IF EXISTS "Users can create entitlements for their own deals" ON public.deal_entitlements;

-- Also remove user UPDATE on deal_entitlements so users can't flip their own status to 'unlocked'
DROP POLICY IF EXISTS "Users can update their own entitlements" ON public.deal_entitlements;
