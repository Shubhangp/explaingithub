'use client'

import { useState, useEffect } from 'react'
import { Octokit } from '@octokit/rest'
import { useSession, signIn } from 'next-auth/react'
import { FaFile, FaLock, FaGithub, FaGitlab } from 'react-icons/fa'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { getProvider } from '@/src/lib/providers/provider-factory'

interface FileViewerProps {
  owner: string
  repo: string
  filePath: string | null
  provider?: 'github' | 'gitlab'
}

export default function FileViewer({ owner, repo, filePath, provider = 'github' }: FileViewerProps) {
  const { data: session } = useSession()
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileType, setFileType] = useState('text')
  
  // Add a cache for file contents
  const [fileCache, setFileCache] = useState<Record<string, string>>({})

  useEffect(() => {
    const path = filePath || 'README.md' // Default to README.md if no file selected
    const fetchContent = async () => {
      setLoading(true)
      setError(null)

      try {
        // Check if we have this file cached already
        const cacheKey = `${provider}/${owner}/${repo}/${path}`;
        if (fileCache[cacheKey]) {
          console.log('Using cached file content for', cacheKey);
          setContent(fileCache[cacheKey]);
          setLoading(false);
          return;
        }
        
        let fileContent = '';
        
        if (provider === 'gitlab') {
          try {
            // Use GitLab provider
            const gitLabProvider = getProvider('gitlab');
            fileContent = await gitLabProvider.getFileContent(owner, repo, path);
          } catch (err: any) {
            if (!session && (err.message?.includes('token not found') || err.message?.includes('authentication failed'))) {
              setError('This appears to be a private repository. Please sign in with GitLab if you are the owner or have access to this repository.');
            } else if (!filePath) {
              fileContent = 'No README.md found in this repository.';
            } else {
              setError(err.message || 'Failed to fetch file content');
              console.error('Error fetching GitLab file:', err);
            }
            return;
          }
        } else {
          // Default to GitHub (Octokit)
          try {
            // Initialize Octokit with or without authentication token
            // Public repos can be accessed without authentication
            const octokit = new Octokit({
              auth: session?.accessToken || undefined,
            });

            const { data } = await octokit.repos.getContent({
              owner,
              repo,
              path,
            });

            if ('content' in data) {
              fileContent = atob(data.content);
            } else {
              setError('Unable to load file content');
              return;
            }
          } catch (err: any) {
            // Check for private repository errors (404/403) when not authenticated
            if (!session?.accessToken && err && 
                typeof err === 'object' && 
                'status' in err && 
                (err.status === 404 || err.status === 403)) {
              setError('This appears to be a private repository. Please sign in if you are the owner or have access to this repository.');
            } else if (!filePath) {
              fileContent = 'No README.md found in this repository.';
            } else {
              setError('Failed to fetch file content');
              console.error('Error fetching GitHub file:', err);
            }
            return;
          }
        }
        
        // Cache the file content
        setFileCache(prev => ({
          ...prev,
          [cacheKey]: fileContent
        }));
        
        setContent(fileContent);
      } finally {
        setLoading(false);
      }
    }

    fetchContent();
  }, [owner, repo, filePath, session, provider])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        {error.includes('private repository') || error.includes('token not found') ? (
          <div className="text-center max-w-md p-6">
            <FaLock className="mx-auto text-4xl mb-4 text-gray-400 dark:text-gray-500" />
            <h3 className="text-lg font-semibold mb-2">Private Repository</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            <button
              onClick={() => signIn(provider)}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded transition-colors mx-auto"
            >
              {provider === 'gitlab' ? (
                <FaGitlab className="text-lg" />
              ) : (
                <FaGithub className="text-lg" />
              )}
              Sign in with {provider === 'gitlab' ? 'GitLab' : 'GitHub'}
            </button>
          </div>
        ) : (
          <div className="text-red-500">{error}</div>
        )}
      </div>
    )
  }

  const currentFile = filePath || 'README.md'
  const isMarkdown = currentFile.toLowerCase().endsWith('.md')

  return (
    <div className="h-full">
      {/* File Header */}
      <div className="border-b border-gray-200 pb-4 mb-4">
        <h2 className="text-lg font-semibold">{currentFile}</h2>
      </div>

      {/* File Content */}
      <div className="p-4">
        {isMarkdown ? (
          <div className="prose dark:prose-invert max-w-none markdown-body">
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
                    <SyntaxHighlighter
                      // @ts-ignore - type mismatch in library
                      style={tomorrow}
                      language={match[1]}
                      PreTag="div"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  )
                }
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          <SyntaxHighlighter
            language={currentFile.split('.').pop() || 'text'}
            // @ts-ignore - type mismatch in library
            style={tomorrow}
            customStyle={{ background: 'transparent' }}
          >
            {content}
          </SyntaxHighlighter>
        )}
      </div>
    </div>
  )
} 