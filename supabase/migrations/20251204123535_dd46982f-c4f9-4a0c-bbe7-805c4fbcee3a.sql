-- Create table for tracking active coaching sessions
CREATE TABLE public.coaching_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.coaching_requests(id) ON DELETE CASCADE NOT NULL,
  coach_id uuid REFERENCES public.coaches(id) NOT NULL,
  customer_id uuid NOT NULL,
  session_type session_type NOT NULL,
  
  -- Google Meet / Twilio integration
  meet_link text,
  twilio_room_sid text,
  masked_phone_number text,
  
  -- Time tracking
  scheduled_duration_minutes integer NOT NULL DEFAULT 30,
  started_at timestamp with time zone,
  ended_at timestamp with time zone,
  actual_duration_minutes integer,
  
  -- Extension tracking
  extension_requested boolean DEFAULT false,
  extension_minutes integer DEFAULT 0,
  extension_approved boolean,
  extension_price_cents integer,
  
  -- Status
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'warning_sent', 'extension_pending', 'completed', 'cancelled')),
  
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.coaching_sessions ENABLE ROW LEVEL SECURITY;

-- Customers can view their own sessions
CREATE POLICY "Customers can view their own sessions"
ON public.coaching_sessions FOR SELECT
USING (auth.uid() = customer_id);

-- Coaches can view and manage their sessions
CREATE POLICY "Coaches can view their sessions"
ON public.coaching_sessions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM coaches c WHERE c.user_id = auth.uid() AND c.id = coaching_sessions.coach_id
));

CREATE POLICY "Coaches can update their sessions"
ON public.coaching_sessions FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM coaches c WHERE c.user_id = auth.uid() AND c.id = coaching_sessions.coach_id
));

-- Admins can manage all sessions
CREATE POLICY "Admins can view all sessions"
ON public.coaching_sessions FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all sessions"
ON public.coaching_sessions FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert sessions"
ON public.coaching_sessions FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Coaches can create sessions for their claimed requests
CREATE POLICY "Coaches can create sessions"
ON public.coaching_sessions FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM coaches c WHERE c.user_id = auth.uid() AND c.id = coaching_sessions.coach_id
));

-- Trigger for updated_at
CREATE TRIGGER update_coaching_sessions_updated_at
BEFORE UPDATE ON public.coaching_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table for storing coach Google OAuth tokens
CREATE TABLE public.coach_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid REFERENCES public.coaches(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Google OAuth
  google_connected boolean DEFAULT false,
  google_refresh_token text,
  google_access_token text,
  google_token_expires_at timestamp with time zone,
  
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.coach_integrations ENABLE ROW LEVEL SECURITY;

-- Coaches can only manage their own integrations
CREATE POLICY "Coaches can view their own integrations"
ON public.coach_integrations FOR SELECT
USING (EXISTS (
  SELECT 1 FROM coaches c WHERE c.user_id = auth.uid() AND c.id = coach_integrations.coach_id
));

CREATE POLICY "Coaches can update their own integrations"
ON public.coach_integrations FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM coaches c WHERE c.user_id = auth.uid() AND c.id = coach_integrations.coach_id
));

CREATE POLICY "Coaches can insert their own integrations"
ON public.coach_integrations FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM coaches c WHERE c.user_id = auth.uid() AND c.id = coach_integrations.coach_id
));

-- Trigger for updated_at
CREATE TRIGGER update_coach_integrations_updated_at
BEFORE UPDATE ON public.coach_integrations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add admin policies to coaches and coaching_requests tables
CREATE POLICY "Admins can view all coaches"
ON public.coaches FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert coaches"
ON public.coaches FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all coaches"
ON public.coaches FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete coaches"
ON public.coaches FOR DELETE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all coaching requests"
ON public.coaching_requests FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all coaching requests"
ON public.coaching_requests FOR UPDATE
USING (has_role(auth.uid(), 'admin'));