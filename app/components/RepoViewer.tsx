'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import DirectoryViewer from '@/app/components/DirectoryViewer'
import FileViewer from '@/app/components/FileViewer'
import ChatBox from '@/app/components/ChatBox'
import {
  FaGithub,
  FaCode,
  FaSearch,
  FaChevronRight,
  FaChevronDown,
  FaFolder,
  FaFileAlt,
  FaPaperPlane,
  FaExpand,
  FaCompress,
  FaFile,
  FaGitlab
} from 'react-icons/fa'
import { useTheme } from 'next-themes'
import styles from './RepoViewer.module.css'
import { Octokit } from '@octokit/rest'
import { addRepoToHistory } from '@/app/services/repoHistoryService'

interface FileWithContent {
  path: string;
  content: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  selectedFiles?: string[];
}

interface RepoViewerProps {
  owner: string;
  repo: string;
  provider: 'github' | 'gitlab';
}

export default function RepoViewer({ owner, repo, provider = 'github' }: RepoViewerProps) {
  const { data: session, status } = useSession();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFilesForContext, setSelectedFilesForContext] = useState<FileWithContent[]>([]);
  const { theme: systemTheme, resolvedTheme } = useTheme();
  const [viewMode, setViewMode] = useState<'tree' | 'github'>('tree');
  const [mobileView, setMobileView] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');

  // Add state for panel maximization
  const [maximizedPanel, setMaximizedPanel] = useState<'none' | 'files' | 'fileViewer' | 'chat'>('none');

  // Panel resize management - simplified for two panels
  const [leftPanelWidth, setLeftPanelWidth] = useState(30); // percentage
  const [rightPanelWidth, setRightPanelWidth] = useState(70); // percentage

  // Store original dimensions for restoring after maximization
  const [originalDimensions, setOriginalDimensions] = useState({
    leftPanelWidth: 30,
    topRowHeight: 60,
    bottomRowHeight: 40
  });

  // Add state for vertical resizing of the right panel rows
  const [topRowHeight, setTopRowHeight] = useState(60);
  const [bottomRowHeight, setBottomRowHeight] = useState(40);
  const [verticalResizing, setVerticalResizing] = useState(false);
  const [initialY, setInitialY] = useState(0);
  const [initialTopHeight, setInitialTopHeight] = useState(0);

  const [resizing, setResizing] = useState(false);
  const [initialX, setInitialX] = useState(0);
  const [initialLeftWidth, setInitialLeftWidth] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [expandedMessages, setExpandedMessages] = useState(new Set<string>());
  const [repoContext, setRepoContext] = useState<{
    structure: string;
    readme: string;
    taggedFiles: Record<string, string>;
  }>({
    structure: '',
    readme: '',
    taggedFiles: {},
  });

  const currentTheme = (resolvedTheme || systemTheme) as 'light' | 'dark';

  // Updated colors object with both light and dark theme colors
  const colors = {
    background: currentTheme === 'light' ? '#FFFFFF' : '#0D1117',
    menuBackground: currentTheme === 'light' ? '#F6F8FA' : '#161B22',
    border: currentTheme === 'light' ? '#D0D7DE' : '#30363D',
    text: currentTheme === 'light' ? '#24292F' : '#C9D1D9',
    secondaryText: currentTheme === 'light' ? '#57606A' : '#8B949E',
    headerBackground: currentTheme === 'light' ? '#FFFFFF' : '#0D1117',
    buttonHover: currentTheme === 'light' ? '#F3F4F6' : '#21262D',
    buttonActive: currentTheme === 'light' ? '#E5E7EB' : '#282E33',
    codeBackground: currentTheme === 'light' ? '#FFFFFF' : '#0D1117',
    shadow: currentTheme === 'light'
      ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
      : '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.3)'
  };

  useEffect(() => {
    setLoading(false);

    // Find and set README.md as the default file
    findAndSetReadmeFile();
  }, [owner, repo]);

  useEffect(() => {
    const checkMobile = () => {
      // Use a small delay to prevent immediate re-rendering during hot module replacement
      setTimeout(() => {
        setMobileView(window.innerWidth <= 768);
      }, 0);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  useEffect(() => {
    if (resizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    if (verticalResizing) {
      window.addEventListener('mousemove', handleVerticalMouseMove);
      window.addEventListener('mouseup', handleVerticalMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleVerticalMouseMove);
      window.removeEventListener('mouseup', handleVerticalMouseUp);
    };
  }, [resizing, verticalResizing]);

  const handleMouseMove = (e: MouseEvent) => {
    if (!resizing || !containerRef.current) return;

    const dx = e.clientX - initialX;
    const containerWidth = containerRef.current.clientWidth;

    // Calculate new widths based on the mouse movement
    let newLeftWidth = initialLeftWidth + (dx / containerWidth * 100);

    // Apply constraints to prevent panels from becoming too small
    newLeftWidth = Math.max(20, Math.min(80, newLeftWidth));

    // Update the panel widths
    setLeftPanelWidth(newLeftWidth);
    setRightPanelWidth(100 - newLeftWidth);
  };

  const handleMouseUp = () => {
    setResizing(false);
  };

  const startResizing = (e: React.MouseEvent) => {
    setResizing(true);
    setInitialX(e.clientX);
    setInitialLeftWidth(leftPanelWidth);
    e.preventDefault();
  };

  const handleFilesForContextChange = (files: FileWithContent[]) => {
    setSelectedFilesForContext(files);
  };

  // For debugging - log the messages state whenever it changes
  useEffect(() => {
    console.log('ChatMessages state updated:', chatMessages);
  }, [chatMessages]);

  const handleAddMessage = (message: Message) => {
    setChatMessages(prevMessages => {
      const existingIndex = prevMessages.findIndex(m => m.id === message.id);

      if (existingIndex !== -1) {
        // Replace existing message
        const updatedMessages = [...prevMessages];
        updatedMessages[existingIndex] = message;
        return updatedMessages;
      }

      return [...prevMessages, message];
    });
  };


  // Clear chat messages when navigating to a different repo
  useEffect(() => {
    console.log('Repository changed, clearing chat messages state');
    setChatMessages([]);
    setExpandedMessages(new Set());
  }, [owner, repo, provider]);

  const handleChatLoadingChange = (isLoading: boolean) => {
    setChatLoading(isLoading);
  };

  const handleToggleMessageExpansion = (messageId: string) => {
    const newExpanded = new Set(Array.from(expandedMessages));
    if (newExpanded.has(messageId)) {
      newExpanded.delete(messageId);
    } else {
      newExpanded.add(messageId);
    }
    setExpandedMessages(newExpanded);
  };

  const handleSetRepoContext = (context: { structure: string; readme: string; taggedFiles: Record<string, string> }) => {
    setRepoContext(context);

    // If no file is selected yet, try to find README.md in the repo structure
    if (!selectedFile) {
      findReadmePathFromStructure(context.structure);
    }
  };

  // Function to find and set README file as selected
  const findAndSetReadmeFile = async () => {
    try {
      // Initialize Octokit with or without authentication token
      const octokit = new Octokit({
        auth: session?.accessToken || undefined,
      });

      // Common README filenames to check
      const readmeFiles = ['README.md', 'Readme.md', 'readme.md', 'README.markdown', 'README'];

      for (const filename of readmeFiles) {
        try {
          const { data: readmeData } = await octokit.repos.getContent({
            owner,
            repo,
            path: filename,
          });

          if ('path' in readmeData) {
            console.log('Found README file:', readmeData.path);
            setSelectedFile(readmeData.path);
            return;
          }
        } catch (error) {
          // Continue checking other README filenames
          continue;
        }
      }

      console.log('No README file found in the repository root');
    } catch (error) {
      console.error('Error finding README file:', error);
    }
  };

  // Fallback method to find README path from the structure string
  const findReadmePathFromStructure = (structure: string) => {
    if (!structure) return;

    // Try to find a README file in the structure
    const lines = structure.split('\n');
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      if (lowerLine.includes('readme.md') || lowerLine.includes('readme')) {
        // Extract the path from the line
        const match = line.match(/📄\s+(.+?)$/);
        if (match && match[1]) {
          const readmePath = match[1].trim();
          console.log('Found README in structure:', readmePath);
          setSelectedFile(readmePath);
          return;
        }
      }
    }
  };

  const handleFileSelect = (path: string) => {
    setSelectedFile(path);
  };

  const directoryViewerComponent = (
    <DirectoryViewer
      owner={owner}
      repo={repo}
      provider={provider}
      onFileSelect={handleFileSelect}
      onFilesForContextChange={handleFilesForContextChange}
      theme={currentTheme}
      viewMode={viewMode}
    />
  );

  const fileViewerComponent = selectedFile ? (
    <FileViewer
      owner={owner}
      repo={repo}
      filePath={selectedFile}
      provider={provider}
      theme={currentTheme}
    />
  ) : null;

  const chatComponent = (
    <ChatBox
      owner={owner}
      repo={repo}
      provider={provider}
      selectedFile={selectedFile}
      selectedFilesForContext={selectedFilesForContext}
      theme={currentTheme}
      messages={chatMessages}
      expandedMessages={expandedMessages}
      repoContext={repoContext}
      onAddMessage={handleAddMessage}
      onToggleMessageExpansion={handleToggleMessageExpansion}
      onSetRepoContext={handleSetRepoContext}
      onLoadingChange={handleChatLoadingChange}
    />
  );

  const handleVerticalMouseMove = (e: MouseEvent) => {
    if (!verticalResizing || !rightPanelRef.current) return;

    const containerHeight = rightPanelRef.current.clientHeight;
    const dy = e.clientY - initialY;

    // Calculate new heights based on the mouse movement
    let newTopHeight = initialTopHeight + (dy / containerHeight * 100);

    // Apply constraints to prevent panels from becoming too small
    newTopHeight = Math.max(20, Math.min(80, newTopHeight));

    // Update the heights
    setTopRowHeight(newTopHeight);
    setBottomRowHeight(100 - newTopHeight);
  };

  const handleVerticalMouseUp = () => {
    setVerticalResizing(false);
  };

  const startVerticalResizing = (e: React.MouseEvent) => {
    if (!rightPanelRef.current) return;

    setVerticalResizing(true);
    setInitialY(e.clientY);
    setInitialTopHeight(topRowHeight);
    e.preventDefault();
  };

  // Function to handle maximizing and restoring panels
  const toggleMaximize = (panel: 'files' | 'fileViewer' | 'chat') => {
    if (maximizedPanel === panel) {
      setMaximizedPanel('none');
    } else {
      setMaximizedPanel(panel);
    }
  };

  // Function to generate a formatted tree structure from file paths
  const generateTreeStructure = (paths: string[]) => {
    // Sort paths to ensure directories come first within their level
    paths.sort();

    // Define interface for tree nodes
    interface TreeNode {
      isDirectory: boolean;
      children: { [key: string]: TreeNode };
    }

    const root: { [key: string]: TreeNode } = {};

    // Build a nested object structure representing the file hierarchy
    paths.forEach(path => {
      const parts = path.split('/').filter(p => p);
      let current = root;

      parts.forEach((part, index) => {
        if (!current[part]) {
          current[part] = {
            isDirectory: index < parts.length - 1 || path.endsWith('/'),
            children: {}
          };
        }
        current = current[part].children;
      });
    });

    // Format the tree structure with proper symbols
    const formatTree = (node: { [key: string]: TreeNode }, prefix = '', isLast = true, rootName = '') => {
      const entries = Object.entries(node);
      if (entries.length === 0) return '';

      let result = rootName ? `${prefix}${isLast ? '└── ' : '├── '}${rootName}/\n` : '';

      entries.forEach(([name, data], index) => {
        const isLastItem = index === entries.length - 1;
        const newPrefix = prefix + (rootName && isLast ? '    ' : '│   ');

        if (data.isDirectory) {
          // Directory
          if (rootName) {
            // If not the root level, we include the directory in the tree
            result += `${newPrefix}${isLastItem ? '└── ' : '├── '}${name}/\n`;

            // Process children with updated prefix
            const childPrefix = newPrefix + (isLastItem ? '    ' : '│   ');
            const childEntries = Object.entries(data.children);

            childEntries.forEach(([childName, childData], childIndex) => {
              const isLastChild = childIndex === childEntries.length - 1;

              if (childData.isDirectory) {
                result += formatTree(
                  { [childName]: childData },
                  childPrefix,
                  isLastChild,
                  childName
                );
              } else {
                // File
                result += `${childPrefix}${isLastChild ? '└── ' : '├── '}${childName}\n`;
              }
            });
          } else {
            // Root level directory
            result += formatTree(data.children, prefix, isLastItem, name);
          }
        } else {
          // File
          result += `${prefix}${isLastItem ? '└── ' : '├── '}${name}\n`;
        }
      });

      return result;
    };

    // Get the top-level directories and format them
    let result = '';
    const rootEntries = Object.entries(root);

    if (rootEntries.length > 0) {
      // Add the repo name as root
      result = `Directory structure:\n└── ${owner}/${repo}/\n`;

      // Format each top-level entry
      rootEntries.forEach(([name, data], index) => {
        const isLastItem = index === rootEntries.length - 1;
        if (data.isDirectory) {
          result += formatTree(data.children, '    ', isLastItem, name);
        } else {
          result += `    ${isLastItem ? '└── ' : '├── '}${name}\n`;
        }
      });
    } else {
      result = `Directory structure of ${owner}/${repo} (empty)`;
    }

    return result;
  };

  // Function to copy directory structure
  const copyDirectoryStructure = () => {
    try {
      let structure = '';

      // Check if we have directory structure available
      if (repoContext && repoContext.structure && repoContext.structure.length > 0) {
        // Process the existing structure to ensure proper tree formatting
        const lines = repoContext.structure.split('\n');

        // Initial line is typically the repo header
        structure = `Directory structure:\n└── ${owner}/${repo}/\n`;

        // Parse and format the rest with proper tree characters
        let lastDepth = 0;
        let depthStack = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (!line.trim()) continue; // Skip empty lines

          // Calculate indentation depth
          const match = line.match(/^(\s*)(.+)$/);
          if (!match) continue;

          const indentation = match[1];

          // Remove any icons or special characters (like 📄, 📁, etc.)
          let content = match[2]
            .replace(/[└├]── /, '')
            .replace(/^[│]?\s*/, '')
            .replace(/📄\s+/, '')
            .replace(/📁\s+/, '')
            .replace(/📂\s+/, '')
            .replace(/🗂️\s+/, '')
            .replace(/📑\s+/, '')
            .replace(/📝\s+/, '')
            .replace(/📃\s+/, '');

          const currentDepth = Math.floor(indentation.length / 4);

          // Pop from stack if we're moving back up
          while (depthStack.length > currentDepth) {
            depthStack.pop();
          }

          // Push to stack if we're going deeper
          while (depthStack.length < currentDepth) {
            depthStack.push(false);
          }

          // Determine if this is the last item at this level
          const nextLine = lines[i + 1];
          const nextIndentMatch = nextLine ? nextLine.match(/^(\s*)/) : null;
          const nextIndent = nextIndentMatch?.[1]?.length || 0;
          const isLast = i === lines.length - 1 || nextIndent <= indentation.length;

          if (isLast) {
            depthStack[depthStack.length - 1] = true;
          }

          // Generate proper prefix
          let prefix = '';
          for (let j = 0; j < depthStack.length; j++) {
            prefix += depthStack[j] ? '    ' : '│   ';
          }

          // Add formatted line
          const isDir = content.endsWith('/');
          structure += prefix + (isLast ? '└── ' : '├── ') + content + '\n';
        }
      } else {
        // Fallback to a basic structure if actual data is not available
        structure = `Directory structure of ${owner}/${repo} is still loading...`;
      }

      // Copy to clipboard
      navigator.clipboard.writeText(structure)
        .then(() => {
          alert('Directory structure copied to clipboard!');
        })
        .catch((error) => {
          console.error('Failed to copy directory structure:', error);
          alert('Failed to copy directory structure');
        });
    } catch (error) {
      console.error('Error copying directory structure:', error);
      alert('Failed to copy directory structure');
    }
  };

  // Determine panel heights based on maximized state
  const getPanelStyle = (panel: 'files' | 'fileViewer' | 'chat') => {
    const baseStyle: {
      border: string;
      borderRadius: string;
      overflow: string;
      backgroundColor: string;
      width: string;
      maxWidth?: string; // Add maxWidth as optional property
      boxSizing: 'border-box';
      display: 'flex';
      flexDirection: 'column';
      marginBottom: string;
    } = {
      border: '1px solid #E5E7EB',
      borderRadius: '8px',
      overflow: 'hidden',
      backgroundColor: 'white',
      width: '100%',
      boxSizing: 'border-box' as const,
      display: 'flex' as const,
      flexDirection: 'column' as const,
      marginBottom: '16px'
    };

    // Add fixed width for mobile view
    if (mobileView) {
      baseStyle.width = 'calc(100% - 8px)'; // Reduced margin to prevent cutoff
      baseStyle.maxWidth = '450px'; // Changed from 600px to 450px as requested
    }

    if (maximizedPanel === 'none') {
      // Give chat panel more height by default
      if (panel === 'chat') {
        return {
          ...baseStyle,
          height: '500px' // Increased from 400px to 500px
        };
      }
      return {
        ...baseStyle,
        height: '400px' // Increased from 300px to 400px
      };
    }

    if (maximizedPanel === panel) {
      return {
        ...baseStyle,
        height: 'calc(100vh - 80px)' // Increased from calc(100vh - 120px)
      };
    }

    return {
      ...baseStyle,
      height: '0px',
      marginBottom: '0px',
      border: 'none',
      display: 'none'
    };
  };

  // Add repository to history when loaded
  useEffect(() => {
    const saveRepoToHistory = async () => {
      if (session?.user?.email) {
        await addRepoToHistory(session.user.email, provider, owner, repo);
      }
    };

    saveRepoToHistory();
  }, [owner, repo, provider, session?.user?.email]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  // Mobile view implementation 
  if (mobileView) {
    return (
      <div style={{
        width: '300px',
        padding: '4px', // Reduced padding to prevent cutoff
        boxSizing: 'border-box',
        maxWidth: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid #E5E7EB',
          marginBottom: '12px',
          width: '100%',
          maxWidth: '450px', // Changed from 600px to 450px
          boxSizing: 'border-box'
        }}>
          <div className={styles.header}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              overflow: 'hidden',
              maxWidth: '100%'
            }}>
              {provider === 'gitlab' ? (
                <FaGitlab size={24} style={{ flexShrink: 0, color: '#4B5563' }} />
              ) : (
                <FaGithub size={24} style={{ flexShrink: 0, color: '#4B5563' }} />
              )}
              <h1 className={styles.title} style={{
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0
              }}>
                <span style={{ color: '#4B5563' }}>{owner}</span>
                <span style={{ color: '#9CA3AF' }}>/</span>
                <span style={{ color: '#111827' }}>{repo}</span>
              </h1>
            </div>
          </div>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          width: '100%',
          maxWidth: '450px', // Changed from 600px to 450px
          boxSizing: 'border-box',
          alignItems: 'center'
        }}>
          {/* Directory Viewer Panel */}
          <div style={getPanelStyle('files')}>
            <div style={{
              padding: '12px',
              borderBottom: '1px solid #E5E7EB',
              backgroundColor: '#F9FAFB',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              <div style={{ fontWeight: 'bold', fontSize: '14px' }}>Files</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setViewMode('github')}
                  style={{
                    background: viewMode === 'github' ? '#E1F0FF' : 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    cursor: 'pointer'
                  }}
                >
                  {provider === 'gitlab' ? 'GitLab' : 'GitHub'}
                </button>
                <button
                  onClick={() => setViewMode('tree')}
                  style={{
                    background: viewMode === 'tree' ? '#E1F0FF' : 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    cursor: 'pointer'
                  }}
                >
                  Tree
                </button>
                {viewMode === 'tree' && (
                  <button
                    onClick={copyDirectoryStructure}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Copy directory structure"
                  >
                    <FaFileAlt size={14} />
                  </button>
                )}
                <button
                  onClick={() => toggleMaximize('files')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: '#0969DA',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  aria-label={maximizedPanel === 'files' ? 'Minimize files panel' : 'Maximize files panel'}
                >
                  {maximizedPanel === 'files' ? <FaCompress size={14} /> : <FaExpand size={14} />}
                </button>
              </div>
            </div>
            <div style={{
              flex: 1,
              overflow: 'auto',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              <DirectoryViewer
                owner={owner}
                repo={repo}
                provider={provider}
                onFileSelect={(path) => handleFileSelect(path)}
                onFilesForContextChange={(files) => handleFilesForContextChange(files)}
                theme={currentTheme}
                viewMode={viewMode}
              />
            </div>
          </div>

          {/* File Viewer Panel */}
          {selectedFile && (
            <div style={getPanelStyle('fileViewer')}>
              <div style={{
                padding: '12px',
                borderBottom: '1px solid #E5E7EB',
                backgroundColor: '#F9FAFB',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
                boxSizing: 'border-box'
              }}>
                <div style={{
                  fontSize: '13px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '80%'
                }}>
                  {selectedFile}
                </div>
                <button
                  onClick={() => toggleMaximize('fileViewer')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: '#0969DA',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  aria-label={maximizedPanel === 'fileViewer' ? 'Minimize file viewer panel' : 'Maximize file viewer panel'}
                >
                  {maximizedPanel === 'fileViewer' ? <FaCompress size={14} /> : <FaExpand size={14} />}
                </button>
              </div>
              <div style={{
                flex: 1,
                overflow: 'auto',
                padding: '8px',
                width: '100%',
                boxSizing: 'border-box'
              }}>
                {fileViewerComponent}
              </div>
            </div>
          )}

          {/* Chat Panel */}
          <div style={getPanelStyle('chat')}>
            <div style={{
              padding: '12px',
              borderBottom: '1px solid #E5E7EB',
              backgroundColor: '#F9FAFB',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              <div style={{ fontWeight: 'bold', fontSize: '14px' }}>Chat with Repository</div>
              <button
                onClick={() => toggleMaximize('chat')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: '#0969DA',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                aria-label={maximizedPanel === 'chat' ? 'Minimize chat panel' : 'Maximize chat panel'}
              >
                {maximizedPanel === 'chat' ? <FaCompress size={14} /> : <FaExpand size={14} />}
              </button>
            </div>
            <div style={{
              flex: 1,
              overflow: 'auto',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              <ChatBox
                owner={owner}
                repo={repo}
                provider={provider}
                selectedFile={selectedFile}
                selectedFilesForContext={selectedFilesForContext}
                theme={currentTheme}
                messages={chatMessages}
                expandedMessages={expandedMessages}
                repoContext={repoContext}
                onAddMessage={handleAddMessage}
                onToggleMessageExpansion={handleToggleMessageExpansion}
                onSetRepoContext={handleSetRepoContext}
                onLoadingChange={handleChatLoadingChange}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Desktop layout with two panels, right panel split into two rows
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      minHeight: '100vh',
      width: '100%',
      padding: '12px',
      backgroundColor: colors.background
    }}>
      {/* Repository name header - moved to page level */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 0',
        width: 'fit-content'
      }}>
        {provider === 'gitlab' ? (
          <FaGitlab size={24} style={{ color: colors.secondaryText }} />
        ) : (
          <FaGithub size={24} style={{ color: colors.secondaryText }} />
        )}
        <h1 style={{
          fontSize: '18px',
          fontWeight: 'bold',
          margin: 0,
          color: colors.text
        }}>
          <span style={{ color: colors.secondaryText }}>{owner}</span>
          <span style={{ color: colors.secondaryText }}>/</span>
          <span style={{ color: colors.text }}>{repo}</span>
        </h1>
      </div>

      {/* Main container */}
      <div
        ref={containerRef}
        style={{
          width: '1200px',
          height: '95vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: colors.background,
          color: colors.text,
          overflow: 'hidden',
          borderRadius: '8px',
          boxShadow: colors.shadow
        }}
      >
        {/* Main content - 2 panels */}
        <div style={{
          display: 'flex',
          flex: '1',
          overflow: 'hidden'
        }}>
          {/* Left panel - Repository */}
          <div
            ref={leftPanelRef}
            style={{
              width: maximizedPanel === 'files' ? '100%' :
                maximizedPanel !== 'none' ? '0%' : `${leftPanelWidth}%`,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              borderRight: maximizedPanel === 'none' ? `1px solid ${colors.border}` : 'none',
              overflow: 'hidden',
              transition: 'width 0.3s ease'
            }}
          >
            {/* Repository header - now just contains view controls */}
            <div style={{
              padding: '8px 12px',
              borderBottom: `1px solid ${colors.border}`,
              backgroundColor: colors.menuBackground,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: '40px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', color: colors.text }}>
                <span>Files</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={() => setViewMode('github')}
                  style={{
                    background: viewMode === 'github' ? colors.buttonActive : 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: colors.text
                  }}
                  title={provider === 'gitlab' ? "GitLab view" : "GitHub view"}
                >
                  {provider === 'gitlab' ? <FaGitlab size={14} /> : <FaGithub size={14} />}
                </button>
                <button
                  onClick={() => setViewMode('tree')}
                  style={{
                    background: viewMode === 'tree' ? colors.buttonActive : 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: colors.text
                  }}
                  title="Tree view"
                >
                  <FaCode size={14} />
                </button>
                {viewMode === 'tree' && (
                  <button
                    onClick={copyDirectoryStructure}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: colors.text
                    }}
                    title="Copy directory structure"
                  >
                    <FaFileAlt size={14} />
                  </button>
                )}
                <button
                  onClick={() => toggleMaximize('files')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: colors.text
                  }}
                  title={maximizedPanel === 'files' ? 'Restore' : 'Maximize'}
                >
                  {maximizedPanel === 'files' ? <FaCompress size={14} /> : <FaExpand size={14} />}
                </button>
              </div>
            </div>

            {/* File tree */}
            <div style={{
              flex: '1',
              overflow: 'auto',
              backgroundColor: colors.menuBackground
            }}>
              {directoryViewerComponent}
            </div>

            {/* Resize handle */}
            {maximizedPanel === 'none' && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  right: '-3px',
                  width: '6px',
                  height: '100%',
                  cursor: 'col-resize',
                  zIndex: 10
                }}
                onMouseDown={startResizing}
              />
            )}
          </div>

          {/* Right panel */}
          <div
            ref={rightPanelRef}
            style={{
              width: (maximizedPanel === 'fileViewer' || maximizedPanel === 'chat') ? '100%' :
                maximizedPanel === 'files' ? '0%' : `${rightPanelWidth}%`,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden',
              transition: 'width 0.3s ease'
            }}
          >
            {/* Top row - Chat */}
            <div style={{
              height: maximizedPanel === 'chat' ? '100%' :
                maximizedPanel === 'fileViewer' ? '0%' : `${topRowHeight}%`,
              borderBottom: maximizedPanel === 'none' ? `1px solid ${colors.border}` : 'none',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden',
              transition: 'height 0.3s ease'
            }}>
              {/* Chat header */}
              <div style={{
                padding: '8px 12px',
                borderBottom: `1px solid ${colors.border}`,
                backgroundColor: colors.menuBackground,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: '40px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', color: colors.text }}>
                  <span>Chat</span>
                </div>
                <button
                  className={styles.iconButton}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: colors.text,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px',
                    borderRadius: '4px'
                  }}
                  onClick={() => toggleMaximize('chat')}
                  title={maximizedPanel === 'chat' ? 'Minimize chat panel' : 'Maximize chat panel'}
                >
                  {maximizedPanel === 'chat' ? <FaCompress size={14} /> : <FaExpand size={14} />}
                </button>
              </div>

              {/* Chat component container */}
              <div style={{
                flex: '1',
                overflow: 'hidden',
                backgroundColor: colors.background
              }}>
                {chatComponent}
              </div>
            </div>

            {/* Horizontal resize handle */}
            {maximizedPanel === 'none' && (
              <div
                style={{
                  position: 'absolute',
                  top: `${topRowHeight}%`,
                  left: 0,
                  width: '100%',
                  height: '6px',
                  transform: 'translateY(-50%)',
                  cursor: 'row-resize',
                  zIndex: 10,
                  backgroundColor: colors.border
                }}
                onMouseDown={startVerticalResizing}
              />
            )}

            {/* Bottom row - File viewer */}
            <div style={{
              height: maximizedPanel === 'fileViewer' ? '100%' :
                maximizedPanel === 'chat' ? '0%' : `${bottomRowHeight}%`,
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden',
              transition: 'height 0.3s ease'
            }}>
              {/* File header */}
              <div style={{
                padding: '8px 12px',
                borderBottom: `1px solid ${colors.border}`,
                backgroundColor: colors.menuBackground,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: '40px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 'bold',
                  color: colors.text
                }}>
                  <FaCode size={14} style={{ color: colors.secondaryText }} />
                  <span>{selectedFile || 'No file selected'}</span>
                </div>
                <button
                  className={styles.iconButton}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: colors.text,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px',
                    borderRadius: '4px'
                  }}
                  onClick={() => toggleMaximize('fileViewer')}
                  title={maximizedPanel === 'fileViewer' ? 'Restore' : 'Maximize'}
                >
                  {maximizedPanel === 'fileViewer' ? <FaCompress size={14} /> : <FaExpand size={14} />}
                </button>
              </div>

              {/* File content */}
              <div style={{
                flex: '1',
                overflow: 'auto',
                backgroundColor: colors.background
              }}>
                {selectedFile ? (
                  fileViewerComponent
                ) : (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    padding: '20px',
                    color: colors.secondaryText,
                    textAlign: 'center'
                  }}>
                    <FaFile size={40} style={{ marginBottom: '16px', opacity: 0.6 }} />
                    <p style={{ fontSize: '14px', maxWidth: '300px' }}>
                      Select a file from the directory to view its contents
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 