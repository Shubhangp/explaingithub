-- Create a table to store repository view history
CREATE TABLE IF NOT EXISTS repo_view_history (
  id SERIAL PRIMARY KEY,
  email TEXT,
  provider TEXT NOT NULL,
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  -- This will help us identify the most recent view for ordering
  UNIQUE(email, provider, owner, repo)
);

-- Create index for faster lookups by email
CREATE INDEX IF NOT EXISTS idx_repo_view_history_email ON repo_view_history(email);

-- Create index for faster ordering by viewed_at
CREATE INDEX IF NOT EXISTS idx_repo_view_history_viewed_at ON repo_view_history(viewed_at);

-- Set RLS policies
ALTER TABLE repo_view_history ENABLE ROW LEVEL SECURITY;

-- Allow insert for all users
CREATE POLICY "Allow insert for all users" 
  ON repo_view_history FOR INSERT TO public WITH CHECK (true);

-- Only allow reading own history for authenticated users
CREATE POLICY "Allow select for authenticated users" 
  ON repo_view_history FOR SELECT USING (
    auth.role() = 'authenticated' AND email = auth.email()
  );

-- Allow service role to access all records
CREATE POLICY "Allow all for service role" 
  ON repo_view_history FOR ALL TO service_role USING (true); 