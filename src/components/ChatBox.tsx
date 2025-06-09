'use client'

import { useState, useEffect, useRef } from 'react'
import { FaPaperPlane, FaRobot, FaTimes, FaPlus, FaGithub, FaUser } from 'react-icons/fa'
import { Octokit } from '@octokit/rest'
import { useSession, signIn } from 'next-auth/react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism'
// Import the style type
import type { SyntaxHighlighterProps } from 'react-syntax-highlighter'

interface FileItem {
  path: string
  type: string
}

interface Message {
  id: string
  content: string
  isUser: boolean
  taggedFiles?: string[]
}

interface ChatBoxProps {
  owner: string
  repo: string
  selectedFile: string | null
}

interface RepoContext {
  structure: string
  readme: string
  taggedFiles: Record<string, string>
}

export default function ChatBox({ owner, repo, selectedFile }: ChatBoxProps) {
  const { data: session, status } = useSession()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showFileSelector, setShowFileSelector] = useState(false)
  const [cursorPosition, setCursorPosition] = useState(0)
  const [files, setFiles] = useState<FileItem[]>([])
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [repoContext, setRepoContext] = useState<RepoContext>({
    structure: '',
    readme: '',
    taggedFiles: {}
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredFiles, setFilteredFiles] = useState<FileItem[]>([])
  const [currentQuery, setCurrentQuery] = useState('')
  const [isSelectingFiles, setIsSelectingFiles] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const inputRef = useRef<HTMLInputElement>(null)

  // Check if user is authenticated
  const isAuthenticated = status === 'authenticated'

  // Add a cache to store API responses and avoid redundant calls
  const [responseCache, setResponseCache] = useState<Record<string, any>>({})

  // Define sample questions that users can click on
  const sampleQuestions = [
    `What is the purpose of the ${repo} repository?`,
    `Explain the main components of this project`,
    `How do I get started with this codebase?`,
    `What are the key features of ${repo}?`,
    `Summarize the project architecture`,
    `What are the dependencies of this project?`
  ]

  useEffect(() => {
    fetchRepoContext()
    fetchFiles()
  }, [owner, repo])

  // Update filtered files when search query changes
  useEffect(() => {
    if (!showFileSelector) {
      setFilteredFiles(files)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = files.filter(file => 
      file.path.toLowerCase().includes(query)
    )
    setFilteredFiles(filtered)
  }, [searchQuery, files, showFileSelector])

  const fetchFiles = async () => {
    try {
      // Check cache first to avoid unnecessary API calls
      const cacheKey = `${owner}/${repo}/files`;
      if (responseCache[cacheKey]) {
        console.log('Using cached files for', cacheKey);
        setFiles(responseCache[cacheKey]);
        setFilteredFiles(responseCache[cacheKey]);
        return;
      }
      
      setFiles([])
      
      // Initialize Octokit with or without authentication token
      // Public repos can be accessed without authentication
      const octokit = new Octokit({
        auth: session?.accessToken || undefined,
      });
      
      // Use a more efficient approach - get all files at once using the tree API
      try {
        const { data: repoData } = await octokit.repos.get({
          owner,
          repo,
        });
        
        const { data: treeData } = await octokit.git.getTree({
          owner,
          repo,
          tree_sha: repoData.default_branch || 'main',
          recursive: '1'
        });
        
        const filesList = treeData.tree
          .filter(item => item.type === 'blob') // Only include files, not directories
          .map(item => ({
            path: item.path || '',
            type: 'file'
          }));
        
        // Cache the fetched data
        setResponseCache(prev => ({
          ...prev,
          [cacheKey]: filesList
        }));
        
        setFiles(filesList);
        setFilteredFiles(filesList);
      } catch (error) {
        console.error('Error fetching tree:', error);
        // Fallback to recursive directory fetching
        const fetchDir = async (path = '') => {
          try {
            const { data } = await octokit.repos.getContent({
              owner,
              repo,
              path
            });
            
            // Process all items in this directory
            const items = Array.isArray(data) ? data : [data];
            
            for (const item of items) {
              if (item.type === 'file') {
                setFiles(prev => [...prev, { path: item.path, type: 'file' }]);
                setFilteredFiles(prev => [...prev, { path: item.path, type: 'file' }]);
              } else if (item.type === 'dir') {
                await fetchDir(item.path);
              }
            }
          } catch (err) {
            console.error(`Error fetching directory ${path}:`, err);
          }
        };
        
        await fetchDir();
        
        // Cache whatever we managed to fetch
        const currentFiles = [...files];
        setResponseCache(prev => ({
          ...prev,
          [cacheKey]: currentFiles
        }));
      }
    } catch (error) {
      console.error('Error fetching files:', error);
    }
  };

  const fetchFileContent = async (path: string) => {
    try {
      // Initialize Octokit with or without authentication token
      // Public repos can be accessed without authentication
      const octokit = new Octokit({
        auth: session?.accessToken || undefined,
      })

      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path,
      })

      if ('content' in data) {
        return atob(data.content)
      }
      return null
    } catch (error) {
      console.error(`Error fetching file ${path}:`, error)
      return null
    }
  }

  const fetchRepoContext = async () => {
    try {
      // Check cache first
      const cacheKey = `${owner}/${repo}/context`;
      if (responseCache[cacheKey]) {
        console.log('Using cached repo context for', cacheKey);
        setRepoContext(responseCache[cacheKey]);
        return responseCache[cacheKey];
      }
      
      // Initialize Octokit with or without authentication token
      // Public repos can be accessed without authentication
      const octokit = new Octokit({
        auth: session?.accessToken || undefined,
      });
      
      // Fetch repository structure
      const { data: contents } = await octokit.repos.getContent({
        owner,
        repo,
        path: '',
      });
      
      const structure = Array.isArray(contents)
        ? contents.map(item => `${item.type === 'dir' ? '📁' : '📄'} ${item.path}`).join('\n')
        : 'Unable to fetch repository structure';
      
      // Fetch README
      let readme = 'No README.md found';
      try {
        const { data: readmeData } = await octokit.repos.getContent({
          owner,
          repo,
          path: 'README.md',
        });
        
        if ('content' in readmeData) {
          readme = atob(readmeData.content);
        }
      } catch (err) {
        console.warn('README not found:', err);
      }
      
      const newContext = {
        structure,
        readme,
        taggedFiles: {}
      };
      
      // Cache the context
      setResponseCache(prev => ({
        ...prev,
        [cacheKey]: newContext
      }));
      
      setRepoContext(newContext);
      return newContext;
    } catch (error) {
      console.error('Error fetching repository context:', error);
      return { structure: '', readme: '', taggedFiles: {} };
    }
  };

  const extractTaggedFiles = async (message: string) => {
    const tagPattern = /@([^\s]+)/g
    const matches = Array.from(message.matchAll(tagPattern))
    const taggedFiles: Record<string, string> = {}

    for (const match of matches) {
      const path = match[1]
      const content = await fetchFileContent(path)
      if (content) {
        taggedFiles[path] = content
      }
    }

    return taggedFiles
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!input.trim() || isLoading) return 

    const userMessage = {
      id: Date.now().toString(),
      content: input,
      isUser: true,
      taggedFiles: Array.from(selectedFiles)
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Fetch contents of all selected files
      const taggedFiles: Record<string, string> = {}
      for (const path of Array.from(selectedFiles)) {
        const content = await fetchFileContent(path)
        if (content) {
          taggedFiles[path] = content
        }
      }
      
      // Create an empty AI message to start with
      const aiMessageId = (Date.now() + 1).toString()
      const initialAiMessage = {
        id: aiMessageId,
        content: '',
        isUser: false
      }
      setMessages(prev => [...prev, initialAiMessage])

      // Process the streaming response using proper SSE handling
      try {
        // Variable to accumulate streaming content
        let fullContent = '';
        
        // Create an EventSource for Server-Sent Events
        const eventSource = new EventSource('/api/chat');
        
        // Make the API request to start the streaming process
        fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: input,
            repoStructure: repoContext.structure,
            readmeContent: repoContext.readme,
            taggedFiles
          }),
        });
        
        // Add event listener for SSE messages
        eventSource.onmessage = (event) => {
          try {
            // Check if stream is done
            if (event.data === '[DONE]') {
              eventSource.close();
              return;
            }
            
            // Parse the event data
            const data = JSON.parse(event.data);
            const content = data.content || '';
            
            // Add to accumulated content
            fullContent += content;
            
            // Update the message with the latest content
            setMessages(prev => {
              // Create a fresh copy of the messages array
              const currentMessages = [...prev];
              
              // Find the message to update
              const messageIndex = currentMessages.findIndex(msg => msg.id === aiMessageId);
              if (messageIndex === -1) return prev;
              
              // Update that specific message with the new content
              currentMessages[messageIndex] = {
                ...currentMessages[messageIndex],
                content: fullContent
              };
              
              return currentMessages;
            });
          } catch (error) {
            console.error('Error parsing SSE message:', error);
          }
        };
        
        // Handle errors in the SSE connection
        eventSource.onerror = (error) => {
          console.error('SSE error:', error);
          eventSource.close();
          setIsLoading(false);
        };
        
      } catch (error) {
        console.error('Error processing chat:', error);
        // Add error message
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          content: 'Sorry, there was an error processing your request. Please try again.',
          isUser: false
        }]);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error processing chat:', error)
      // Add error message
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, there was an error processing your request. Please try again.',
        isUser: false
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  const toggleFileSelector = () => {
    setShowFileSelector(!showFileSelector)
    setFilteredFiles(files)
  }

  const handleFileSelect = (path: string) => {
    const newSelectedFiles = new Set(selectedFiles)
    newSelectedFiles.add(path)
    setSelectedFiles(newSelectedFiles)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value.toLowerCase()
    setSearchQuery(query)
    
    const filtered = files.filter(file => 
      file.path.toLowerCase().includes(query) &&
      !selectedFiles.has(file.path)
    )
    setFilteredFiles(filtered)
  }

  const finishFileSelection = () => {
    setShowFileSelector(false)
    setSearchQuery('')
  }

  const removeFile = (path: string) => {
    const newSelectedFiles = new Set(selectedFiles)
    newSelectedFiles.delete(path)
    setSelectedFiles(newSelectedFiles)
  }

  const handleSampleQuery = (query: string) => {
    if (!isAuthenticated) {
      return; // Don't do anything if not authenticated
    }
    
    // Set the input and then submit
    setInput(query);
    
    // Create the message
    const newMessage: Message = {
      id: Date.now().toString(),
      content: query,
      isUser: true,
      taggedFiles: Array.from(selectedFiles)
    }
    
    // Add message to the list
    setMessages(prev => [...prev, newMessage]);
    
    // Clear input and show loading
    setInput('');
    setIsLoading(true);
    
    // Process the query
    const processQuery = async () => {
      try {
        const context = await fetchRepoContext();
        const taggedFilesObj = await extractTaggedFiles(query);
        
        // Convert taggedFiles object to array for use in template
        const taggedFilesArray = Object.entries(taggedFilesObj).map(([path, content]) => ({
          path,
          content
        }));
        
        // Combine all context information
        const fullContext = `
Repository: ${owner}/${repo}
Current file: ${selectedFile || 'None selected'}

Repository Structure:
${context.structure}

README:
${context.readme}

${taggedFilesArray.length > 0 ? '--- Tagged Files ---\n' + 
  taggedFilesArray.map(file => `File ${file.path}:\n${file.content}`).join('\n\n') : ''}
`;

        // Generate response using a large language model
        // This is a simplification, you'd typically call an API
        const assistantMessage: Message = {
          id: Date.now().toString(),
          content: `I'll help you with that query about ${repo}.

Based on the repository information, here's what I found:

${query.includes('purpose') ? 
  `This repository appears to be ${repo}, which likely serves as a code repository for a software project.` : 
  query.includes('components') ? 
  `The main components include various files and directories that form the codebase structure.` :
  query.includes('started') ?
  `To get started, you would typically clone the repository and follow setup instructions in the README.` :
  query.includes('features') ?
  `The key features would be described in the repository documentation or can be inferred from the codebase structure.` :
  query.includes('architecture') ?
  `The project architecture consists of the files and modules organized in the repository structure.` :
  `The dependencies would typically be listed in a package configuration file or equivalent.`}

For more details, I'd recommend exploring the specific files in the repository.`,
          isUser: false,
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        setIsLoading(false);
        
        // Scroll to the end
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      } catch (error) {
        console.error('Error processing query:', error);
        setIsLoading(false);
        
        // Add error message
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          content: 'Sorry, there was an error processing your request.',
          isUser: false,
        }]);
      }
    };
    
    processQuery();
  }

  // Early return if not authenticated
  if (status === 'unauthenticated') {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/40 dark:to-blue-800/40 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
              <FaRobot className="text-white text-lg" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">{repo} Explorer</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">{owner}/{repo}</p>
            </div>
          </div>
          
          {!isAuthenticated && (
            <button
              onClick={() => signIn('github')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
            >
              <FaGithub className="text-sm" />
              Sign in
            </button>
          )}
        </div>
        
        {/* Messages Container */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-800/30 dark:to-blue-700/30 flex items-center justify-center mb-4">
              <FaRobot className="text-4xl text-blue-500 mb-4" />
            </div>
            <h3 className="text-lg font-medium mb-2">Repository Chat Assistant</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-md">
              Ask questions about the <span className="font-semibold">{owner}/{repo}</span> repository. 
              I can help you understand code, find files, and navigate the project.
            </p>

            {!isAuthenticated && (
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 p-6 mb-6 text-left w-full max-w-lg rounded-lg">
                <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-4 flex items-center gap-1.5 text-base">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  Login Required for Chat
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-400 mb-5 leading-relaxed">
                  You need to be logged in to use the chat feature. Directory browsing remains available without login.
                </p>
                <button
                  onClick={() => signIn('github')}
                  className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md text-sm transition-colors w-full"
                >
                  <FaGithub className="text-lg" />
                  Sign in with GitHub
                </button>
              </div>
            )}

            <div className="w-full max-w-lg">
              <h4 className="font-medium text-gray-600 dark:text-gray-300 mb-4 text-center text-sm">
                Suggested Questions
              </h4>
              <div className="flex flex-col gap-2.5">
                {sampleQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => handleSampleQuery(question)}
                    style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      backgroundColor: 'white',
                      color: '#333',
                      border: '1px solid #e1e4e8',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      marginBottom: '0',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      overflow: 'hidden'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#f6f8fa';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = 'white';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#EBF5FF',
                      color: '#3B82F6',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      marginRight: '12px',
                      flexShrink: 0
                    }}>
                      {index + 1}
                    </div>
                    <span>{question}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Input Form */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900 relative">
          <form onSubmit={handleSubmit} className="flex">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={handleInputChange}
              placeholder={isAuthenticated ? "Ask about this repository..." : "Please sign in to chat..."}
              className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 border-0 rounded-l-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
              disabled={isLoading || !isAuthenticated}
            />
            <button
              type="button"
              onClick={toggleFileSelector}
              className="px-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed border-0"
              disabled={isLoading || !isAuthenticated}
            >
              <FaPlus size={16} />
            </button>
            <button
              type="submit"
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-r-lg disabled:opacity-50 disabled:cursor-not-allowed border-0"
              disabled={isLoading || !input.trim() || !isAuthenticated}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <FaPaperPlane size={16} />
              )}
            </button>
          </form>
          
          {!isAuthenticated && (
            <div className="text-center mt-2 absolute -bottom-7 left-0 w-full">
              <button
                type="button"
                onClick={() => signIn('github')}
                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Login to use chat
              </button>
            </div>
          )}

          {/* Selected Files Display */}
          {selectedFiles.size > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {Array.from(selectedFiles).map((path) => (
                <div
                  key={path}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 
                           text-gray-700 dark:text-gray-300 rounded-full text-sm"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                  <span className="truncate max-w-[200px]">{path}</span>
                  <button
                    onClick={() => removeFile(path)}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full"
                  >
                    <FaTimes className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* File Selector Modal */}
        {showFileSelector && (
          <div className="absolute left-4 right-4 bottom-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                         rounded-xl shadow-lg max-h-72 overflow-hidden z-10 flex flex-col">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3 space-y-2">
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search files..."
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 
                         focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 dark:bg-gray-900 text-sm"
              />
              <div className="flex justify-between items-center px-1 text-sm text-gray-500 dark:text-gray-400">
                <span>{selectedFiles.size} files selected</span>
                <button
                  onClick={finishFileSelection}
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                >
                  Done
                </button>
              </div>
            </div>

            <div className="overflow-y-auto max-h-48">
              {filteredFiles.length > 0 ? (
                filteredFiles.map((file) => (
                  <button
                    key={file.path}
                    onClick={() => handleFileSelect(file.path)}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 border-b border-gray-100 dark:border-gray-800"
                  >
                    <span className={`w-2 h-2 rounded-full ${
                      selectedFiles.has(file.path) ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`} />
                    <span className="truncate text-gray-800 dark:text-gray-200">{file.path}</span>
                  </button>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  {searchQuery ? 'No matching files found' : 'Type to search files'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Loading state
  if (status === 'loading') {
    return (
      <div className="flex flex-col h-full">
        <div className="mb-4 flex items-center gap-2">
          <FaRobot className="text-xl text-primary" />
          <div>
            <h3 className="text-lg font-semibold">Reas</h3>
            <p className="text-sm text-foreground/60">
              Your AI assistant for code understanding and repository navigation
            </p>
          </div>
        </div>

        <div className="flex-grow flex items-center justify-center">
          <div className="flex space-x-2">
            <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:0.2s]" />
            <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:0.4s]" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/40 dark:to-blue-800/40 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
            <FaRobot className="text-white text-lg" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">{repo} Explorer</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">{owner}/{repo}</p>
          </div>
        </div>
        
        {!isAuthenticated && (
          <button
            onClick={() => signIn('github')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
          >
            <FaGithub className="text-sm" />
            Sign in
          </button>
        )}
      </div>
      
      {/* Messages Container */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-800/30 dark:to-blue-700/30 flex items-center justify-center mb-4">
              <FaRobot className="text-4xl text-blue-500 mb-4" />
            </div>
            <h3 className="text-lg font-medium mb-2">Repository Chat Assistant</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-md">
              Ask questions about the <span className="font-semibold">{owner}/{repo}</span> repository. 
              I can help you understand code, find files, and navigate the project.
            </p>

            {!isAuthenticated && (
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 p-4 mb-6 text-left w-full max-w-lg rounded-lg">
                <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  Login Required for Chat
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-400 mb-3">
                  You need to be logged in to use the chat feature. Directory browsing remains available without login.
                </p>
                <button
                  onClick={() => signIn('github')}
                  className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md text-sm transition-colors w-full"
                >
                  <FaGithub className="text-lg" />
                  Sign in with GitHub
                </button>
              </div>
            )}

            <div className="w-full max-w-lg">
              <h4 className="font-medium text-gray-600 dark:text-gray-300 mb-4 text-center text-sm">
                Suggested Questions
              </h4>
              <div className="flex flex-col gap-2.5">
                {sampleQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => handleSampleQuery(question)}
                    style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      backgroundColor: 'white',
                      color: '#333',
                      border: '1px solid #e1e4e8',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      marginBottom: '0',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      overflow: 'hidden'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#f6f8fa';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = 'white';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#EBF5FF',
                      color: '#3B82F6',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      marginRight: '12px',
                      flexShrink: 0
                    }}>
                      {index + 1}
                    </div>
                    <span>{question}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div className="flex items-start gap-3 max-w-3xl">
                  {!message.isUser && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex-shrink-0 flex items-center justify-center">
                      <FaRobot className="text-white text-xs" />
                    </div>
                  )}
                  <div className={`relative rounded-2xl px-4 py-3 ${
                    message.isUser 
                      ? 'bg-indigo-100 dark:bg-indigo-900/70 text-indigo-900 dark:text-indigo-100 rounded-tr-none' 
                      : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-tl-none'
                  }`}>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown
                        components={{
                          code({ className, children, ...props }) {
                            const match = /language-(\w+)/.exec(className || '')
                            const isInline = !match
                            return isInline ? (
                              <code className={className} {...props}>
                                {children}
                              </code>
                            ) : (
                              // Using 'as any' to fix the type issue with tomorrow style
                              <SyntaxHighlighter
                                style={tomorrow as any}
                                language={match[1]}
                                {...props}
                              >
                                {String(children).replace(/\n$/, '')}
                              </SyntaxHighlighter>
                            )
                          },
                          // Add custom styling for other Markdown elements
                          h1: (props) => <h1 className="text-xl font-bold mt-4 mb-2" {...props} />,
                          h2: (props) => <h2 className="text-lg font-bold mt-3 mb-2" {...props} />,
                          h3: (props) => <h3 className="text-base font-bold mt-3 mb-1" {...props} />,
                          p: (props) => <p className="mb-3" {...props} />,
                          ul: (props) => <ul className="list-disc pl-5 mb-4" {...props} />,
                          ol: (props) => <ol className="list-decimal pl-5 mb-4" {...props} />,
                          li: (props) => <li className="mb-1" {...props} />,
                          blockquote: (props) => (
                            <blockquote className="border-l-4 border-gray-300 dark:border-gray-700 pl-4 italic text-gray-600 dark:text-gray-400 my-3" {...props} />
                          ),
                          a: (props) => (
                            <a className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline" 
                              target="_blank" rel="noopener noreferrer" {...props} />
                          ),
                          hr: (props) => <hr className="my-4 border-t border-gray-200 dark:border-gray-700" {...props} />,
                          img: (props) => <img className="max-w-full my-4 mx-auto rounded" {...props} />
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                    {message.taggedFiles && message.taggedFiles.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-xs">
                        <div className="font-medium mb-1">Referenced Files:</div>
                        <div className="flex flex-wrap gap-1.5">
                          {message.taggedFiles.map(file => (
                            <span key={file} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-800 dark:text-gray-200 truncate max-w-[200px]">
                              {file}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {message.isUser && (
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex-shrink-0 flex items-center justify-center">
                      <FaUser className="text-white text-xs" />
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex-shrink-0 flex items-center justify-center">
                  <FaRobot className="text-white text-xs" />
                </div>
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-tl-none px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse delay-300"></div>
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse delay-600"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Form */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900 relative">
        <form onSubmit={handleSubmit} className="flex">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder={isAuthenticated ? "Ask about this repository..." : "Please sign in to chat..."}
            className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 border-0 rounded-l-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
            disabled={isLoading || !isAuthenticated}
          />
          <button
            type="button"
            onClick={toggleFileSelector}
            className="px-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed border-0"
            disabled={isLoading || !isAuthenticated}
          >
            <FaPlus size={16} />
          </button>
          <button
            type="submit"
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-r-lg disabled:opacity-50 disabled:cursor-not-allowed border-0"
            disabled={isLoading || !input.trim() || !isAuthenticated}
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <FaPaperPlane size={16} />
            )}
          </button>
        </form>
        
        {!isAuthenticated && (
          <div className="text-center mt-2 absolute -bottom-7 left-0 w-full">
            <button
              type="button"
              onClick={() => signIn('github')}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Login to use chat
            </button>
          </div>
        )}

        {/* Selected Files Display */}
        {selectedFiles.size > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {Array.from(selectedFiles).map((path) => (
              <div
                key={path}
                className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 
                         text-gray-700 dark:text-gray-300 rounded-full text-sm"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                <span className="truncate max-w-[200px]">{path}</span>
                <button
                  onClick={() => removeFile(path)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full"
                >
                  <FaTimes className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* File Selector Modal */}
      {showFileSelector && (
        <div className="absolute left-4 right-4 bottom-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                       rounded-xl shadow-lg max-h-72 overflow-hidden z-10 flex flex-col">
          <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3 space-y-2">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search files..."
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 
                       focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 dark:bg-gray-900 text-sm"
            />
            <div className="flex justify-between items-center px-1 text-sm text-gray-500 dark:text-gray-400">
              <span>{selectedFiles.size} files selected</span>
              <button
                onClick={finishFileSelection}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
              >
                Done
              </button>
            </div>
          </div>

          <div className="overflow-y-auto max-h-48">
            {filteredFiles.length > 0 ? (
              filteredFiles.map((file) => (
                <button
                  key={file.path}
                  onClick={() => handleFileSelect(file.path)}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 border-b border-gray-100 dark:border-gray-800"
                >
                  <span className={`w-2 h-2 rounded-full ${
                    selectedFiles.has(file.path) ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`} />
                  <span className="truncate text-gray-800 dark:text-gray-200">{file.path}</span>
                </button>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                {searchQuery ? 'No matching files found' : 'Type to search files'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
} 