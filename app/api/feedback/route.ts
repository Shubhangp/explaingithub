import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/auth/auth-options';
import supabase from '@/app/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // Get session
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    
    // Get request data
    const body = await request.json();
    const { conversationId, feedback } = body;
    
    // Validate input
    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      );
    }
    
    if (!feedback || !['like', 'dislike'].includes(feedback)) {
      return NextResponse.json(
        { error: 'Invalid feedback value. Must be "like" or "dislike"' },
        { status: 400 }
      );
    }
    
    // Get user ID (email or anonymous)
    let userId = email;
    if (!userId) {
      const anonymousId = request.headers.get('x-anonymous-id');
      if (anonymousId) {
        userId = `anonymous_${anonymousId}@temp.example.com`;
      }
    }
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User identification required' },
        { status: 401 }
      );
    }
    
    console.log('Updating feedback for conversation:', conversationId, 'by user:', userId);
    
    // First verify the conversation belongs to this user
    const { data: existingConversation, error: verifyError } = await supabase
      .from('conversations')
      .select('id, user_id')
      .eq('id', conversationId)
      .single();
    
    if (verifyError || !existingConversation) {
      console.error('Conversation not found:', verifyError);
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }
    
    if (existingConversation.user_id !== userId) {
      console.error('User does not own this conversation');
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
    
    // Update the feedback
    const { error: updateError } = await supabase
      .from('conversations')
      .update({
        feedback: feedback,
        feedback_timestamp: new Date().toISOString()
      })
      .eq('id', conversationId);
    
    if (updateError) {
      console.error('Failed to update feedback:', updateError);
      return NextResponse.json(
        { error: 'Failed to update feedback' },
        { status: 500 }
      );
    }
    
    console.log('Successfully updated feedback for conversation:', conversationId);
    
    return NextResponse.json({
      success: true,
      conversationId,
      feedback
    });
    
  } catch (error) {
    console.error('Error in feedback API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve feedback for a conversation
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    
    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      );
    }
    
    // Get session
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    
    // Get user ID
    let userId = email;
    if (!userId) {
      const anonymousId = request.headers.get('x-anonymous-id');
      if (anonymousId) {
        userId = `anonymous_${anonymousId}@temp.example.com`;
      }
    }
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User identification required' },
        { status: 401 }
      );
    }
    
    // Get the conversation with feedback
    const { data: conversation, error } = await supabase
      .from('conversations')
      .select('id, feedback, feedback_timestamp')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();
    
    if (error || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      conversationId: conversation.id,
      feedback: conversation.feedback,
      feedbackTimestamp: conversation.feedback_timestamp
    });
    
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}