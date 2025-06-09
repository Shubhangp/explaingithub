import { createClient as supabaseCreateClient } from '@supabase/supabase-js';

// Initialize the Supabase server-side client (prevents caching and is safer for API routes)
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in environment variables');
    throw new Error('Missing Supabase credentials');
  }
  
  return supabaseCreateClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false, // Don't persist session in server environment
      autoRefreshToken: false, // Don't auto-refresh token on server
    },
    global: {
      headers: {
        'X-Client-Info': 'github-directory-viewer-server'
      }
    }
  });
} 