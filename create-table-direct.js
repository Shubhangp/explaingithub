// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const createUserProviderTokensTable = `
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
`;

async function createTable() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in environment variables');
    process.exit(1);
  }
  
  console.log('Supabase URL:', supabaseUrl);
  console.log('Supabase Key available:', !!supabaseKey);
  console.log('Creating Supabase client...');
  
  try {
    // Create a Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Check if the user_provider_tokens table already exists
    console.log('Checking if table exists...');
    
    const { data: tableExists, error: tableError } = await supabase
      .from('user_provider_tokens')
      .select('id')
      .limit(1)
      .single();
    
    if (tableError && tableError.code === 'PGRST116') {
      console.log('Table does not exist. Creating it...');
      
      // Since we can't execute raw SQL with the JS client without access to a custom function,
      // we'll need to create the table structure manually using the Supabase API
      
      const tableData = {
        name: 'user_provider_tokens',
        schema: 'public',
        comment: 'Stores user provider authentication tokens'
      };
      
      console.log(`
IMPORTANT: You need to execute the following SQL in the Supabase Dashboard SQL Editor:

${createUserProviderTokensTable}

The table isn't being created automatically because the anon key doesn't have permission to create tables.
You need to go to https://app.supabase.com/ and:
1. Sign in 
2. Select your project (likely "github-directory-viewer")
3. Go to the SQL Editor
4. Paste the SQL above
5. Run the query
      `);
      
    } else if (tableError) {
      console.error('Error checking if table exists:', tableError);
    } else {
      console.log('Table already exists:', tableExists);
    }
    
    // List all tables in the public schema
    console.log('Listing all tables in the public schema...');
    const { data: tables, error: tablesError } = await supabase.rpc('get_tables');
    
    if (tablesError) {
      console.error('Error listing tables:', tablesError);
      
      // This RPC might not exist, so let's check another way
      const { data: schemaData, error: schemaError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');
      
      if (schemaError) {
        console.error('Error querying information_schema:', schemaError);
      } else {
        console.log('Tables found:', schemaData);
      }
    } else {
      console.log('Tables found:', tables);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

createTable(); 