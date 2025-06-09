import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useLocation, Link, useNavigate, Navigate } from 'react-router-dom';
import { Octokit } from '@octokit/rest';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { 
  FaFolder, FaFile, FaChevronRight, FaChevronLeft, 
  FaFolderOpen, FaChevronDown, FaList, FaTree, 
  FaCode, FaHome, FaGithub, FaStar, FaCodeBranch, FaEye,
  FaExclamationCircle, FaPaperPlane, FaRobot, FaUser, FaCog, FaSignOutAlt, FaSearch, FaCompress, FaExpand, FaLock, FaSun, FaMoon
} from 'react-icons/fa';
import { useTheme } from '../context/ThemeContext.js';
import { useAuth } from '../context/AuthContext.js';
import { v4 as uuidv4 } from 'uuid';
import { sendQueryToAI, fetchFileContent } from '../services/aiService.js';
import { setPageTitle } from '../utils/helpers.js';

// Add imports for the new components
import Header from './Header.js';
import Footer from './Footer.js';
import DirectoryTree from './DirectoryTree.js';
import ChatContainer from './ChatContainer.js';
import RepoViewer from './RepoViewer.js';

// Create a route guard component
const RedirectIfLoggedIn = ({ children }) => {
  const { isAuthenticated } = useAuth();
  
  // If user is logged in and trying to access the login page, redirect immediately
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  // Otherwise, render the children (login page)
  return children;
};

const generateRandomState = () => {
  return Math.random().toString(36).substring(2);
};

const RepoBrowser = () => {
  const { isAuthenticated, setIsAuthenticated, user } = useAuth();
  const { username, repo } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [path, setPath] = useState([]);
  const [isReadme, setIsReadme] = useState(false);
  const [readmeContent, setReadmeContent] = useState('');
  const [treeData, setTreeData] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [viewMode, setViewMode] = useState('interactive');
  const [repoInfo, setRepoInfo] = useState(null);
  
  // Chat state
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { 
      role: 'assistant', 
      content: `Hello! I'm **Repas**, your GitHub repository assistant on **ExplainGithub**. How can I help you explore \`${username}/${repo}\` today?` 
    }
  ]);
  const [isSending, setIsSending] = useState(false);

  // Add these new state variables
  const [showFileSearch, setShowFileSearch] = useState(false);
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileContents, setFileContents] = useState({});
  const chatInputRef = useRef(null);
  const fileSearchRef = useRef(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [showRepoInput, setShowRepoInput] = useState(false);

  // Add theme context
  const { theme, toggleTheme } = useTheme();
  
  // Add fade-in animation for components
  const fadeIn = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.4 } }
  };

  // Add a new state for tracking if the chat is maximized
  const [chatMaximized, setChatMaximized] = useState(false);

  // Add a new state for sample queries
  const [sampleQueries, setSampleQueries] = useState([
    "What does this repository do?",
    "Explain the project structure",
    "What are the main features?",
    "How do I contribute to this project?",
    "Show me the most important files"
  ]);

  // Add a toggle function for the maximize button
  const toggleChatMaximize = () => {
    setChatMaximized(!chatMaximized);
  };

  // Add a new state for query count
  const [queryCount, setQueryCount] = useState(0);
  const { currentUser } = useAuth();
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  // Add a state for the user ID
  const [anonymousUserId, setAnonymousUserId] = useState('');
  
  // Add a state variable to control the visibility of the private repo message
  const [showPrivateRepoMessage, setShowPrivateRepoMessage] = useState(true);
  
  // Add a new state for showing the already logged in notification
  const [showLoggedInNotice, setShowLoggedInNotice] = useState(false);
  
  // Add this to the component to display debug info when needed
  const [showDebug, setShowDebug] = useState(false);
  
  // Update the anonymous user tracking
  useEffect(() => {
    // For non-authenticated users, generate or retrieve an anonymous ID
    if (!isAuthenticated) {
      let anonymousUserId = localStorage.getItem('anonymousUserId');
      if (!anonymousUserId) {
        anonymousUserId = uuidv4();
        localStorage.setItem('anonymousUserId', anonymousUserId);
      }
    }
  }, [isAuthenticated]);

  // Update query count tracking for non-authenticated users
  useEffect(() => {
    if (!isAuthenticated) {
      let anonymousUserId = localStorage.getItem('anonymousUserId');
      if (anonymousUserId) {
        const storedCount = localStorage.getItem(`queryCount_${anonymousUserId}`);
        setQueryCount(storedCount ? parseInt(storedCount, 10) : 0);
      }
    }
  }, [isAuthenticated]);

  // Load the query count from localStorage on component mount with the user ID
  useEffect(() => {
    if (!isAuthenticated && anonymousUserId) {
      const storedCount = localStorage.getItem(`freeQueryCount_${anonymousUserId}`);
      if (storedCount) {
        setQueryCount(parseInt(storedCount, 10));
      }
    }
  }, [isAuthenticated, anonymousUserId]);
  
  // Update localStorage whenever queryCount changes
  useEffect(() => {
    if (!isAuthenticated && anonymousUserId) {
      localStorage.setItem(`freeQueryCount_${anonymousUserId}`, queryCount.toString());
    }
  }, [queryCount, isAuthenticated, anonymousUserId]);

  // Fetch repository info
  useEffect(() => {
    const fetchRepoInfo = async () => {
      try {
        const token = localStorage.getItem('github_token');
        
        // For non-logged-in users, just set minimal repo info
        if (!token) {
          setRepoInfo({
            name: repo,
            owner: { login: username },
            default_branch: 'main'
          });
          return;
        }

        const octokit = new Octokit({ auth: token });
        const { data } = await octokit.rest.repos.get({
          owner: username,
          repo: repo
        });
        
        setRepoInfo(data);
      } catch (error) {
        console.error('Error fetching repo info:', error);
        // Don't set error state here, just log it
      }
    };
    
    fetchRepoInfo();
  }, [username, repo]);

  // Update fetchRepoTree function to handle file paths properly
  const fetchRepoTree = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = isAuthenticated ? localStorage.getItem('authToken') : null;
      const octokit = new Octokit({
        auth: token
      });

      // Get the current path from the URL
      const currentPath = location.pathname.split('/').slice(3).join('/');
      console.log(`Fetching tree for ${username}/${repo} at path ${currentPath}`);
      
      // Add more detailed token debugging
      console.log('Token available:', !!token);
      
      if (!token && repoInfo?.private) {
        console.warn('No authentication token found for private repository');
        setError('Authentication required to view this private repository. Please log in.');
        setLoading(false);
        return;
      }
      
      // First get repository details to check if it's private
      try {
        const repoResponse = await octokit.repos.get({
          owner: username,
          repo: repo
        });
        
        // Update path segments for breadcrumb navigation
        if (currentPath) {
          const segments = currentPath.split('/').filter(Boolean);
          setPath(segments);
        } else {
          setPath([]);
        }
        
        // Try to get the full tree
        try {
          const treeResponse = await octokit.git.getTree({
            owner: username,
            repo: repo,
            tree_sha: repoResponse.data.default_branch,
            recursive: 1
          });
          
          if (treeResponse.data.tree && treeResponse.data.tree.length > 0) {
            console.log(`Successfully fetched tree with ${treeResponse.data.tree.length} items`);
            const tree = buildTree(treeResponse.data.tree);
            setTreeData(tree);
            
            // Check if current path is a file
            if (currentPath) {
              try {
                // Try to get the content directly
                const { data } = await octokit.repos.getContent({
                  owner: username,
                  repo: repo,
                  path: currentPath
                });
                
                // If it returns a single item, it's a file
                if (!Array.isArray(data) && data.type === 'file') {
                  // Handle file display directly instead of error
                  await handleFileDisplay(currentPath, {
                    type: 'blob',
                    path: currentPath,
                    sha: data.sha
                  });
                }
              } catch (error) {
                console.error('Error checking if path is file:', error);
              }
            }
          } else {
            setError('Repository appears to be empty');
          }
        } catch (error) {
          console.error('Error fetching tree:', error);
          setError('Failed to fetch repository contents');
        }
      } catch (error) {
        console.error('Error fetching repo details:', error);
        if (error.status === 404) {
          setError('Repository not found or access denied');
        } else {
          setError('Failed to fetch repository details');
        }
      }
    } catch (error) {
      console.error('Error in fetchRepoTree:', error);
      setError(error.message || 'An error occurred while fetching repository data');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to fetch contents of the current path
  const fetchCurrentPathContents = async (octokit, username, repo, path) => {
    try {
      if (!path) {
        // For the root directory
        const { data } = await octokit.repos.getContent({
          owner: username,
          repo: repo,
          path: ''
        });
        
        setDirectoryContents(data);
        
        // Look for a README file in the root
        await checkForReadme(octokit, username, repo, data);
      } else {
        try {
          const { data } = await octokit.repos.getContent({
            owner: username,
            repo: repo,
            path: path
          });
          
          // If it's a directory, handle it normally
          if (Array.isArray(data)) {
            setDirectoryContents(data);
            await checkForReadme(octokit, username, repo, data, path);
          } else {
            // It's a file - don't set an error, just display the file content
            await handleFileSelect(path, {
              type: 'blob',
              path: path,
              name: path.split('/').pop()
            });
          }
        } catch (error) {
          console.error(`Error fetching content for path ${path}:`, error);
          
          // Check if it's a 404 error (file or path not found)
          if (error.status === 404) {
            setDirectoryContents([]);
            setReadmeContent('');
            setIsReadme(false);
          } else {
            throw error; // Re-throw other errors
          }
        }
      }
    } catch (error) {
      console.error('Error in fetchCurrentPathContents:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Helper function to fetch and process README content
  const fetchReadme = async (owner, repo, path, octokit) => {
    try {
      const readmeResponse = await octokit.repos.getContent({
        owner,
        repo,
        path
      });
      
      const content = atob(readmeResponse.data.content);
      const html = path.toLowerCase().endsWith('.md') 
        ? marked.parse(content) 
        : `<pre>${content}</pre>`;
      
      setReadmeContent(DOMPurify.sanitize(html));
      setIsReadme(true);
    } catch (error) {
      console.error('Error fetching README:', error);
      setReadmeContent('');
      setIsReadme(false);
    }
  };

  // Then use a simple useEffect to call it
  useEffect(() => {
    fetchRepoTree();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, repo, location.pathname, isAuthenticated]);

  // Fetch content of current directory/file
  const fetchRepoContent = async (owner, repo, path = '') => {
    try {
      const token = localStorage.getItem('authToken');
      const octokit = new Octokit({
        auth: token
      });

      const response = await octokit.repos.getContent({
        owner,
        repo,
        path
      });

      return response.data;
    } catch (error) {
      if (error.status === 404) {
        throw new Error('Repository or file not found');
      } else if (error.status === 403) {
        throw new Error('Access denied. Please check if you have permission to view this repository.');
      }
      throw error;
    }
  };

  const navigateToParent = () => {
    const currentPath = location.pathname.split('/').slice(3);
    if (currentPath.length <= 1) {
      navigate(`/${username}/${repo}`);
    } else {
      const parentPath = currentPath.slice(0, -1).join('/');
      navigate(`/${username}/${repo}/${parentPath}`);
    }
  };

  // Toggle folder expansion in tree view
  const toggleFolder = (path) => {
    setExpandedFolders(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  // Render tree node recursively
  const renderTreeNode = (node, name, path) => {
    const isFolder = node.type === 'folder';
    const isExpanded = expandedFolders[path];
    
    const handleNodeClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (isFolder) {
        // Toggle expanded state for folders
        if (isExpanded) {
          setExpandedFolders(prev => ({
            ...prev,
            [path]: false
          }));
        } else {
          setExpandedFolders(prev => ({
            ...prev,
            [path]: true
          }));
        }
      } else {
        // Navigate to file
        navigate(`/${username}/${repo}/${path}`);
      }
    };
    
    return (
      <div key={path} className="tree-node">
        <div 
          className={`flex items-center py-1 px-2 rounded cursor-pointer ${
            theme === 'dark' 
              ? 'hover:bg-gray-700' 
              : 'hover:bg-gray-100'
          }`}
          onClick={handleNodeClick}
        >
          <div className="mr-1 w-4 text-center">
            {isFolder && (
              isExpanded ? 
                <FaChevronDown className="text-xs" /> : 
                <FaChevronRight className="text-xs" />
            )}
          </div>
          
          <div className="mr-2">
            {isFolder ? (
              isExpanded ? 
                <FaFolderOpen className={theme === 'dark' ? 'text-yellow-400' : 'text-yellow-500'} /> : 
                <FaFolder className={theme === 'dark' ? 'text-yellow-400' : 'text-yellow-500'} />
            ) : (
              <FaFile className={theme === 'dark' ? 'text-blue-400' : 'text-blue-500'} />
            )}
          </div>
          
          <div className="truncate">{name}</div>
        </div>
        
        {isFolder && isExpanded && node.children && (
          <div className="pl-6 border-l ml-3 mt-1 mb-1 border-gray-300 dark:border-gray-600">
            {Object.entries(node.children)
              .sort(([, a], [, b]) => {
                // Sort folders first, then files
                if (a.type === 'folder' && b.type !== 'folder') return -1;
                if (a.type !== 'folder' && b.type === 'folder') return 1;
                // Then sort alphabetically
                return a.name.localeCompare(b.name);
              })
              .map(([childName, childNode]) => 
                renderTreeNode(childNode, childName, childNode.path)
              )
            }
          </div>
        )}
      </div>
    );
  };

  // Build flat tree for traditional view
  const buildTraditionalTree = (treeData) => {
    if (!treeData) return [];
    
    const flattenTree = (node, prefix = '', isLast = true, path = '') => {
      if (!node) return [];
      
      let result = [];
      
      // Skip the root node
      if (node.name) {
        const displayPrefix = prefix + (isLast ? '└── ' : '├── ');
        const fullPath = path ? `${path}/${node.name}` : node.name;
        
        result.push({
          display: displayPrefix + node.name,
          path: fullPath,
          type: node.type,
        });
      }
      
      // Process children if this is a directory
      if (node.children) {
        const childEntries = Object.entries(node.children);
        
        childEntries.forEach(([childName, childNode], index) => {
          const childIsLast = index === childEntries.length - 1;
          const childPrefix = node.name ? prefix + (isLast ? '    ' : '│   ') : '';
          const childPath = path ? `${path}/${node.name}` : node.name || '';
          
          result = result.concat(
            flattenTree(childNode, childPrefix, childIsLast, childPath)
          );
        });
      }
      
      return result;
    };
    
    return flattenTree(treeData);
  };

  // Toggle view mode
  const toggleViewMode = () => {
    setViewMode(prev => prev === 'interactive' ? 'traditional' : 'interactive');
  };

  // Add a function to flatten the tree into a searchable file list
  const getAllFiles = (node, files = []) => {
    if (!node) return files;
      
      if (node.type === 'blob') {
      files.push(node);
      }
      
      if (node.children) {
      Object.values(node.children).forEach(child => {
        getAllFiles(child, files);
      });
    }
    
    return files;
  };

  // Add a function to check if the user has reached their query limit
  const hasReachedQueryLimit = () => {
    return !isAuthenticated && queryCount >= (process.env.REACT_APP_FREE_QUERY_LIMIT || 5);
  };

  // Update the handleChatSubmit function to include file references
  const handleChatSubmit = async (e) => {
    e.preventDefault();
    
    if (!chatMessage.trim()) return;
    
    // Check if user is authenticated for chat feature
    if (!isAuthenticated) {
      setShowLoginPrompt(true);
      return;
    }
    
    // Get user's message with the files tagged
    const userMessage = chatMessage.trim();
    
    // Create a unique ID for this message
    const messageId = uuidv4();
    
    // Clear the chat input and close file search
    setChatMessage('');
    setShowFileSearch(false);
    
    // Add the user message to chat history with the selected files
    const newUserMessage = {
      id: messageId,
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
      referencedFiles: selectedFiles.map(file => file.path) // Include file references
    };
    
    setChatHistory(prev => [...prev, newUserMessage]);
    
    // Clear selected files after sending
    setSelectedFiles([]);
    
    try {
      setIsSending(true);
      
      // Get the token for API requests
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentication required');
      }
      
      // Get file contents for referenced files
      const fileContentsPromises = selectedFiles.map(async (file) => {
        if (!fileContents[file.path]) {
          const content = await fetchFileContent(username, repo, file.path, token);
          return { path: file.path, content };
        }
        return { path: file.path, content: fileContents[file.path] };
      });
      
      const resolvedFileContents = await Promise.all(fileContentsPromises);
      
      // Send message to AI service
      const response = await sendQueryToAI({
        query: userMessage,
        repoName: `${username}/${repo}`,
        files: resolvedFileContents,
        token
      });
      
      // Add AI response to chat history
      const aiResponse = {
        id: uuidv4(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date().toISOString()
      };
      
      setChatHistory(prev => [...prev, aiResponse]);
      
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Add error message to chat
      const errorMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        isError: true,
        timestamp: new Date().toISOString()
      };
      
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
      scrollToBottom();
    }
  };

  // Add a new state for the selected file
  const [selectedFile, setSelectedFile] = useState(null);

  // Add a function to handle file selection from DirectoryTree
  const handleFileSelect = async (file) => {
    if (!isAuthenticated && repoInfo?.private) {
      setShowLoginPrompt(true);
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const octokit = new Octokit({
        auth: token
      });

      const response = await octokit.repos.getContent({
        owner: username,
        repo,
        path: file.path
      });

      // Update file contents cache
      setFileContents(prev => ({
        ...prev,
        [file.path]: response.data
      }));

      // Add to selected files if not already selected
      if (!selectedFiles.some(f => f.path === file.path)) {
        setSelectedFiles(prev => [...prev, file]);
      }
    } catch (error) {
      console.error('Error fetching file content:', error);
      // Show error message to user
    }
  };

  // Update the handleChatInputChange function to keep showing files after selection
  const handleChatInputChange = (e) => {
    const value = e.target.value;
    setChatMessage(value);
    
    // Remove the @ detection logic
    setShowFileSearch(false);
  };

  // Add a function to toggle file search visibility
  const toggleFileSearch = () => {
    setShowFileSearch(prev => !prev);
    
    // When opening the file search, populate with all files
    if (!showFileSearch && treeData) {
      const getAllFilesFromTree = (node, prefix = '', result = []) => {
        if (!node) return result;
        
        if (node.type === 'file' || node.type === 'blob') {
          result.push({
            path: node.path || (prefix ? `${prefix}/${node.name}` : node.name),
            type: 'blob',
            name: node.name
          });
        }
        
        if (node.children) {
          Object.entries(node.children).forEach(([childName, childNode]) => {
            const childPath = prefix ? `${prefix}/${childName}` : childName;
            if (childNode.type === 'file' || childNode.type === 'blob') {
              result.push({
                path: childNode.path || childPath,
                type: 'blob',
                name: childNode.name || childName
              });
            } else {
              getAllFilesFromTree(childNode, childPath, result);
            }
          });
        }
        
        return result;
      };
      
      const allFiles = getAllFilesFromTree(treeData);
      setFilteredFiles(allFiles.slice(0, 20)); // Limit to 20 files for performance
    }
  };

  // Update the file search filter function
  const handleFileSearchFilter = (e) => {
    const searchQuery = e.target.value.toLowerCase();
    setFileSearchQuery(searchQuery);
    
    if (treeData) {
      const getAllFilesFromTree = (node, prefix = '', result = []) => {
        // ... existing file search logic ...
      };
      
      const allFiles = getAllFilesFromTree(treeData);
      const filtered = allFiles.filter(file => 
        file.path.toLowerCase().includes(searchQuery)
      );
      
      setFilteredFiles(filtered.slice(0, 20));
    }
  };

  // Add a function to remove a selected file
  const removeSelectedFile = (filePath) => {
    setSelectedFiles(prev => prev.filter(f => f.path !== filePath));
  };

  // Helper function to format directory structure for AI context
  const formatDirectoryStructure = (node, depth = 0) => {
    if (!node) return '';
    
    let result = '';
    const indent = '  '.repeat(depth);
    
    if (depth > 0) {
      result += `${indent}${node.name}${node.type === 'tree' ? '/' : ''}\n`;
    }
    
    if (node.children) {
      const sortedChildren = Object.entries(node.children)
        .sort(([, a], [, b]) => {
          // Directories first, then files
          if (a.type === 'tree' && b.type !== 'tree') return -1;
          if (a.type !== 'tree' && b.type === 'tree') return 1;
          return a.name.localeCompare(b.name);
        });
      
      for (const [, child] of sortedChildren) {
        result += formatDirectoryStructure(child, depth + 1);
      }
    }
    
    return result;
  };

  // Rename the second getAllFiles function to avoid the duplicate declaration
  const getProjectType = (treeData) => {
    // Analyze files to determine project type
    const allFiles = collectAllFiles(treeData);
    
    if (allFiles.some(file => file.endsWith('.py'))) return 'Python';
    if (allFiles.some(file => file.endsWith('.js') || file.endsWith('.jsx'))) return 'JavaScript';
    if (allFiles.some(file => file.endsWith('.java'))) return 'Java';
    if (allFiles.some(file => file.endsWith('.go'))) return 'Go';
    if (allFiles.some(file => file.endsWith('.rb'))) return 'Ruby';
    if (allFiles.some(file => file.endsWith('.php'))) return 'PHP';
    
    return 'software';
  };

  // Renamed from getAllFiles to collectAllFiles
  const collectAllFiles = (node, prefix = '', result = []) => {
    if (!node || !node.children) return result;
    
    Object.entries(node.children).forEach(([name, child]) => {
      const path = prefix ? `${prefix}/${name}` : name;
      
      if (child.type === 'blob') {
        result.push(path);
      } else if (child.children) {
        collectAllFiles(child, path, result);
      }
    });
    
    return result;
  };

  const getMainDirectories = (treeData) => {
    if (!treeData || !treeData.children) return 'various files';
    
    const mainDirs = Object.keys(treeData.children)
      .filter(name => treeData.children[name].type === 'tree')
      .slice(0, 3);
      
    if (mainDirs.length === 0) return 'various files';
    if (mainDirs.length === 1) return `a main "${mainDirs[0]}" directory`;
    
    return `main directories like ${mainDirs.map(dir => `"${dir}"`).join(', ')}`;
  };

  // Update other functions to use collectAllFiles instead of getAllFiles
  const getFileCount = (treeData) => {
    return collectAllFiles(treeData).length;
  };

  const getFolderCount = (treeData) => {
    let count = 0;
    
    const countFolders = (node) => {
      if (!node || !node.children) return;
      
      Object.values(node.children).forEach(child => {
        if (child.type === 'tree') {
          count++;
          countFolders(child);
        }
      });
    };
    
    countFolders(treeData);
    return count;
  };

  const getImportantFiles = (treeData, username, repo) => {
    const allFiles = collectAllFiles(treeData);
    
    // Look for common important files
    const importantPatterns = [
      'README.md', 'package.json', 'requirements.txt', 'setup.py',
      'Dockerfile', '.gitignore', 'LICENSE', 'CONTRIBUTING.md',
      'main.py', 'index.js', 'app.js', 'src/index', 'src/main'
    ];
    
    const importantFiles = allFiles.filter(file => 
      importantPatterns.some(pattern => file.includes(pattern))
    ).slice(0, 5);
    
    if (importantFiles.length === 0) {
      return 'No key files identified. You can browse the file structure to explore the codebase.';
    }
    
    return importantFiles.map(file => 
      `- [${file}](https://github.com/${username}/${repo}/blob/main/${file}): ${getFileDescription(file)}`
    ).join('\n\n');
  };

  const getFileDescription = (filePath) => {
    const fileName = filePath.split('/').pop().toLowerCase();
    
    if (fileName === 'readme.md') return 'Project documentation and overview';
    if (fileName === 'package.json') return 'Node.js dependencies and project configuration';
    if (fileName === 'requirements.txt') return 'Python dependencies';
    if (fileName === 'setup.py') return 'Python package configuration';
    if (fileName === 'dockerfile') return 'Container configuration for Docker';
    if (fileName === '.gitignore') return 'Specifies files ignored by Git';
    if (fileName === 'license') return 'Project license information';
    if (fileName === 'contributing.md') return 'Guidelines for contributing to the project';
    if (fileName.includes('main') || fileName.includes('index')) return 'Entry point for the application';
    
    return 'A key file in the project';
  };

  // Render chat message
  const renderChatMessage = (message, index) => {
    if (message.role === 'user') {
      return (
        <div key={index} className="chat-bubble chat-bubble--user">
          <div className="flex items-start">
            <div className="flex-1 overflow-hidden">
              <p>{message.content}</p>
            </div>
          </div>
          <div className="chat-bubble-time">You</div>
        </div>
      );
    } else {
      // For assistant messages
      return (
        <div key={index} className={`chat-bubble chat-bubble--assistant ${theme === 'dark' ? 'text-[var(--color-dark-text)]' : ''}`}>
          <div className="flex items-start">
            <div className="flex-1 overflow-hidden">
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ 
                  __html: DOMPurify.sanitize(marked.parse(message.content)) 
                }}
              />
            </div>
          </div>
          <div className="chat-bubble-time">Repas</div>
        </div>
      );
    }
  };

  // Add click outside handler for file search dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        fileSearchRef.current && 
        !fileSearchRef.current.contains(event.target) &&
        chatInputRef.current &&
        !chatInputRef.current.contains(event.target)
      ) {
        setShowFileSearch(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Add a function to handle repository URL submission
  const handleRepoSubmit = (e) => {
    e.preventDefault();
    
    // Parse the GitHub URL to extract username and repo
    try {
      const url = new URL(repoUrl);
      if (url.hostname === 'github.com') {
        const pathParts = url.pathname.split('/').filter(Boolean);
        if (pathParts.length >= 2) {
          const repoUsername = pathParts[0];
          const repoName = pathParts[1];
          navigate(`/${repoUsername}/${repoName}`);
          setRepoUrl('');
          setShowRepoInput(false);
        } else {
          alert('Invalid GitHub repository URL');
        }
      } else {
        alert('Please enter a valid GitHub URL');
      }
    } catch (error) {
      // If it's not a URL, check if it's in the format username/repo
      const parts = repoUrl.split('/').filter(Boolean);
      if (parts.length === 2) {
        navigate(`/${parts[0]}/${parts[1]}`);
        setRepoUrl('');
        setShowRepoInput(false);
      } else {
        alert('Please enter a valid GitHub repository URL or username/repo format');
      }
    }
  };

  // Add this function to render the traditional view of the repository
  const renderTraditionalView = (treeData) => {
    if (!treeData) return null;
    
    // Function to build the traditional tree view
    const buildTraditionalTree = (node, prefix = '', isLast = true, parentPrefixes = []) => {
      if (!node) return [];
      
      let result = [];
      
      // Skip the root node
      if (node.name) {
        const displayPrefix = parentPrefixes.join('') + (isLast ? '└── ' : '├── ');
        const itemPath = node.path;
        const itemType = node.type;
        
        // Add this node to the result
        result.push({
          display: displayPrefix + node.name,
          path: itemPath,
          type: itemType
        });
      }
      
      // Process children if this is a directory
      if (node.children) {
        const childKeys = Object.keys(node.children);
        
        childKeys.forEach((key, index) => {
          const child = node.children[key];
          const isChildLast = index === childKeys.length - 1;
          
          // Calculate the new prefix for children
          const newParentPrefixes = [...parentPrefixes];
          if (node.name) {
            newParentPrefixes.push(isLast ? '    ' : '│   ');
          }
          
          // Recursively process children
          const childResults = buildTraditionalTree(
            child,
            prefix + (isLast ? '    ' : '│   '),
            isChildLast,
            newParentPrefixes
          );
          
          result = [...result, ...childResults];
        });
      }
      
      return result;
    };
    
    // Build the tree and render it
    const treeItems = buildTraditionalTree(treeData);
    
    return (
      <div className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
        {treeItems.map((item, index) => (
          <div key={index} className="py-1">
            <span 
              className={`cursor-pointer hover:opacity-80 transition-opacity ${
                item.type === 'tree' 
                  ? theme === 'dark' ? 'text-yellow-400 font-bold' : 'text-yellow-700 font-bold'
                  : ''
              }`}
              onClick={() => navigate(`/${username}/${repo}/${item.path}`)}
            >
              {item.display}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // Add a function to handle clicking a sample query
  const handleSampleQueryClick = (query) => {
    setChatMessage(query);
    // Optional: Auto-submit the query
    // handleChatSubmit({ preventDefault: () => {} });
  };

  // Add a new ref for the chat container
  const chatContainerRef = useRef(null);

  // Add a function to scroll to the latest message
  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  // Add a useEffect to scroll to bottom when chat history changes
  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  // Update the AccessLimitationsInfo component with additional message about private repositories
  const AccessLimitationsInfo = ({ queryCount, theme }) => {
    const freeQueryLimit = process.env.REACT_APP_FREE_QUERY_LIMIT || 5;
    const queriesRemaining = Math.max(0, freeQueryLimit - queryCount);
    
    return (
      <div className={`mt-4 p-4 rounded-lg border ${
        theme === 'dark' 
          ? 'bg-gray-800 border-gray-700 text-gray-300' 
          : 'bg-gray-50 border-gray-200 text-gray-700'
      }`}>
        <div className="flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <FaLock className="mr-2 text-yellow-500" />
              <p className="text-sm">
                You're browsing <span className="font-medium">ExplainGithub</span> as a guest. You have <span className="font-medium">{queriesRemaining}</span> free AI queries remaining.
              </p>
            </div>
            <button
              onClick={navigateToLogin}
              className={`ml-4 px-4 py-1.5 rounded-md text-sm font-medium ${
                theme === 'dark'
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              Log in
            </button>
          </div>
          
          {showPrivateRepoMessage && (
            <div className={`text-sm p-3 rounded ${
              theme === 'dark' 
                ? 'bg-gray-700' 
                : 'bg-gray-100'
            }`}>
              <p className="flex items-start">
                <FaLock className="mr-2 mt-0.5 text-yellow-500 flex-shrink-0" />
                <span>
                  <strong>Access private repositories:</strong> Upgrade your permissions to view and explore your private repositories. If you've already set up your permissions, please ignore this message.
                </span>
              </p>
              <div className="flex mt-2 space-x-2 justify-end">
                <button
                  onClick={navigateToLogin}
                  className={`px-3 py-1 rounded text-xs font-medium ${
                    theme === 'dark'
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  Upgrade Access
                </button>
                <button
                  onClick={() => setShowPrivateRepoMessage(false)}
                  className={`px-3 py-1 rounded text-xs font-medium ${
                    theme === 'dark'
                      ? 'bg-gray-600 hover:bg-gray-500 text-gray-300'
                      : 'bg-gray-300 hover:bg-gray-400 text-gray-700'
                  }`}
                >
                  Not now
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Update the header section to properly handle the logout button display
  const handleLogout = () => {
    navigate('/login');
  };

  // Update the document title
  useEffect(() => {
    setPageTitle(`${username}/${repo}`);
  }, [username, repo]);

  // Update the navigateToLogin function
  const navigateToLogin = () => {
    navigate('/login');
  };

  // This useEffect will check for location.pathname changes
  useEffect(() => {
    if (isAuthenticated && location.pathname === '/login') {
      navigate('/');
      setShowLoggedInNotice(true);
      setTimeout(() => setShowLoggedInNotice(false), 5000);
    }
  }, [isAuthenticated, location.pathname]);

  // Add this near the top of your component to debug the currentUser
  useEffect(() => {
    console.log("Current user state:", isAuthenticated);
  }, [isAuthenticated]);

  // Improved buildTree function to better handle folders
  const buildTree = (paths) => {
    // If paths is not an array or is empty, return an empty object with children
    if (!Array.isArray(paths) || paths.length === 0) {
      console.log('Received invalid tree data:', paths);
      return { name: '', type: 'folder', children: {}, path: '' };
    }
    
    console.log('Building tree from', paths.length, 'items');
    
    const root = { name: '', type: 'folder', children: {}, path: '' };
    
    // First, sort paths to ensure folders come before files
    paths.sort((a, b) => {
      // Sort by path depth first (shorter paths first)
      const aDepth = a.path.split('/').length;
      const bDepth = b.path.split('/').length;
      if (aDepth !== bDepth) return aDepth - bDepth;
      
      // Then sort by type (tree/folder before blob/file)
      const aIsFolder = a.type === 'tree' || a.type === 'dir' || a.type === 'folder';
      const bIsFolder = b.type === 'tree' || b.type === 'dir' || b.type === 'folder';
      if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
      
      // Finally sort by name
      return a.path.localeCompare(b.path);
    });
    
    // Process each path to build the tree
    paths.forEach(item => {
      if (!item.path) {
        console.log('Skipping item without path:', item);
        return;
      }
      
      const pathParts = item.path.split('/');
      let currentLevel = root;
      
      // Create folder nodes for each part of the path
      pathParts.forEach((part, index) => {
        const isLastPart = index === pathParts.length - 1;
        const currentPath = pathParts.slice(0, index + 1).join('/');
        
        // If this node doesn't exist yet, create it
        if (!currentLevel.children[part]) {
          // Determine if this is a folder or file
          const isFolder = isLastPart ? 
            (item.type === 'tree' || item.type === 'dir' || item.type === 'folder') : 
            true; // Non-last parts are always folders
          
          currentLevel.children[part] = {
            name: part,
            type: isFolder ? 'folder' : 'file',
            children: isFolder ? {} : undefined,
            path: currentPath,
            sha: item.sha,
            size: item.size
          };
        }
        
        // Move to the next level for the next part of the path
        currentLevel = currentLevel.children[part];
      });
    });
    
    // Log the structure for debugging
    console.log('Tree structure built:', Object.keys(root.children).length, 'top-level items');
    
    return root;
  };

  // Add a keyboard shortcut to toggle debug mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+Shift+D to toggle debug mode
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        setShowDebug(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Update the file content display logic in the RepoBrowser component
  useEffect(() => {
    // This effect will handle fetching file content when a path is selected
    const fetchContentIfFile = async () => {
      if (path.length > 0) {
        try {
          const token = isAuthenticated ? localStorage.getItem('authToken') : localStorage.getItem('github_token');
          const octokit = new Octokit({ auth: token });
          
          // Construct the path from current path segments
          const filePath = path.join('/');
          
          // Get file content 
          const { data } = await octokit.repos.getContent({
            owner: username,
            repo: repo,
            path: filePath
          });
          
          // If it's a directory, we don't need to do anything here
          if (Array.isArray(data)) {
            setIsReadme(false);
            setReadmeContent('');
            return;
          }
          
          // Otherwise it's a file, so we'll display its content
          setIsReadme(true);
          
          // Handle different file types
          if (data.type === 'file' && data.content) {
            const content = atob(data.content);
            const fileName = data.name.toLowerCase();
            
            // Format the content based on file type
            if (fileName.endsWith('.md')) {
              // Markdown files
              const html = marked(content);
              const sanitized = DOMPurify.sanitize(html);
              setReadmeContent(sanitized);
            } else if (fileName.endsWith('.js') || fileName.endsWith('.jsx') || 
                      fileName.endsWith('.ts') || fileName.endsWith('.tsx') ||
                      fileName.endsWith('.css') || fileName.endsWith('.html') ||
                      fileName.endsWith('.json') || fileName.endsWith('.py')) {
              // Code files - use pre/code formatting
              const sanitized = DOMPurify.sanitize(content);
              setReadmeContent(`<pre><code>${sanitized}</code></pre>`);
            } else {
              // Text files
              const sanitized = DOMPurify.sanitize(content);
              setReadmeContent(`<pre>${sanitized}</pre>`);
            }
          }
        } catch (error) {
          console.error('Error fetching file content:', error);
          setError('Error loading file content');
        }
      }
    };
    
    fetchContentIfFile();
  }, [username, repo, path, isAuthenticated]);

  // Add these state variables near the other state declarations in RepoBrowser
  const [directoryContents, setDirectoryContents] = useState([]);

  // Add this function to check for README files in a directory
  const checkForReadme = async (octokit, username, repo, contents, currentPath = '') => {
    try {
      // Look for README files in any case variation (README.md, readme.md, etc.)
      const readmeFile = contents.find(item => 
        item.name.toLowerCase().includes('readme') && 
        item.type === 'file'
      );
      
      if (readmeFile) {
        // Fetch the README content
        const { data } = await octokit.repos.getContent({
          owner: username,
          repo: repo,
          path: readmeFile.path
        });
        
        if (data.content) {
          // Decode and render as markdown
          const content = atob(data.content);
          const html = marked(content);
          const sanitized = DOMPurify.sanitize(html);
          
          setReadmeContent(sanitized);
          setIsReadme(true);
        }
      } else {
        // No README found
        setReadmeContent('');
        setIsReadme(false);
      }
    } catch (error) {
      console.error('Error checking for README:', error);
      setReadmeContent('');
      setIsReadme(false);
    }
  };

  // Rename this function to differentiate it from the chat file selection handler
  const handleFileDisplay = async (filePath, fileNode) => {
    try {
      // Get auth token
      const token = isAuthenticated ? localStorage.getItem('authToken') : localStorage.getItem('github_token');
      const octokit = new Octokit({ auth: token });
      
      // Fetch file content
      const { data } = await octokit.repos.getContent({
        owner: username,
        repo: repo,
        path: filePath
      });
      
      // Display file content
      if (data.type === 'file' && data.content) {
        const content = atob(data.content);
        const fileName = filePath.split('/').pop().toLowerCase();
        
        // Set flag for README content
        setIsReadme(true);
        
        // Format content based on file type
        if (fileName.endsWith('.md')) {
          // Markdown files
          const html = marked(content);
          const sanitized = DOMPurify.sanitize(html);
          setReadmeContent(sanitized);
        } else if (fileName.endsWith('.js') || fileName.endsWith('.jsx') || 
                  fileName.endsWith('.ts') || fileName.endsWith('.tsx') ||
                  fileName.endsWith('.css') || fileName.endsWith('.html') ||
                  fileName.endsWith('.json') || fileName.endsWith('.py')) {
          // Code files - use pre/code formatting
          const sanitized = DOMPurify.sanitize(content);
          setReadmeContent(`<pre><code>${sanitized}</code></pre>`);
        } else {
          // Text files
          const sanitized = DOMPurify.sanitize(content);
          setReadmeContent(`<pre>${sanitized}</pre>`);
        }
        
        // Set the selected file
        setSelectedFile(filePath);
        
        // Update window title but don't change URL
        document.title = `${filePath} - ${username}/${repo}`;
      }
    } catch (error) {
      console.error('Error fetching file content:', error);
      setError('Error loading file content');
    }
  };

  // Update the useEffect for checking authentication and repo access
  useEffect(() => {
    const checkAccess = async () => {
      try {
        // For private repos, require authentication
        if (repoInfo?.private && !isAuthenticated) {
          setError('This is a private repository. Please log in to access it.');
          return;
        }

        await fetchRepoTree();
      } catch (error) {
        console.error('Error checking repository access:', error);
        setError(error.message);
      }
    };

    if (repoInfo) {
      checkAccess();
    }
  }, [repoInfo, isAuthenticated]);

  // Update the chat container render logic
  const renderChatContainer = () => {
    if (!isAuthenticated) {
      return (
        <div className={`rounded-lg border p-4 ${
          theme === 'dark' 
            ? 'bg-gray-700 border-gray-600 text-gray-300' 
            : 'bg-gray-100 border-gray-300 text-gray-700'
        }`}>
          <div className="flex flex-col">
            <div className="flex items-center mb-2">
              <FaLock className="mr-2 text-blue-500" />
              <span className="font-medium">Chat with AI about this repository</span>
            </div>
            <p className="text-sm mb-3">
              Log in to chat with our AI assistant about this repository. Get explanations, ask questions, and explore the code.
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => navigate('/login')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium ${
                  theme === 'dark'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                Log in to chat
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <ChatContainer
        messages={chatHistory}
        onSubmit={handleChatSubmit}
        isLoading={isSending}
        selectedFiles={selectedFiles}
        onRemoveFile={removeSelectedFile}
      />
    );
  };

  // Update the repository info section
  const renderRepoInfo = () => {
    if (!repoInfo) return null;

    return (
      <div className={`p-4 border-b ${
        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold">
              {repoInfo.name}
            </h1>
            {repoInfo.private && (
              <span className="ml-2 px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">
                Private
              </span>
            )}
          </div>
          {!isAuthenticated && repoInfo.private && (
            <button
              onClick={handleInstallClick}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Install GitHub App
            </button>
          )}
        </div>
      </div>
    );
  };

  const handleInstallClick = async () => {
    try {
      // Generate state value
      const stateValue = uuidv4();
      
      // Create state object with minimal required data
      const stateData = {
        state: stateValue,
        timestamp: Date.now()
      };

      // Store state in localStorage for persistence
      localStorage.setItem('github_oauth_state', stateValue);
      localStorage.setItem('github_oauth_timestamp', Date.now().toString());

      // Build GitHub OAuth URL with correct parameters
      const authUrl = 'https://github.com/login/oauth/authorize';
      const params = new URLSearchParams({
        client_id: process.env.REACT_APP_GITHUB_CLIENT_ID,
        redirect_uri: process.env.REACT_APP_GITHUB_REDIRECT_URI,
        state: stateValue,
        scope: 'repo user',
      });

      // Redirect to GitHub OAuth
      window.location.href = `${authUrl}?${params}`;

    } catch (error) {
      console.error('OAuth initialization failed:', error);
      setError('Failed to initialize GitHub login. Please try again.');
    }
  };

  // Update the handleOAuthCallback function
  const handleOAuthCallback = async (code, state) => {
    try {
      // Verify state matches
      const savedState = localStorage.getItem('github_oauth_state');
      const timestamp = parseInt(localStorage.getItem('github_oauth_timestamp') || '0');
      
      if (!savedState || savedState !== state || Date.now() - timestamp > 30 * 60 * 1000) {
        throw new Error('Invalid or expired OAuth state');
      }

      // Clear OAuth state data
      localStorage.removeItem('github_oauth_state');
      localStorage.removeItem('github_oauth_timestamp');

      // Exchange code for token through your backend
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/github/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, state }),
        credentials: 'include' // Important for cookies
      });

      if (!response.ok) {
        throw new Error('Failed to exchange code for token');
      }

      const data = await response.json();
      
      if (data.access_token) {
        localStorage.setItem('github_token', data.access_token);
        setIsAuthenticated(true);
        navigate(`/${username}/${repo}`);
      } else {
        throw new Error('No access token received');
      }

    } catch (error) {
      console.error('OAuth callback failed:', error);
      setError('Authentication failed. Please try again.');
      navigate('/login');
    }
  };

  // Add useEffect to handle OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (code && state) {
      console.log('🔄 OAuth callback detected');
      console.log('✅ Authorization code received:', code.substring(0, 8) + '...');
      handleOAuthCallback(code, state);
    }
  }, []);

  const handleGitHubLogin = () => {
    console.log('🔄 Initiating GitHub login...');
    
    const githubUrl = `https://github.com/login/oauth/authorize?` +
      `client_id=${process.env.REACT_APP_GITHUB_CLIENT_ID}` +
      `&redirect_uri=${process.env.REACT_APP_GITHUB_CALLBACK_URL}` +
      `&scope=repo user`;
    
    console.log('🔗 GitHub OAuth URL:', githubUrl);
    console.log('🔄 Redirecting to GitHub...');
    
    window.location.href = githubUrl;
  };

  if (loading && !treeData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-6"></div>
          <h2 className="text-xl font-semibold text-gray-700">Loading repository...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${theme === 'dark' ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-800'}`}>
      {/* Rest of your component JSX */}
      {!isAuthenticated && (
        <AccessLimitationsInfo queryCount={queryCount} theme={theme} />
      )}

      {showLoggedInNotice && (
        <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 flex items-center justify-between ${
          theme === 'dark' 
            ? 'bg-gray-800 text-white border border-gray-700' 
            : 'bg-white text-gray-800 border border-gray-200'
        }`}>
          <div className="flex items-center">
            <svg className={`w-5 h-5 mr-2 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-500'}`} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9z" clipRule="evenodd"></path>
            </svg>
            <span>You're already logged in</span>
          </div>
          <div className="flex items-center ml-4">
            <button
              onClick={() => navigate(`/${username}/${repo}`)}
              className={`px-3 py-1 text-sm rounded-md mr-2 ${
                theme === 'dark' 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              Back to Repository
            </button>
            <button 
              onClick={() => setShowLoggedInNotice(false)}
              className="text-gray-500 hover:text-gray-700 ml-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RepoBrowser;