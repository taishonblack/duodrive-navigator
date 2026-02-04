-- Create premium_users table for permanently premium users
CREATE TABLE public.premium_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  expires_at timestamp with time zone DEFAULT NULL, -- NULL means never expires
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  notes text
);

-- Enable RLS
ALTER TABLE public.premium_users ENABLE ROW LEVEL SECURITY;

-- Users can view their own premium status
CREATE POLICY "Users can view their own premium status"
ON public.premium_users
FOR SELECT
USING (auth.uid() = user_id);

-- Only admins can manage premium users
CREATE POLICY "Admins can manage premium users"
ON public.premium_users
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Insert taishon.black@yahoo.com as premium user (lookup by email in profiles)
INSERT INTO public.premium_users (user_id, notes)
SELECT id, 'Manually granted permanent premium access'
FROM public.profiles
WHERE email = 'taishon.black@yahoo.com';