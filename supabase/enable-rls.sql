-- Re-enable RLS after migration
ALTER TABLE user_logins ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies that allow both reading and writing for anonymous users
-- Note: In production, you would want more restrictive policies
CREATE POLICY "Allow all access for anonymous" 
  ON user_logins FOR ALL TO anon USING (true);

CREATE POLICY "Allow all access for anonymous" 
  ON login_info FOR ALL TO anon USING (true);

CREATE POLICY "Allow all access for anonymous" 
  ON user_chats FOR ALL TO anon USING (true);

CREATE POLICY "Allow all access for anonymous" 
  ON users FOR ALL TO anon USING (true);

CREATE POLICY "Allow all access for anonymous" 
  ON user_tokens FOR ALL TO anon USING (true); 