import supabase from './supabase';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  selectedFiles?: string[];
}

// Function to save a chat message to the database
export async function saveChatMessage(
  message: ChatMessage,
  owner?: string,
  repo?: string,
  userEmail?: string
) {
  if (!owner || !repo) {
    console.error('Cannot save chat message: owner or repo is missing');
    return null;
  }

  try {
    console.log(`Saving chat message: ${message.id} for ${owner}/${repo} (user: ${userEmail || 'anonymous'})`);
    
    // Ensure we have a valid message structure
    if (!message.id || !message.role || !message.content) {
      console.error('Invalid message format', message);
      return null;
    }
    
    // Handle retries for supabase connection issues
    let retries = 0;
    const maxRetries = 3;
    
    while (retries < maxRetries) {
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .insert([
            {
              message_id: message.id,
              user_email: userEmail || null,
              owner,
              repo,
              role: message.role,
              content: message.content,
              timestamp: message.timestamp,
              selected_files: message.selectedFiles ? message.selectedFiles : null
            }
          ])
          .select();

        if (error) {
          console.error(`Error saving chat message (attempt ${retries + 1}/${maxRetries}):`, error);
          retries++;
          
          if (retries >= maxRetries) {
            console.error('Max retries reached, failing to save message');
            return null;
          }
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        
        console.log('Chat message saved successfully:', data?.[0]?.message_id);
        return data?.[0] || null;
      } catch (innerError) {
        console.error(`Error in supabase operation (attempt ${retries + 1}/${maxRetries}):`, innerError);
        retries++;
        
        if (retries >= maxRetries) {
          throw innerError;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return null;
  } catch (error) {
    console.error('Failed to save chat message:', error);
    
    // Save to localStorage as backup if database fails
    try {
      if (typeof localStorage !== 'undefined') {
        const key = `chat_${owner}_${repo}_${message.id}`;
        localStorage.setItem(key, JSON.stringify({
          message,
          owner,
          repo,
          userEmail,
          timestamp: new Date().toISOString()
        }));
        console.log('Saved chat message to localStorage as backup');
      }
    } catch (localStorageError) {
      console.error('Failed to save to localStorage:', localStorageError);
    }
    
    return null;
  }
}

// Function to get chat messages for a repository
export async function getChatMessages(owner: string, repo: string, userEmail?: string) {
  try {
    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('owner', owner)
      .eq('repo', repo);

    // If user email is provided, filter by it
    if (userEmail) {
      query = query.eq('user_email', userEmail);
    }

    // Order by timestamp
    query = query.order('timestamp', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('Error retrieving chat messages:', error);
      return [];
    }

    // Map the database records to ChatMessage objects
    return data.map(record => ({
      id: record.message_id,
      role: record.role as 'user' | 'assistant',
      content: record.content,
      timestamp: record.timestamp,
      selectedFiles: record.selected_files
    }));
  } catch (error) {
    console.error('Failed to retrieve chat messages:', error);
    return [];
  }
}

// Function to delete chat messages
export async function deleteChatMessages(messageIds: string[]) {
  try {
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .in('message_id', messageIds);

    if (error) {
      console.error('Error deleting chat messages:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to delete chat messages:', error);
    return false;
  }
}

// Function to clear chat history for a repository
export async function clearChatHistory(owner: string, repo: string, userEmail?: string) {
  try {
    let query = supabase
      .from('chat_messages')
      .delete()
      .eq('owner', owner)
      .eq('repo', repo);

    // If user email is provided, filter by it
    if (userEmail) {
      query = query.eq('user_email', userEmail);
    }

    const { error } = await query;

    if (error) {
      console.error('Error clearing chat history:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to clear chat history:', error);
    return false;
  }
} 