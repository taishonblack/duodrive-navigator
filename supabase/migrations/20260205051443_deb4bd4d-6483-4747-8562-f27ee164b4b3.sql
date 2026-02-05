-- Add status and progress columns to deals table
ALTER TABLE public.deals 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'evaluated', 'archived')),
ADD COLUMN IF NOT EXISTS progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100);

-- Create deal_scores table for score trends
CREATE TABLE IF NOT EXISTS public.deal_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  score integer NOT NULL CHECK (score >= 0 AND score <= 100),
  summary text,
  flags_json jsonb DEFAULT '[]'::jsonb,
  score_breakdown jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on deal_scores
ALTER TABLE public.deal_scores ENABLE ROW LEVEL SECURITY;

-- Users can view their own scores
CREATE POLICY "Users can view their own deal scores"
ON public.deal_scores
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create scores for their own deals
CREATE POLICY "Users can create their own deal scores"
ON public.deal_scores
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_deal_scores_user_id ON public.deal_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_deal_scores_deal_id ON public.deal_scores(deal_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON public.deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_user_status ON public.deals(user_id, status);