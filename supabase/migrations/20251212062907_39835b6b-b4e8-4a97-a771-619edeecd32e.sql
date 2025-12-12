-- Create a dedicated table for coach chat sessions (text-based coaching through the platform)
CREATE TABLE public.coach_chat_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.coaching_requests(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'active', 'completed', 'cancelled')),
  scheduled_duration_minutes INTEGER NOT NULL DEFAULT 10,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  actual_duration_minutes INTEGER,
  coach_extended BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create a table for coach chat messages
CREATE TABLE public.coach_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_session_id UUID NOT NULL REFERENCES public.coach_chat_sessions(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('coach', 'customer')),
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.coach_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for coach_chat_sessions
CREATE POLICY "Customers can view their own chat sessions" 
ON public.coach_chat_sessions 
FOR SELECT 
USING (auth.uid() = customer_id);

CREATE POLICY "Coaches can view their assigned chat sessions" 
ON public.coach_chat_sessions 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.coaches c 
  WHERE c.user_id = auth.uid() AND c.id = coach_chat_sessions.coach_id
));

CREATE POLICY "Coaches can update their assigned chat sessions" 
ON public.coach_chat_sessions 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.coaches c 
  WHERE c.user_id = auth.uid() AND c.id = coach_chat_sessions.coach_id
));

CREATE POLICY "Coaches can create chat sessions for their claimed requests" 
ON public.coach_chat_sessions 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.coaches c 
  WHERE c.user_id = auth.uid() AND c.id = coach_chat_sessions.coach_id
));

CREATE POLICY "Admins can view all chat sessions" 
ON public.coach_chat_sessions 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all chat sessions" 
ON public.coach_chat_sessions 
FOR UPDATE 
USING (public.has_role(auth.uid(), 'admin'));

-- RLS policies for coach_chat_messages
CREATE POLICY "Participants can view messages in their sessions" 
ON public.coach_chat_messages 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.coach_chat_sessions s 
  WHERE s.id = coach_chat_messages.chat_session_id 
  AND (
    s.customer_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.coaches c WHERE c.user_id = auth.uid() AND c.id = s.coach_id)
  )
));

CREATE POLICY "Customers can send messages to their sessions" 
ON public.coach_chat_messages 
FOR INSERT 
WITH CHECK (
  sender_type = 'customer' 
  AND sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.coach_chat_sessions s 
    WHERE s.id = coach_chat_messages.chat_session_id 
    AND s.customer_id = auth.uid()
    AND s.status = 'active'
  )
);

CREATE POLICY "Coaches can send messages to their sessions" 
ON public.coach_chat_messages 
FOR INSERT 
WITH CHECK (
  sender_type = 'coach' 
  AND EXISTS (
    SELECT 1 FROM public.coach_chat_sessions s 
    JOIN public.coaches c ON c.id = s.coach_id
    WHERE s.id = coach_chat_messages.chat_session_id 
    AND c.user_id = auth.uid()
    AND s.status = 'active'
  )
);

CREATE POLICY "Admins can view all messages" 
ON public.coach_chat_messages 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

-- Enable realtime for chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.coach_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.coach_chat_sessions;

-- Create trigger for updated_at on coach_chat_sessions
CREATE TRIGGER update_coach_chat_sessions_updated_at
BEFORE UPDATE ON public.coach_chat_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();