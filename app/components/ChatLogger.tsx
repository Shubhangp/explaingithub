'use client'

import { useEffect, useState } from 'react'

// Define a type for the event detail
interface ChatEventDetail {
  type: string;
  message?: string;
}

export default function ChatLogger() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;
    
    // Fix for the event listener and handler
    const handleChatEvent = (event: Event) => {
      // Type guard to check if it's a CustomEvent with our expected structure
      if (event instanceof CustomEvent && event.detail?.type === 'chat-message' && event.detail?.message) {
        const message = event.detail.message;
        console.log('📝 Captured chat message:', message.substring(0, 30) + '...');
        
        // Log the message using the API
        fetch('/api/log-chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ question: message, call: "chatlogger.tsx" }),
        }).catch(err => {
          console.error('Error logging chat:', err);
        });
      }
    };
    
    // Add the event listener
    window.addEventListener('chat-event', handleChatEvent);
    console.log('📝 Chat logger initialized');
    setInitialized(true);
    
    // Cleanup
    return () => {
      window.removeEventListener('chat-event', handleChatEvent);
    };
  }, [initialized]);
  
  return null;
} 