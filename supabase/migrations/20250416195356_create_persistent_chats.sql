-- Create a persistent_chats table to store chat messages
CREATE TABLE IF NOT EXISTS public.persistent_chats (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id TEXT NOT NULL,
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'github',
  message_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  selected_files TEXT[] NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  conversation_id TEXT NOT NULL DEFAULT 'default'
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS persistent_chats_user_id_idx ON public.persistent_chats (user_id);
CREATE INDEX IF NOT EXISTS persistent_chats_owner_repo_idx ON public.persistent_chats (owner, repo);
CREATE INDEX IF NOT EXISTS persistent_chats_conversation_id_idx ON public.persistent_chats (conversation_id);

-- Enable RLS (Row Level Security)
ALTER TABLE public.persistent_chats ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to read only their own chats
CREATE POLICY "Users can read their own chats"
  ON persistent_chats FOR SELECT
  USING (user_id = auth.uid()::TEXT OR user_id LIKE 'anonymous_%' OR user_id = 'system');

-- Create policy to allow users to insert their own chats
CREATE POLICY "Users can insert their own chats"
  ON persistent_chats FOR INSERT
  WITH CHECK (user_id = auth.uid()::TEXT OR user_id LIKE 'anonymous_%' OR user_id = 'system');

-- Create policy to allow users to update their own chats
CREATE POLICY "Users can update their own chats"
  ON persistent_chats FOR UPDATE
  USING (user_id = auth.uid()::TEXT OR user_id LIKE 'anonymous_%' OR user_id = 'system');

-- Create policy to allow users to delete their own chats
CREATE POLICY "Users can delete their own chats"
  ON persistent_chats FOR DELETE
  USING (user_id = auth.uid()::TEXT OR user_id LIKE 'anonymous_%' OR user_id = 'system');
