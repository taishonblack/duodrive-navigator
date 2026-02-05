-- Drop the existing coach SELECT policy that may be too permissive
DROP POLICY IF EXISTS "Coaches can view their assigned requests only" ON public.coaching_requests;

-- Create a more restrictive policy: coaches can ONLY see requests assigned to them
CREATE POLICY "Coaches can view their assigned requests only"
ON public.coaching_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.coaches c 
    WHERE c.user_id = auth.uid() 
    AND c.id = coaching_requests.coach_id
    AND coaching_requests.coach_id IS NOT NULL
  )
);

-- Also verify the UPDATE policy is properly scoped
DROP POLICY IF EXISTS "Coaches can update their claimed requests" ON public.coaching_requests;

CREATE POLICY "Coaches can update their claimed requests"
ON public.coaching_requests
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.coaches c 
    WHERE c.user_id = auth.uid() 
    AND c.id = coaching_requests.coach_id
    AND coaching_requests.coach_id IS NOT NULL
  )
);