import { useState, useEffect, useCallback } from 'react'

interface TreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  sha: string
  children?: TreeNode[]
  level: number
  isLast: boolean
}

interface FileTreeProps {
  data: TreeNode[]
  onSelect: (node: TreeNode) => void
  selectedPath: string | null
  onToggleFileForContext: (node: TreeNode) => void
  selectedFilesForContext: { path: string; content: string }[]
}

const FileTree = ({ data, onSelect, selectedPath, onToggleFileForContext, selectedFilesForContext }: FileTreeProps) => {
  const [openNodes] = useState<Set<string>>(new Set())

  const renderNode = useCallback((node: TreeNode, level: number = 0, isLast: boolean = false, parentIsLast: boolean = false) => {
    const isSelected = selectedFilesForContext.some(f => f.path === node.path)

    return (
      <div key={node.path} style={{ marginLeft: node.level > 0 ? '20px' : '0' }}>
        <div
          className={`flex items-center py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 ${
            node.path === selectedPath ? 'bg-gray-100 dark:bg-gray-700/50' : ''
          }`}
        >
          <div className="flex-1 flex items-center text-gray-900 dark:text-white" onClick={() => onSelect(node)}>
            <span className="font-mono text-sm text-gray-900 dark:text-white">
              <span className="text-gray-500 dark:text-gray-300">{node.isLast ? '└── ' : '├── '}</span>
              {node.name}
            </span>
          </div>
          {node.type === 'file' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggleFileForContext(node)
              }}
              className={`p-1 rounded-md transition-colors mr-2 ${
                isSelected
                  ? 'text-blue-500 hover:text-blue-600'
                  : 'text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100'
              }`}
              title={isSelected ? 'Remove from context' : 'Add to context'}
            >
              {isSelected ? '✓' : '+'}
            </button>
          )}
        </div>
        {node.children?.map((child, index) => 
          renderNode(
            child, 
            level + 1, 
            index === (node.children?.length ?? 0) - 1,
            isLast
          )
        )}
      </div>
    )
  }, [selectedPath, onSelect, onToggleFileForContext, selectedFilesForContext])

  return (
    <div className="font-mono text-sm whitespace-pre overflow-x-auto h-full max-h-full custom-scrollbar">
      <div className="text-gray-700 dark:text-white h-full">
        {data.map((node, index) => renderNode(node, 0, index === data.length - 1, true))}
      </div>
    </div>
  )
}

export default FileTree 