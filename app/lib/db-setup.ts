import { createClient as supabaseCreateClient } from '@supabase/supabase-js';

// Query to create the user_provider_tokens table
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

// Query to check if table exists
const checkTableExists = `
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public'
  AND table_name = 'user_provider_tokens'
);
`;

// Query to check if refresh_token column exists
const checkRefreshTokenColumn = `
SELECT EXISTS (
  SELECT column_name 
  FROM information_schema.columns 
  WHERE table_schema = 'public'
  AND table_name = 'user_provider_tokens' 
  AND column_name = 'refresh_token'
);
`;

// Query to add refresh_token column if it doesn't exist
const addRefreshTokenColumn = `
ALTER TABLE user_provider_tokens 
ADD COLUMN IF NOT EXISTS refresh_token TEXT;
`;

/**
 * Set up database tables needed for the application
 */
export async function setupDatabase() {
  try {
    console.log('Setting up database tables...');
    
    // Create a Supabase client with service role key if available
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase credentials in environment variables');
      return { success: false, error: 'Missing Supabase credentials' };
    }
    
    const supabase = supabaseCreateClient(supabaseUrl, supabaseKey);
    console.log('Connected to Supabase');

    // Try to query the table to check if it exists
    const { error: tableCheckError } = await supabase
      .from('user_provider_tokens')
      .select('id')
      .limit(1);
      
    // If we get a PGRST116 error or 42P01 error, the table doesn't exist
    const tableNotExist = tableCheckError && 
      (tableCheckError.code === 'PGRST116' || tableCheckError.code === '42P01');
    
    console.log('Table check result:', { error: tableCheckError?.code || 'none', tableNotExist });
    
    if (tableNotExist) {
      console.log('Creating user_provider_tokens table...');
      
      // We'll use the raw SQL query approach - using Supabase's SQL interface
      try {
        // Create the table with direct SQL
        const { error } = await supabase.rpc('exec_sql', { sql: createUserProviderTokensTable });
        
        if (error) {
          console.error('Error with RPC exec_sql method:', error);
          
          // Fall back to direct database connection
          const { data, error: pgError } = await fetch(
            `${supabaseUrl}/rest/v1/`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
                'apikey': supabaseKey,
                'X-Client-Info': 'db-setup'
              },
              body: JSON.stringify({
                query: createUserProviderTokensTable
              })
            }
          ).then(res => res.json());
          
          if (pgError) {
            console.error('Error executing SQL directly:', pgError);
            return { success: false, error: pgError };
          }
          
          console.log('Successfully created user_provider_tokens table via direct SQL');
        } else {
          console.log('Successfully created user_provider_tokens table via RPC');
        }
        
        // After creating the table, check if it now exists
        const { error: recheckError } = await supabase
          .from('user_provider_tokens')
          .select('id')
          .limit(1);
          
        if (recheckError) {
          console.error('Table still not accessible after creation:', recheckError);
          return { success: false, error: recheckError };
        }
        
        console.log('Table creation confirmed - table is now accessible');
      } catch (error) {
        console.error('Error executing SQL to create table:', error);
        return { success: false, error };
      }
    } else {
      console.log('user_provider_tokens table already exists and is accessible');
    }
    
    return { success: true, message: 'Database setup completed successfully' };
  } catch (error) {
    console.error('Error setting up database:', error);
    return { success: false, error };
  }
} 

// This section will run when the file is executed directly with tsx or ts-node
// but not when imported as a module
// Using a self-executing async function to support top-level await
(async function() {
  // Check if this file is being run directly
  // ESM doesn't have require.main, so we need a different approach
  const isDirectlyExecuted = import.meta.url === `file://${process.argv[1]}`;
  
  if (isDirectlyExecuted) {
    console.log('Running database setup...');
    try {
      const result = await setupDatabase();
      console.log('Setup result:', result);
      if (!result.success) {
        process.exit(1);
      }
    } catch (error) {
      console.error('Unhandled error during database setup:', error);
      process.exit(1);
    }
  }
})(); 