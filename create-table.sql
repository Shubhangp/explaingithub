-- Create the user_provider_tokens table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_provider_tokens (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  provider TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMP WITH TIME ZONE,
  username TEXT,
  user_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_validated_at TIMESTAMP WITH TIME ZONE,
  is_valid BOOLEAN DEFAULT TRUE,
  UNIQUE(email, provider)
);

-- Create index for faster lookups by email
CREATE INDEX IF NOT EXISTS idx_user_provider_tokens_email ON user_provider_tokens(email);

-- Create index for faster lookups by provider
CREATE INDEX IF NOT EXISTS idx_user_provider_tokens_provider ON user_provider_tokens(provider);

-- Grant appropriate permissions for the anon and service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_provider_tokens TO anon, service_role;
GRANT USAGE, SELECT ON SEQUENCE user_provider_tokens_id_seq TO anon, service_role;

-- Add example command to check if the table was created
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public'
  AND table_name = 'user_provider_tokens'
);  