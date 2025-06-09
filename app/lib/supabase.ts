import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

// Log the Supabase configuration values (sanitized)
console.log('Supabase configuration:', { 
  urlSet: !!supabaseUrl,
  urlLength: supabaseUrl?.length || 0,
  anonKeySet: !!supabaseAnonKey,
  anonKeyLength: supabaseAnonKey?.length || 0
});

// Create the Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: {
      'X-Client-Info': 'github-directory-viewer'
    }
  }
});

export default supabase; 