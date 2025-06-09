import supabase from '@/app/lib/supabase';

// SQL statements to create the chat database tables
const SQL_STATEMENTS = {
  // Create the persistent_chats table
  createTable: `
    CREATE TABLE IF NOT EXISTS persistent_chats (
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
  `,
  
  // Create necessary indexes
  createIndexes: `
    CREATE INDEX IF NOT EXISTS persistent_chats_user_id_idx ON persistent_chats (user_id);
    CREATE INDEX IF NOT EXISTS persistent_chats_owner_repo_idx ON persistent_chats (owner, repo);
    CREATE INDEX IF NOT EXISTS persistent_chats_conversation_id_idx ON persistent_chats (conversation_id);
  `,
};

/**
 * Function to set up the database directly from client side
 * by running SQL directly through RPC
 */
export async function setupDatabase(): Promise<{ success: boolean, error?: any }> {
  try {
    console.log('Setting up persistent_chats table...');
    
    // Try to insert a test record to check if table exists
    const { error: testError } = await supabase
      .from('persistent_chats')
      .select('id')
      .limit(1);
    
    // If table doesn't exist, create it
    if (testError && testError.code === 'PGRST116') {
      console.log('Table does not exist, creating...');
      
      // For client-side, we may not be able to run raw SQL directly
      // Instead, we can try using the REST API or notify the server
      // that setup is needed

      // Create the table through a direct insert attempt
      const { error: insertError } = await supabase
        .from('persistent_chats')
        .insert({
          user_id: 'test_setup',
          owner: 'test',
          repo: 'setup',
          provider: 'github',
          message_id: 'setup',
          role: 'system',
          content: 'Table setup test',
          timestamp: Date.now(),
          conversation_id: 'setup'
        });
      
      if (insertError && insertError.code !== '23505') { // Not a duplicate key error
        console.error('Error creating table:', insertError);
        return { success: false, error: insertError };
      }
      
      console.log('Table created or already exists');
      return { success: true };
    } else if (testError) {
      console.error('Error checking if table exists:', testError);
      return { success: false, error: testError };
    }
    
    console.log('Table already exists');
    return { success: true };
  } catch (error) {
    console.error('Error setting up database:', error);
    return { success: false, error };
  }
}

/**
 * Run this function on app initialization to ensure the database is set up
 */
export async function ensureDatabaseSetup(): Promise<void> {
  try {
    console.log('Checking database setup...');
    const result = await setupDatabase();
    if (result.success) {
      console.log('Database setup complete');
    } else {
      console.error('Database setup failed:', result.error);
    }
  } catch (error) {
    // Catch any exceptions to prevent app crashing
    console.error('Error in ensureDatabaseSetup:', error);
  }
} 