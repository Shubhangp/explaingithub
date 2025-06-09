-- Drop the existing constraint first
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_provider_owner_repo_key;

-- Add a new constraint that includes user_id
ALTER TABLE public.conversations ADD CONSTRAINT conversations_user_id_provider_owner_repo_key UNIQUE (user_id, provider, owner, repo);

-- Ensure the messages column exists
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS messages JSONB DEFAULT '[]'::jsonb;

-- Create index on the user_id, provider, owner, repo fields for faster lookups
DROP INDEX IF EXISTS conversations_lookup_idx;
CREATE INDEX IF NOT EXISTS conversations_lookup_idx ON public.conversations (user_id, provider, owner, repo);

-- Add comment
COMMENT ON CONSTRAINT conversations_user_id_provider_owner_repo_key ON public.conversations 
IS 'Ensures each user has a unique conversation per repository';

-- Log the changes
DO $$
BEGIN
  RAISE NOTICE 'Conversations table constraints updated successfully.';
END $$; 