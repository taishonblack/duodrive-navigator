-- Create a secure table for coach OAuth credentials
-- This table has NO SELECT policies - only accessible via service_role in edge functions
CREATE TABLE IF NOT EXISTS public.coach_oauth_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id uuid NOT NULL UNIQUE REFERENCES public.coaches(id) ON DELETE CASCADE,
  google_access_token text,
  google_refresh_token text,
  google_token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS but with NO policies for regular users
-- Only service_role can access this table
ALTER TABLE public.coach_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- No SELECT, INSERT, UPDATE, DELETE policies for authenticated users
-- This ensures tokens are only accessible via edge functions using service_role

-- Add timestamp trigger
CREATE TRIGGER update_coach_oauth_tokens_updated_at
  BEFORE UPDATE ON public.coach_oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing tokens from coach_integrations to the new secure table
INSERT INTO public.coach_oauth_tokens (coach_id, google_access_token, google_refresh_token, google_token_expires_at, created_at, updated_at)
SELECT 
  coach_id, 
  google_access_token, 
  google_refresh_token, 
  google_token_expires_at,
  created_at,
  updated_at
FROM public.coach_integrations
WHERE google_refresh_token IS NOT NULL
ON CONFLICT (coach_id) DO UPDATE SET
  google_access_token = EXCLUDED.google_access_token,
  google_refresh_token = EXCLUDED.google_refresh_token,
  google_token_expires_at = EXCLUDED.google_token_expires_at,
  updated_at = now();

-- Remove sensitive token columns from coach_integrations
-- Keep only the google_connected boolean for UI display
ALTER TABLE public.coach_integrations 
  DROP COLUMN IF EXISTS google_access_token,
  DROP COLUMN IF EXISTS google_refresh_token,
  DROP COLUMN IF EXISTS google_token_expires_at;

COMMENT ON TABLE public.coach_oauth_tokens IS 'Secure storage for OAuth tokens - NO user access policies, only accessible via service_role';