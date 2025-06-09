-- Create tables based on the existing Google Sheets structure

-- User Logins table
CREATE TABLE IF NOT EXISTS user_logins (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  login_date DATE NOT NULL,
  login_time TEXT NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Login Info table (without storing access tokens)
CREATE TABLE IF NOT EXISTS login_info (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address TEXT,
  login_date DATE NOT NULL,
  login_time TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User Chats table
CREATE TABLE IF NOT EXISTS user_chats (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  question TEXT,
  chat_date DATE NOT NULL,
  chat_time TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Users table for signup information
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  username TEXT,
  organization TEXT,
  purpose TEXT,
  signup_date DATE NOT NULL,
  signup_time TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User Tokens table for storing access tokens
CREATE TABLE IF NOT EXISTS user_tokens (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  username TEXT,
  access_token TEXT NOT NULL,
  updated_date DATE NOT NULL,
  updated_time TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Chat Messages table for persistent chat history
CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  message_id TEXT NOT NULL UNIQUE,
  user_email TEXT,
  owner TEXT,
  repo TEXT,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  selected_files JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS user_logins_email_idx ON user_logins (email);
CREATE INDEX IF NOT EXISTS login_info_email_idx ON login_info (email);
CREATE INDEX IF NOT EXISTS user_chats_email_idx ON user_chats (email);
CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
CREATE INDEX IF NOT EXISTS chat_messages_user_email_idx ON chat_messages (user_email);
CREATE INDEX IF NOT EXISTS chat_messages_owner_repo_idx ON chat_messages (owner, repo);

-- Create RLS policies for security
ALTER TABLE user_logins ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Remove any existing policies
DROP POLICY IF EXISTS "Allow full access to service role only" ON user_logins;
DROP POLICY IF EXISTS "Allow full access to service role only" ON login_info;
DROP POLICY IF EXISTS "Allow full access to service role only" ON user_chats;
DROP POLICY IF EXISTS "Allow full access to service role only" ON users;
DROP POLICY IF EXISTS "Allow full access to service role only" ON user_tokens;
DROP POLICY IF EXISTS "Allow full access to service role only" ON chat_messages;

-- Create new policies that allow anonymous users to insert
CREATE POLICY "Allow insert for all users" 
  ON user_logins FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow insert for all users" 
  ON login_info FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow insert for all users" 
  ON user_chats FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow insert for all users" 
  ON users FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow insert for all users" 
  ON user_tokens FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow insert for all users" 
  ON chat_messages FOR INSERT TO public WITH CHECK (true);

-- Only allow reading for authenticated or service roles
CREATE POLICY "Allow select for service role" 
  ON user_logins FOR SELECT USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

CREATE POLICY "Allow select for service role" 
  ON login_info FOR SELECT USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

CREATE POLICY "Allow select for service role" 
  ON user_chats FOR SELECT USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

CREATE POLICY "Allow select for service role" 
  ON users FOR SELECT USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

CREATE POLICY "Allow select for service role" 
  ON user_tokens FOR SELECT USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

CREATE POLICY "Allow select for service role" 
  ON chat_messages FOR SELECT USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Chat messages can also be read by anonymous users who created them (using owner/repo as identifiers)
CREATE POLICY "Allow select for message creators" 
  ON chat_messages FOR SELECT TO public USING (true); 