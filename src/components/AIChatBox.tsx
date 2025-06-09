'use client'

import { useState, useEffect } from 'react'

console.log('\n\n\n========== AICHATBOX COMPONENT LOADED ==========\n\n\n');

export default function AIChatBox({ owner, repo }: { owner: string, repo: string }) {
  console.log('\n\n\n========== AICHATBOX COMPONENT RENDERED ==========\n\n\n', { owner, repo });
  
  const [input, setInput] = useState('')
  const [response, setResponse] = useState('')
  const [status, setStatus] = useState('idle') // idle, loading, success, error
  const [log, setLog] = useState<string[]>([])
  
  // Log function that shows in both console and UI
  const addLog = (message: string) => {
    console.log('\n\n\n========== UI LOG ==========\n\n\n', message);
    setLog(prev => [...prev, `${new Date().toISOString()}: ${message}`]);
  };
  
  // Clear logs when component mounts
  useEffect(() => {
    addLog('Component mounted');
    
    // Check if fetch is available
    if (typeof fetch !== 'undefined') {
      addLog('Fetch API is available');
    } else {
      addLog('ERROR: Fetch API is NOT available');
    }
    
    return () => {
      addLog('Component unmounting');
    };
  }, []);
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim()) {
      addLog('Empty input - ignoring submission');
      return;
    }
    
    try {
      addLog(`Submitting form with input: "${input}"`);
      setStatus('loading');
      
      // Try a very simple fetch with minimal configuration
      addLog('Sending fetch request to /api/chat');
      
      // Log the request details
      const requestDetails = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: input, owner, repo })
      };
      addLog(`Request details: ${JSON.stringify(requestDetails)}`);
      
      // Make the API request
      const response = await fetch('/api/chat', requestDetails);
      
      addLog(`Response received with status: ${response.status}`);
      
      // Handle the response
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Error reading response');
        addLog(`Error response (${response.status}): ${errorText}`);
        setStatus('error');
        setResponse(`Error ${response.status}: ${errorText}`);
        return;
      }
      
      // Read the response as text (not using streaming)
      const text = await response.text();
      addLog(`Response text (${text.length} chars): "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
      
      // Update state with response
      setResponse(text);
      setStatus('success');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Error in handleSubmit: ${errorMessage}`);
      setStatus('error');
      setResponse(`Error: ${errorMessage}`);
    }
  };

  return (
    <div className="border rounded-lg p-4 h-[600px] flex flex-col">
      <h2 className="text-xl font-semibold mb-4">Simple AI Chat Test</h2>
      
      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {/* Input display */}
        {input && (
          <div className="p-3 rounded bg-blue-500 text-white ml-4">
            {input}
          </div>
        )}
        
        {/* Response display */}
        {response && (
          <div className="p-3 rounded bg-gray-100 dark:bg-gray-800 mr-4">
            {response}
          </div>
        )}
        
        {/* Status indicator */}
        {status === 'loading' && (
          <div className="text-center p-3">
            <span className="inline-block animate-spin mr-2">⟳</span>
            Loading...
          </div>
        )}
        
        {/* Log display */}
        <div className="mt-4 border-t pt-2">
          <h3 className="font-bold">Debug Log:</h3>
          <pre className="text-xs p-2 bg-gray-100 dark:bg-gray-900 rounded overflow-x-auto max-h-40">
            {log.join('\n')}
          </pre>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a test message..."
          className="flex-1 px-3 py-2 border rounded-lg"
          disabled={status === 'loading'}
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          disabled={status === 'loading' || !input.trim()}
        >
          {status === 'loading' ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  )
} 