'use client'

import { useState, useEffect, useRef, Fragment } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { Octokit } from '@octokit/rest'
import { FaPaperPlane, FaGithub, FaChevronDown, FaChevronUp, FaFileCode, FaArrowDown, FaCloudUploadAlt, FaTrash } from 'react-icons/fa'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus as syntaxDark, oneLight as syntaxLight } from 'react-syntax-highlighter/dist/cjs/styles/prism'
import styles from './ChatBox.module.css'
import remarkBreaks from 'remark-breaks'
import axios from 'axios'
import { saveChatMessage, getChatMessages, clearChatHistory, ChatMessage as DBChatMessage } from '../lib/chat-utils'
import { 
  savePersistentMessage, 
  getPersistentMessages, 
  clearConversation,
  syncPendingMessages
} from '@/app/lib/chat-persistence';
import { 
  saveMessage, 
  getMessages, 
  clearConversationV2,
  migrateMessages,
  ChatMessage as ChatMessageV2
} from '@/app/lib/chat-persistence-v2';
import { testDatabaseConnection } from '@/app/lib/supabase-utils';

interface ChatBoxProps {
  owner: string
  repo: string
  provider?: 'github' | 'gitlab'
  selectedFile: string | null
  selectedFilesForContext?: FileWithContent[]
  theme: 'light' | 'dark'
  messages?: Message[]
  expandedMessages?: Set<string>
  repoContext?: {
    structure: string
    readme: string
    taggedFiles: Record<string, string>
  }
  onAddMessage?: (message: Message) => void
  onToggleMessageExpansion?: (messageId: string) => void
  onSetRepoContext?: (context: {
    structure: string
    readme: string
    taggedFiles: Record<string, string>
  }) => void
  onMaximizeClick?: () => void
  isMaximized?: boolean
  onLoadingChange?: (isLoading: boolean) => void
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  selectedFiles?: string[]
}

interface FileWithContent {
  path: string;
  content: string;
}

// Generate a unique ID for messages
const generateId = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Use localStorage as a debug flag setter
const DEBUG_ENABLED = false;

// Add a debug function that works both server and client side
function debugLog(...args: any[]) {
  if (DEBUG_ENABLED) {
    console.log('[CHAT DEBUG]', ...args);
    
    // If in browser, also add to a debug element
    if (typeof document !== 'undefined') {
      try {
        // Find or create debug element
        let debugElement = document.getElementById('chat-debug-output');
        if (!debugElement) {
          debugElement = document.createElement('div');
          debugElement.id = 'chat-debug-output';
          debugElement.style.position = 'fixed';
          debugElement.style.bottom = '10px';
          debugElement.style.left = '10px';
          debugElement.style.maxHeight = '200px';
          debugElement.style.maxWidth = '400px';
          debugElement.style.overflow = 'auto';
          debugElement.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
          debugElement.style.color = 'white';
          debugElement.style.padding = '10px';
          debugElement.style.zIndex = '9999';
          debugElement.style.fontSize = '12px';
          debugElement.style.fontFamily = 'monospace';
          document.body.appendChild(debugElement);
        }
        
        // Add the message
        const message = document.createElement('div');
        message.textContent = `${new Date().toISOString().slice(11, 23)} ${args.map(a => 
          typeof a === 'object' ? JSON.stringify(a) : a.toString()
        ).join(' ')}`;
        debugElement.appendChild(message);
        
        // Limit to 20 messages
        while (debugElement.childNodes.length > 20) {
          debugElement.removeChild(debugElement.firstChild!);
        }
        
        // Scroll to bottom
        debugElement.scrollTop = debugElement.scrollHeight;
      } catch (e) {
        // Just in case there's any DOM error
        console.error('Error in debug display:', e);
      }
    }
  }
}

export default function ChatBox({ 
  owner, 
  repo, 
  provider, 
  selectedFile, 
  selectedFilesForContext = [], 
  theme = 'light',
  messages: externalMessages = [],
  expandedMessages: externalExpandedMessages = new Set(),
  repoContext: externalRepoContext = { structure: '', readme: '', taggedFiles: {} },
  onAddMessage,
  onToggleMessageExpansion,
  onSetRepoContext,
  onMaximizeClick,
  isMaximized,
  onLoadingChange
}: ChatBoxProps) {
  const { data: session, status } = useSession()
  const isAuthenticated = status === 'authenticated'
  
  const [localMessages, setLocalMessages] = useState<Message[]>([])
  const [localExpandedMessages, setLocalExpandedMessages] = useState<Set<string>>(new Set())
  const [localRepoContext, setLocalRepoContext] = useState<{
    structure: string
    readme: string
    taggedFiles: Record<string, string>
  }>({
    structure: '',
    readme: '',
    taggedFiles: {},
  })
  
  // Add missing error state
  const [error, setError] = useState<string | null>(null)
  
  // Add a cache to store API responses and avoid redundant calls
  const [responseCache, setResponseCache] = useState<Record<string, any>>({})
  // Add state to track if messages have been loaded from the database
  const [messagesLoaded, setMessagesLoaded] = useState(false)

  // Add sample questions that users can click on
  const sampleQuestions = [
    `What is the purpose of the ${repo} repository?`,
    `Explain the main components of this project`,
    `How do I get started with this codebase?`,
    `Explain the selected files and how they relate to each other`,
    `What are the key dependencies used in these files?`,
    `Analyze the code patterns in the selected files`
  ]

  const messages = externalMessages.length > 0 || onAddMessage ? externalMessages : localMessages
  const expandedMessages = onToggleMessageExpansion ? externalExpandedMessages : localExpandedMessages
  const repoContext = onSetRepoContext ? externalRepoContext : localRepoContext

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lastTypingTimeRef = useRef<number>(0)
  const typingCharIndexRef = useRef<number>(0)
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // For client-side streaming effect
  const [visibleContent, setVisibleContent] = useState<string>('')
  const completeContentRef = useRef<string>('')
  const currentPositionRef = useRef<number>(0)
  const currentMessageIdRef = useRef<string>('')

  // Add these variables near the other state variables
  const [typingMessage, setTypingMessage] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const typingSpeed = 15; // milliseconds per character
  const typingRef = useRef<NodeJS.Timeout | null>(null);
  const [typingContent, setTypingContent] = useState<string>('');

  // Add these refs near other state declarations
  const accumulatedContentRef = useRef<string>('');
  const messageAddedRef = useRef<boolean>(false);

  // Add these refs near other state declarations
  const loadingStateRef = useRef<{
    isLoading: boolean;
    isBusy: boolean;
    isTyping: boolean;
    typingContent: string;
  }>({
    isLoading: false,
    isBusy: false,
    isTyping: false,
    typingContent: ''
  });

  // Add a new ref for tracking the response stream
  const responseStreamRef = useRef<ReadableStreamDefaultReader | null>(null);

  // Add state for tooltip visibility
  const [showTooltip, setShowTooltip] = useState(false);

  // Add new state for advanced chat
  // const [showAdvancedOptions, setShowAdvancedOptions] = useState<boolean>(false);
  // const [isUploading, setIsUploading] = useState<boolean>(false);
  // const [uploadProgress, setUploadProgress] = useState<number>(0);

  // Reset messagesLoaded when owner or repo changes to force reloading messages
  useEffect(() => {
    console.log('Owner or repo changed, resetting messagesLoaded state');
    setMessagesLoaded(false);
    setLocalMessages([]);
  }, [owner, repo, provider]);

  // Add database test on component mount
  useEffect(() => {
    if (DEBUG_ENABLED) {
      debugLog('DEBUG MODE ENABLED - Will test database in 5 seconds');
      setTimeout(() => {
        testDatabaseConnection()
          .then(result => {
            debugLog('Database connectivity test completed:', result);
            // Add a visual indicator for database connectivity
            if (typeof document !== 'undefined') {
              const indicator = document.createElement('div');
              indicator.style.position = 'fixed';
              indicator.style.top = '10px';
              indicator.style.right = '10px';
              indicator.style.backgroundColor = result ? 'green' : 'red';
              indicator.style.color = 'white';
              indicator.style.padding = '5px 10px';
              indicator.style.borderRadius = '5px';
              indicator.style.zIndex = '9999';
              indicator.textContent = result ? 'DB Connected' : 'DB Connection Failed';
              document.body.appendChild(indicator);
              setTimeout(() => {
                document.body.removeChild(indicator);
              }, 10000);
            }
          })
          .catch(err => debugLog('Database connectivity test error:', err));
      }, 5000); // Delay by 5 seconds to make sure everything is loaded
    }
  }, [session]);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      // Instead of using setTimeout which might affect the whole page,
      // directly scroll the chat container element
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      
      // Don't use messagesEndRef.scrollIntoView() as that can scroll the whole page
      // Instead, just make sure we're at the bottom of the chat container
    }
  }

  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current
      const isScrolledUp = scrollHeight - scrollTop - clientHeight > 50
      setShowScrollButton(isScrolledUp)
    }
  }

  const fetchRepoContext = async () => {
    try {
      console.log('Fetching repo context for', owner, repo);
      console.log('Current auth status:', status);
      console.log('Using provider:', provider || 'github');
      
      // If we're still loading the auth state, wait for it
      if (status === 'loading') {
        console.log('Auth state is loading, waiting...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return; // The useEffect will trigger another fetch once status changes
      }

      // Check if we have cached data for this repo
      const cacheKey = `${owner}/${repo}/context`;
      
      // Check if we have valid cached data (with non-empty structure)
      const hasValidCache = responseCache[cacheKey] && 
                           responseCache[cacheKey].structure && 
                           responseCache[cacheKey].structure.length > 0;
      
      if (hasValidCache) {
        console.log('Using cached repo context for', cacheKey);
        const cachedContext = responseCache[cacheKey];
        
        if (onSetRepoContext) {
          onSetRepoContext(cachedContext);
        } else {
          setLocalRepoContext(cachedContext);
        }
        
        return;
      }

      let structure = '';
      let readme = 'No README.md found';
      let retryCount = 0;
      const maxRetries = 3;
      
      // Handle GitLab repositories
      if (provider === 'gitlab') {
        console.log('Using GitLab API for repository context');
        
        try {
          // Try to get a token from localStorage or the API
          const gitlabTokenKeys = ['gitlabToken', 'gitlab_token', 'GITLAB_TOKEN'];
          let token = null;
          
          // Try localStorage first
          for (const key of gitlabTokenKeys) {
            const storedToken = localStorage.getItem(key);
            if (storedToken) {
              token = storedToken;
              console.log(`Found GitLab token in localStorage with key: ${key}`);
              break;
            }
          }
          
          // If no token in localStorage, try to fetch from API
          if (!token) {
            console.log('Trying to fetch GitLab token from API');
            const response = await fetch('/api/user/current-token?provider=gitlab');
            if (response.ok) {
              const data = await response.json();
              if (data.token) {
                token = data.token;
                localStorage.setItem('gitlabToken', token);
                console.log('Successfully retrieved GitLab token from API');
              }
            }
          }
          
          if (!token) {
            throw new Error('GitLab token not found. Please login with GitLab to access this repository.');
          }
          
          console.log('Using GitLab token to fetch repository data');
          
          // Encode the repository path
          const encodedRepo = encodeURIComponent(`${owner}/${repo}`);
          
          // Get repository details
          console.log(`Making GitLab API request for ${encodedRepo}`);
          const repoResponse = await axios.get(`https://gitlab.com/api/v4/projects/${encodedRepo}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          console.log('GitLab repository details fetched successfully');
          
          // Get the default branch
          const defaultBranch = repoResponse.data.default_branch || 'main';
          console.log('GitLab default branch:', defaultBranch);
          
          // Get repository tree
          const treeResponse = await axios.get(
            `https://gitlab.com/api/v4/projects/${encodedRepo}/repository/tree`, 
            {
              headers: { 'Authorization': `Bearer ${token}` },
              params: { 
                recursive: true, 
                per_page: 100,
                ref: defaultBranch
              }
            }
          );
          
          if (!Array.isArray(treeResponse.data) || treeResponse.data.length === 0) {
            throw new Error('Empty tree response from GitLab API');
          }
          
          console.log('GitLab tree fetched successfully, items:', treeResponse.data.length);
          
          // Format the tree structure
          structure = treeResponse.data
            .filter(item => item.path !== undefined && !item.path.includes('.git/'))
            .map(item => {
              const isDirectory = item.type === 'tree';
              const path = item.path;
              const indentation = path.split('/').slice(0, -1).map(() => '  ').join('');
              return `${indentation}${isDirectory ? '📁' : '📄'} ${path.split('/').pop()}`;
            })
            .join('\n');
          
          // Try to get README.md
          try {
            console.log('Trying to fetch GitLab README.md');
            const readmeFiles = ['README.md', 'Readme.md', 'readme.md', 'README.markdown', 'README'];
            
            for (const filename of readmeFiles) {
              try {
                const encodedPath = encodeURIComponent(filename);
                const readmeResponse = await axios.get(
                  `https://gitlab.com/api/v4/projects/${encodedRepo}/repository/files/${encodedPath}/raw`,
                  {
                    headers: { 'Authorization': `Bearer ${token}` },
                    params: { ref: defaultBranch },
                    responseType: 'text'
                  }
                );
                
                if (readmeResponse.data) {
                  readme = readmeResponse.data;
                  console.log('GitLab README fetched successfully, length:', readme.length);
                  break;
                }
              } catch (error) {
                console.log(`GitLab README '${filename}' not found, trying next option`);
                continue;
              }
            }
          } catch (readmeError) {
            console.error('Error fetching GitLab README:', readmeError);
          }
        } catch (error) {
          console.error('Error fetching GitLab repository context:', error);
          structure = `Error: Unable to access GitLab repository structure. This could be due to:
1. Repository access restrictions
2. Repository might be private
3. Repository might not exist
4. GitLab API rate limits
5. Authentication issues

Please ensure:
- The repository exists at ${owner}/${repo}
- You have the necessary permissions to access it
- You are properly authenticated with GitLab`;
        }
      } else {
        // Default to GitHub API
        console.log('Using GitHub API for repository context');
        
        // Initialize Octokit with authentication token
        const octokit = new Octokit({
          auth: session?.accessToken,
        });
        
        while (retryCount < maxRetries) {
          try {
            // First try to get repository details to verify access
            const repoResponse = await octokit.repos.get({
              owner,
              repo,
            });
            
            console.log('Repository access verified:', repoResponse.status);
            
            // Get the default branch
            const defaultBranch = repoResponse.data.default_branch;
            console.log('Default branch:', defaultBranch);
            
            // Get the latest commit SHA
            const { data: refData } = await octokit.git.getRef({
              owner,
              repo,
              ref: `heads/${defaultBranch}`,
            });
            
            const latestCommitSha = refData.object.sha;
            console.log('Latest commit SHA:', latestCommitSha);
            
            // Get the full directory tree
            console.log('Fetching recursive git tree');
            const { data: treeData } = await octokit.git.getTree({
              owner,
              repo,
              tree_sha: latestCommitSha,
              recursive: '1'
            });
            
            if (treeData.tree.length === 0) {
              throw new Error('Empty tree response');
            }
            
            console.log('Git tree fetched successfully, number of items:', treeData.tree.length);

            // Format the tree structure in a readable way
            structure = treeData.tree
              .filter(item => item.path !== undefined && !item.path.includes('.git/'))
              .map(item => {
                const isDirectory = item.type === 'tree';
                const path = item.path!;
                const indentation = path.split('/').slice(0, -1).map(() => '  ').join('');
                return `${indentation}${isDirectory ? '📁' : '📄'} ${path.split('/').pop()}`;
              })
              .join('\n');
              
            console.log('Structured tree:', structure.substring(0, 200) + '...');
            break; // Success, exit the retry loop
            
          } catch (error) {
            console.error(`Attempt ${retryCount + 1} failed:`, error);
            retryCount++;
            
            if (retryCount < maxRetries) {
              console.log(`Retrying in ${retryCount * 1000}ms...`);
              await new Promise(resolve => setTimeout(resolve, retryCount * 1000));
            } else {
              throw error; // Let the outer catch handle it
            }
          }
        }

        // If we still don't have a structure, try the fallback method
        if (!structure) {
          console.log('Falling back to contents API');
          try {
            const { data: contents } = await octokit.repos.getContent({
              owner,
              repo,
              path: '',
            });
            
            if (Array.isArray(contents) && contents.length > 0) {
              console.log('Fetched top-level contents, number of items:', contents.length);
              
              const dirs = contents.filter(item => item.type === 'dir');
              const files = contents.filter(item => item.type === 'file');
              
              structure = dirs.map(dir => `📁 ${dir.path}`).join('\n');
              structure += '\n' + files.map(file => `📄 ${file.path}`).join('\n');
              
              for (const dir of dirs) {
                try {
                  const { data: dirContents } = await octokit.repos.getContent({
                    owner,
                    repo,
                    path: dir.path,
                  });
                  
                  if (Array.isArray(dirContents)) {
                    structure += '\n' + dirContents
                      .map(item => `  ${item.type === 'dir' ? '📁' : '📄'} ${dir.path}/${item.name}`)
                      .join('\n');
                  }
                } catch (dirError) {
                  console.error(`Error fetching contents of directory ${dir.path}:`, dirError);
                }
              }
            } else {
              structure = "Error: Unable to fetch repository contents. The repository might be empty or inaccessible.";
            }
          } catch (contentError) {
            console.error('Error in fallback content fetch:', contentError);
            structure = `Error: Unable to access repository structure. This could be due to:
1. Repository access restrictions
2. Repository might be private
3. Repository might not exist
4. GitHub API rate limits
5. Network connectivity issues

Please ensure:
- The repository exists at ${owner}/${repo}
- You have the necessary permissions to access it
- You are properly authenticated with GitHub`;
          }
        }
        
        // Try to fetch README with retries for GitHub
        retryCount = 0;
        while (retryCount < maxRetries) {
          try {
            const readmeFiles = ['README.md', 'Readme.md', 'readme.md', 'README.markdown', 'README'];
            let readmeContent = null;
            
            for (const filename of readmeFiles) {
              try {
                const { data: readmeData } = await octokit.repos.getContent({
                  owner,
                  repo,
                  path: filename,
                });
                
                if ('content' in readmeData) {
                  readmeContent = readmeData;
                  console.log('Found README file:', filename);
                  break;
                }
              } catch (error) {
                continue;
              }
            }
            
            if (readmeContent && 'content' in readmeContent) {
              readme = atob(readmeContent.content);
              console.log('README fetched successfully, length:', readme.length);
              break; // Success, exit the retry loop
            }
            
            throw new Error('No README found in any common format');
          } catch (readmeError) {
            console.error(`README fetch attempt ${retryCount + 1} failed:`, readmeError);
            retryCount++;
            
            if (retryCount < maxRetries) {
              console.log(`Retrying README fetch in ${retryCount * 500}ms...`);
              await new Promise(resolve => setTimeout(resolve, retryCount * 500));
            } else {
              console.log('All README fetch attempts failed');
              break;
            }
          }
        }
      }
      
      // Create repo context with the fetched data
      const repoContext = {
        structure,
        readme,
        taggedFiles: {}
      };
      
      // Store in cache
      responseCache[cacheKey] = repoContext;
      
      // Update state or callback
      if (onSetRepoContext) {
        onSetRepoContext(repoContext);
      } else {
        setLocalRepoContext(repoContext);
      }
      
    } catch (error) {
      console.error('Error fetching repository context:', error);
      setError('Failed to fetch repository data. Please try again later.');
    }
  };

  const toggleMessageExpansion = (messageId: string) => {
    if (onToggleMessageExpansion) {
      onToggleMessageExpansion(messageId)
    } else {
      const newExpanded = new Set(Array.from(localExpandedMessages))
      if (newExpanded.has(messageId)) {
        newExpanded.delete(messageId)
      } else {
        newExpanded.add(messageId)
      }
      setLocalExpandedMessages(newExpanded)
    }
  }

  // Helper function to log the current messages array for debugging
  const logMessages = (prefix: string, messages: Message[]) => {
    console.log(`\n\n==== ${prefix} ====\n\n`, 
      messages.map(m => ({
        id: m.id,
        role: m.role,
        contentPreview: m.content.substring(0, 30) + (m.content.length > 30 ? '...' : ''),
        contentLength: m.content.length,
        timestamp: new Date(m.timestamp).toISOString()
      }))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    console.log('handleSubmit called', 'Event type:', e.type);
    e.preventDefault();
    console.log('Default prevented in handleSubmit');
    
    if (!isAuthenticated || !input.trim() || loading) {
      console.log('Submit blocked -', 'isAuthenticated:', isAuthenticated, 'input.trim():', input.trim(), 'loading:', loading);
      return;
    }
    
    // Debug log for selected files
    console.log('Selected files for context:', selectedFilesForContext);
    
    // Check if we have repository structure, and if not, fetch it
    if (!repoContext.structure || repoContext.structure.length === 0) {
      console.log('No repository structure available, fetching before sending message');
      try {
        await fetchRepoContext();
        // Double check if we got the structure
        if (!repoContext.structure || repoContext.structure.length === 0) {
          console.error('Failed to fetch repository structure');
          return;
        }
      } catch (error) {
        console.error('Error fetching repository structure:', error);
        return;
      }
    }
    
    console.log('Submitting message:', input);
    
    // Only use explicitly selected files for context
    const filesContent = selectedFilesForContext.map(file => 
      `=== ${file.path} ===\n${file.content}`
    ).join('\n\n');
    
    const selectedFilesPaths = selectedFilesForContext.map(file => file.path);
    
    // Log what files are being used for context
    console.log('Files used for context:', selectedFilesPaths);
    
    // Create a copy of repoContext with the selected files included in taggedFiles
    const updatedRepoContext = {
      ...repoContext,
      taggedFiles: Object.fromEntries(
        selectedFilesForContext.map(file => [file.path, file.content])
      )
    };
    
    // Update the repoContext state if needed
    if (onSetRepoContext) {
      onSetRepoContext(updatedRepoContext);
    } else {
      setLocalRepoContext(updatedRepoContext);
    }
    
    const formattedMessage: Message = {
      id: generateId(),
      role: 'user',
      content: selectedFilesPaths.length > 0 
        ? `${input}\n\n[Files used for context: ${selectedFilesPaths.join(', ')}]` 
        : input,
      timestamp: Date.now(),
      selectedFiles: selectedFilesPaths.length > 0 ? selectedFilesPaths : undefined
    };

    console.log('Created user message:', formattedMessage);
    
    // Save the user message to the database for persistence
    try {
      console.log('Saving user message to database...');
      const userEmail = session?.user?.email;
      const saveResult = await saveMessage(
        formattedMessage,
        owner,
        repo,
        provider || 'github',
        userEmail
      );
      console.log('Save result:', saveResult);
    } catch (saveError) {
      console.error('Error saving message to database:', saveError);
      // Continue with the chat even if saving fails
    }
    
    if (onAddMessage) {
      onAddMessage(formattedMessage);
    } else {
      setLocalMessages(prev => [...prev, formattedMessage]);
    }
    
    setInput('');
    console.log('Input cleared after message creation');
    setLoading(true);
    setBusy(true);
    console.log('Loading and busy states set to true');
    
    // Make loading state available to refs immediately
    loadingStateRef.current = {
      isLoading: true,
      isBusy: true,
      isTyping: false,
      typingContent: ''
    };
    
    if (onLoadingChange) {
      onLoadingChange(true);
    }
    
    // Reset refs at the start of new message
    accumulatedContentRef.current = '';
    messageAddedRef.current = false;
    
    // Add scroll to bottom after adding user message
    scrollToBottom();
    
    try {
      console.log('Sending to server:', input);
      console.log('Selected files for context:', selectedFilesPaths);
      console.log('Repository information:', { owner, repo, provider });
      
      // Use our centralized API endpoint with a consistent format
      const payload = {
        message: selectedFilesPaths.length > 0 
          ? `${input}\n\nNOTE: I have selected specific files that I want to understand: ${selectedFilesPaths.join(', ')}. Please focus on analyzing these files.`
          : input,
        repoStructure: updatedRepoContext.structure,
        owner,
        repo,
        readmeContent: updatedRepoContext.readme,
        taggedFiles: updatedRepoContext.taggedFiles || {},
        prioritizeSelectedFiles: selectedFilesPaths.length > 0,
        provider: provider || 'github',
        repoPath: `${owner}/${repo}`
      };
      
      console.log('Sending request to /api/chat with repo info:', { owner, repo });
      
      // For quick development testing, you can uncomment this to simulate a response without API call
      /*
      // Simulated response
      setIsTyping(true);
      setTypingContent('');
      simulateStreaming('This is a simulated response to your question.', generateId());
      return;
      */
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('Response received:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Start typing animation with empty content
      setIsTyping(true);
      setTypingContent('');
      loadingStateRef.current = {
        ...loadingStateRef.current,
        isTyping: true,
        isBusy: true,
        typingContent: ''
      };
      
      if (response.body) {
        const reader = response.body.getReader();
        responseStreamRef.current = reader; // Store the reader in the ref
        
        console.log('Starting to read response stream');
        
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('Stream complete, final content:', accumulatedContentRef.current);
            
            if (!messageAddedRef.current && accumulatedContentRef.current) {
              const selectedFileNames = selectedFilesForContext.map(file => file.path);
              const filesContextNote = selectedFileNames.length > 0 
                ? `\n\n---\n**Files analyzed:** ${selectedFileNames.join(', ')}`
                : '';
                
              const assistantMessage: Message = {
                id: generateId(),
                role: 'assistant',
                content: accumulatedContentRef.current + filesContextNote,
                timestamp: Date.now(),
                selectedFiles: selectedFileNames.length > 0 ? selectedFileNames : undefined
              };
              
              // Save the assistant message to the database for persistence
              try {
                console.log('Saving assistant message to database...');
                const userEmail = session?.user?.email;
                const saveResult = await saveMessage(
                  assistantMessage,
                  owner,
                  repo,
                  provider || 'github',
                  userEmail
                );
                console.log('Save result for assistant message:', saveResult);
              } catch (saveError) {
                console.error('Error saving assistant message to database:', saveError);
              }
              
              console.log('Adding assistant message after stream completion:', assistantMessage);
              
              if (onAddMessage) {
                onAddMessage(assistantMessage);
              } else {
                setLocalMessages(prev => [...prev, assistantMessage]);
              }
              messageAddedRef.current = true;
            }
            // Update both state and ref
            setIsTyping(false);
            setLoading(false);
            setBusy(false);
            loadingStateRef.current.isTyping = false;
            loadingStateRef.current.isLoading = false;
            loadingStateRef.current.isBusy = false;
            responseStreamRef.current = null;
            
            // Notify parent if needed
            if (onLoadingChange) {
              onLoadingChange(false);
            }
            
            break;
          }
          
          const chunk = new TextDecoder().decode(value, { stream: true });
          console.log('Received chunk:', chunk);
          
          // Process the chunk directly - don't split by newlines first
          if (chunk.includes('data: ')) {
            // Extract all data: parts from the chunk
            const dataMatches = chunk.match(/data: ({.*?})/g);
            if (dataMatches) {
              for (const match of dataMatches) {
                try {
                  // Extract the JSON part
                  const jsonStr = match.replace('data: ', '');
                  // Parse it
                  const parsed = JSON.parse(jsonStr);
                  if (parsed.content) {
                    // Add the content directly to our buffer
                    accumulatedContentRef.current += parsed.content;
                    
                    // Update typing content
                    setTypingContent(accumulatedContentRef.current);
                    loadingStateRef.current.typingContent = accumulatedContentRef.current;
                    
                    // Ensure we transition from loading to typing on first content
                    if (!isTyping) {
                      setIsTyping(true);
                      setBusy(false);
                      loadingStateRef.current = {
                        ...loadingStateRef.current,
                        isTyping: true,
                        isBusy: false
                      };
                    }
                    
                    // Scroll to bottom to show new content
                    scrollToBottom();
                  }
                } catch (error) {
                  console.error('Error parsing data part:', match, error);
                }
              }
            }
          } else if (chunk.includes('[DONE]')) {
            // Handle completion marker
            console.log('Received [DONE] marker');
            setIsTyping(false);
            setLoading(false);
            setBusy(false);
            loadingStateRef.current = {
              isLoading: false,
              isBusy: false,
              isTyping: false,
              typingContent: accumulatedContentRef.current
            };
            responseStreamRef.current = null;
          } else {
            // As a fallback, just append the raw chunk
            console.warn('Unexpected chunk format, using as raw content:', chunk);
            accumulatedContentRef.current += chunk;
            setTypingContent(accumulatedContentRef.current);
          }
        }
      }

      // Log chat after completion
      fetch('/api/log-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: input, owner, repo, provider, call: "chatBox.tsx" }),
      }).catch(err => console.error('Error logging chat:', err));

    } catch (error) {
      console.error('Error processing message:', error);
      const errorMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: 'Sorry, there was an error processing your request. Please try again.',
        timestamp: Date.now()
      };
      
      if (onAddMessage) {
        onAddMessage(errorMessage);
      } else {
        setLocalMessages(prev => [...prev, errorMessage]);
      }
      
      // Update both state and ref for error cleanup
      setIsTyping(false);
      setLoading(false);
      setBusy(false);
      loadingStateRef.current = {
        isLoading: false,
        isBusy: false,
        isTyping: false,
        typingContent: ''
      };
      responseStreamRef.current = null;
    }
  };

  // Add effect to sync loading states from ref
  useEffect(() => {
    const loadingState = loadingStateRef.current;
    if (loading !== loadingState.isLoading) {
      setLoading(loadingState.isLoading);
    }
    if (busy !== loadingState.isBusy) {
      setBusy(loadingState.isBusy);
    }
    if (isTyping !== loadingState.isTyping) {
      setIsTyping(loadingState.isTyping);
    }
    if (typingContent !== loadingState.typingContent) {
      setTypingContent(loadingState.typingContent);
    }
  }, [loading, busy, isTyping, typingContent]);

  // Function to disable client-side streaming (we're using server streaming directly)
  const simulateStreaming = (content: string, messageId: string) => {
    console.log('\n\n==== CLIENT-SIDE STREAMING DISABLED ====\n\n');
    console.log('\n\n==== USING SERVER-SIDE STREAMING INSTEAD ====\n\n');
    
    // Just set the current message ID for reference
    currentMessageIdRef.current = messageId;
    completeContentRef.current = content;
    
    // After streaming completes, save the message
    setTimeout(async () => {
      try {
        const userEmail = session?.user?.email;
        
        // Create the proper message object for saving
        const messageToSave: Message = {
          id: messageId,
          role: 'assistant',
          content: content,
          timestamp: Date.now()
        };
        
        // Save to database
        const saveResult = await saveMessage(
          messageToSave,
          owner,
          repo,
          provider || 'github',
          userEmail
        );
        
        console.log('Saved simulated message to database:', saveResult);
      } catch (error) {
        console.error('Error saving simulated message to database:', error);
      }
    }, 500);
  };

  // Add a handler for when a sample question is clicked
  const handleSampleQuestionClick = (question: string) => {
    if (!isAuthenticated) {
      // If not authenticated, encourage login
      return
    }
    
    // Debug log for selected files
    console.log('Selected files for sample question context:', selectedFilesForContext);
    
    setInput(question)
    // Optionally auto-submit the question
    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
      timestamp: Date.now(),
      selectedFiles: selectedFilesForContext.length > 0 
        ? selectedFilesForContext.map(file => file.path) 
        : undefined
    }

    if (onAddMessage) {
      onAddMessage(newMessage)
    } else {
      setLocalMessages(prev => [...prev, newMessage])
    }

    setInput('')
    setLoading(true)
    setBusy(true)
    
    // Make loading state available to refs immediately
    loadingStateRef.current = {
      isLoading: true,
      isBusy: true,
      isTyping: false,
      typingContent: ''
    };
    
    if (onLoadingChange) {
      onLoadingChange(true);
    }
    
    // Reset refs at the start of new message
    accumulatedContentRef.current = '';
    messageAddedRef.current = false;

    // Add scroll to bottom after adding user message
    scrollToBottom();

    // Create a copy of repoContext with the selected files included in taggedFiles
    const updatedRepoContext = {
      ...repoContext,
      taggedFiles: Object.fromEntries(
        selectedFilesForContext.map(file => [file.path, file.content])
      )
    };
    
    // Update the repoContext state if needed
    if (onSetRepoContext) {
      onSetRepoContext(updatedRepoContext);
    } else {
      setLocalRepoContext(updatedRepoContext);
    }

    // Helper function for error handling
    const handleStreamError = () => {
      const errorMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: 'Sorry, there was an error processing your request. Please try again.',
        timestamp: Date.now()
      };
      
      if (onAddMessage) {
        onAddMessage(errorMessage);
      } else {
        setLocalMessages(prev => [...prev, errorMessage]);
      }
      
      setIsTyping(false);
      setLoading(false);
      setBusy(false);
      loadingStateRef.current = {
        isLoading: false,
        isBusy: false,
        isTyping: false,
        typingContent: ''
      };
      if (onLoadingChange) {
        onLoadingChange(false);
      }
      responseStreamRef.current = null;
    };

    // Use our centralized API endpoint with a consistent format
    const payload = {
      message: selectedFilesForContext.length > 0 
        ? `${question}\n\nNOTE: I have selected specific files that I want to understand: ${selectedFilesForContext.map(file => file.path).join(', ')}. Please focus on analyzing these files.`
        : question,
      repoStructure: updatedRepoContext.structure,
      owner,
      repo,
      readmeContent: updatedRepoContext.readme,
      taggedFiles: updatedRepoContext.taggedFiles || {},
      prioritizeSelectedFiles: selectedFilesForContext.length > 0
    };
    
    // Use server-side API endpoint
    console.log('Sending sample question to /api/chat:', question);
    
    fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    .then(async response => {
      console.log('Response received for sample question:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Start typing animation with empty content
      setIsTyping(true);
      setTypingContent('');
      loadingStateRef.current = {
        ...loadingStateRef.current,
        isTyping: true,
        isBusy: true,
        typingContent: ''
      };
      
      if (response.body) {
        // Create a ReadableStream reader for the response body
        const reader = response.body.getReader();
        responseStreamRef.current = reader; // Store the reader in the ref
        
        console.log('Starting to read sample question response stream');
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              console.log('Stream complete, final content:', accumulatedContentRef.current);
              
              if (!messageAddedRef.current && accumulatedContentRef.current) {
                const selectedFileNames = selectedFilesForContext.map(file => file.path);
                const filesContextNote = selectedFileNames.length > 0 
                  ? `\n\n---\n**Files analyzed:** ${selectedFileNames.join(', ')}`
                  : '';
                  
                const assistantMessage: Message = {
                  id: generateId(),
                  role: 'assistant',
                  content: accumulatedContentRef.current + filesContextNote,
                  timestamp: Date.now(),
                  selectedFiles: selectedFileNames.length > 0 ? selectedFileNames : undefined
                };
                
                // Save the assistant message to the database for persistence
                try {
                  console.log('Saving assistant message to database...');
                  const userEmail = session?.user?.email;
                  const saveResult = await saveMessage(
                    assistantMessage,
                    owner,
                    repo,
                    provider || 'github',
                    userEmail
                  );
                  console.log('Save result for assistant message:', saveResult);
                } catch (saveError) {
                  console.error('Error saving assistant message to database:', saveError);
                }
                
                console.log('Adding assistant message for sample question:', assistantMessage);
                
                if (onAddMessage) {
                  onAddMessage(assistantMessage);
                } else {
                  setLocalMessages(prev => [...prev, assistantMessage]);
                }
                messageAddedRef.current = true;
              }
              
              // Update both state and ref for cleanup
              setIsTyping(false);
              setLoading(false);
              setBusy(false);
              loadingStateRef.current = {
                isLoading: false,
                isBusy: false,
                isTyping: false,
                typingContent: accumulatedContentRef.current
              };
              if (onLoadingChange) {
                onLoadingChange(false);
              }
              responseStreamRef.current = null;
              break;
            }
            
            const chunk = new TextDecoder().decode(value, { stream: true });
            console.log('Received chunk for sample question:', chunk);
            
            // Process the chunk directly - don't split by newlines first
            if (chunk.includes('data: ')) {
              // Extract all data: parts from the chunk
              const dataMatches = chunk.match(/data: ({.*?})/g);
              if (dataMatches) {
                for (const match of dataMatches) {
                  try {
                    // Extract the JSON part
                    const jsonStr = match.replace('data: ', '');
                    // Parse it
                    const parsed = JSON.parse(jsonStr);
                    if (parsed.content) {
                      // Add the content directly to our buffer
                      accumulatedContentRef.current += parsed.content;
                      
                      // Update typing content
                      setTypingContent(accumulatedContentRef.current);
                      loadingStateRef.current.typingContent = accumulatedContentRef.current;
                      
                      // Ensure we transition from loading to typing on first content
                      if (!isTyping) {
                        setIsTyping(true);
                        setBusy(false);
                        loadingStateRef.current = {
                          ...loadingStateRef.current,
                          isTyping: true,
                          isBusy: false
                        };
                      }
                      
                      // Scroll to bottom to show new content
                      scrollToBottom();
                    }
                  } catch (error) {
                    console.error('Error parsing data part:', match, error);
                  }
                }
              }
            } else if (chunk.includes('[DONE]')) {
              // Handle completion marker
              console.log('Received [DONE] marker');
              setIsTyping(false);
              setLoading(false);
              setBusy(false);
              loadingStateRef.current = {
                isLoading: false,
                isBusy: false,
                isTyping: false,
                typingContent: accumulatedContentRef.current
              };
              responseStreamRef.current = null;
            } else {
              // As a fallback, just append the raw chunk
              console.warn('Unexpected chunk format, using as raw content:', chunk);
              accumulatedContentRef.current += chunk;
              setTypingContent(accumulatedContentRef.current);
            }
          }
        } catch (error) {
          console.error('Error reading sample question response stream:', error);
          // Handle the error as appropriate
          handleStreamError();
        }
      } else {
        console.error('No response body received');
        handleStreamError();
      }
    })
    .catch(error => {
      console.error('Error fetching response for sample question:', error);
      handleStreamError();
    });
    
    // Log the question
    fetch('/api/log-question', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question }),
    }).catch(err => console.error('Error logging question:', err));
  };

  // Helper component for safely rendering markdown in all contexts
  const SafeMarkdown = ({ content, theme }: { content: string, theme: 'light' | 'dark' }) => {
    try {
      return (
        <ReactMarkdown
          // Only use remarkBreaks to avoid table parsing errors
          remarkPlugins={[remarkBreaks]}
          components={{
            code({node, inline, className, children, ...props}) {
              const match = /language-(\w+)/.exec(className || '');
              const syntaxStyle = theme === 'dark' ? syntaxDark : syntaxLight;
              
              if (inline) {
                return (
                  <code
                    className={className}
                    style={{
                      backgroundColor: theme === 'dark' ? '#2d2d2d' : '#f5f5f5',
                      color: theme === 'dark' ? '#d4d4d4' : '#333333',
                      padding: '0.1em 0.3em',
                      borderRadius: '3px',
                      fontSize: '0.85em',
                      fontFamily: 'monospace'
                    }}
                    {...props}
                  >
                    {children}
                  </code>
                );
              }
              
              return (
                <SyntaxHighlighter
                  language={(match && match[1]) || ''}
                  style={syntaxStyle as any}
                  PreTag="div"
                  customStyle={{
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    margin: '0.5rem 0',
                    padding: '0.6rem',
                    maxHeight: '400px',
                    overflowY: 'auto'
                  }}
                  {...props}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              );
            },
            p({node, children, ...props}) {
              return (
                <p style={{
                  marginTop: '0.75rem',
                  marginBottom: '0.75rem',
                  lineHeight: '1.6'
                }} {...props}>
                  {children}
                </p>
              );
            },
            ul({node, children, ...props}) {
              return (
                <ul style={{
                  paddingLeft: '1.5rem',
                  marginTop: '0.75rem',
                  marginBottom: '0.75rem'
                }} {...props}>
                  {children}
                </ul>
              );
            },
            ol({node, children, ...props}) {
              return (
                <ol style={{
                  paddingLeft: '1.5rem',
                  marginTop: '0.75rem',
                  marginBottom: '0.75rem'
                }} {...props}>
                  {children}
                </ol>
              );
            },
            li({node, children, ...props}) {
              return (
                <li style={{
                  marginBottom: '0.25rem'
                }} {...props}>
                  {children}
                </li>
              );
            },
            h1({node, children, ...props}) {
              return (
                <h1 style={{
                  fontSize: '1.8em',
                  marginTop: '1.5em',
                  marginBottom: '0.5em',
                  fontWeight: 600
                }} {...props}>
                  {children}
                </h1>
              );
            },
            h2({node, children, ...props}) {
              return (
                <h2 style={{
                  fontSize: '1.5em',
                  marginTop: '1.5em',
                  marginBottom: '0.5em',
                  fontWeight: 600
                }} {...props}>
                  {children}
                </h2>
              );
            },
            h3({node, children, ...props}) {
              return (
                <h3 style={{
                  fontSize: '1.3em',
                  marginTop: '1.5em',
                  marginBottom: '0.5em',
                  fontWeight: 600
                }} {...props}>
                  {children}
                </h3>
              );
            }
          }}
        >
          {/* Preprocess tables to avoid errors - replace any text between pipes with code blocks */}
          {content.replace(/^\s*(\|.*\|)\s*$/gm, '```\n$1\n```')}
        </ReactMarkdown>
      );
    } catch (error) {
      console.error('Error rendering markdown with SafeMarkdown:', error);
      
      // Fallback rendering with very safe approach
      return (
        <div style={{ whiteSpace: 'pre-wrap' }}>
          {content.split(/```([^`]+)```/).map((part, i) => {
            // Even indices are regular text, odd indices are code blocks
            if (i % 2 === 0) {
              // Regular text - handle line breaks properly
              return <p key={i} style={{ marginBottom: '0.75rem' }}>{part.split('\n\n').map((para, j) => (
                <span key={j}>
                  {para}
                  {j < part.split('\n\n').length - 1 && (
                    <Fragment>
                      <br /><br />
                    </Fragment>
                  )}
                </span>
              ))}</p>;
            } else {
              // Code block
              return (
                <pre key={i} style={{
                  backgroundColor: theme === 'dark' ? '#2d2d2d' : '#f5f5f5',
                  padding: '0.6rem',
                  borderRadius: '4px',
                  overflowX: 'auto',
                  margin: '0.5rem 0',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem'
                }}><code>{part}</code></pre>
              );
            }
          })}
        </div>
      );
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    console.log('handleInputChange called', 'New value:', e.target.value);
    setInput(e.target.value);
    
    // Auto-resize the textarea based on content
    if (textareaRef.current) {
      // Reset height momentarily to get the correct scrollHeight for the new content
      textareaRef.current.style.height = 'auto';
      // Set the height based on scrollHeight, with a maximum height
      const newHeight = Math.min(textareaRef.current.scrollHeight, 200);
      textareaRef.current.style.height = `${newHeight}px`;
      console.log('Adjusted textarea height to:', newHeight);
    }
  };

  // Add a direct test for Enter key behavior
  useEffect(() => {
    // Log when input state changes
    console.log('Input state changed to:', input);
  }, [input]);

  // Add a component mount event log
  useEffect(() => {
    console.log('ChatBox component mounted');
    
    // Test if we can detect Enter key in document keydown
    const documentKeyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        console.log('Document detected Enter key - target:', e.target, 'active element:', document.activeElement);
      }
    };
    
    document.addEventListener('keydown', documentKeyHandler);
    
    return () => {
      document.removeEventListener('keydown', documentKeyHandler);
      console.log('ChatBox component unmounted');
    };
  }, []);

  // Update the auth state effect
  useEffect(() => {
    // Only fetch if we have a definite auth state (not loading)
    if (status !== 'loading') {
      console.log('Auth state resolved, fetching repo context');
      fetchRepoContext();
    }
  }, [status, owner, repo]);

  // Add a retry effect for empty structures
  useEffect(() => {
    let retryTimeout: NodeJS.Timeout;
    
    if (repoContext && (!repoContext.structure || repoContext.structure.length === 0 || repoContext.structure.startsWith('Error:'))) {
      console.log('Repository structure is missing or has error, scheduling retry');
      retryTimeout = setTimeout(() => {
        console.log('Retrying repository structure fetch');
        fetchRepoContext();
      }, 2000); // Retry after 2 seconds
    }
    
    return () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [repoContext]);

  // Add a new useEffect to check if we need to re-fetch missing structure
  useEffect(() => {
    // If we already have repoContext but structure is empty, fetch it again
    if (repoContext && (!repoContext.structure || repoContext.structure.length === 0)) {
      console.log('Repository structure is empty, re-fetching');
      fetchRepoContext();
    }
  }, [repoContext]);

  // Add a new useEffect specifically for auto-scrolling on message or typing changes
  useEffect(() => {
    // Scroll whenever messages or typing content changes
    scrollToBottom();
  }, [messages, typingContent]);

  // Reset textarea height when input is empty
  useEffect(() => {
    if (input === '' && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current);
        streamIntervalRef.current = null;
      }
      
      // Clean up typing animation
      if (typingRef.current) {
        clearTimeout(typingRef.current);
        typingRef.current = null;
      }
    };
  }, []);

  // Add a function to simulate typing effect
  const simulateTyping = (fullMessage: string) => {
    setIsTyping(true);
    setTypingMessage('');
    let index = 0;
    
    const typeCharacter = () => {
      if (index < fullMessage.length) {
        setTypingMessage(prev => prev + fullMessage.charAt(index));
        index++;
        typingRef.current = setTimeout(typeCharacter, typingSpeed);
      } else {
        setIsTyping(false);
        if (typingRef.current) {
          clearTimeout(typingRef.current);
          typingRef.current = null;
        }
      }
    };
    
    typeCharacter();
  };

  // Add this effect to scroll to bottom during typing animation
  useEffect(() => {
    if (isTyping) {
      scrollToBottom();
    }
  }, [typingMessage, isTyping]);

  // Add cleanup effect for the refs
  useEffect(() => {
    return () => {
      accumulatedContentRef.current = '';
      messageAddedRef.current = false;
    };
  }, []);

  // Add cleanup effect for the response stream
  useEffect(() => {
    return () => {
      if (responseStreamRef.current) {
        responseStreamRef.current.cancel();
        responseStreamRef.current = null;
      }
    };
  }, []);

  // Update loading state change to notify parent
  useEffect(() => {
    // Notify parent of loading state changes
    onLoadingChange?.(loading || isTyping);
  }, [loading, isTyping, onLoadingChange]);

  // Add a more aggressive global keyboard handler
  useEffect(() => {
    console.log('Setting up aggressive global keyboard handler');
    
    const globalKeyHandler = (e: KeyboardEvent) => {
      console.log('Global keydown event:', e.key, 'Active element:', document.activeElement, 'Target:', e.target);
      
      // Check if the active element is our textarea
      if (textareaRef.current && 
          (e.target === textareaRef.current || document.activeElement === textareaRef.current)) {
        
        console.log('Our textarea is the active element/target');
        
        if (e.key === 'Enter' && !e.shiftKey) {
          console.log('GLOBAL HANDLER: Enter key detected in our textarea without shift');
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          console.log('GLOBAL HANDLER: All event propagation prevented');
          
          if (input.trim() && !busy && !isTyping) {
            console.log('GLOBAL HANDLER: Creating synthetic submit event');
            window.setTimeout(() => {
              console.log('GLOBAL HANDLER: Executing delayed submit');
              const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
              handleSubmit(fakeEvent);
            }, 10);
          }
          
          return false;
        }
      }
    };
    
    // Add with capture to get it first
    document.addEventListener('keydown', globalKeyHandler, true);
    
    return () => {
      document.removeEventListener('keydown', globalKeyHandler, true);
    };
  }, [input, busy, isTyping, handleSubmit]);

  // Auto-scroll to the latest message when messages change or content is updated
  useEffect(() => {
    // Scroll to bottom whenever messages change or typing occurs
    scrollToBottom();
  }, [messages, typingContent]);

  // Add function to stop response streaming
  const stopResponseStream = () => {
    console.log('Stopping response stream');
    
    // Close the response stream if it exists
    if (responseStreamRef.current) {
      console.log('Closing response stream');
      responseStreamRef.current.cancel();
      responseStreamRef.current = null;
    }
    
    // Reset loading states
    setLoading(false);
    setBusy(false);
    setIsTyping(false);
    
    // Update the loading state ref
    loadingStateRef.current = {
      isLoading: false,
      isBusy: false,
      isTyping: false,
      typingContent: ''
    };
    
    // Notify parent component if callback exists
    if (onLoadingChange) {
      onLoadingChange(false);
    }
    
    // Add the message if we have content but haven't added the message yet
    if (!messageAddedRef.current && accumulatedContentRef.current) {
      const selectedFileNames = selectedFilesForContext.map(file => file.path);
      const filesContextNote = selectedFileNames.length > 0 
        ? `\n\n---\n**Files analyzed:** ${selectedFileNames.join(', ')}`
        : '';
        
      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: accumulatedContentRef.current + filesContextNote + "\n\n[Response stopped by user]",
        timestamp: Date.now(),
        selectedFiles: selectedFileNames.length > 0 ? selectedFileNames : undefined
      };
      
      console.log('Adding assistant message after stream completion:', assistantMessage);
      
      if (onAddMessage) {
        onAddMessage(assistantMessage);
      } else {
        setLocalMessages(prev => [...prev, assistantMessage]);
      }
      
      messageAddedRef.current = true;
    }
  };

  // Add new function to handle repository upload
//   const uploadRepositoryContents = async () => {
//     if (!isAuthenticated) {
//       // Prompt user to sign in
//       signIn('github');
//       return;
//     }
    
//     try {
//       setIsUploading(true);
//       setUploadProgress(0);
      
//       // Initialize Octokit with authentication token
//       const octokit = new Octokit({
//         auth: session?.accessToken,
//       });
      
//       // Get repo details to verify access
//       const repoResponse = await octokit.repos.get({
//         owner,
//         repo,
//       });
      
//       // Get the default branch
//       const defaultBranch = repoResponse.data.default_branch;
      
//       // Get the latest commit SHA
//       const { data: refData } = await octokit.git.getRef({
//         owner,
//         repo,
//         ref: `heads/${defaultBranch}`,
//       });
      
//       const latestCommitSha = refData.object.sha;
      
//       // Get the full directory tree
//       const { data: treeData } = await octokit.git.getTree({
//         owner,
//         repo,
//         tree_sha: latestCommitSha,
//         recursive: '1'
//       });
      
//       // Only process files (not directories) and exclude large binary files
//       const filesToUpload = treeData.tree.filter(item => 
//         item.type === 'blob' && 
//         item.path.match(/\.(md|txt|js|jsx|ts|tsx|json|css|scss|html|py|rb|java|c|cpp|h|php|go|rs|swift|kt)$/i)
//       );
      
//       // Prepare the repository data object
//       const repoData = {
//         owner,
//         repo,
//         branch: defaultBranch,
//         files: {}
//       };
      
//       // Add initial message about starting the upload
//       const initiatingMessage: Message = {
//         id: generateId(),
//         role: 'assistant',
//         content: `Starting repository upload for ${owner}/${repo}. The files will be stored in \`User Repos/${owner}/${repo}\` folder with a metadata file containing the directory structure. A zip file will also be created and sent to the external API.`,
//         timestamp: Date.now(),
//       };
      
//       addMessage(initiatingMessage);
      
//       // Load content for each file
//       for (let i = 0; i < filesToUpload.length; i++) {
//         const file = filesToUpload[i];
//         setUploadProgress(Math.floor((i / filesToUpload.length) * 100));
        
//         try {
//           const { data: fileData } = await octokit.git.getBlob({
//             owner,
//             repo,
//             file_sha: file.sha || '',
//           });
          
//           // Decode base64 content
//           const content = fileData.encoding === 'base64' 
//             ? atob(fileData.content) 
//             : fileData.content;
            
//           repoData.files[file.path] = content;
//         } catch (error) {
//           console.error(`Error fetching file ${file.path}:`, error);
//           // Continue with other files even if one fails
//         }
//       }
      
//       // Upload the entire repository data to the backend
//       const response = await fetch('/api/upload-repository', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify(repoData),
//       });
      
//       if (!response.ok) {
//         throw new Error(`Server responded with ${response.status}`);
//       }
      
//       // Get response data
//       const responseData = await response.json();
      
//       // Add system message confirming upload with detailed information
//       const systemMessage: Message = {
//         id: generateId(),
//         role: 'assistant',
//         content: `✅ Repository contents for ${owner}/${repo} have been uploaded successfully.

// **Storage Location:**
// - Folder: \`User Repos/${owner}/${repo}\`
// - Contains: All repository files and a metadata.json file
// - Metadata: Includes directory structure and file information
// - Zip File: \`${responseData.zipFile}\` has been created (using underscore instead of slash)

// ${responseData.apiUploadStatus ? `**API Upload Status:** ${responseData.apiUploadStatus}` : '**API Upload:** The zip file has been sent to the external API endpoint.'}

// The repository data is now organized by username and repository name, making it easier to navigate and analyze. 

// **Note:** The zip filename uses underscores (${owner}_${repo}.zip) instead of slashes to be compatible with file systems. The original path (${owner}/${repo}) is preserved in the metadata and API request.`,
//         timestamp: Date.now(),
//       };
      
//       addMessage(systemMessage);
//       // setShowAdvancedOptions(false);
      
//     } catch (error) {
//       console.error('Error uploading repository:', error);
      
//       // Add error message to chat
//       const errorMessage: Message = {
//         id: generateId(),
//         role: 'assistant',
//         content: `Failed to upload repository contents: ${error.message}. Please try again later.`,
//         timestamp: Date.now(),
//       };
      
//       addMessage(errorMessage);
//     } finally {
//       setIsUploading(false);
//       setUploadProgress(100);
//       // Reset progress after showing 100% complete
//       setTimeout(() => setUploadProgress(0), 1000);
//     }
//   };

  // Define a helper function to add messages
  const addMessage = (message: Message) => {
    console.log('Adding message', message.id)
    debugLog('Adding message with ID:', message.id)
    
    // Save the message using the provided callback or update local state
    if (onAddMessage) {
      onAddMessage(message)
    } else {
      setLocalMessages(prev => [...prev, message])
    }
    
    // Save the message to the persistent storage
    try {
      debugLog('Saving message to persistent storage', message.id, owner, repo, provider);
      console.log('Saving message to persistent storage', message.id, owner, repo, provider);
      const userEmail = session?.user?.email
      
      // Debug log
      debugLog('Chat message save details:', {
        messageId: message.id,
        owner,
        repo,
        provider,
        userEmail: userEmail || 'anonymous',
        contentLength: message.content.length
      });

      // Save to the new messaging system first
      saveMessage(
        message,
        owner,
        repo,
        provider || 'github',
        userEmail
      ).then(success => {
        if (success) {
          console.log('Message saved to new schema successfully');
        } else {
          console.warn('Failed to save to new schema, falling back to old methods');
          
          // Try the server-side direct-save endpoint as fallback
          fetch('/api/direct-save', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              message,
              owner,
              repo,
              provider,
              anonymousId: localStorage.getItem('anonymous_user_id'),
              conversationId: localStorage.getItem(`chat_conversation_${owner}_${repo}`)
            })
          })
          .then(response => response.json())
          .then(data => {
            if (data.success) {
              debugLog('Message saved successfully via direct-save API')
            } else {
              debugLog('Direct-save API failed, falling back to client-side methods:', data.error)
              
              // Fall back to old persistence system
              savePersistentMessage(
                message, 
                owner, 
                repo, 
                provider, 
                userEmail
              ).then(success => {
                if (success) {
                  console.log('Message saved to old persistent storage successfully')
                } else {
                  console.error('Failed to save message to all storage options')
                  
                  // Debug: Add error output element to the page for debugging
                  if (typeof document !== 'undefined') {
                    const debugDiv = document.createElement('div');
                    debugDiv.style.position = 'fixed';
                    debugDiv.style.bottom = '10px';
                    debugDiv.style.right = '10px';
                    debugDiv.style.backgroundColor = 'rgba(255,0,0,0.8)';
                    debugDiv.style.color = 'white';
                    debugDiv.style.padding = '10px';
                    debugDiv.style.zIndex = '9999';
                    debugDiv.style.maxWidth = '400px';
                    debugDiv.style.maxHeight = '200px';
                    debugDiv.style.overflow = 'auto';
                    debugDiv.textContent = 'Database Error: Check console for details';
                    document.body.appendChild(debugDiv);
                    
                    // Auto-remove after 10 seconds
                    setTimeout(() => {
                      document.body.removeChild(debugDiv);
                    }, 10000);
                  }
                }
              }).catch(error => {
                console.error('Error saving message to old persistent storage:', error)
              })
            }
          })
          .catch(error => {
            console.error('Error calling direct-save API:', error)
          })
        }
      }).catch(error => {
        console.error('Error saving message to new schema:', error)
      })
    } catch (error) {
      console.error('Error in message persistence:', error)
    }
  };

  // Load chat messages from the database when the component is mounted
  useEffect(() => {
    const loadChatMessages = async () => {
      if (!owner || !repo) {
        console.log('No owner or repo provided');
        return;
      }
      
      // Don't reload if messages have already been loaded
      if (messagesLoaded) {
        console.log('Messages already loaded, skipping reload');
        return;
      }
      
      // Don't load if there are already messages in the state
      if (messages.length > 0) {
        console.log('Messages already in state, skipping load');
        setMessagesLoaded(true);
        return;
      }
      
      try {
        console.log('Loading chat messages for', owner, repo, 'with provider', provider || 'github');
        console.log('Current session state:', {
          status,
          hasSession: !!session,
          userEmail: session?.user?.email || 'none'
        });
        
        const userEmail = session?.user?.email;

        // First, try to load from new schema
        console.log('Attempting to load messages from new schema...');
        let newSchemaMessages = await getMessages(owner, repo, provider || 'github', userEmail);
        console.log('New schema messages result:', {
          success: !!newSchemaMessages,
          count: newSchemaMessages?.length || 0
        });
        
        let loaded = false;
        
        if (newSchemaMessages.length > 0) {
          console.log(`Loaded ${newSchemaMessages.length} messages from new schema`);
          
          // Convert messages to the Message format used by the component
          const loadedMessages = newSchemaMessages.map(dbMsg => ({
            id: dbMsg.id,
            role: dbMsg.role,
            content: dbMsg.content,
            timestamp: dbMsg.timestamp,
            selectedFiles: dbMsg.selectedFiles
          }));
          
          console.log('Processed messages from DB:', {
            count: loadedMessages.length,
            firstMessage: loadedMessages.length > 0 ? {
              id: loadedMessages[0].id.substring(0, 8) + '...',
              role: loadedMessages[0].role,
              contentPreview: loadedMessages[0].content.substring(0, 30) + '...'
            } : 'none'
          });
          
          // Set messages based on whether we're using external or local state
          if (onAddMessage) {
            // For external state management, add each message
            console.log('Using external state management to add messages');
            loadedMessages.forEach(msg => onAddMessage(msg));
          } else {
            // For local state management
            console.log('Using local state management to set messages');
            setLocalMessages(loadedMessages);
          }
          
          loaded = true;
        }

        // If no messages from new schema, try old storage systems
        if (!loaded) {
          console.log('No messages in new schema, checking old storage...');
          
          // Try to sync any pending messages first
          await syncPendingMessages(userEmail);
          
          // Try to get from persistent_chats
          let persistentMessages = await getPersistentMessages(owner, repo, userEmail);
          
          if (persistentMessages.length > 0) {
            console.log(`Loaded ${persistentMessages.length} messages from persistent storage`);
            
            // Convert messages to the Message format used by the component
            const loadedMessages = persistentMessages.map(dbMsg => ({
              id: dbMsg.id,
              role: dbMsg.role,
              content: dbMsg.content,
              timestamp: dbMsg.timestamp,
              selectedFiles: dbMsg.selectedFiles
            }));
            
            // Set messages based on whether we're using external or local state
            if (onAddMessage) {
              // For external state management, add each message
              loadedMessages.forEach(msg => onAddMessage(msg));
            } else {
              // For local state management
              setLocalMessages(loadedMessages);
            }
            
            loaded = true;
            
            // Migrate messages to the new schema
            console.log('Migrating messages to new schema...');
            try {
              const migrationResult = await migrateMessages(owner, repo, provider || 'github', userEmail);
              console.log('Migration result:', migrationResult);
            } catch (migrationError) {
              console.error('Error migrating messages:', migrationError);
            }
          } 
          
          // If still no messages, try from chat_messages table
          if (!loaded) {
            // Try to load from the old system for backward compatibility
            const dbMessages = await getChatMessages(owner, repo, userEmail);
            
            if (dbMessages.length > 0) {
              console.log(`Loaded ${dbMessages.length} messages from legacy storage`);
              
              // Convert DB messages to the Message format used by the component
              const loadedMessages = dbMessages.map(dbMsg => ({
                id: dbMsg.id,
                role: dbMsg.role,
                content: dbMsg.content,
                timestamp: dbMsg.timestamp,
                selectedFiles: dbMsg.selectedFiles
              }));
              
              // Set messages based on whether we're using external or local state
              if (onAddMessage) {
                // For external state management, add each message
                loadedMessages.forEach(msg => onAddMessage(msg));
              } else {
                // For local state management
                setLocalMessages(loadedMessages);
              }
              
              loaded = true;
              
              // Migrate messages to the new schema
              console.log('Migrating messages from legacy storage to new schema...');
              try {
                const migrationResult = await migrateMessages(owner, repo, provider || 'github', userEmail);
                console.log('Migration result:', migrationResult);
              } catch (migrationError) {
                console.error('Error migrating messages:', migrationError);
              }
            }
          }
        }
        
        if (!loaded) {
          console.log('No chat messages found in any storage system');
        } else {
          console.log('Successfully loaded messages, setting messagesLoaded to true');
        }
      } catch (error) {
        console.error('Error loading chat messages:', error);
        console.error('Error details:', error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : 'Unknown error type');
      } finally {
        setMessagesLoaded(true);
      }
    };
    
    // Only load messages when session is loaded (not loading)
    if (status !== 'loading') {
      loadChatMessages();
    }
  }, [owner, repo, provider, session, status, messagesLoaded, onAddMessage, messages.length]);

  // Ensure we scroll to bottom after messages are loaded
  useEffect(() => {
    if (messagesLoaded && messages.length > 0) {
      // Use setTimeout to ensure the DOM has updated
      setTimeout(scrollToBottom, 100);
    }
  }, [messagesLoaded, messages.length]);

  // Add a clearChatHistory function that will be called when the Clear Chat button is clicked
  const handleClearChat = async () => {
    if (!owner || !repo) return;
    
    if (window.confirm('Are you sure you want to clear all chat messages? This cannot be undone.')) {
      try {
        setLoading(true);
        
        // Call the API to clear chat history from both storage systems
        const userEmail = session?.user?.email;
        
        // Clear from new storage system first
        const newSuccess = await clearConversationV2(owner, repo, provider || 'github', userEmail);
        console.log('New schema clear result:', newSuccess);
        
        // Clear from old storage systems for backward compatibility
        const oldSuccess = await clearConversation(owner, repo, userEmail);
        const legacySuccess = await clearChatHistory(owner, repo, userEmail);
        console.log('Old storage clear results:', { oldSuccess, legacySuccess });
        
        if (newSuccess || oldSuccess || legacySuccess) {
          // Clear messages from state
          if (onAddMessage) {
            // For external state, we need a way to clear messages
            // This depends on how the parent component manages messages
          } else {
            // For local state
            setLocalMessages([]);
          }
          console.log('Chat history cleared successfully');
        } else {
          console.error('Failed to clear chat history');
          setError('Failed to clear chat history');
        }
      } catch (error) {
        console.error('Error clearing chat history:', error);
        setError('An error occurred while clearing chat history');
      } finally {
        setLoading(false);
      }
    }
  };

  // When selectedFilesForContext changes, update the repoContext
  useEffect(() => {
    if (selectedFilesForContext?.length > 0) {
      // Add selected files to taggedFiles in repoContext
      const updatedTaggedFiles = { ...repoContext.taggedFiles };
      selectedFilesForContext.forEach(file => {
        updatedTaggedFiles[file.path] = file.content;
      });

      // Create a new repoContext object with updated taggedFiles
      const updatedRepoContext = {
        ...repoContext,
        taggedFiles: updatedTaggedFiles
      };

      // Update the repoContext state
      if (onSetRepoContext) {
        onSetRepoContext(updatedRepoContext);
      } else {
        setLocalRepoContext(updatedRepoContext);
      }
    }
  }, [selectedFilesForContext]);
  
  // Reset messagesLoaded when owner or repo changes to force reloading messages
  useEffect(() => {
    console.log('Owner or repo changed, resetting messagesLoaded state');
    setMessagesLoaded(false);
    setLocalMessages([]);
  }, [owner, repo, provider]);

  // Redesigned chat UI rendering
  return (
    <div className={styles.container} style={{ 
      backgroundColor: theme === 'dark' ? '#1a1a1a' : '#f8f9fa',
      color: theme === 'dark' ? '#e0e0e0' : '#333333',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Chat header with clear button */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 16px',
        borderBottom: `1px solid ${theme === 'dark' ? '#333' : '#e5e5e5'}`
      }}>
        <div style={{ fontWeight: 500 }}>Repository Assistant</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {/* Clear chat button */}
          <button
            onClick={handleClearChat}
            disabled={messages.length === 0 || loading}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: messages.length === 0 || loading ? 'not-allowed' : 'pointer',
              opacity: messages.length === 0 || loading ? 0.5 : 1,
              color: theme === 'dark' ? '#aaa' : '#666'
            }}
            title="Clear chat history"
          >
            <FaTrash size={14} />
          </button>
          
          {/* Maximize button if provided */}
          {onMaximizeClick && (
            <button
              onClick={onMaximizeClick}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: theme === 'dark' ? '#aaa' : '#666'
              }}
              title={isMaximized ? "Minimize chat" : "Maximize chat"}
            >
              {isMaximized ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 14 10 14 10 20"></polyline>
                  <polyline points="20 10 14 10 14 4"></polyline>
                  <line x1="14" y1="10" x2="21" y2="3"></line>
                  <line x1="3" y1="21" x2="10" y2="14"></line>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <polyline points="9 21 3 21 3 15"></polyline>
                  <line x1="21" y1="3" x2="14" y2="10"></line>
                  <line x1="3" y1="21" x2="10" y2="14"></line>
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
      
      {/* Rest of the existing code... */}
      <div 
        ref={chatContainerRef}
        className={styles.messagesContainer} 
        style={{ 
          flex: 1, 
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
        onScroll={handleScroll}
      >
        {messages.length === 0 ? (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: '100%',
            color: theme === 'dark' ? '#888888' : '#777777',
            textAlign: 'center',
            padding: '1rem'
          }}>
            {session ? (
              <>
                <div style={{ 
                  fontSize: '0.95rem', 
                  marginBottom: '12px',
                  fontWeight: 500
                }}>
                  Chat with Reas about this repository
                </div>
                <div style={{ 
                  fontSize: '0.8rem', 
                  maxWidth: '400px', 
                  opacity: 0.8,
                  marginBottom: '20px'
                }}>
                  I can explain code, suggest improvements, or help you understand how this project works.
                </div>
                
                {/* Center sample questions */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  maxWidth: '600px'
                }}>
                  <div style={{
                    fontSize: '0.85rem',
                    color: theme === 'dark' ? '#aaa' : '#666',
                    marginBottom: '4px'
                  }}>
                    Try asking:
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '8px',
                    width: '100%'
                  }}>
                    {sampleQuestions.map((question, index) => (
                      <button
                        key={index}
                        onClick={() => handleSampleQuestionClick(question)}
                        style={{
                          padding: '10px 15px',
                          backgroundColor: theme === 'dark' ? '#2d2d2d' : '#f0f0f0',
                          border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          textAlign: 'left',
                          width: '100%',
                          color: theme === 'dark' ? '#e0e0e0' : '#333',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          minHeight: '50px'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.backgroundColor = theme === 'dark' ? '#3d3d3d' : '#e8e8e8';
                          e.currentTarget.style.borderColor = theme === 'dark' ? '#555' : '#ccc';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.backgroundColor = theme === 'dark' ? '#2d2d2d' : '#f0f0f0';
                          e.currentTarget.style.borderColor = theme === 'dark' ? '#444' : '#ddd';
                        }}
                      >
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: theme === 'dark' ? '#444' : '#e0e0e0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          color: theme === 'dark' ? '#ccc' : '#666',
                          flexShrink: 0
                        }}>
                          {index + 1}
                        </div>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{question}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              // Single sign-in message for unauthenticated users
              <div style={{
                backgroundColor: theme === 'dark' ? '#252525' : '#fff',
                borderRadius: '8px',
                padding: '24px',
                textAlign: 'center',
                boxShadow: theme === 'dark' ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
                maxWidth: '400px',
                width: '100%'
              }}>
                <FaGithub size={40} style={{ 
                  marginBottom: '16px', 
                  color: theme === 'dark' ? '#e0e0e0' : '#333' 
                }} />
                <div style={{ 
                  fontWeight: '600', 
                  marginBottom: '12px', 
                  fontSize: '1.1rem',
                  color: theme === 'dark' ? '#e0e0e0' : '#333' 
                }}>
                  Sign in to chat
                </div>
                <div style={{ 
                  marginBottom: '20px', 
                  fontSize: '0.9rem', 
                  color: theme === 'dark' ? '#aaa' : '#666'
                }}>
                  Sign in with GitHub to chat about this repository and get AI-powered explanations of the code.
                </div>
                <button
                  onClick={() => signIn('github')}
                  style={{
                    backgroundColor: theme === 'dark' ? '#333' : '#2d333b',
                    color: theme === 'dark' ? '#e0e0e0' : 'white',
                    border: 'none',
                    padding: '12px 20px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    width: '100%',
                    fontWeight: '500',
                    fontSize: '0.9rem',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = theme === 'dark' ? '#444' : '#24292f';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = theme === 'dark' ? '#333' : '#2d333b';
                  }}
                >
                  <FaGithub size={18} />
                  Sign in with GitHub
                </button>
              </div>
            )}
          </div>
        ) : (
          messages.map((message) => {
            // Extract content without the "Files used for context" part for user messages
            const displayContent = message.role === 'user' 
              ? message.content.split('\n\n[Files used for context')[0]
              : message.content;
              
            return (
              <div 
                key={message.id} 
                className={`${styles.messageCard} ${message.role === 'user' ? styles.userMessage : styles.assistantMessage}`}
                style={{ 
                  display: 'flex',
                  flexDirection: 'column',
                  width: '100%',
                  maxWidth: message.role === 'user' ? '80%' : '95%',
                  alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                  borderLeft: message.role === 'assistant' ? `2px solid ${theme === 'dark' ? '#333' : '#e0e0e0'}` : 'none',
                  borderRadius: message.role === 'user' ? '4px' : '0',
                  marginBottom: '4px',
                  backgroundColor: message.role === 'user' 
                    ? (theme === 'dark' ? 'rgba(60, 60, 70, 0.2)' : 'rgba(240, 242, 245, 0.7)') 
                    : 'transparent',
                  padding: message.role === 'user' ? '10px 14px' : '0 0 0 14px'
                }}
              >
                {message.selectedFiles && message.selectedFiles.length > 0 && (
                  <div style={{
                    fontSize: '0.65rem',
                    opacity: 0.7,
                    marginBottom: '4px',
                    color: theme === 'dark' ? '#aaa' : '#777'
                  }}>
                    {message.selectedFiles.map(file => file.split('/').pop()).join(', ')}
                  </div>
                )}
                
                <div style={{
                  fontSize: '0.85rem',
                  lineHeight: '1.5',
                  color: theme === 'dark' 
                    ? (message.role === 'user' ? '#e6e6e6' : '#d4d4d4') 
                    : (message.role === 'user' ? '#222' : '#333')
                }}>
                  {message.role === 'assistant' ? (
                    <div className={styles.proseContent}>
                      <SafeMarkdown content={displayContent} theme={theme} />
                    </div>
                  ) : (
                    <div style={{ whiteSpace: 'pre-wrap' }}>
                      {displayContent}
                    </div>
                  )}
                </div>
                
                <div style={{
                  fontSize: '0.65rem',
                  color: theme === 'dark' ? '#555555' : '#aaaaaa',
                  alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                  marginTop: '6px'
                }}>
                  {new Date(message.timestamp).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})}
                </div>
              </div>
            );
          })
        )}
        
        {/* Typing message with no background */}
        {isTyping && (
          <div 
            style={{ 
              display: 'flex',
              flexDirection: 'column',
              alignSelf: 'flex-start',
              maxWidth: '95%',
              borderLeft: `2px solid ${theme === 'dark' ? '#333' : '#e0e0e0'}`,
              padding: '0 0 0 14px',
              marginBottom: '4px'
            }}
          >
            <div style={{
              fontSize: '0.85rem',
              lineHeight: '1.5',
              color: theme === 'dark' ? '#d4d4d4' : '#333'
            }}>
              <div className={styles.proseContent}>
                <SafeMarkdown content={typingContent} theme={theme} />
              </div>
            </div>
          </div>
        )}
        
        {/* Loading indicator with more prominent design */}
        {busy && !isTyping && (
          <div 
            style={{ 
              display: 'flex',
              alignItems: 'center',
              alignSelf: 'flex-start',
              padding: '8px 14px',
              borderLeft: `2px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
              borderRadius: '4px',
              backgroundColor: theme === 'dark' ? '#222' : '#f5f5f5',
              margin: '4px 0',
              gap: '8px'
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <div style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: theme === 'dark' ? '#888' : '#999',
                animation: 'bounceLoader 1.4s infinite ease-in-out'
              }}></div>
              <div style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: theme === 'dark' ? '#888' : '#999',
                animation: 'bounceLoader 1.4s infinite ease-in-out',
                animationDelay: '0.2s'
              }}></div>
              <div style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: theme === 'dark' ? '#888' : '#999',
                animation: 'bounceLoader 1.4s infinite ease-in-out',
                animationDelay: '0.4s'
              }}></div>
            </div>
            <span style={{
              fontSize: '0.8rem',
              color: theme === 'dark' ? '#aaa' : '#777',
              animation: 'fadeInOut 2s infinite'
            }}>
              Generating response...
            </span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Redesigned input area */}
      <div style={{
        padding: '16px',
        backgroundColor: theme === 'dark' ? '#1a1a1a' : '#f8f9fa',
        borderTop: `1px solid ${theme === 'dark' ? '#333' : '#e5e5e5'}`
      }}>
        {session ? (
          <>
            {/* Advanced Chat Button */}
            {/* <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginBottom: '8px'
            }}>
              <button
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: theme === 'dark' ? '#252525' : '#f0f0f0',
                  color: theme === 'dark' ? '#bbb' : '#666',
                  border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
                  cursor: 'pointer'
                }}
              >
                Advanced Chat {showAdvancedOptions ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
              </button>
            </div> */}
            
            {/* Advanced Options Panel */}
            {/* {showAdvancedOptions && (
              <div style={{
                padding: '12px',
                marginBottom: '12px',
                backgroundColor: theme === 'dark' ? '#252525' : '#f5f5f5',
                borderRadius: '4px',
                border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`
              }}>
                <h4 style={{
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  marginBottom: '8px',
                  color: theme === 'dark' ? '#ddd' : '#444'
                }}>Advanced Options</h4>
                
                <button
                  onClick={uploadRepositoryContents}
                  disabled={isUploading || loading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    padding: '8px 12px',
                    gap: '8px',
                    backgroundColor: (isUploading || loading) 
                      ? (theme === 'dark' ? '#444' : '#ccc') 
                      : (theme === 'dark' ? '#2a4365' : '#4a6cf7'),
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                    cursor: (isUploading || loading) ? 'not-allowed' : 'pointer',
                    marginBottom: '8px'
                  }}
                >
                  <FaCloudUploadAlt size={16} />
                  {isUploading ? 'Uploading Repository...' : 'Upload Entire Repository'}
                </button>
                
                {isUploading && uploadProgress > 0 && (
                  <div style={{
                    width: '100%',
                    height: '6px',
                    backgroundColor: theme === 'dark' ? '#333' : '#e0e0e0',
                    borderRadius: '3px',
                    overflow: 'hidden',
                    marginBottom: '10px'
                  }}>
                    <div 
                      style={{
                        height: '100%',
                        backgroundColor: theme === 'dark' ? '#4a6cf7' : '#4a6cf7',
                        width: `${uploadProgress}%`,
                        transition: 'width 0.3s ease'
                      }}
                    ></div>
                  </div>
                )}
                
                <p style={{
                  fontSize: '0.75rem',
                  color: theme === 'dark' ? '#888' : '#777',
                  marginTop: '8px'
                }}>
                  This will upload the entire repository content to enable deeper analysis and context awareness.
                </p>
              </div>
            )} */}
            
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (input.trim() && !busy && !isTyping) {
                  handleSubmit(e);
                }
              }} 
              style={{ position: 'relative' }}
            >
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                {selectedFilesForContext && selectedFilesForContext.length > 0 && (
                  <div style={{
                    fontSize: '0.7rem',
                    color: theme === 'dark' ? '#888' : '#888',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    flexWrap: 'wrap',
                    padding: '4px 8px',
                    backgroundColor: theme === 'dark' ? '#222' : '#f0f0f0',
                    borderRadius: '4px',
                    marginBottom: '8px',
                    border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`
                  }}>
                    <span style={{ fontWeight: 'bold' }}>Files selected for context:</span>
                    {selectedFilesForContext.map((file, index) => (
                      <span key={file.path} style={{
                        backgroundColor: theme === 'dark' ? '#333' : '#e8e8e8',
                        color: theme === 'dark' ? '#bbb' : '#666',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '0.65rem',
                        border: `1px solid ${theme === 'dark' ? '#555' : '#ccc'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <FaFileCode size={10} />
                        {file.path.split('/').pop()}
                      </span>
                    ))}
                  </div>
                )}
                
                <div style={{
                  backgroundColor: theme === 'dark' ? '#252525' : '#fff',
                  borderRadius: '4px',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  boxShadow: theme === 'dark' ? 'none' : '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={handleInputChange}
                    placeholder="Ask about this repository..."
                    disabled={busy}
                    rows={1}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (input.trim() && !busy && !isTyping) {
                          handleSubmit(e);
                        }
                      }
                    }}
                    style={{
                      resize: 'none',
                      border: 'none',
                      outline: 'none',
                      backgroundColor: 'transparent',
                      color: theme === 'dark' ? '#e0e0e0' : '#333333',
                      fontSize: '0.85rem',
                      lineHeight: '1.5',
                      width: '100%',
                      padding: '8px 12px',
                      minHeight: '22px',
                      maxHeight: '150px'
                    }}
                  />
                  
                  {isTyping ? (
                    <button
                      type="button"
                      onClick={stopResponseStream}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: theme === 'dark' ? '#ff6b6b' : '#dc3545',
                        cursor: 'pointer'
                      }}
                      title="Stop generating"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={busy || !input.trim()}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: input.trim() && !busy 
                          ? (theme === 'dark' ? '#888' : '#4a6cf7') 
                          : (theme === 'dark' ? '#555' : '#ccc'),
                        cursor: input.trim() && !busy ? 'pointer' : 'default'
                      }}
                    >
                      <FaPaperPlane size={14} />
                    </button>
                  )}
                </div>
              </div>
            </form>
          </>
        ) : messages.length > 0 ? (
          // Only show a minimal sign-in reminder if there are messages already
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            color: theme === 'dark' ? '#888' : '#666',
            fontSize: '0.85rem',
            padding: '8px'
          }}>
            <FaGithub size={14} />
            <span>Please <button 
              onClick={() => signIn('github')} 
              style={{
                background: 'none',
                border: 'none',
                padding: '0',
                color: theme === 'dark' ? '#4dabf7' : '#0969da',
                fontWeight: '500',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >sign in</button> to chat</span>
          </div>
        ) : null /* No need for another sign-in message here if messages.length === 0 */}
      </div>
      
      {/* Scroll button */}
      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          style={{
            position: 'absolute',
            bottom: '80px',
            right: '16px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: theme === 'dark' ? 'rgba(40, 40, 40, 0.7)' : 'rgba(250, 250, 250, 0.9)',
            border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme === 'dark' ? '#ccc' : '#666',
            cursor: 'pointer',
            boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
            zIndex: 10
          }}
        >
          <FaArrowDown size={14} />
        </button>
      )}
      
      {/* Add animation keyframes */}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes blink {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }
        
        /* Enhanced animations for loading indicators */
        @keyframes bounceLoader {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.6; }
          40% { transform: scale(1.2); opacity: 1; }
        }
        
        @keyframes fadeInOut {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
} 

// Add database test on component mount