import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/auth/auth-options';

// SQL to create persistent_chats table with fixed type casting
const CREATE_PERSISTENT_CHATS_TABLE = `
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
`;

// SQL to create indexes
const CREATE_INDEXES = `
CREATE INDEX IF NOT EXISTS persistent_chats_user_id_idx ON persistent_chats (user_id);
CREATE INDEX IF NOT EXISTS persistent_chats_owner_repo_idx ON persistent_chats (owner, repo);
CREATE INDEX IF NOT EXISTS persistent_chats_conversation_id_idx ON persistent_chats (conversation_id);
`;

// SQL to enable RLS (Row Level Security)
const ENABLE_RLS = `
ALTER TABLE persistent_chats ENABLE ROW LEVEL SECURITY;
`;

// SQL to create RLS policies with proper type casting
const CREATE_RLS_POLICIES = `
CREATE POLICY IF NOT EXISTS "Users can read their own chats"
  ON persistent_chats FOR SELECT
  USING (user_id = auth.uid()::TEXT OR user_id LIKE 'anonymous_%');

CREATE POLICY IF NOT EXISTS "Users can insert their own chats"
  ON persistent_chats FOR INSERT
  WITH CHECK (user_id = auth.uid()::TEXT OR user_id LIKE 'anonymous_%');

CREATE POLICY IF NOT EXISTS "Users can update their own chats"
  ON persistent_chats FOR UPDATE
  USING (user_id = auth.uid()::TEXT OR user_id LIKE 'anonymous_%');

CREATE POLICY IF NOT EXISTS "Users can delete their own chats"
  ON persistent_chats FOR DELETE
  USING (user_id = auth.uid()::TEXT OR user_id LIKE 'anonymous_%');
`;

export async function GET(request: NextRequest) {
  try {
    // For debugging - allow access without authentication in dev
    let isAllowed = process.env.NODE_ENV === 'development';
    
    if (!isAllowed) {
      // Authenticate in production - only allow admins
      const session = await getServerSession(authOptions);
      isAllowed = !!session?.user?.email && (
        session.user.email.includes('admin') || 
        session.user.email === 'shivam.maurya@programmingwithmaurya.com'
      );
    }
    
    if (!isAllowed) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new NextResponse('Missing Supabase credentials', { status: 500 });
    }
    
    console.log('Setting up database with URL:', supabaseUrl);
    
    // Use service role key to execute SQL (needs higher privileges)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    try {
      // First create the table
      const { error: tableError } = await supabase.rpc('execute_sql', { sql: CREATE_PERSISTENT_CHATS_TABLE });
      
      if (tableError) {
        console.error('Error creating table:', tableError);
        
        // Try direct insert as a fallback
        const { error: insertError } = await supabase
          .from('persistent_chats')
          .insert({
            user_id: 'system',
            owner: 'setup',
            repo: 'init',
            provider: 'github',
            message_id: 'setup-' + Date.now(),
            role: 'system',
            content: 'Table initialization record',
            timestamp: Date.now(),
            conversation_id: 'setup'
          });
          
        if (insertError && insertError.code !== '23505') {
          // If still failing, return error details
          return NextResponse.json({ 
            success: false, 
            error: 'Failed to create table', 
            details: {
              tableError,
              insertError
            }
          }, { status: 500 });
        }
      }
      
      // Then create indexes
      await supabase.rpc('execute_sql', { sql: CREATE_INDEXES });
      
      // Enable RLS
      await supabase.rpc('execute_sql', { sql: ENABLE_RLS });
      
      // Create RLS policies
      await supabase.rpc('execute_sql', { sql: CREATE_RLS_POLICIES });
      
      return NextResponse.json({ 
        success: true, 
        message: 'Database tables and policies created successfully' 
      });
    } catch (error) {
      console.error('Error setting up database:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to set up database tables',
        details: error
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in setup-db API route:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Server error',
      details: error
    }, { status: 500 });
  }
} 