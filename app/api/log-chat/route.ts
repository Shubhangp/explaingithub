import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/auth/auth-options'
import supabase from '@/app/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    console.log('log-chat API called')

    // Extract data from the request
    const body = await request.json()
    const { question, response, conversationId, action = 'create', owner, repo, provider = 'github' } = body
    
    console.log("action:", action, "conversationId:", conversationId);

    // Get session
    const session = await getServerSession(authOptions)
    let email = session?.user?.email || body.email

    // Check if we have an anonymousId in the request
    const anonymousId = body.anonymousId || request.headers.get('x-anonymous-id')

    // If no email but we have anonymousId, create a pseudo-email
    if (!email && anonymousId) {
      email = `anonymous_${anonymousId}@temp.example.com`
    }

    // Log detailed request information for debugging
    console.log('Full request data:', {
      bodyEmail: body.email,
      sessionEmail: session?.user?.email,
      anonymousId,
      question: question ? question.substring(0, 100) + '...' : 'No question',
      response: response ? response.substring(0, 100) + '...' : 'No response',
      repo: body.repo,
      owner: body.owner,
      combinedEmail: email,
      action,
      conversationId
    })

    // Check if we have the required data to save
    if (!email) {
      console.warn('Missing email - cannot save chat to database')
      return NextResponse.json({ success: false, error: 'Missing email' })
    }

    if (!question) {
      console.warn('Missing question - cannot save chat to database')
      return NextResponse.json({ success: false, error: 'Missing question' })
    }

    // Check if we have repo information
    if (!owner || !repo) {
      console.warn('Missing owner or repo - cannot save chat to database')
      return NextResponse.json({ success: false, error: 'Missing repository information' })
    }

    try {
      let result;

      // Handle different actions
      if (action === 'update' && conversationId) {
        // UPDATE EXISTING CONVERSATION BY ID
        console.log('Updating existing conversation with ID:', conversationId);

        // First verify the conversation belongs to this user
        const { data: existingConversation, error: verifyError } = await supabase
          .from('conversations')
          .select('id, user_id, messages')
          .eq('id', conversationId)
          .single();

        if (verifyError || !existingConversation) {
          console.error('Conversation not found or access denied:', verifyError);
          return NextResponse.json({ success: false, error: 'Conversation not found' });
        }

        if (existingConversation.user_id !== email) {
          console.error('User does not own this conversation');
          return NextResponse.json({ success: false, error: 'Access denied' });
        }

        // Get existing messages or initialize empty array
        let messages = existingConversation.messages || [];
        
        // Ensure messages is an array
        if (!Array.isArray(messages)) {
          console.log('Messages is not an array, converting...');
          messages = [];
        }

        // Create new message entries
        const timestamp = Date.now();
        const userMessage = {
          id: `msg_${timestamp}_user`,
          role: 'user',
          content: question,
          timestamp: timestamp
        };

        const assistantMessage = {
          id: `msg_${timestamp}_assistant`,
          role: 'assistant',
          content: response || '',
          timestamp: timestamp + 1
        };

        // Add both messages
        messages.push(userMessage);
        if (response) {
          messages.push(assistantMessage);
        }

        // Update the conversation with new messages
        result = await supabase
          .from('conversations')
          .update({
            title: question.length > 50 ? `${question.substring(0, 47)}...` : question,
            messages: messages,
            updated_at: new Date().toISOString()
          })
          .eq('id', conversationId)
          .select('id');

        if (result.error) {
          console.error('Failed to update conversation:', result.error);
          return NextResponse.json({ success: false, error: 'Failed to update conversation' });
        }

        console.log('Successfully updated conversation:', conversationId);
        return NextResponse.json({
          success: true,
          action: 'updated',
          id: conversationId
        });

      } else {
        // CREATE NEW CONVERSATION (default behavior)
        console.log('Creating new conversation');

        const timestamp = Date.now();
        const messages = [];

        // Add user message
        messages.push({
          id: `msg_${timestamp}_user`,
          role: 'user',
          content: question,
          timestamp: timestamp
        });

        // Add assistant message if response is provided
        if (response) {
          messages.push({
            id: `msg_${timestamp}_assistant`,
            role: 'assistant',
            content: response,
            timestamp: timestamp + 1
          });
        }

        const newConversation = {
          user_id: email,
          provider: provider,
          owner: owner,
          repo: repo,
          title: question.length > 50 ? `${question.substring(0, 47)}...` : question,
          messages: messages,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        result = await supabase
          .from('conversations')
          .insert(newConversation)
          .select('id');

        if (result.error) {
          console.error('Failed to create conversation:', result.error);
          return NextResponse.json({ success: false, error: 'Failed to create conversation' });
        }

        const newConversationId = result.data?.[0]?.id;
        console.log('Successfully created new conversation:', newConversationId);

        return NextResponse.json({
          success: true,
          action: 'created',
          id: newConversationId
        });
      }

    } catch (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json({ success: false, error: 'Database error' });
    }
  } catch (error) {
    console.error('Error in log-chat API:', error)
    return NextResponse.json({ success: false, error: 'Failed to log chat' }, { status: 500 })
  }
}

// Helper function to get conversation history for a repository
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');
    const provider = searchParams.get('provider') || 'github';

    // Get session
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;

    if (!email) {
      return NextResponse.json({ success: false, error: 'Authentication required' });
    }

    if (!owner || !repo) {
      return NextResponse.json({ success: false, error: 'Missing repository information' });
    }

    // Get conversation history for this repository
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select('id, title, messages, created_at, updated_at')
      .eq('user_id', email)
      .eq('provider', provider)
      .eq('owner', owner)
      .eq('repo', repo)
      .order('created_at', { ascending: false })
      .limit(50); // Limit to last 50 conversations

    if (error) {
      console.error('Failed to fetch conversations:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch conversations' });
    }

    return NextResponse.json({
      success: true,
      conversations: conversations || []
    });

  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch conversations' }, { status: 500 });
  }
}