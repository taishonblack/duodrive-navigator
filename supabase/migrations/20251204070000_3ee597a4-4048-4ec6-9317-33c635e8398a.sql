-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('customer', 'coach');

-- Create coaching_tier enum
CREATE TYPE public.coaching_tier AS ENUM ('text', 'phone', 'concierge');

-- Create session_type enum  
CREATE TYPE public.session_type AS ENUM ('text', 'phone', 'video');

-- Create request_status enum
CREATE TYPE public.request_status AS ENUM ('pending', 'claimed', 'in_progress', 'completed', 'cancelled');

-- User roles table (security best practice - separate from profiles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Coaches table
CREATE TABLE public.coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  tier coaching_tier NOT NULL DEFAULT 'text',
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;

-- Coaching requests table
CREATE TABLE public.coaching_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  coach_id UUID REFERENCES public.coaches(id) ON DELETE SET NULL,
  session_type session_type NOT NULL,
  status request_status NOT NULL DEFAULT 'pending',
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  phone_number TEXT NOT NULL,
  email TEXT NOT NULL,
  notes TEXT,
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coaching_requests ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- RLS Policies for coaches
CREATE POLICY "Coaches can view their own profile"
ON public.coaches FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Coaches can update their own profile"
ON public.coaches FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view available coaches"
ON public.coaches FOR SELECT
USING (is_available = true);

-- RLS Policies for coaching_requests
CREATE POLICY "Customers can create coaching requests"
ON public.coaching_requests FOR INSERT
WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can view their own requests"
ON public.coaching_requests FOR SELECT
USING (auth.uid() = customer_id);

CREATE POLICY "Coaches can view pending requests for their tier"
ON public.coaching_requests FOR SELECT
USING (
  public.has_role(auth.uid(), 'coach') AND
  status = 'pending'
);

CREATE POLICY "Coaches can view their claimed requests"
ON public.coaching_requests FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.coaches c 
    WHERE c.user_id = auth.uid() AND c.id = coach_id
  )
);

CREATE POLICY "Coaches can claim pending requests"
ON public.coaching_requests FOR UPDATE
USING (
  public.has_role(auth.uid(), 'coach') AND
  status = 'pending'
);

CREATE POLICY "Coaches can update their claimed requests"
ON public.coaching_requests FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.coaches c 
    WHERE c.user_id = auth.uid() AND c.id = coach_id
  )
);

-- Triggers for updated_at
CREATE TRIGGER update_coaches_updated_at
BEFORE UPDATE ON public.coaches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_coaching_requests_updated_at
BEFORE UPDATE ON public.coaching_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();