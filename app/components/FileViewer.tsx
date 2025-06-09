'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Octokit } from '@octokit/rest'
import { useSession, signIn } from 'next-auth/react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/cjs/styles/prism'
import { FaFile, FaGithub, FaLock, FaGitlab } from 'react-icons/fa'
import { getProvider } from '@/app/lib/providers/provider-factory'
import { MonacoEditorProps } from '@monaco-editor/react'

interface FileViewerProps {
  owner: string
  repo: string
  filePath: string | null
  provider?: 'github' | 'gitlab'
  theme?: 'light' | 'dark'
  className?: string
  onFileContentChange?: (content: string) => void
}

export default function FileViewer({ 
  owner, 
  repo, 
  filePath, 
  provider = 'github',
  theme = 'light', 
  className = '',
  onFileContentChange
}: FileViewerProps) {
  const { data: session } = useSession()
  const [content, setContent] = useState<string>('')
  const [fileLanguage, setFileLanguage] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')
  const [retryCount, setRetryCount] = useState(0)
  const editorRef = useRef<MonacoEditorProps>(null)
  const maxRetries = 3
  
  // Generate cache key for file content
  const cacheKey = useMemo(() => {
    return `${provider}-${owner}-${repo}-${filePath}`;
  }, [provider, owner, repo, filePath]);

  // Helper function to determine the language based on file extension
  const getLanguage = (filename: string) => {
    if (!filename) return 'text';
    
    const ext = filename.split('.').pop()?.toLowerCase();
    
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'rb': 'ruby',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'h': 'c',
      'hpp': 'cpp',
      'cs': 'csharp',
      'php': 'php',
      'go': 'go',
      'rs': 'rust',
      'swift': 'swift',
      'kt': 'kotlin',
      'md': 'markdown',
      'json': 'json',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'less': 'less',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'sh': 'bash',
      'bash': 'bash',
      'sql': 'sql'
    };
    
    return ext ? languageMap[ext] || ext : 'text'
  }

  // Function to detect the language from file extension
  const detectLanguage = (filePath: string, content: string) => {
    const language = getLanguage(filePath)
    setFileLanguage(language)
  }

  useEffect(() => {
    if (filePath) {
      fetchFileContent()
    }
  }, [filePath, owner, repo, provider, session])

  // Fetch file content from the API
  const fetchFileContent = async () => {
    // Prevent fetching if no path is provided
    if (!filePath) {
      setLoading(false);
      setError('No file path provided');
      return;
    }
    
    try {
      setLoading(true);
      console.log(`Fetching file: ${filePath} from ${provider} repo: ${owner}/${repo}`);
      
      // Check cache first
      const cachedContent = localStorage.getItem(cacheKey);
      if (cachedContent) {
        console.log(`Using cached content for ${filePath}`);
        setContent(cachedContent);
        detectLanguage(filePath, cachedContent);
        setLoading(false);
        return;
      }
      
      if (provider === 'gitlab') {
        try {
          // Use GitLab provider
          const gitLabProvider = getProvider('gitlab');
          const fileContent = await gitLabProvider.getFileContent(owner, repo, filePath);
          
          setContent(fileContent);
          localStorage.setItem(cacheKey, fileContent);
          detectLanguage(filePath, fileContent);
          
          if (onFileContentChange) {
            onFileContentChange(fileContent);
          }
          
          setRetryCount(0);
        } catch (err: any) {
          console.error('Error fetching GitLab file content:', err);
          
          if (!session && err.message?.includes('authentication')) {
            setError('This appears to be a private repository. Please sign in with GitLab if you are the owner or have access to this repository.');
          } else if (err.message?.includes('rate limit')) {
            setError('GitLab API rate limit exceeded. Please try again later or sign in with GitLab for higher rate limits.');
          } else if (err.response?.status === 404 || err.message?.includes('not found')) {
            console.log('File not found on GitLab, trying to fall back to GitHub...');
            
            // Try to fetch from GitHub instead
            try {
              // Check if there's a GitHub token available
              const githubToken = localStorage.getItem('github_token');
              
              // Initialize Octokit with or without authentication token
              const octokit = new Octokit({
                auth: githubToken || session?.accessToken || undefined,
              });

              const response = await octokit.repos.getContent({
                owner: owner,
                repo,
                path: filePath,
              });
              
              if ('content' in response.data) {
                const fileContent = atob(response.data.content);
                setContent(fileContent);
                localStorage.setItem(cacheKey, fileContent);
                detectLanguage(filePath, fileContent);
                
                if (onFileContentChange) {
                  onFileContentChange(fileContent);
                }
                
                // Clear error and retry count on success
                setError('');
                setRetryCount(0);
                console.log('Successfully fetched file content from GitHub as fallback');
                return;
              }
            } catch (githubErr: any) {
              console.error('Error fetching from GitHub fallback:', githubErr);
              // If GitHub fallback also fails, show the original GitLab error
              setError('File not found. Please check that the file path is correct.');
            }
          } else {
            setError(err.message || 'Failed to fetch file content');
          }
        }
      } else {
        // Default to GitHub (Octokit)
        try {
          // Check if there's a GitHub token available
          const githubToken = localStorage.getItem('github_token');
          
          // If we need GitHub but have no authentication, show clear message
          if (!githubToken && session?.provider !== 'github') {
            setError('You need to sign in with GitHub to access this file. Your current session does not have GitHub access.');
            setLoading(false);
            return;
          }
          
          // Initialize Octokit with the GitHub token (from localStorage if available)
          const octokit = new Octokit({
            auth: githubToken || session?.accessToken || undefined,
          });
          
          const response = await octokit.repos.getContent({
            owner: owner,
            repo,
            path: filePath,
          });
          
          if ('content' in response.data) {
            const fileContent = atob(response.data.content);
            setContent(fileContent);
            localStorage.setItem(cacheKey, fileContent);
            detectLanguage(filePath, fileContent);
            
            if (onFileContentChange) {
              onFileContentChange(fileContent);
            }
            
            setRetryCount(0);
          } else {
            throw new Error('Unexpected response format from GitHub API');
          }
        } catch (err: any) {
          console.error('Error fetching GitHub file content:', err);
          
          if (err.status === 401 || err.message?.includes('Bad credentials')) {
            setError('GitHub authentication failed. Please sign in with GitHub to access this file.');
          } else if (err.status === 403 && err.message?.includes('rate limit')) {
            setError('GitHub API rate limit exceeded. Please try again later or sign in with GitHub for higher rate limits.');
          } else if (err.status === 404) {
            setError('File not found. Please check that the file path is correct.');
          } else {
            setError(err.message || 'Failed to fetch file content');
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Save the file content
  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
  }

  if (!filePath) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100%', 
        color: theme === 'light' ? '#6B7280' : '#9CA3AF',
        width: '100%',
        backgroundColor: theme === 'light' ? 'white' : '#1E293B'
      }}>
        <div style={{ textAlign: 'center' }}>
          <FaFile style={{ 
            fontSize: '48px', 
            color: theme === 'light' ? '#9CA3AF' : '#4B5563',
            margin: '0 auto 16px' 
          }} />
          <p>Select a file to view its contents</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100%',
        width: '100%',
        backgroundColor: theme === 'light' ? 'white' : '#1E293B'
      }}>
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className={`flex justify-center items-center h-full p-4 text-red-500 dark:text-red-400 ${className}`}>
        <div className="max-w-md text-center">
          {error.includes('private repository') ? (
            <>
              <div className="mx-auto text-4xl mb-4 text-gray-400 dark:text-gray-500">🔒</div>
              <h3 className="text-lg font-semibold mb-2">Private Repository</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
              {!session && (
                <button
                  onClick={() => signIn(provider === 'gitlab' ? 'gitlab' : 'github')}
                  className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  {provider === 'gitlab' ? <FaGitlab className="mr-2" /> : <FaGithub className="mr-2" />}
                  Sign in with {provider === 'gitlab' ? 'GitLab' : 'GitHub'}
                </button>
              )}
            </>
          ) : error.includes('GitHub authentication') ? (
            <>
              <div className="mx-auto text-4xl mb-4 text-gray-400 dark:text-gray-500">🔑</div>
              <h3 className="text-lg font-semibold mb-2">GitHub Authentication Required</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
              <button
                onClick={() => signIn('github')}
                className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <FaGithub className="mr-2" />
                Sign in with GitHub
              </button>
            </>
          ) : (
            <div className="text-red-500">{error}</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`w-full h-full overflow-hidden bg-white dark:bg-gray-900 ${className}`}>
      {content && (
        <SyntaxHighlighter
          language={fileLanguage}
          style={theme === 'light' ? oneLight : vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: '1rem',
            borderRadius: 0,
            height: '100%',
            fontSize: '14px',
            backgroundColor: theme === 'light' ? 'white' : '#1E293B', 
            overflow: 'auto',
          }}
          showLineNumbers={true}
        >
          {content}
        </SyntaxHighlighter>
      )}
    </div>
  )
} 