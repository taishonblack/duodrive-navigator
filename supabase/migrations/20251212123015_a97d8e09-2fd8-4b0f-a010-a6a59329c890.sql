-- Create audit log table for coach compliance tracking
CREATE TABLE public.coach_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for efficient querying
CREATE INDEX idx_coach_audit_logs_coach_id ON public.coach_audit_logs(coach_id);
CREATE INDEX idx_coach_audit_logs_action ON public.coach_audit_logs(action);
CREATE INDEX idx_coach_audit_logs_created_at ON public.coach_audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.coach_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs (compliance requirement)
CREATE POLICY "Admins can view all audit logs"
ON public.coach_audit_logs FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Coaches can insert their own audit logs
CREATE POLICY "Coaches can insert their own audit logs"
ON public.coach_audit_logs FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM coaches c
  WHERE c.user_id = auth.uid() AND c.id = coach_audit_logs.coach_id
));

-- Add comment for documentation
COMMENT ON TABLE public.coach_audit_logs IS 'Audit trail for coach actions on customer data for compliance';