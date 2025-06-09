import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// SQL to create persistent_chats table in Supabase:
/*
-- Create a persistent_chats table to store chat messages
create table
  public.persistent_chats (
    id uuid not null default uuid_generate_v4() primary key,
    user_id text not null,
    owner text not null,
    repo text not null,
    provider text not null default 'github',
    message_id text not null,
    role text not null,
    content text not null,
    timestamp bigint not null,
    selected_files text[] null,
    created_at timestamp with time zone not null default now(),
    conversation_id text not null default 'default'
  );

-- Add indexes for better query performance
create index persistent_chats_user_id_idx on public.persistent_chats (user_id);
create index persistent_chats_owner_repo_idx on public.persistent_chats (owner, repo);
create index persistent_chats_conversation_id_idx on public.persistent_chats (conversation_id);

-- Enable RLS (Row Level Security)
alter table public.persistent_chats enable row level security;

-- Create policy to allow users to read only their own chats
create policy "Users can read their own chats"
  on persistent_chats for select
  using (user_id = auth.uid()::TEXT or user_id like 'anonymous_%');

-- Create policy to allow users to insert their own chats
create policy "Users can insert their own chats"
  on persistent_chats for insert
  with check (user_id = auth.uid()::TEXT or user_id like 'anonymous_%');

-- Create policy to allow users to update their own chats
create policy "Users can update their own chats"
  on persistent_chats for update
  using (user_id = auth.uid()::TEXT or user_id like 'anonymous_%');

-- Create policy to allow users to delete their own chats
create policy "Users can delete their own chats"
  on persistent_chats for delete
  using (user_id = auth.uid()::TEXT or user_id like 'anonymous_%');
*/

export default supabase; 