-- Create session_ratings table for customer feedback
CREATE TABLE public.session_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_session_id UUID NOT NULL REFERENCES public.coach_chat_sessions(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL,
  coach_id UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint so customers can only rate a session once
ALTER TABLE public.session_ratings 
ADD CONSTRAINT unique_session_rating UNIQUE (chat_session_id, customer_id);

-- Enable RLS
ALTER TABLE public.session_ratings ENABLE ROW LEVEL SECURITY;

-- Customers can create their own ratings
CREATE POLICY "Customers can rate their own sessions"
ON public.session_ratings
FOR INSERT
WITH CHECK (auth.uid() = customer_id);

-- Customers can view their own ratings
CREATE POLICY "Customers can view their own ratings"
ON public.session_ratings
FOR SELECT
USING (auth.uid() = customer_id);

-- Coaches can view ratings for their sessions
CREATE POLICY "Coaches can view their session ratings"
ON public.session_ratings
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM coaches c
  WHERE c.user_id = auth.uid() AND c.id = session_ratings.coach_id
));

-- Admins can view all ratings
CREATE POLICY "Admins can view all ratings"
ON public.session_ratings
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add index for faster lookups
CREATE INDEX idx_session_ratings_coach ON public.session_ratings(coach_id);
CREATE INDEX idx_session_ratings_session ON public.session_ratings(chat_session_id);