import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/auth/auth-options';
import { 
  saveChatMessage, 
  getChatMessages, 
  deleteChatMessages, 
  clearChatHistory 
} from '@/app/lib/chat-utils';

export async function GET(request: NextRequest) {
  try {
    // Get URL parameters
    const url = new URL(request.url);
    const owner = url.searchParams.get('owner');
    const repo = url.searchParams.get('repo');
    
    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Owner and repo parameters are required' },
        { status: 400 }
      );
    }
    
    // Get the user's email if they're authenticated
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;
    
    // Get chat messages from the database
    const messages = await getChatMessages(owner, repo, userEmail);
    
    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Error in GET /api/chat-messages:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;
    
    // Parse the request body
    const body = await request.json();
    const { message, owner, repo } = body;
    
    if (!message || !message.id || !message.role || !message.content || !message.timestamp) {
      return NextResponse.json(
        { error: 'Invalid message format' },
        { status: 400 }
      );
    }
    
    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Owner and repo parameters are required' },
        { status: 400 }
      );
    }
    
    // Save the message to the database
    const savedMessage = await saveChatMessage(message, owner, repo, userEmail);
    
    if (!savedMessage) {
      return NextResponse.json(
        { error: 'Failed to save message' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true, message: savedMessage });
  } catch (error) {
    console.error('Error in POST /api/chat-messages:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const owner = url.searchParams.get('owner');
    const repo = url.searchParams.get('repo');
    const messageId = url.searchParams.get('messageId');
    const clearAll = url.searchParams.get('clearAll') === 'true';
    
    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Owner and repo parameters are required' },
        { status: 400 }
      );
    }
    
    // Get the user's email if they're authenticated
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;
    
    let success = false;
    
    if (clearAll) {
      // Clear all chat messages for the repository
      success = await clearChatHistory(owner, repo, userEmail);
    } else if (messageId) {
      // Delete a specific message
      success = await deleteChatMessages([messageId]);
    } else {
      return NextResponse.json(
        { error: 'Either messageId or clearAll parameter is required' },
        { status: 400 }
      );
    }
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete messages' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/chat-messages:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
} 