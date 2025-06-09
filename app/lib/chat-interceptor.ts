/**
 * Chat interceptor that hooks into the message submission process
 */

import { getSession } from 'next-auth/react';

// Add a type definition for chat messages at the top of the file
interface ChatMessage {
  role: string;
  content: string;
}

// Global variable to store the original fetch function
let originalFetch: typeof fetch;

// Initialize the interceptor
export function initChatInterceptor() {
  console.log('🔄 INTERCEPTOR: Initializing chat interceptor');
  
  // Save the original fetch function
  originalFetch = window.fetch;
  
  // Override the fetch function to intercept chat API calls
  window.fetch = async function(input, init) {
    // Properly handle different input types
    const url = typeof input === 'string' 
      ? input 
      : input instanceof Request 
        ? input.url 
        : input.href;
    
    // Check if this is a chat completion request
    if (url.includes('/api/chat') || 
        url.includes('/v1/chat/completions') || 
        url.includes('/api/completions')) {
      
      try {
        console.log('🔄 INTERCEPTOR: Detected chat API call');
        
        // Get the request body
        const body = init?.body ? JSON.parse(init.body.toString()) : null;
        
        if (body && body.messages && Array.isArray(body.messages)) {
          // Find the user's message (usually the last one)
          const userMessages = body.messages.filter((m: ChatMessage) => m.role === 'user');
          
          if (userMessages.length > 0) {
            const lastUserMessage = userMessages[userMessages.length - 1];
            console.log('🔄 INTERCEPTOR: Found user message:', lastUserMessage.content.substring(0, 30) + '...');
            
            // Get user session
            const session = await getSession();
            const email = session?.user?.email || 'unknown@example.com';
            
            // Call the API to log the chat
            console.log('🔄 INTERCEPTOR: Calling API to log chat for', email);
            
            // Use a separate fetch (not the intercepted one) to avoid infinite loops
            originalFetch('/api/log-chat', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ 
                question: lastUserMessage.content 
                , call: "chatinter.tsx"
              }),
            }).catch(err => {
              console.error('Error calling log API:', err);
            });
          }
        }
      } catch (error) {
        console.error('🔄 INTERCEPTOR: Error intercepting chat:', error);
        // Don't block the original request
      }
    }
    
    // Continue with the original fetch
    return originalFetch.apply(window, [input, init]);
  };
  
  console.log('🔄 INTERCEPTOR: Chat interceptor initialized');
} 