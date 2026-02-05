-- Block anonymous access to all coaching-related tables

-- coaches
CREATE POLICY "Block anonymous access"
  ON public.coaches
  FOR SELECT
  TO anon
  USING (false);

-- coach_chat_sessions
CREATE POLICY "Block anonymous access"
  ON public.coach_chat_sessions
  FOR SELECT
  TO anon
  USING (false);

-- coach_chat_messages
CREATE POLICY "Block anonymous access"
  ON public.coach_chat_messages
  FOR SELECT
  TO anon
  USING (false);

-- coach_customer_updates
CREATE POLICY "Block anonymous access"
  ON public.coach_customer_updates
  FOR SELECT
  TO anon
  USING (false);

-- coach_integrations
CREATE POLICY "Block anonymous access"
  ON public.coach_integrations
  FOR SELECT
  TO anon
  USING (false);

-- coach_oauth_tokens
CREATE POLICY "Block anonymous access"
  ON public.coach_oauth_tokens
  FOR SELECT
  TO anon
  USING (false);

-- coaching_sessions
CREATE POLICY "Block anonymous access"
  ON public.coaching_sessions
  FOR SELECT
  TO anon
  USING (false);

-- coach_audit_logs
CREATE POLICY "Block anonymous access"
  ON public.coach_audit_logs
  FOR SELECT
  TO anon
  USING (false);

-- session_ratings
CREATE POLICY "Block anonymous access"
  ON public.session_ratings
  FOR SELECT
  TO anon
  USING (false);