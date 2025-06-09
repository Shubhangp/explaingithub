import supabase from './supabase';
import { v4 as uuidv4 } from 'uuid';

// Define types for the new schema
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  selectedFiles?: string[];
}

export interface Conversation {
  id: string;
  userId: string;
  provider: string;
  owner: string;
  repo: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
}

// Get or create a user ID
export function getUserId(userEmail?: string | null): string {
  if (userEmail) {
    return userEmail;
  }
  
  if (typeof localStorage !== 'undefined') {
    // For anonymous users, get or create ID from localStorage
    let anonymousId = localStorage.getItem('anonymous_user_id');
    if (!anonymousId) {
      anonymousId = `anonymous_${uuidv4()}`;
      localStorage.setItem('anonymous_user_id', anonymousId);
    }
    return anonymousId;
  }
  
  // Fallback for serverside or when localStorage isn't available
  return `anonymous_${uuidv4()}`;
}

// Get or create a conversation
export async function getOrCreateConversation(
  owner: string,
  repo: string,
  provider: string = 'github',
  userEmail?: string | null
): Promise<string> {
  try {
    const userId = getUserId(userEmail);
    console.log('Getting/creating conversation for:', { userId, provider, owner, repo });
    
    // First, check if a conversation exists
    const { data: existingConversations, error: fetchError } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id', userId)
      .eq('provider', provider)
      .eq('owner', owner)
      .eq('repo', repo);
      
    if (fetchError) {
      console.error('Error fetching conversation:', fetchError);
      throw fetchError;
    }
    
    // If conversation exists, return its ID
    if (existingConversations && existingConversations.length > 0) {
      console.log('Found existing conversation:', existingConversations[0].id);
      return existingConversations[0].id;
    }
    
    // Create a new conversation
    const now = new Date().toISOString();
    const title = `${owner}/${repo}`;
    
    const { data: newConversation, error: createError } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        provider,
        owner,
        repo,
        title,
        created_at: now,
        updated_at: now
      })
      .select();
      
    if (createError) {
      console.error('Error creating conversation:', createError);
      throw createError;
    }
    
    if (!newConversation || newConversation.length === 0) {
      throw new Error('Failed to create conversation');
    }
    
    console.log('Created new conversation:', newConversation[0].id);
    return newConversation[0].id;
    
  } catch (error) {
    console.error('Error in getOrCreateConversation:', error);
    // Fallback to a locally generated ID if database operations fail
    const fallbackId = `${provider}_${owner}_${repo}_${uuidv4()}`;
    console.log('Using fallback conversation ID:', fallbackId);
    return fallbackId;
  }
}

/**
 * Stores message content in the conversations table
 * Updates the conversation title with the latest message
 */
export async function updateConversationWithMessage(
  conversationId: string,
  message: ChatMessage,
  isUserMessage: boolean = false
): Promise<boolean> {
  try {
    console.log('Updating conversation with message:', { conversationId, messageId: message.id });
    
    // First, get the current messages array from the conversation
    const { data: currentConversation, error: fetchError } = await supabase
      .from('conversations')
      .select('id, messages')
      .eq('id', conversationId)
      .single();
      
    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching current conversation messages:', fetchError);
      return false;
    }
    
    console.log('Current conversation data:', {
      id: currentConversation?.id || 'not found',
      hasMessages: !!currentConversation?.messages,
      messagesType: typeof currentConversation?.messages,
      isArray: Array.isArray(currentConversation?.messages)
    });
    
    // Initialize messages array with existing messages or empty array
    let currentMessages = [];
    
    // Handle different possible formats of the messages field
    if (currentConversation?.messages) {
      if (Array.isArray(currentConversation.messages)) {
        currentMessages = [...currentConversation.messages];
        console.log(`Found ${currentMessages.length} existing messages in array format`);
      } else if (typeof currentConversation.messages === 'object') {
        // If it's a JSON object but not an array, try to handle it
        console.log('Messages is an object but not an array, trying to convert');
        try {
          // If it has keys that look like indices, try to convert to array
          if (Object.keys(currentConversation.messages).some(key => !isNaN(Number(key)))) {
            currentMessages = Object.values(currentConversation.messages);
            console.log(`Converted object to array with ${currentMessages.length} messages`);
          }
        } catch (conversionError) {
          console.error('Error converting messages object to array:', conversionError);
          currentMessages = [];
        }
      } else if (typeof currentConversation.messages === 'string') {
        // If it's a string, try to parse it as JSON
        console.log('Messages is a string, trying to parse as JSON');
        try {
          const parsed = JSON.parse(currentConversation.messages);
          currentMessages = Array.isArray(parsed) ? parsed : [];
          console.log(`Parsed string to array with ${currentMessages.length} messages`);
        } catch (parseError) {
          console.error('Error parsing messages string as JSON:', parseError);
          currentMessages = [];
        }
      }
    } else {
      console.log('No existing messages found, starting with empty array');
    }
    
    // Add the new message to the array
    const newMessage = {
      id: message.id,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
      selectedFiles: message.selectedFiles || []
    };
    
    currentMessages.push(newMessage);
    console.log(`Added new message, now have ${currentMessages.length} messages`);
    
    // For user messages, we'll update the title to show the latest query
    let updateResult;
    if (isUserMessage) {
      console.log('Updating conversation with user message');
      updateResult = await supabase
        .from('conversations')
        .update({
          title: message.content.length > 50 ? `${message.content.substring(0, 47)}...` : message.content,
          updated_at: new Date().toISOString(),
          // Store the complete messages array
          messages: currentMessages
        })
        .eq('id', conversationId);
    } else {
      // For assistant messages, just append the message without changing the title
      console.log('Updating conversation with assistant message');
      updateResult = await supabase
        .from('conversations')
        .update({
          updated_at: new Date().toISOString(),
          // Store the complete messages array
          messages: currentMessages
        })
        .eq('id', conversationId);
    }
    
    if (updateResult.error) {
      console.error('Error updating conversation with message:', updateResult.error);
      console.error('Error details:', {
        code: updateResult.error.code,
        message: updateResult.error.message,
        details: updateResult.error.details
      });
      return false;
    }
    
    console.log('Successfully updated conversation with message');
    
    // Verify the update by fetching the conversation again
    const { data: verifyConversation, error: verifyError } = await supabase
      .from('conversations')
      .select('id, messages')
      .eq('id', conversationId)
      .single();
    
    if (verifyError) {
      console.error('Error verifying conversation update:', verifyError);
    } else {
      console.log('Verified conversation update:', {
        id: verifyConversation.id,
        messagesCount: Array.isArray(verifyConversation.messages) ? verifyConversation.messages.length : 'unknown',
        lastMessageId: Array.isArray(verifyConversation.messages) && verifyConversation.messages.length > 0 ? 
          verifyConversation.messages[verifyConversation.messages.length - 1].id : 'none'
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error updating conversation with message:', error);
    console.error('Error details:', error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : 'Unknown error type');
    return false;
  }
}

// Modify the saveMessage function to use the new approach
export async function saveMessage(
  message: ChatMessage,
  owner: string,
  repo: string,
  provider: string = 'github',
  userEmail?: string | null
): Promise<boolean> {
  try {
    console.log('Saving message:', { messageId: message.id, owner, repo, provider });
    
    // Get conversation ID
    const conversationId = await getOrCreateConversation(owner, repo, provider, userEmail);
    
    // Update the conversation with the message
    const isUserMessage = message.role === 'user';
    const result = await updateConversationWithMessage(conversationId, message, isUserMessage);
    
    if (result) {
      console.log('Message saved successfully to conversation');
      return true;
    } else {
      console.error('Failed to save message to conversation');
      return false;
    }
  } catch (error) {
    console.error('Error in saveMessage:', error);
    
    // Save to localStorage as backup
    if (typeof localStorage !== 'undefined') {
      try {
        const key = `chat_backup_${owner}_${repo}_${message.id}`;
        localStorage.setItem(key, JSON.stringify({
          message,
          owner,
          repo,
          provider,
          timestamp: Date.now()
        }));
        console.log('Saved message to localStorage backup');
      } catch (localStorageError) {
        console.error('Error saving to localStorage:', localStorageError);
      }
    }
    
    return false;
  }
}

// Modify the getMessages function to retrieve messages from the conversations table
export async function getMessages(
  owner: string,
  repo: string,
  provider: string = 'github',
  userEmail?: string | null
): Promise<ChatMessage[]> {
  try {
    console.log('Getting messages for:', { owner, repo, provider });
    
    const userId = getUserId(userEmail);
    console.log('User ID for message retrieval:', userId);
    
    // Get the conversation with its messages
    console.log('Querying Supabase for conversations with params:', {
      user_id: userId,
      provider,
      owner,
      repo
    });
    
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id, messages')
      .eq('user_id', userId)
      .eq('provider', provider)
      .eq('owner', owner)
      .eq('repo', repo);
      
    if (convError) {
      console.error('Error fetching conversation:', convError);
      return [];
    }
    
    console.log('Conversations query result:', {
      found: !!conversations && conversations.length > 0,
      count: conversations?.length || 0,
      conversationIds: conversations?.map(c => c.id) || []
    });
    
    if (!conversations || conversations.length === 0) {
      console.log('No conversation found');
      return [];
    }
    
    const conversation = conversations[0];
    console.log('Retrieved conversation:', {
      id: conversation.id,
      hasMessages: !!conversation.messages,
      messagesType: typeof conversation.messages,
      isArray: Array.isArray(conversation.messages),
      messagesLength: Array.isArray(conversation.messages) ? conversation.messages.length : (conversation.messages ? Object.keys(conversation.messages).length : 0)
    });
    
    const messages = conversation.messages || [];
    
    if (!messages.length) {
      console.log('No messages found in conversation');
      return [];
    }
    
    // Convert to ChatMessage format
    const chatMessages: ChatMessage[] = messages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      selectedFiles: msg.selectedFiles
    }));
    
    console.log(`Found ${chatMessages.length} messages in conversation`);
    console.log('First message sample:', chatMessages.length > 0 ? {
      id: chatMessages[0].id,
      role: chatMessages[0].role,
      contentPreview: chatMessages[0].content.substring(0, 50) + '...',
      timestamp: chatMessages[0].timestamp
    } : 'No messages');
    
    return chatMessages;
  } catch (error) {
    console.error('Error getting messages:', error);
    console.error('Error details:', error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : 'Unknown error type');
    return [];
  }
}

// Modify clearConversationV2 to clear messages from the conversations table
export async function clearConversationV2(
  owner: string,
  repo: string,
  provider: string = 'github',
  userEmail?: string | null
): Promise<boolean> {
  try {
    console.log('Clearing conversation for:', { owner, repo, provider });
    
    const userId = getUserId(userEmail);
    
    // Find the conversation
    const { data: conversations, error: fetchError } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id', userId)
      .eq('provider', provider)
      .eq('owner', owner)
      .eq('repo', repo);
      
    if (fetchError) {
      console.error('Error fetching conversation to clear:', fetchError);
      return false;
    }
    
    if (!conversations || conversations.length === 0) {
      console.log('No conversation found to clear');
      return true; // Already cleared
    }
    
    // Reset the messages to empty array
    const { error: updateError } = await supabase
      .from('conversations')
      .update({ 
        messages: '[]', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', conversations[0].id);
      
    if (updateError) {
      console.error('Error clearing messages from conversation:', updateError);
      return false;
    }
    
    console.log('Conversation messages cleared successfully');
    return true;
  } catch (error) {
    console.error('Error in clearConversationV2:', error);
    return false;
  }
}

// Get all conversations for a user
export async function getUserConversationsV2(
  userEmail?: string | null
): Promise<{ id: string; provider: string; owner: string; repo: string; updatedAt: string }[]> {
  try {
    const userId = getUserId(userEmail);
    
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select('id, provider, owner, repo, title, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
      
    if (error) {
      console.error('Error fetching user conversations:', error);
      return [];
    }
    
    return (conversations || []).map(conv => ({
      id: conv.id,
      provider: conv.provider,
      owner: conv.owner,
      repo: conv.repo,
      title: conv.title || `${conv.owner}/${conv.repo}`,
      updatedAt: conv.updated_at
    }));
    
  } catch (error) {
    console.error('Error in getUserConversations:', error);
    return [];
  }
}

// Update migrateMessages to store messages in the conversations table
export async function migrateMessages(
  owner: string,
  repo: string,
  provider: string = 'github',
  userEmail?: string | null
): Promise<{ migrated: number; failed: number }> {
  try {
    console.log('Migrating messages for:', { owner, repo, provider });
    
    // Get conversation ID or create one
    const conversationId = await getOrCreateConversation(owner, repo, provider, userEmail);
    
    // Don't migrate if we're already using the new schema
    // Check if we already have messages in the new format
    const { data: conversation, error: checkError } = await supabase
      .from('conversations')
      .select('messages')
      .eq('id', conversationId)
      .single();
      
    if (checkError) {
      console.error('Error checking existing messages:', checkError);
      return { migrated: 0, failed: 0 };
    }
    
    if (conversation.messages && conversation.messages.length > 0) {
      console.log('Messages already exist in conversation, skipping migration');
      return { migrated: 0, failed: 0 };
    }
    
    // We don't have any messages to migrate from the old tables
    // Just return success - messages will be saved in the new format going forward
    console.log('No old messages found, conversation is ready for new message storage');
    return { migrated: 0, failed: 0 };
  } catch (error) {
    console.error('Error in migrateMessages:', error);
    return { migrated: 0, failed: 1 };
  }
} 