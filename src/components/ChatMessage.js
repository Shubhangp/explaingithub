import React from 'react';
import { FaUser, FaRobot, FaFile } from 'react-icons/fa';
import { useTheme } from '../context/ThemeContext.js';

const ChatMessage = ({ message }) => {
  const { theme } = useTheme();
  const isUser = message.role === 'user';
  
  // Format timestamp
  const formattedTime = message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  }) : '';
  
  return (
    <div className={`chat-message p-4 ${
      isUser 
        ? theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100' 
        : theme === 'dark' ? 'bg-gray-750' : 'bg-white'
    } ${message.isError ? 'border-l-4 border-red-500' : ''}`}>
      <div className="flex items-start">
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
          isUser 
            ? theme === 'dark' ? 'bg-blue-600' : 'bg-blue-500' 
            : theme === 'dark' ? 'bg-green-600' : 'bg-green-500'
        }`}>
          {isUser ? <FaUser className="text-white" /> : <FaRobot className="text-white" />}
        </div>
        
        <div className="flex-1 overflow-hidden">
          <div className="flex justify-between items-center mb-1">
            <div className="font-medium">
              {isUser ? 'You' : 'AI Assistant'}
            </div>
            {formattedTime && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {formattedTime}
              </div>
            )}
          </div>
          
          {/* Display referenced files if any */}
          {isUser && message.referencedFiles && message.referencedFiles.length > 0 && (
            <div className={`mb-2 p-2 rounded-md text-sm ${
              theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
            }`}>
              <div className="font-medium mb-1 text-xs text-gray-500 dark:text-gray-400">
                Files referenced:
              </div>
              <div className="flex flex-wrap gap-2">
                {message.referencedFiles.map((file, index) => (
                  <div 
                    key={index}
                    className={`flex items-center px-2 py-1 rounded ${
                      theme === 'dark' 
                        ? 'bg-gray-600 text-blue-300' 
                        : 'bg-gray-300 text-blue-700'
                    }`}
                  >
                    <FaFile className="mr-1 text-xs" />
                    <span className="text-xs truncate max-w-[200px]">{file}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="whitespace-pre-wrap">
            {message.content}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage; 