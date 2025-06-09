import React, { useRef, useEffect } from 'react';
import ChatMessage from './ChatMessage.js';
import { useTheme } from '../context/ThemeContext.js';

const ChatContainer = ({ chatHistory }) => {
  const { theme } = useTheme();
  const chatContainerRef = useRef(null);
  
  // Scroll to bottom when chat history changes
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);
  
  return (
    <div 
      ref={chatContainerRef}
      className={`chat-container flex-1 overflow-y-auto p-4 space-y-4 ${
        theme === 'dark' ? 'bg-gray-850' : 'bg-gray-50'
      }`}
    >
      {chatHistory.length === 0 ? (
        <div className={`text-center py-10 ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
        }`}>
          <p className="text-lg font-medium mb-2">No messages yet</p>
          <p className="text-sm">Ask a question about this repository to get started</p>
        </div>
      ) : (
        chatHistory.map(message => (
          <ChatMessage key={message.id} message={message} />
        ))
      )}
    </div>
  );
};

export default ChatContainer; 