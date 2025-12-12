-- Drop the problematic RLS policy that exposes email/phone to all coaches
DROP POLICY IF EXISTS "Coaches can view pending requests for their tier" ON public.coaching_requests;

-- Create new policy that doesn't allow coaches to view pending requests directly
-- They must use the masked view instead
CREATE POLICY "Coaches can only view their claimed requests"
ON public.coaching_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM coaches c
    WHERE c.user_id = auth.uid() AND c.id = coaching_requests.coach_id
  )
);

-- Create coach_customer_updates table for coach-to-customer communication
CREATE TABLE public.coach_customer_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL,
  request_id UUID REFERENCES public.coaching_requests(id) ON DELETE CASCADE,
  update_type TEXT NOT NULL CHECK (update_type IN ('update', 'schedule_request')),
  message TEXT NOT NULL,
  proposed_times JSONB, -- For schedule requests: array of proposed datetime options
  customer_selected_time TIMESTAMP WITH TIME ZONE,
  meet_link TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'read', 'responded', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.coach_customer_updates ENABLE ROW LEVEL SECURITY;

-- Coaches can create updates for their customers
CREATE POLICY "Coaches can create updates for their customers"
ON public.coach_customer_updates
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM coaches c
    WHERE c.user_id = auth.uid() AND c.id = coach_customer_updates.coach_id
  )
);

-- Coaches can view their own updates
CREATE POLICY "Coaches can view their updates"
ON public.coach_customer_updates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM coaches c
    WHERE c.user_id = auth.uid() AND c.id = coach_customer_updates.coach_id
  )
);

-- Coaches can update their own updates (to add meet link)
CREATE POLICY "Coaches can update their updates"
ON public.coach_customer_updates
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM coaches c
    WHERE c.user_id = auth.uid() AND c.id = coach_customer_updates.coach_id
  )
);

-- Customers can view updates sent to them
CREATE POLICY "Customers can view their updates"
ON public.coach_customer_updates
FOR SELECT
USING (auth.uid() = customer_id);

-- Customers can update (to select time for schedule requests)
CREATE POLICY "Customers can respond to updates"
ON public.coach_customer_updates
FOR UPDATE
USING (auth.uid() = customer_id);

-- Admins can view all updates
CREATE POLICY "Admins can view all updates"
ON public.coach_customer_updates
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_coach_customer_updates_updated_at
BEFORE UPDATE ON public.coach_customer_updates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.coach_customer_updates;