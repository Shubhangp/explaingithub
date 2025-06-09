-- Create a table to store user provider tokens
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

-- Enable RLS for security
ALTER TABLE user_provider_tokens ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to read their own tokens
CREATE POLICY "Users can read their own tokens"
  ON user_provider_tokens FOR SELECT
  USING (email = auth.email()::TEXT);

-- Create policy to allow service role to manage tokens
CREATE POLICY "Service role can manage all tokens"
  ON user_provider_tokens
  USING (auth.role() = 'service_role'); 