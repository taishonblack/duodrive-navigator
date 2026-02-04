-- Create unknown_term_escalations table to track Henry's unknown topic escalations
CREATE TABLE public.unknown_term_escalations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  term TEXT NOT NULL,
  user_message TEXT NOT NULL,
  context TEXT,
  conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE SET NULL,
  user_id UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  resolution_notes TEXT,
  resolved_by UUID,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.unknown_term_escalations ENABLE ROW LEVEL SECURITY;

-- Only admins can view escalations
CREATE POLICY "Admins can view all escalations"
ON public.unknown_term_escalations
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update escalations (to resolve them)
CREATE POLICY "Admins can update escalations"
ON public.unknown_term_escalations
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can insert escalations (from edge function)
CREATE POLICY "Service role can insert escalations"
ON public.unknown_term_escalations
FOR INSERT
WITH CHECK (true);

-- Only admins can delete escalations
CREATE POLICY "Admins can delete escalations"
ON public.unknown_term_escalations
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for efficient status filtering
CREATE INDEX idx_unknown_term_escalations_status ON public.unknown_term_escalations(status);
CREATE INDEX idx_unknown_term_escalations_created_at ON public.unknown_term_escalations(created_at DESC);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_unknown_term_escalations_updated_at
BEFORE UPDATE ON public.unknown_term_escalations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();