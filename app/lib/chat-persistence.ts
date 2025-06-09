import supabase from './supabase';
import { v4 as uuidv4 } from 'uuid';

// Ensure TypeScript recognizes the uuid module
declare module 'uuid' {
  export function v4(): string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  selectedFiles?: string[];
}

export interface ConversationMetadata {
  id: string;
  owner: string;
  repo: string;
  provider: string;
  lastUpdated: string;
  messageCount: number;
  previewText: string;
}

// Generate a conversation ID using repo details
export function generateConversationId(owner: string, repo: string): string {
  return `${owner}-${repo}-${new Date().toISOString().slice(0, 10)}-${uuidv4().slice(0, 8)}`;
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

// Save a chat message to the persistent storage
export async function savePersistentMessage(
  message: ChatMessage,
  owner: string,
  repo: string,
  provider: string = 'github',
  userEmail?: string,
  conversationId?: string
): Promise<boolean> {
  try {
    console.log('Starting savePersistentMessage with params:', { 
      messageId: message.id,
      owner,
      repo,
      provider,
      hasUserEmail: !!userEmail,
      userEmail: userEmail || 'anonymous'
    });
    
    // Log the Supabase connection details (without sensitive info)
    console.log('Supabase connection check:', { 
      hasSupabase: !!supabase,
      supabaseUrl: supabase.supabaseUrl ? 'set' : 'not set',
      hasAuthHeader: !!supabase['headers']?.Authorization
    });
    
    // Validate required fields
    if (!message.id || !message.role || !message.content || !owner || !repo) {
      console.error('Missing required fields for persistent chat', { message, owner, repo });
      return false;
    }
    
    // Use existing conversation ID or get from localStorage 
    let finalConversationId = conversationId;
    
    if (!finalConversationId && typeof localStorage !== 'undefined') {
      finalConversationId = localStorage.getItem(`chat_conversation_${owner}_${repo}`);
    }
    
    // If no conversation ID exists, create one and store it
    if (!finalConversationId) {
      finalConversationId = generateConversationId(owner, repo);
      console.log('Generated new conversation ID:', finalConversationId);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`chat_conversation_${owner}_${repo}`, finalConversationId);
      }
    } else {
      console.log('Using existing conversation ID:', finalConversationId);
    }
    
    // Get user ID (either email or anonymous ID)
    const userId = getUserId(userEmail);
    console.log('Using user ID for persistence:', userId);
    
    // Prepare Supabase data
    const messageData = {
      user_id: userId,
      owner,
      repo,
      provider,
      message_id: message.id,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
      selected_files: message.selectedFiles || null,
      conversation_id: finalConversationId
    };
    
    console.log('Preparing to insert message into Supabase:', { 
      messageId: message.id,
      role: message.role,
      contentLength: message.content.length,
      timestamp: message.timestamp
    });
    
    // Try to insert into Supabase
    let { data, error } = await supabase.from('persistent_chats').insert(messageData).select();
    
    // Log request details for debugging
    console.log('Supabase request details:', {
      table: 'persistent_chats',
      operation: 'insert',
      userIdLength: userId.length,
      conversationId: finalConversationId
    });
    
    // If table doesn't exist, try to create it
    if (error && error.code === 'PGRST116') {
      console.log('Table does not exist, attempting to create it');
      
      // Attempt to create the table with a direct insert
      await setupPersistentChatsTable();
      
      // Try the insert again
      const result = await supabase.from('persistent_chats').insert(messageData).select();
      data = result.data;
      error = result.error;
    }
    
    if (error) {
      console.error('Error saving persistent chat message:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      
      // Fall back to localStorage on error
      if (typeof localStorage !== 'undefined') {
        const key = `persistent_chat_${owner}_${repo}_${message.id}`;
        localStorage.setItem(key, JSON.stringify({
          ...messageData,
          pending: true // Mark as pending for future sync
        }));
        console.log('Saved to localStorage as fallback with key:', key);
      }
      
      return false;
    }
    
    console.log('Successfully saved persistent chat message:', data?.[0]?.id);
    return true;
  } catch (error) {
    console.error('Failed to save persistent chat message:', error);
    // Add detailed error logging
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    return false;
  }
}

// Function to attempt to create the persistent_chats table if it doesn't exist
async function setupPersistentChatsTable(): Promise<boolean> {
  try {
    // Try a simple insert to create the table
    const { error } = await supabase.from('persistent_chats').insert({
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
    
    // If there's an error other than duplicate primary key, it might
    // indicate the table structure is wrong or another issue
    if (error && error.code !== '23505') {
      console.error('Error setting up persistent_chats table:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Failed to set up persistent_chats table:', error);
    return false;
  }
}

// Get all messages for a specific conversation
export async function getPersistentMessages(
  owner: string,
  repo: string,
  userEmail?: string,
  conversationId?: string
): Promise<ChatMessage[]> {
  try {
    const userId = getUserId(userEmail);
    
    // Get conversation ID from params or localStorage
    let finalConversationId = conversationId;
    if (!finalConversationId && typeof localStorage !== 'undefined') {
      finalConversationId = localStorage.getItem(`chat_conversation_${owner}_${repo}`);
    }
    
    // If no conversation exists yet, return empty array
    if (!finalConversationId) {
      return [];
    }
    
    // Query Supabase
    const { data, error } = await supabase
      .from('persistent_chats')
      .select('*')
      .eq('owner', owner)
      .eq('repo', repo)
      .eq('user_id', userId)
      .eq('conversation_id', finalConversationId)
      .order('timestamp', { ascending: true });
    
    if (error) {
      console.error('Error fetching persistent chat messages:', error);
      
      // Try to load from localStorage as fallback
      if (typeof localStorage !== 'undefined') {
        const localMessages: ChatMessage[] = [];
        
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(`persistent_chat_${owner}_${repo}_`)) {
            try {
              const stored = JSON.parse(localStorage.getItem(key) || '');
              if (stored && stored.conversation_id === finalConversationId) {
                localMessages.push({
                  id: stored.message_id,
                  role: stored.role,
                  content: stored.content,
                  timestamp: stored.timestamp,
                  selectedFiles: stored.selected_files
                });
              }
            } catch (e) {
              console.error('Error parsing localStorage item:', e);
            }
          }
        }
        
        // Sort by timestamp
        return localMessages.sort((a, b) => a.timestamp - b.timestamp);
      }
      
      return [];
    }
    
    // Convert to ChatMessage format and return
    return data.map(item => ({
      id: item.message_id,
      role: item.role,
      content: item.content,
      timestamp: item.timestamp,
      selectedFiles: item.selected_files
    }));
  } catch (error) {
    console.error('Failed to retrieve persistent chat messages:', error);
    return [];
  }
}

// Get all conversations for a user
export async function getUserConversations(userEmail?: string): Promise<ConversationMetadata[]> {
  try {
    const userId = getUserId(userEmail);
    
    // Query for distinct conversations
    const { data, error } = await supabase
      .from('persistent_chats')
      .select('owner, repo, provider, conversation_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching user conversations:', error);
      return [];
    }
    
    // Group by conversation_id to get unique conversations
    const conversationMap = new Map<string, ConversationMetadata>();
    
    for (const item of data) {
      if (!conversationMap.has(item.conversation_id)) {
        // For each unique conversation, get message count and latest message
        const { data: messages, error: messagesError } = await supabase
          .from('persistent_chats')
          .select('content, role')
          .eq('conversation_id', item.conversation_id)
          .eq('user_id', userId)
          .order('timestamp', { ascending: false })
          .limit(1);
        
        if (messagesError) {
          console.error('Error fetching conversation details:', messagesError);
          continue;
        }
        
        // Get message count
        const { count, error: countError } = await supabase
          .from('persistent_chats')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', item.conversation_id)
          .eq('user_id', userId);
        
        if (countError) {
          console.error('Error counting messages:', countError);
          continue;
        }
        
        // Create metadata
        conversationMap.set(item.conversation_id, {
          id: item.conversation_id,
          owner: item.owner,
          repo: item.repo,
          provider: item.provider,
          lastUpdated: item.created_at,
          messageCount: count || 0,
          previewText: messages && messages.length > 0 
            ? (messages[0].role === 'user' ? 'You: ' : 'AI: ') + messages[0].content.substring(0, 100) + (messages[0].content.length > 100 ? '...' : '')
            : 'Empty conversation'
        });
      }
    }
    
    // Convert to array and sort by lastUpdated
    return Array.from(conversationMap.values())
      .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
  } catch (error) {
    console.error('Failed to retrieve user conversations:', error);
    return [];
  }
}

// Clear a specific conversation
export async function clearConversation(
  owner: string,
  repo: string,
  userEmail?: string,
  conversationId?: string
): Promise<boolean> {
  try {
    const userId = getUserId(userEmail);
    
    // Get conversation ID
    let finalConversationId = conversationId;
    if (!finalConversationId && typeof localStorage !== 'undefined') {
      finalConversationId = localStorage.getItem(`chat_conversation_${owner}_${repo}`);
    }
    
    if (!finalConversationId) {
      return false; // No conversation to clear
    }
    
    // Delete from Supabase
    const { error } = await supabase
      .from('persistent_chats')
      .delete()
      .eq('user_id', userId)
      .eq('owner', owner)
      .eq('repo', repo)
      .eq('conversation_id', finalConversationId);
    
    if (error) {
      console.error('Error clearing conversation:', error);
      return false;
    }
    
    // Clear from localStorage
    if (typeof localStorage !== 'undefined') {
      // Remove conversation ID
      localStorage.removeItem(`chat_conversation_${owner}_${repo}`);
      
      // Remove all related messages
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`persistent_chat_${owner}_${repo}_`)) {
          try {
            const stored = JSON.parse(localStorage.getItem(key) || '');
            if (stored && stored.conversation_id === finalConversationId) {
              localStorage.removeItem(key);
            }
          } catch (e) {
            console.error('Error parsing localStorage item:', e);
          }
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('Failed to clear conversation:', error);
    return false;
  }
}

// Sync pending messages from localStorage to Supabase
export async function syncPendingMessages(userEmail?: string): Promise<number> {
  if (typeof localStorage === 'undefined') {
    return 0;
  }
  
  try {
    const userId = getUserId(userEmail);
    let syncCount = 0;
    
    // Find all pending messages in localStorage
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.includes('persistent_chat_') && key.includes('_pending')) {
        try {
          const stored = JSON.parse(localStorage.getItem(key) || '');
          if (stored && stored.pending) {
            // Try to insert into Supabase
            const { error } = await supabase.from('persistent_chats').insert({
              user_id: userId,
              owner: stored.owner,
              repo: stored.repo,
              provider: stored.provider,
              message_id: stored.message_id,
              role: stored.role,
              content: stored.content,
              timestamp: stored.timestamp,
              selected_files: stored.selected_files || null,
              conversation_id: stored.conversation_id
            });
            
            if (!error) {
              // Success - remove from localStorage
              localStorage.removeItem(key);
              syncCount++;
            }
          }
        } catch (e) {
          console.error('Error syncing pending message:', e);
        }
      }
    }
    
    return syncCount;
  } catch (error) {
    console.error('Failed to sync pending messages:', error);
    return 0;
  }
} 