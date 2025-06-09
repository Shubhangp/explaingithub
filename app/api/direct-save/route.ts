import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/auth/auth-options';

export async function POST(request: NextRequest) {
  try {
    // Get user from session
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    
    // Get message data from request
    const data = await request.json();
    const { message, owner, repo, provider, anonymousId, conversationId } = data;
    
    // Validate required fields
    if (!message || !message.id || !message.role || !message.content || !owner || !repo) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }
    
    // Get user ID (either email or anonymousId)
    const userId = email || (anonymousId ? `anonymous_${anonymousId}` : 'system');
    
    // Connect to Supabase with admin rights to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials');
      return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500 });
    }
    
    // Create a service role client that can bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Insert the message
    const { error } = await supabase.from('persistent_chats').insert({
      user_id: userId,
      owner,
      repo, 
      provider: provider || 'github',
      message_id: message.id,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
      selected_files: message.selectedFiles || null,
      conversation_id: conversationId || `${owner}-${repo}-default`
    });
    
    // Handle errors
    if (error) {
      console.error('Error saving message:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to save message',
        details: error
      }, { status: 500 });
    }
    
    // Return success
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in direct-save API:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Server error',
      details: error
    }, { status: 500 });
  }
} 