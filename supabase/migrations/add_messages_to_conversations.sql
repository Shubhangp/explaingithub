-- Add messages column to conversations table to store chat messages
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS messages JSONB DEFAULT '[]'::jsonb;

-- Create index on user_id, provider, owner, repo for faster lookups
CREATE INDEX IF NOT EXISTS conversations_lookup_idx ON public.conversations (user_id, provider, owner, repo);

-- Add comment to describe the purpose of the messages column
COMMENT ON COLUMN public.conversations.messages IS 'Stores an array of chat messages between user and assistant for this repository conversation';

-- Drop user_chats table if it exists (commented out for safety, uncomment to run)
-- DROP TABLE IF EXISTS public.user_chats CASCADE;

-- Drop messages table if it exists (commented out for safety, uncomment to run)
-- DROP TABLE IF EXISTS public.messages CASCADE; 