import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useTheme } from '../context/ThemeContext.js';
import ChatInput from './ChatInput.jsx';
import FileViewer from './FileViewer.js';
import DirectoryTree from './DirectoryTree.js';
import { FiFolder, FiMessageSquare, FiFileText, FiExternalLink } from 'react-icons/fi';

const RepoViewer = () => {
  const { owner, repo, path = '' } = useParams();
  const [repoContent, setRepoContent] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [isLoadingResponse, setIsLoadingResponse] = useState(false);

  useEffect(() => {
    const fetchRepoContent = async () => {
      try {
        setLoading(true);
        const headers = {
          'Accept': 'application/vnd.github.v3+json'
        };

        if (isAuthenticated) {
          const token = localStorage.getItem('github_token');
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
        }

        // Get repository details to find default branch
        const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
        if (!repoResponse.ok) throw new Error('Failed to fetch repo details');
        const repoData = await repoResponse.json();

        // Get full repository tree
        const treeResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/git/trees/${repoData.default_branch}?recursive=1`,
          { headers }
        );
        if (!treeResponse.ok) throw new Error('Failed to fetch repository tree');
        
        const treeData = await treeResponse.json();
        const flatContent = treeData.tree
          .filter(item => item.type === 'blob' || item.type === 'tree')
          .map(item => ({
            name: item.path.split('/').pop(),
            path: item.path,
            type: item.type === 'tree' ? 'dir' : 'file',
            url: `https://github.com/${owner}/${repo}/blob/${repoData.default_branch}/${item.path}`
          }));

        setRepoContent(flatContent);
        
        // Auto-select README
        const readme = flatContent.find(item => 
          item.name.match(/^readme\.md$/i) && item.type === 'file'
        );
        if (readme) handleFileSelect(readme);
        
        setError(null);
      } catch (err) {
        console.error('Error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRepoContent();
  }, [owner, repo, isAuthenticated]);

  const handleFileSelect = async (file) => {
    try {
      // Get the file content using the GitHub contents API
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3.raw',
            'Authorization': `Bearer ${localStorage.getItem('github_token')}`
          }
        }
      );
      
      if (!response.ok) throw new Error('Failed to fetch file content');
      
      const content = await response.text();
      setSelectedFile({
        name: file.name,
        content,
        path: file.path,
        url: file.url
      });
    } catch (err) {
      console.error('Error fetching file:', err);
      setError('Failed to load file content');
    }
  };

  const handleSendMessage = async (message) => {
    try {
      // Add user message to chat immediately
      const userMessage = { 
        id: Date.now(), 
        content: message, 
        isBot: false 
      };
      console.log('Adding user message:', userMessage);
      setMessages(prev => [...prev, userMessage]);

      setIsLoadingResponse(true);
      
      // Log the attempt to send message
      console.log('Sending message to API:', message);
      
      const response = await fetch(
        process.env.REACT_APP_API_URL + '/api/chat', 
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('github_token')}`
          },
          body: JSON.stringify({
            message,
            context: {
              owner,
              repo,
              currentPath: path,
              fileStructure: repoContent,
              readmeContent: selectedFile?.name.match(/readme\.md/i) 
                ? selectedFile.content 
                : null,
              currentFileContent: selectedFile?.content || null
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const data = await response.json();
      
      // Add bot response to chat
      setMessages(prev => [...prev, {
        id: Date.now(),
        content: data.response,
        isBot: true
      }]);
      
    } catch (err) {
      console.error('Error sending message:', err);
      setMessages(prev => [...prev, {
        id: Date.now(),
        content: `Error: ${err.message}. Please try again.`,
        isBot: true
      }]);
    } finally {
      setIsLoadingResponse(false);
    }
  };

  // Add this useEffect to scroll to bottom when messages update
  useEffect(() => {
    const chatContainer = document.querySelector('.chat-messages');
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }, [messages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-blue-500 border-blue-200"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="container mx-auto px-4 py-8">
        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left Column - Directory Tree */}
          <section className={`rounded-xl p-6 shadow-lg ${
            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          } border h-[70vh] flex flex-col`}>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <FiFolder className="text-blue-500" />
              Directory Structure
            </h2>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <DirectoryTree
                content={repoContent}
                onFileSelect={handleFileSelect}
                currentPath={path}
              />
            </div>
          </section>

          {/* Right Column - Chat & File Viewer */}
          <div className="flex flex-col gap-8">
            {/* Chat Section */}
            <section className={`rounded-xl p-6 shadow-lg ${
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            } border flex-1 flex flex-col`}>
              <h2 className="text-xl font-bold mb-4">Chat</h2>
              <div className="flex-1 overflow-y-auto mb-4 space-y-4" style={{ height: '400px' }}>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`p-4 rounded-lg mb-2 ${
                      message.isBot ? 'bg-gray-100 ml-4' : 'bg-blue-500 text-white mr-4'
                    }`}
                    style={{ maxWidth: '80%', marginLeft: message.isBot ? '0' : 'auto' }}
                  >
                    <div className="font-bold mb-1">
                      {message.isBot ? 'Bot' : 'You'}
                    </div>
                    <div>{message.content}</div>
                  </div>
                ))}
                {isLoadingResponse && (
                  <div className="text-gray-500 ml-4">Bot is typing...</div>
                )}
              </div>
              <ChatInput onSendMessage={handleSendMessage} />
            </section>

            {/* File Viewer Section */}
            <section className={`rounded-xl shadow-lg ${
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            } border h-[50vh] flex flex-col`}>
              <div className="p-6 border-b flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <FiFileText className="text-purple-500" />
                  {selectedFile?.name || 'README.md'}
                </h2>
                {selectedFile?.url && (
                  <a
                    href={selectedFile.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm flex items-center gap-1 hover:text-blue-500 transition-colors"
                  >
                    View on GitHub
                    <FiExternalLink />
                  </a>
                )}
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                {selectedFile ? (
                  <FileViewer file={selectedFile} />
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    <p>Select a file to view its contents</p>
                  </div>
                )}
              </div>
            </section>
          </div>

        </div>
      </div>
    </div>
  );
};

export default RepoViewer; 