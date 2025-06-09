'use client'

import { useState, useEffect, useMemo } from 'react'
import { Octokit } from '@octokit/rest'
import { useSession, signIn } from 'next-auth/react'
import { 
  FaFolder, FaFile, FaChevronLeft, FaList, FaProjectDiagram, FaCheckSquare, 
  FaRegSquare, FaGithub, FaCode, FaMarkdown, FaImage, FaFileAlt, FaFileCode 
} from 'react-icons/fa'
import styles from './DirectoryViewer.module.css'
import { getProvider } from '@/app/lib/providers/provider-factory'
import { BaseGitProvider } from '@/app/lib/providers/base-provider'

interface DirectoryViewerProps {
  owner: string
  repo: string
  provider?: 'github' | 'gitlab'
  onFileSelect?: (path: string) => void
  onFilesForContextChange?: (selectedFiles: FileWithContent[]) => void
  theme?: 'light' | 'dark'
  viewMode?: 'list' | 'tree' | 'github'
}

interface FileItem {
  name: string
  path: string
  type: 'dir' | 'file'
  sha: string
}

interface TreeNode {
  name: string
  path: string
  type: 'dir' | 'file'
  sha: string
  children: TreeNode[]
  level: number
}

interface FileWithContent {
  path: string;
  content: string;
}

const sortItems = (items: FileItem[]) => {
  return [...items].sort((a, b) => {
    if (a.type === b.type) {
      return a.name.localeCompare(b.name)
    }
    return a.type === 'dir' ? -1 : 1
  })
}

const buildTreeFromFiles = (files: FileItem[]): TreeNode[] => {
  const rootNodes: TreeNode[] = [];
  const pathMap: Record<string, TreeNode> = {};
  
  // First sort files to ensure directories come first
  const sortedFiles = sortItems(files);
  
  sortedFiles.forEach(file => {
    const pathParts = file.path.split('/');
    const fileName = pathParts[pathParts.length - 1];
    const fullPath = file.path;
    
    // Create node for this file
    const node: TreeNode = {
      name: fileName,
      path: fullPath,
      type: file.type,
      sha: file.sha,
      children: [],
      level: pathParts.length - 1
    };
    
    // Add to pathMap for fast lookup
    pathMap[fullPath] = node;
    
    if (pathParts.length === 1) {
      // This is a root item
      rootNodes.push(node);
    } else {
      // This item has a parent
      const parentPath = pathParts.slice(0, -1).join('/');
      if (pathMap[parentPath]) {
        // Use a type assertion to tell TypeScript that pathMap[parentPath] is defined
        (pathMap[parentPath] as TreeNode).children.push(node);
      } else {
        console.warn(`Parent path ${parentPath} not found for ${fullPath}`);
      }
    }
  });
  
  // Sort each directory's children
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name);
      }
      return a.type === 'dir' ? -1 : 1;
    });
    
    nodes.forEach(node => {
      if (node.children.length > 0) {
        sortNodes(node.children);
      }
    });
  };
  
  sortNodes(rootNodes);
  return rootNodes;
};

export default function DirectoryViewer({ 
  owner, 
  repo, 
  provider = 'github',
  onFileSelect, 
  onFilesForContextChange, 
  theme = 'light', 
  viewMode = 'tree' 
}: DirectoryViewerProps) {
  const { data: session, status } = useSession()
  const [currentPath, setCurrentPath] = useState('')
  const [contents, setContents] = useState<FileItem[]>([])
  const [allFiles, setAllFiles] = useState<FileItem[]>([])
  const [treeData, setTreeData] = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [initialLoad, setInitialLoad] = useState(true)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [selectedFilesWithContent, setSelectedFilesWithContent] = useState<FileWithContent[]>([])
  const [retryCount, setRetryCount] = useState(0)
  const [internalViewMode, setViewMode] = useState<'list' | 'tree' | 'github'>(viewMode)
  const maxRetries = 3
  
  useEffect(() => {
    // Only fetch if we're not in the initial loading state or if we have a session
    if (!initialLoad || session) {
      if (internalViewMode === 'list' || internalViewMode === 'github') {
        fetchContents()
      } else {
        fetchTreeData()
      }
    }
    
    // After first mount, set initialLoad to false
    if (initialLoad && status !== 'loading') {
      setInitialLoad(false)
    }
  }, [owner, repo, currentPath, internalViewMode, session, status, initialLoad, provider])

  // Add retry logic for API failures that might be temporary
  useEffect(() => {
    let retryTimeout: NodeJS.Timeout | null = null;
    
    // If we have an error and haven't exceeded max retries, try again
    if (error && retryCount < maxRetries && 
        (error.includes('rate limit') || error.includes('network error'))) {
      retryTimeout = setTimeout(() => {
        console.log(`Retrying fetch (attempt ${retryCount + 1} of ${maxRetries})...`);
        setRetryCount(prevCount => prevCount + 1);
        
        if (internalViewMode === 'list' || internalViewMode === 'github') {
          fetchContents();
        } else {
          fetchTreeData();
        }
      }, 1000 * (retryCount + 1)); // Exponential backoff
    }
    
    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [error, retryCount, internalViewMode]);

  // Update internal viewMode when prop changes
  useEffect(() => {
    setViewMode(viewMode);
  }, [viewMode]);

  // Reset retry count when repository or path changes
  useEffect(() => {
    setRetryCount(0);
  }, [owner, repo, currentPath]);

  useEffect(() => {
    // Update the parent component with selected files and their content
    if (onFilesForContextChange) {
      onFilesForContextChange(selectedFilesWithContent)
    }
  }, [selectedFilesWithContent, onFilesForContextChange])

  useEffect(() => {
    fetchDataForProvider();
  }, [owner, repo, provider]);
  
  // Listen for provider settings updates and refresh data
  useEffect(() => {
    const handleProviderSettingsUpdate = () => {
      console.log('Provider settings updated, refreshing data');
      setLoading(true);
      setError(null);
      fetchDataForProvider();
    };
    
    window.addEventListener('provider-settings-updated', handleProviderSettingsUpdate);
    
    return () => {
      window.removeEventListener('provider-settings-updated', handleProviderSettingsUpdate);
    };
  }, []);
  
  // Reset loading and errors when provider changes
  useEffect(() => {
    setLoading(true);
    setError(null);
  }, [provider]);

  // Add the missing fetchDataForProvider function
  const fetchDataForProvider = () => {
    if (internalViewMode === 'list' || internalViewMode === 'github') {
      fetchContents();
    } else {
      fetchTreeData();
    }
  };

  const fetchContents = async () => {
    try {
      setLoading(true)
      setError('')

      if (provider === 'gitlab') {
        // Use the GitLab provider
        try {
          const gitLabProvider = getProvider('gitlab')
          const items = await gitLabProvider.getRepositoryContents(owner, repo, currentPath)
          setContents(items)
          setRetryCount(0)
        } catch (err: any) {
          console.error('Error fetching GitLab contents:', err)
          
          if (!session && err.message?.includes('token not found')) {
            setError('This appears to be a private repository. Please sign in with GitLab if you are the owner or have access to this repository.')
          } else if (err.message?.includes('rate limit')) {
            setError('GitLab API rate limit exceeded. Please try again later or sign in with GitLab for higher rate limits.')
          } else if (err.response?.status === 404 || err.message?.includes('not found')) {
            console.log('Repository or path not found on GitLab, trying to fall back to GitHub...');
            
            // Try to fetch from GitHub instead
            try {
              // Initialize Octokit with or without authentication token
              const octokit = new Octokit({
                auth: session?.accessToken || undefined,
              });

              const response = await octokit.repos.getContent({
                owner: owner,
                repo,
                path: currentPath,
              });

              const items = Array.isArray(response.data) ? response.data : [response.data];
              setContents(sortItems(items as FileItem[]));
              
              // Clear retry count on success and reset error
              setRetryCount(0);
              setError('');
              console.log('Successfully fetched content from GitHub as fallback');
              
              return; // Exit the function since we succeeded with GitHub
            } catch (githubErr: any) {
              console.error('Error fetching from GitHub fallback:', githubErr);
              // If GitHub fallback also fails, show the original GitLab error
              setError('Repository or path not found. Please check that the repository exists and the path is correct.');
            }
          } else {
            setError(err.message || 'Failed to fetch repository contents')
          }
        }
      } else {
        // Default to GitHub (Octokit)
        try {
          // Check if there's a GitHub token available
          const githubToken = localStorage.getItem('github_token');
          
          // If we need GitHub but have no authentication, show clear message
          if (!githubToken && session?.provider !== 'github') {
            setError('You need to sign in with GitHub to access this repository. Your current session does not have GitHub access.');
            setLoading(false);
            return;
          }
          
          // Initialize Octokit with the GitHub token (from localStorage if available)
          const octokit = new Octokit({
            auth: githubToken || session?.accessToken || undefined,
          })

          const response = await octokit.repos.getContent({
            owner: owner,
            repo,
            path: currentPath,
          })

          const items = Array.isArray(response.data) ? response.data : [response.data]
          setContents(sortItems(items as FileItem[]))
          // Clear retry count on success
          setRetryCount(0)
        } catch (err: any) {
          console.error('Error fetching GitHub contents:', err)
          
          // Only show login prompt for 401 errors (Unauthorized) as these definitively indicate a private repo
          // 403 can happen for rate limiting, 404 can be for non-existent repos or paths
          if (err.status === 401 || err.message?.includes('Bad credentials')) {
            setError('GitHub authentication failed. Please sign in with GitHub to access this repository.')
          } else if (err.status === 403 && err.message?.includes('rate limit')) {
            // Handle rate limiting separately
            setError('GitHub API rate limit exceeded. Please try again later or sign in with GitHub for higher rate limits.')
          } else if (err.status === 404) {
            setError('Repository or path not found. Please check that the repository exists and the path is correct.')
          } else {
            setError(err.message || 'Failed to fetch repository contents')
          }
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchTreeData = async () => {
    try {
      setLoading(true)
      setError('')

      if (provider === 'gitlab') {
        // Use the GitLab provider
        try {
          const gitLabProvider = getProvider('gitlab')
          const tree = await gitLabProvider.getRepositoryTree(owner, repo)
          
          // Extract a flat list of files from the tree for allFiles state
          const files = flattenTree(tree)
          setAllFiles(files)
          setTreeData(tree)
          setRetryCount(0)
        } catch (err: any) {
          console.error('Error fetching GitLab tree data:', err)
          
          if (!session && err.message?.includes('token not found')) {
            setError('This appears to be a private repository. Please sign in with GitLab if you are the owner or have access to this repository.')
          } else if (err.message?.includes('rate limit')) {
            setError('GitLab API rate limit exceeded. Please try again later or sign in with GitLab for higher rate limits.')
          } else if (err.response?.status === 404 || err.message?.includes('not found')) {
            console.log('Repository not found on GitLab, trying to fall back to GitHub...');
            
            // Try to fetch from GitHub instead
            try {
              // Initialize Octokit with or without authentication token
              const octokit = new Octokit({
                auth: session?.accessToken || undefined,
              });

              // Get the repository details to get the default branch
              const { data: repoData } = await octokit.repos.get({
                owner: owner,
                repo,
              });

              // Get the default branch's commit SHA
              const { data: branchData } = await octokit.repos.getBranch({
                owner: owner,
                repo,
                branch: repoData.default_branch,
              });

              // Get the full tree
              const { data: treeData } = await octokit.git.getTree({
                owner: owner,
                repo,
                tree_sha: branchData.commit.sha,
                recursive: '1'
              });

              // Convert to our file format
              const files = treeData.tree.map(item => ({
                name: item.path?.split('/').pop() || '',
                path: item.path || '',
                type: item.type === 'blob' ? 'file' : 'dir',
                sha: item.sha || ''
              })).filter(item => item.name) as FileItem[];

              setAllFiles(files);
              
              // Build tree structure
              const tree = buildTreeFromFiles(files);
              setTreeData(tree);
              
              // Clear retry count on success and reset error
              setRetryCount(0);
              setError('');
              console.log('Successfully fetched from GitHub as fallback');
              
              return; // Exit the function since we succeeded with GitHub
            } catch (githubErr: any) {
              console.error('Error fetching from GitHub fallback:', githubErr);
              // If GitHub fallback also fails, show the original GitLab error
              setError('Repository not found. Please check that the repository exists and the owner/name are correct.');
            }
          } else {
            setError(err.message || 'Failed to fetch repository tree')
          }
        }
      } else {
        // Default to GitHub (Octokit)
        try {
          // Check if there's a GitHub token available
          const githubToken = localStorage.getItem('github_token');
          
          // If we need GitHub but have no authentication, show clear message
          if (!githubToken && session?.provider !== 'github') {
            setError('You need to sign in with GitHub to access this repository. Your current session does not have GitHub access.');
            setLoading(false);
            return;
          }
          
          // Initialize Octokit with the GitHub token (from localStorage if available)
          const octokit = new Octokit({
            auth: githubToken || session?.accessToken || undefined,
          })

          // Get the repository details to get the default branch
          const { data: repoData } = await octokit.repos.get({
            owner: owner,
            repo,
          })

          // Get the default branch's commit SHA
          const { data: branchData } = await octokit.repos.getBranch({
            owner: owner,
            repo,
            branch: repoData.default_branch,
          })

          // Get the full tree
          const { data: treeData } = await octokit.git.getTree({
            owner: owner,
            repo,
            tree_sha: branchData.commit.sha,
            recursive: '1'
          })

          // Convert to our file format
          const files = treeData.tree.map(item => ({
            name: item.path?.split('/').pop() || '',
            path: item.path || '',
            type: item.type === 'blob' ? 'file' : 'dir',
            sha: item.sha || ''
          })).filter(item => item.name) as FileItem[];

          setAllFiles(files)
          
          // Build tree structure
          const tree = buildTreeFromFiles(files);
          setTreeData(tree)
          // Clear retry count on success
          setRetryCount(0)
        } catch (err: any) {
          console.error('Error fetching GitHub tree data:', err)
          
          // Only show login prompt for 401 errors (Unauthorized) as these definitively indicate a private repo
          // 403 can happen for rate limiting, 404 can be for non-existent repos
          if (err.status === 401 || err.message?.includes('Bad credentials')) {
            setError('GitHub authentication failed. Please sign in with GitHub to access this repository.')
          } else if (err.status === 403 && err.message?.includes('rate limit')) {
            // Handle rate limiting separately
            setError('GitHub API rate limit exceeded. Please try again later or sign in with GitHub for higher rate limits.')
          } else if (err.status === 404) {
            setError('Repository not found. Please check that the repository exists and the owner/name are correct.')
          } else {
            setError(err.message || 'Failed to fetch repository tree')
          }
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const handleItemClick = (item: FileItem) => {
    if (item.type === 'dir') {
      setCurrentPath(item.path)
    } else {
      onFileSelect?.(item.path)
    }
  }

  const handleBackClick = () => {
    if (currentPath) {
      const newPath = currentPath.split('/').slice(0, -1).join('/')
      setCurrentPath(newPath)
    }
  }

  const toggleFileSelection = async (filePath: string) => {
    console.log('toggleFileSelection called for path:', filePath);
    
    // Use the current selection state to avoid refresh issues
    const newSelectedFiles = new Set(selectedFiles);
    
    if (newSelectedFiles.has(filePath)) {
      console.log('Removing file from selection:', filePath);
      // If removing a file from selection
      newSelectedFiles.delete(filePath);
      const updatedFiles = selectedFilesWithContent.filter(file => file.path !== filePath);
      setSelectedFilesWithContent(updatedFiles);
      
      // Update the parent component without triggering a refresh
      if (onFilesForContextChange) {
        onFilesForContextChange(updatedFiles);
      }
    } else {
      console.log('Adding file to selection:', filePath);
      // If adding a file to selection
      newSelectedFiles.add(filePath);
      
      try {
        let content = '';
        
        if (provider === 'gitlab') {
          // Use GitLab provider to fetch file content
          const gitLabProvider = getProvider('gitlab');
          content = await gitLabProvider.getFileContent(owner, repo, filePath);
        } else {
          // Default to GitHub API
          const githubToken = localStorage.getItem('github_token');
          
          // If we need GitHub but have no authentication, show error
          if (!githubToken && session?.provider !== 'github') {
            console.error('GitHub authentication required to select this file');
            newSelectedFiles.delete(filePath);
            setError('GitHub authentication required to select files. Please sign in with GitHub.');
            return;
          }
          
          const octokit = new Octokit({
            auth: githubToken || session?.accessToken || undefined,
          });
          
          const response = await octokit.repos.getContent({
            owner: owner,
            repo,
            path: filePath,
          });
          
          if ('content' in response.data) {
            content = atob(response.data.content);
          }
        }
        
        if (content) {
          // Create new array instead of modifying the existing one
          const updatedFiles = [...selectedFilesWithContent, { path: filePath, content }];
          
          // Update local state first
          setSelectedFilesWithContent(updatedFiles);
          
          // Then update parent component 
          if (onFilesForContextChange) {
            onFilesForContextChange(updatedFiles);
          }
        }
      } catch (error) {
        console.error('Error fetching file content:', error);
        // Remove from selection if fetching failed
        newSelectedFiles.delete(filePath);
      }
    }
    
    // Update selected files set after all operations
    setSelectedFiles(newSelectedFiles);
  };

  // Helper function to flatten tree to a list of files
  const flattenTree = (tree: TreeNode[]): FileItem[] => {
    const files: FileItem[] = [];
    
    const processNode = (node: TreeNode) => {
      files.push({
        name: node.name,
        path: node.path,
        type: node.type,
        sha: node.sha
      });
      
      if (node.children) {
        node.children.forEach(processNode);
      }
    };
    
    tree.forEach(processNode);
    return files;
  };

  // File type detection for GitHub view
  const getFileIcon = (filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    
    // Programming languages
    if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'cs', 'php', 'rb', 'go', 'swift'].includes(extension)) {
      return <FaCode style={{ color: theme === 'light' ? '#3B82F6' : '#60A5FA' }} />;
    }
    
    // Markdown
    if (['md', 'markdown'].includes(extension)) {
      return <FaMarkdown style={{ color: theme === 'light' ? '#10B981' : '#34D399' }} />;
    }
    
    // Images
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(extension)) {
      return <FaImage style={{ color: theme === 'light' ? '#8B5CF6' : '#A78BFA' }} />;
    }
    
    // Text/Config files
    if (['txt', 'json', 'yml', 'yaml', 'xml', 'csv', 'html', 'css', 'toml', 'ini'].includes(extension)) {
      return <FaFileAlt style={{ color: theme === 'light' ? '#F59E0B' : '#FBBF24' }} />;
    }
    
    // Default file icon
    return <FaFile style={{ color: theme === 'light' ? '#6B7280' : '#9CA3AF' }} />;
  };

  // Format file size for GitHub view
  const formatFileSize = (size: number) => {
    if (size < 1024) {
      return `${size} B`;
    } else if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    } else {
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    }
  };

  // Render the tree view recursively
  const renderTree = (items: TreeNode[]) => {
    return items.map((item) => (
      <div key={item.path} className="flex flex-col">
        <div className="flex items-center">
          <button
            onClick={() => handleItemClick(item)}
            className={`flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-left w-full truncate ${
              currentPath === item.path ? 'bg-blue-50 dark:bg-blue-900/20' : ''
            }`}
          >
            <span style={{ marginLeft: `${item.level * 16}px` }}>
              {item.type === 'dir' ? (
                <FaFolder className="text-blue-500" />
              ) : (
                getFileIcon(item.name)
              )}
            </span>
            <span className="truncate">{item.name}</span>
          </button>
          
          {item.type === 'file' && onFilesForContextChange && (
            <button
              onClick={() => toggleFileSelection(item.path)}
              className="p-2 text-gray-500 hover:text-blue-500"
              title={selectedFiles.has(item.path) ? "Deselect file" : "Select file for context"}
            >
              {selectedFiles.has(item.path) ? <FaCheckSquare /> : <FaRegSquare />}
            </button>
          )}
        </div>
        
        {item.children && item.children.length > 0 && (
          <div className="ml-4">
            {renderTree(item.children)}
          </div>
        )}
      </div>
    ));
  };

  if (error) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-full text-center">
        <div className="max-w-md">
          {error.includes('private repository') ? (
            <>
              <div className="mx-auto text-4xl mb-4 text-gray-400 dark:text-gray-500">🔒</div>
              <h3 className="text-lg font-semibold mb-2">Private Repository</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
              {error.includes('private repository') && !session && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => signIn(provider === 'gitlab' ? 'gitlab' : 'github')}
                    className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <FaGithub className="mr-2" />
                    Sign in with {provider === 'gitlab' ? 'GitLab' : 'GitHub'}
                  </button>
                </div>
              )}
            </>
          ) : error.includes('GitHub authentication') ? (
            <>
              <div className="mx-auto text-4xl mb-4 text-gray-400 dark:text-gray-500">🔑</div>
              <h3 className="text-lg font-semibold mb-2">GitHub Authentication Required</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
              <div className="mt-4 text-center">
                <button
                  onClick={() => signIn('github')}
                  className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <FaGithub className="mr-2" />
                  Sign in with GitHub
                </button>
              </div>
            </>
          ) : (
            <div className="text-red-500">{error}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="flex items-center justify-between p-3 border-b dark:border-gray-700">
        <div className="flex items-center">
          <h2 className="text-lg font-semibold">Repository Contents</h2>
          <div className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
            provider === 'github' 
              ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' 
              : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200'
          }`}>
            <div className="flex items-center">
              {provider === 'github' ? (
                <>
                  <FaGithub className="mr-1" />
                  GitHub
                </>
              ) : (
                <>
                  <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.6,17.5l-3.2-10c-0.3-1-1.2-1.7-2.2-1.7H5.8c-1,0-1.9,0.7-2.2,1.7l-3.2,10c-0.3,1,0.2,2.1,1.2,2.5l10,3.8c0.3,0.1,0.7,0.1,1,0l10-3.8 C23.4,19.6,23.9,18.5,23.6,17.5z M19.8,13.5H15l-2.5-3.5h5.9L19.8,13.5z M9.9,13.5h4.2L12,9.5L9.9,13.5z M5.6,13.5l1.3-3.5h5.9L10.5,13.5H5.6z M12,21l-7.8-3l1.1-3h13.3l1.1,3L12,21z" />
                  </svg>
                  GitLab
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded ${
              internalViewMode === 'list' 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title="List view"
          >
            <FaList />
          </button>
          <button
            onClick={() => setViewMode('tree')}
            className={`p-2 rounded ${
              internalViewMode === 'tree' 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title="Tree view"
          >
            <FaProjectDiagram />
          </button>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : internalViewMode === 'list' ? (
          <>
            {currentPath && (
              <button
                onClick={handleBackClick}
                className="mb-4 text-blue-600 hover:underline flex items-center"
              >
                <FaChevronLeft className="mr-1" /> Back
              </button>
            )}
            <div className="grid gap-2">
              {contents.map((item) => (
                <div key={item.path} className="flex items-center justify-between">
                  <button
                    onClick={() => handleItemClick(item)}
                    className="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-left w-full text-gray-900 dark:text-white"
                  >
                    {item.type === 'dir' ? (
                      <FaFolder className="text-blue-500" />
                    ) : (
                      getFileIcon(item.name)
                    )}
                    <span className="truncate">{item.name}</span>
                  </button>
                  
                  {item.type === 'file' && onFilesForContextChange && (
                    <button
                      onClick={() => toggleFileSelection(item.path)}
                      className="p-2 text-gray-500 hover:text-blue-500"
                      title={selectedFiles.has(item.path) ? "Deselect file" : "Select file for context"}
                    >
                      {selectedFiles.has(item.path) ? <FaCheckSquare /> : <FaRegSquare />}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          // Tree view
          <div className="font-mono text-sm text-gray-900 dark:text-white space-y-1">
            {renderTree(treeData)}
          </div>
        )}
      </div>
    </div>
  );
}