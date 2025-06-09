'use client'

import { useState, useEffect } from 'react'
import { Octokit } from '@octokit/rest'
import type { Octokit as OctokitType } from '@octokit/rest'
import { useSession, signIn } from 'next-auth/react'
import { FaFolder, FaFile, FaList, FaStream, FaGithub, FaLock } from 'react-icons/fa'

interface DirectoryViewerProps {
  owner: string
  repo: string
  onFileSelect?: (path: string) => void
}

interface FileItem {
  name: string
  path: string
  type: string
  sha: string
  content?: string
}

interface TreeItem extends FileItem {
  children?: TreeItem[]
}

interface GitHubTreeItem {
  path?: string
  type?: 'blob' | 'tree'
  sha: string
  url?: string
}

const sortItems = (items: FileItem[] | TreeItem[]) => {
  return items.sort((a, b) => {
    // First sort by type (directories first)
    if (a.type === 'dir' && b.type !== 'dir') return -1
    if (a.type !== 'dir' && b.type === 'dir') return 1
    // Then sort alphabetically
    return a.name.localeCompare(b.name)
  })
}

const isValidTreeItem = (item: any): item is { path: string; type: string; sha: string } => {
  return typeof item.path === 'string' && typeof item.type === 'string' && typeof item.sha === 'string';
};

export default function DirectoryViewer({ owner, repo, onFileSelect }: DirectoryViewerProps) {
  const { data: session } = useSession()
  const [currentPath, setCurrentPath] = useState('')
  const [contents, setContents] = useState<FileItem[]>([])
  const [treeData, setTreeData] = useState<TreeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('list')

  const octokit = new Octokit({
    auth: session?.accessToken || undefined,
  })

  useEffect(() => {
    if (viewMode === 'list') {
      fetchContents()
    } else {
      fetchTreeData()
    }
  }, [owner, repo, currentPath, viewMode])

  const fetchContents = async () => {
    try {
      setLoading(true)
      setError('')

      const response = await octokit.repos.getContent({
        owner,
        repo,
        path: currentPath,
        headers: {
          Accept: 'application/vnd.github.v3+json',
        },
      })

      const items = Array.isArray(response.data) ? response.data : [response.data]
      setContents(sortItems(items as FileItem[]))
    } catch (err: any) {
      console.error('Error fetching contents:', err)
      if (err.status === 404) {
        // Check if this is likely a private repository access error for unauthenticated users
        if (!session) {
          setError('This appears to be a private repository. Please sign in if you are the owner or have access to this repository.')
        } else {
          setError('Repository not found or you don\'t have access')
        }
      } else if (err.status === 403) {
        // Rate limit or authentication issue
        if (!session) {
          setError('This appears to be a private repository. Please sign in if you are the owner or have access to this repository.')
        } else {
          setError('API rate limit exceeded or insufficient permissions')
        }
      } else {
        setError(err.message || 'Failed to fetch repository contents')
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchTreeData = async () => {
    try {
      setLoading(true)
      setError('')

      // Get the repository details to get the default branch
      const { data: repoData } = await octokit.repos.get({
        owner,
        repo,
      })

      // Get the default branch's commit SHA
      const { data: branchData } = await octokit.repos.getBranch({
        owner,
        repo,
        branch: repoData.default_branch,
      })

      // Get the full tree
      const { data: treeData } = await octokit.git.getTree({
        owner,
        repo,
        tree_sha: branchData.commit.sha,
        recursive: '1'
      })

      // Convert flat tree to hierarchical structure
      const root: TreeItem[] = []
      const map = new Map<string, TreeItem>()

      treeData.tree.forEach((item) => {
        if (!isValidTreeItem(item)) return;
        
        const parts = item.path.split('/')
        let currentPath = ''
        
        parts.forEach((part, index) => {
          const path = currentPath ? `${currentPath}/${part}` : part
          currentPath = path

          if (!map.has(path)) {
            const newItem: TreeItem = {
              name: part,
              path,
              type: item.type === 'blob' && index === parts.length - 1 ? 'file' : 'dir',
              sha: item.sha,
              children: [],
            }

            map.set(path, newItem)

            if (index === 0) {
              root.push(newItem)
            } else {
              const parentPath = parts.slice(0, index).join('/')
              const parent = map.get(parentPath)
              if (parent && parent.children) {
                parent.children.push(newItem)
                parent.children = sortItems(parent.children)
              }
            }
          }
        })
      })

      setTreeData(sortItems(root))
    } catch (err) {
      console.error('Error fetching tree:', err)
      setError('Failed to fetch repository tree')
    } finally {
      setLoading(false)
    }
  }

  const renderTree = (items: TreeItem[], level = 0, isLast = true) => {
    return items.map((item, index) => {
      const isLastItem = index === items.length - 1
      const hasChildren = item.children && item.children.length > 0
      const prefix = level > 0 ? (isLastItem ? '└── ' : '├── ') : ''
      const indent = level > 0 ? Array(level).fill('│   ').join('') : ''

      return (
        <div key={item.path}>
          <button
            onClick={() => item.type === 'file' && onFileSelect?.(item.path)}
            className="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-left w-full font-mono text-gray-900 dark:text-white"
          >
            <span className="text-gray-400 dark:text-gray-500 select-none whitespace-pre">
              {indent}{prefix}
            </span>
            {item.type === 'dir' ? (
              <FaFolder className="text-github-blue" />
            ) : (
              <FaFile className="text-gray-500" />
            )}
            {item.name}
          </button>
          {hasChildren && (
            <div>
              {renderTree(item.children!, level + 1, isLastItem)}
            </div>
          )}
        </div>
      )
    })
  }

  const handleItemClick = async (item: FileItem) => {
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

  if (error) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-full text-center">
        <div className="max-w-md">
          {error.includes('private repository') ? (
            <>
              <FaLock className="mx-auto text-4xl mb-4 text-gray-400 dark:text-gray-500" />
              <h3 className="text-lg font-semibold mb-2">Private Repository</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
              {error.includes('private repository') && !session && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => signIn('github')}
                    className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <FaGithub className="mr-2" />
                    Sign in with GitHub
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-red-500">{error}</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="border rounded-lg dark:border-gray-700">
      <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
        <h2 className="text-lg font-semibold">Repository Contents</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded ${
              viewMode === 'list' 
                ? 'bg-github-blue text-white' 
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title="List view"
          >
            <FaList />
          </button>
          <button
            onClick={() => setViewMode('tree')}
            className={`p-2 rounded ${
              viewMode === 'tree' 
                ? 'bg-github-blue text-white' 
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title="Tree view"
          >
            <FaStream />
          </button>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div>Loading...</div>
        ) : viewMode === 'list' ? (
          <>
            {currentPath && (
              <button
                onClick={handleBackClick}
                className="mb-4 text-github-blue hover:underline"
              >
                ← Back
              </button>
            )}
            <div className="grid gap-2">
              {contents.map((item) => (
                <button
                  key={item.sha}
                  onClick={() => handleItemClick(item)}
                  className="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-left w-full text-gray-900 dark:text-white"
                >
                  {item.type === 'dir' ? (
                    <FaFolder className="text-github-blue" />
                  ) : (
                    <FaFile className="text-gray-500" />
                  )}
                  {item.name}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="font-mono text-sm text-gray-900 dark:text-white">
            {renderTree(treeData)}
          </div>
        )}
      </div>
    </div>
  )
} 