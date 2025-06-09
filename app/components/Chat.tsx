'use client';

import { useState, FormEvent } from 'react';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export default function Chat() {
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  async function logChatQuestion(question: string) {
    try {
      console.log('💬 CHAT COMPONENT: Logging question to Google Sheets:', question.substring(0, 30) + '...');
      
      const response = await fetch('/api/log-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question, call: "chat.tsx" }),
      });
      
      const result = await response.json();
      console.log('💬 CHAT COMPONENT: Log response:', result);
      
      if (!response.ok) {
        console.error('💬 CHAT COMPONENT: Failed to log chat question', result);
      } else {
        console.log('💬 CHAT COMPONENT: Successfully logged question to Google Sheets');
      }
    } catch (error) {
      console.error('💬 CHAT COMPONENT: Error logging chat question:', error);
      // Don't block the chat flow if logging fails
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    
    const userQuestion = inputValue.trim();
    if (!userQuestion) return;
    
    console.log('💬 CHAT COMPONENT: User submitted question');
    
    // Update UI with user's question
    setMessages(prev => [...prev, { role: 'user', content: userQuestion }]);
    setInputValue('');
    setIsLoading(true);
    
    // Log the chat question to Google Sheets
    console.log('💬 CHAT COMPONENT: Calling logChatQuestion function');
    await logChatQuestion(userQuestion);
    
    console.log('💬 CHAT COMPONENT: Continuing with chat processing...');
    // Here you would typically call your AI service
    // For demonstration, we'll just add a mock response
    
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `This is a mock response to your question: "${userQuestion}"` 
      }]);
      setIsLoading(false);
    }, 1000);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div key={index} className={`${message.role === 'user' ? 'bg-blue-100 ml-auto' : 'bg-gray-100'} p-3 rounded-lg max-w-[80%]`}>
            {message.content}
          </div>
        ))}
        {isLoading && (
          <div className="bg-gray-100 p-3 rounded-lg max-w-[80%]">
            <span className="animate-pulse">Thinking...</span>
          </div>
        )}
      </div>
      
      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="flex space-x-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask a question..."
            className="flex-1 p-2 border rounded-md"
          />
          <button 
            type="submit" 
            disabled={!inputValue.trim() || isLoading}
            className="bg-blue-500 text-white px-4 py-2 rounded-md disabled:bg-blue-300"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
} 