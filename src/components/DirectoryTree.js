import React, { useState } from 'react';
import { FiChevronRight, FiChevronDown, FiFolder, FiFile, FiList, FiGrid } from 'react-icons/fi';
import { useTheme } from '../context/ThemeContext.js';

const DirectoryTree = ({ content, onFileSelect, currentPath }) => {
  const { theme } = useTheme();
  const [expandedPaths, setExpandedPaths] = useState(new Set());
  const [viewMode, setViewMode] = useState('tree'); // 'tree' or 'list'

  const toggleExpand = (path) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  const buildTree = (items) => {
    const tree = [];
    const pathMap = { '': { children: tree } };

    items.forEach(item => {
      const pathParts = item.path.split('/');
      let currentPath = '';
      
      pathParts.forEach((part, index) => {
        const parentPath = currentPath;
        currentPath += (currentPath ? '/' : '') + part;
        
        if (!pathMap[currentPath]) {
          const newItem = {
            name: part,
            type: item.type,
            path: currentPath,
            url: item.url,
            children: []
          };
          
          if (pathMap[parentPath]) {
            pathMap[parentPath].children.push(newItem);
          }
          
          pathMap[currentPath] = newItem;
        }
      });
    });

    return tree;
  };

  const renderTree = (nodes, level = 0) => {
    // Sort directories first, then files, both alphabetically
    return nodes.slice().sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'dir' ? -1 : 1;
    }).map(node => (
      <div key={node.path} className="ml-4">
        <div 
          className={`flex items-center py-1 px-2 hover:bg-opacity-20 ${
            currentPath === node.path ? 'bg-blue-500 bg-opacity-20' : ''
          } ${
            theme === 'dark' ? 'hover:bg-gray-200' : 'hover:bg-gray-800'
          }`}
          style={{ marginLeft: `${level * 12}px` }}
        >
          {node.type === 'dir' ? (
            <>
              <button 
                className="mr-1"
                onClick={() => toggleExpand(node.path)}
              >
                {expandedPaths.has(node.path) ? (
                  <FiChevronDown className="inline" />
                ) : (
                  <FiChevronRight className="inline" />
                )}
              </button>
              <FiFolder className="inline mr-2 text-yellow-500" />
              <span 
                className="cursor-pointer"
                onClick={() => toggleExpand(node.path)}
              >
                {node.name}
              </span>
            </>
          ) : (
            <>
              <FiFile className="inline mr-2 ml-3 text-gray-400" />
              <button
                className="text-left flex-1"
                onClick={() => onFileSelect(node)}
              >
                {node.name}
              </button>
            </>
          )}
        </div>
        {node.type === 'dir' && expandedPaths.has(node.path) && node.children && (
          renderTree(node.children, level + 1)
        )}
      </div>
    ));
  };

  const renderTraditionalList = () => {
    const renderTree = (nodes, level = 0, isLast = false, parentPrefix = '') => {
      // Sort directories first, then files, both alphabetically
      return nodes.slice().sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'dir' ? -1 : 1;
      }).map((node, index) => {
        const isLastNode = index === nodes.length - 1;
        const prefix = isLastNode ? '└── ' : '├── ';
        const childPrefix = parentPrefix + (isLast ? '    ' : '│   ');

        return (
          <div key={node.path} className="font-mono text-sm">
            <div className={`py-1 ${currentPath === node.path ? 'text-blue-500' : ''}`}>
              {parentPrefix + prefix}
              {node.type === 'dir' ? (
                <button
                  className="hover:underline ml-1"
                  onClick={() => toggleExpand(node.path)}
                >
                  {node.name}/
                </button>
              ) : (
                <button
                  className="hover:underline ml-1"
                  onClick={() => onFileSelect(node)}
                >
                  {node.name}
                </button>
              )}
            </div>
            {node.type === 'dir' && expandedPaths.has(node.path) && node.children && (
              renderTree(node.children, level + 1, isLastNode, childPrefix)
            )}
          </div>
        );
      });
    };

    const treeStructure = buildTree(content || []);
    return (
      <div className="whitespace-pre">
        {treeStructure.length > 0 && '└── '}
        {renderTree(treeStructure)}
      </div>
    );
  };

  const treeStructure = buildTree(content || []);

  return (
    <div className={`font-mono text-sm ${
      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
    }`}>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setViewMode('tree')}
          className={`p-2 rounded ${viewMode === 'tree' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
        >
          <FiGrid />
        </button>
        <button
          onClick={() => setViewMode('list')}
          className={`p-2 rounded ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
        >
          <FiList />
        </button>
      </div>
      
      {viewMode === 'tree' ? renderTree(treeStructure) : renderTraditionalList()}
    </div>
  );
};

export default DirectoryTree; 