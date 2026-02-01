-- Create deal_entitlements table for one-time unlock per deal
CREATE TABLE public.deal_entitlements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL UNIQUE REFERENCES public.deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'unlocked')),
  stripe_payment_intent_id TEXT,
  unlocked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deal_entitlements ENABLE ROW LEVEL SECURITY;

-- Users can view their own entitlements
CREATE POLICY "Users can view their own entitlements"
ON public.deal_entitlements
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create entitlements for their own deals
CREATE POLICY "Users can create entitlements for their own deals"
ON public.deal_entitlements
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Service role can update entitlements (for webhook)
CREATE POLICY "Service role can update entitlements"
ON public.deal_entitlements
FOR UPDATE
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_deal_entitlements_updated_at
BEFORE UPDATE ON public.deal_entitlements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill existing deals with locked entitlements
INSERT INTO public.deal_entitlements (deal_id, user_id, status)
SELECT id, user_id, 'locked'
FROM public.deals
ON CONFLICT (deal_id) DO NOTHING;

-- Create function to auto-create entitlement on new deal
CREATE OR REPLACE FUNCTION public.create_deal_entitlement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.deal_entitlements (deal_id, user_id, status)
  VALUES (NEW.id, NEW.user_id, 'locked')
  ON CONFLICT (deal_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger to auto-create entitlement on deal insert
CREATE TRIGGER create_entitlement_on_deal_insert
AFTER INSERT ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.create_deal_entitlement();