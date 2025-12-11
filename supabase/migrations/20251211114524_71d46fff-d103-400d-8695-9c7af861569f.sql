-- Add tags array and is_pinned columns to chat_conversations
ALTER TABLE public.chat_conversations
ADD COLUMN tags text[] DEFAULT '{}',
ADD COLUMN is_pinned boolean DEFAULT false;