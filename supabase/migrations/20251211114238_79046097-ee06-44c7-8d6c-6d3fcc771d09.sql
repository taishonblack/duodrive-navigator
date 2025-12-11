-- Add title and notes columns to chat_conversations
ALTER TABLE public.chat_conversations
ADD COLUMN title text DEFAULT NULL,
ADD COLUMN notes text DEFAULT NULL;