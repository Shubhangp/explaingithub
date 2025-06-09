import axios from 'axios';
import { FaGitlab } from 'react-icons/fa';
import { 
  BaseGitProvider, 
  ProviderType, 
  getCacheKey, 
  getFromCache, 
  saveToCache 
} from './base-provider';
import { FileItem, TreeNode } from '@/app/types/repository';

export class GitLabProvider implements BaseGitProvider {
  name: ProviderType = 'gitlab';
  displayName = 'GitLab';
  iconComponent = FaGitlab;
  
  // Cache for resolved project paths
  private projectPathCache: Record<string, string> = {};
  
  constructor() {
    // Initialize path cache from localStorage if available
    if (typeof window !== 'undefined') {
      try {
        const cachedPaths = localStorage.getItem('gitlabProjectPathCache');
        if (cachedPaths) {
          this.projectPathCache = JSON.parse(cachedPaths);
          console.log(`GitLab: Loaded ${Object.keys(this.projectPathCache).length} cached project paths`);
        }
      } catch (e) {
        console.error('GitLab: Error loading project path cache:', e);
      }
    }
  }
  
  // Save the path cache to localStorage
  private savePathCache() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('gitlabProjectPathCache', JSON.stringify(this.projectPathCache));
      } catch (e) {
        console.error('GitLab: Error saving project path cache:', e);
      }
    }
  }
  
  // Authentication methods
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getAccessToken();
    return !!token;
  }
  
  // Try to get a valid access token from multiple sources
  async getAccessToken(): Promise<string | null> {
    console.log('GitLab: Attempting to get access token');
    
    // First try getting the token from localStorage
    try {
      const possibleTokenKeys = ['gitlabToken', 'gitlab_token', 'GITLAB_TOKEN'];
      for (const key of possibleTokenKeys) {
        const token = localStorage.getItem(key);
        if (token) {
          console.log(`GitLab: Found token in localStorage with key: ${key} (length: ${token.length})`);
          
          // Validate the token with a simple API call
          try {
            const response = await axios.get('https://gitlab.com/api/v4/user', {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.status === 200) {
              console.log('GitLab: Token validated successfully');
          return token;
            }
          } catch (error) {
            console.log('GitLab: Token validation failed, will try to refresh');
            // Continue to next token or source if validation fails
          }
        }
      }
      console.log('GitLab: No valid token found in localStorage');
    } catch (storageError) {
      console.error('GitLab: Error accessing localStorage:', storageError);
    }
    
    // If localStorage doesn't have a valid token, try to get it from the API
    try {
      console.log('GitLab: Trying to fetch token from API');
      const response = await fetch('/api/user/current-token?provider=gitlab');
      if (response.ok) {
        const data = await response.json();
        if (data.token) {
          console.log(`GitLab: Successfully retrieved token from API (length: ${data.token.length})`);
          // Store it in localStorage for future use
          localStorage.setItem('gitlabToken', data.token);
          return data.token;
        } else {
          console.log('GitLab: API response OK but no token in the data');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error(`GitLab: API request failed, status: ${response.status}`, errorData);
      }
    } catch (apiError) {
      console.error('GitLab: Error fetching token from API:', apiError);
    }
    
    console.log('GitLab: Failed to get access token from any source');
    return null;
  }
  
  getAuthUrl(): string {
    // Redirect to the settings page where user can add GitLab token
    return '/settings?provider=gitlab';
  }
  
  // Resolve the correct project path using the GitLab API
  async resolveProjectPath(owner: string, repo: string): Promise<string> {
    // Check if we already have this path in our cache
    const cacheKey = `${owner}/${repo}`;
    
    if (this.projectPathCache[cacheKey]) {
      console.log(`GitLab: Using cached project path for ${cacheKey}: ${this.projectPathCache[cacheKey]}`);
      return this.projectPathCache[cacheKey];
    }

    // Normalize the owner parameter - decode it to handle URL encoding
    const decodedOwner = decodeURIComponent(owner);
    console.log(`GitLab: Resolving project path for owner: ${decodedOwner}, repo: ${repo}`);

    // Try with the exact path first (common case)
    // Combine owner and repo - this is the most common case
    const directPath = `${decodedOwner}/${repo}`;
    console.log(`GitLab: Trying direct project path: ${directPath}`);
    
    const token = await this.getAccessToken();
    if (!token) {
      throw new Error('GitLab access token not found. Please add your GitLab token in settings.');
    }
    
    // Get GitLab instance URL
    let gitlabBaseUrl = 'https://gitlab.com';
    try {
      const storedUrl = localStorage.getItem('gitlabInstanceUrl');
      if (storedUrl) {
        gitlabBaseUrl = storedUrl;
        console.log(`GitLab: Using custom instance URL: ${gitlabBaseUrl}`);
      }
    } catch (error) {
      console.log('GitLab: Could not access localStorage for instance URL, using default');
    }
    
    // First try: Use the direct path (most common case)
    try {
      // Important: Ensure proper URL encoding just once
      // Decode first to normalize any encoded values from URL parameters
      const decodedPath = `${decodedOwner}/${repo}`;
      // Then encode properly for the API call
      const encodedPath = encodeURIComponent(decodedPath);
      
      console.log(`GitLab: Checking project with path: ${decodedPath} (encoded: ${encodedPath})`);
      
      const response = await axios.get(
        `${gitlabBaseUrl}/api/v4/projects/${encodedPath}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (response.data && response.data.path_with_namespace) {
        this.projectPathCache[cacheKey] = response.data.path_with_namespace;
        this.savePathCache();
        console.log(`GitLab: Found project with direct path: ${response.data.path_with_namespace}`);
        return response.data.path_with_namespace;
      }
    } catch (error: any) {
      console.log(`GitLab: Direct path check failed, falling back to search: ${error.message}`);
    }
    
    // Step 2: If direct lookup fails, try listing the user's own projects
    if (currentUser) {
      try {
        console.log(`GitLab: Listing projects for current user ${currentUser.username}`);
        const response = await axios.get(`${gitlabBaseUrl}/api/v4/projects?owned=true&per_page=100`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (Array.isArray(response.data) && response.data.length > 0) {
          console.log(`GitLab: Found ${response.data.length} projects owned by current user`);
          
          // Find a project matching the repository name
          const matchingProject = response.data.find(
            project => project.name.toLowerCase() === repo.toLowerCase()
          );
          
          if (matchingProject) {
            console.log(`GitLab: Found matching project in user's projects: ${matchingProject.path_with_namespace}`);
            this.projectPathCache[cacheKey] = matchingProject.path_with_namespace;
            this.savePathCache();
            return matchingProject.path_with_namespace;
          }
        }
      } catch (error) {
        console.log(`GitLab: Error listing user's projects:`, error);
      }
    }
    
    // Step 3: If direct lookup fails, try project search by name
    try {
      console.log(`GitLab: Searching for projects with name: ${repo}`);
      const searchUrl = `${gitlabBaseUrl}/api/v4/projects?search=${encodeURIComponent(repo)}`;
      
      const response = await axios.get(searchUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (Array.isArray(response.data) && response.data.length > 0) {
        // Look through results to find the best match
        console.log(`GitLab: Found ${response.data.length} potential projects matching "${repo}"`);
        
        // Try to find an exact match for the owner/repo
        // Look for path-based matches only, not display names
        const exactMatch = response.data.find(project => {
          // Extract the namespace part (owner) and project name part
          const fullPath = project.path_with_namespace;
          const lastSlashIndex = fullPath.lastIndexOf('/');
          const namespace = fullPath.substring(0, lastSlashIndex);
          const projectName = fullPath.substring(lastSlashIndex + 1);
          
          // Check if the project part matches our repo name
          if (projectName.toLowerCase() !== repo.toLowerCase()) {
            return false;
          }
          
          // Check if owner matches namespace path only, not display name
          if (project.namespace) {
            // GitLab API provides these fields in the namespace object
            const pathMatch = project.namespace.path === decodedOwner;
            
            console.log(`GitLab: Checking path match for ${fullPath}:`);
            console.log(`  - Path match: ${pathMatch} (${project.namespace.path} vs ${decodedOwner})`);
            
            return pathMatch;
          }
          
          return false;
        });
        
        if (exactMatch) {
          // Use the path_with_namespace from the API which is the correct full path
          console.log(`GitLab: Found exact project match: ${exactMatch.path_with_namespace}`);
          this.projectPathCache[cacheKey] = exactMatch.path_with_namespace;
          this.savePathCache();
          return exactMatch.path_with_namespace;
        }
        
        // If no exact match, try fuzzy matching based on path only
        const fuzzyMatches = response.data.filter(project => {
          // Get the namespace info
          if (project.namespace) {
            const namespacePath = project.namespace.path.toLowerCase();
            const ownerLower = decodedOwner.toLowerCase();
            
            // Check for partial matches in namespace path only
            return namespacePath.includes(ownerLower) || 
                   ownerLower.includes(namespacePath);
          }
          return false;
        });
        
        if (fuzzyMatches.length > 0) {
          console.log(`GitLab: Found fuzzy match: ${fuzzyMatches[0].path_with_namespace}`);
          this.projectPathCache[cacheKey] = fuzzyMatches[0].path_with_namespace;
          this.savePathCache();
          return fuzzyMatches[0].path_with_namespace;
        }
        
        // If still no match but we have results, use the first one (may not be correct)
        console.log(`GitLab: No exact match found, using first result: ${response.data[0].path_with_namespace}`);
        this.projectPathCache[cacheKey] = response.data[0].path_with_namespace;
        this.savePathCache();
        return response.data[0].path_with_namespace;
      }
      
      console.log(`GitLab: No matches found in search for ${repo}`);
    } catch (error) {
      console.error('GitLab: Error during project search:', error);
    }
    
    // If all else fails, try to find groups that match the owner path
    try {
      console.log(`GitLab: Trying to find groups with path: ${decodedOwner}`);
      const groupSearchUrl = `${gitlabBaseUrl}/api/v4/groups?search=${encodeURIComponent(decodedOwner)}`;
      
      const groupResponse = await axios.get(groupSearchUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (Array.isArray(groupResponse.data) && groupResponse.data.length > 0) {
        console.log(`GitLab: Found ${groupResponse.data.length} potential groups matching "${decodedOwner}"`);
        
        // Find the group with matching path
        const matchingGroup = groupResponse.data.find(group => group.path === decodedOwner);
        
        if (matchingGroup) {
          const groupPath = matchingGroup.path;
          
          // Try to find the project within this group
          try {
            console.log(`GitLab: Trying direct lookup with group path: ${groupPath}/${repo}`);
            const encodedPath = encodeURIComponent(`${groupPath}/${repo}`);
            const apiUrl = `${gitlabBaseUrl}/api/v4/projects/${encodedPath}`;
            
            const response = await axios.get(apiUrl, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.data && response.data.path_with_namespace) {
              console.log(`GitLab: Found project via group lookup: ${response.data.path_with_namespace}`);
              this.projectPathCache[cacheKey] = response.data.path_with_namespace;
              this.savePathCache();
              return response.data.path_with_namespace;
            }
          } catch (error) {
            console.log(`GitLab: Direct lookup failed for group path: ${groupPath}/${repo}`);
          }
        } else {
          console.log(`GitLab: No group with matching path found, using first group's path`);
          const groupPath = groupResponse.data[0].path;
          
    try {
            console.log(`GitLab: Trying direct lookup with first group's path: ${groupPath}/${repo}`);
            const encodedPath = encodeURIComponent(`${groupPath}/${repo}`);
      const apiUrl = `${gitlabBaseUrl}/api/v4/projects/${encodedPath}`;
      
      const response = await axios.get(apiUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.data && response.data.path_with_namespace) {
              console.log(`GitLab: Found project via first group lookup: ${response.data.path_with_namespace}`);
        this.projectPathCache[cacheKey] = response.data.path_with_namespace;
        this.savePathCache();
        return response.data.path_with_namespace;
      }
    } catch (error) {
            console.log(`GitLab: Direct lookup failed for first group's path: ${groupPath}/${repo}`);
          }
        }
      }
    } catch (error) {
      console.log(`GitLab: Error during group search:`, error);
    }
    
    // If all else fails, return the original path
    console.log(`GitLab: All resolution attempts failed, using original path: ${decodedOwner}/${repo}`);
    return `${decodedOwner}/${repo}`;
  }
  
  // Repository methods
  async getRepositoryContents(owner: string, repo: string, path: string = ''): Promise<FileItem[]> {
    console.log(`GitLab: Getting repository contents for ${owner}/${repo}, path: "${path}"`);
    
    const token = await this.getAccessToken();
    if (!token) {
      console.error('GitLab: No access token available for repository contents');
      throw new Error('GitLab access token not found. Please add your GitLab token in settings.');
    } else {
      console.log(`GitLab: Using token for repository access (first 5 chars: ${token.substring(0, 5)}...)`);
    }
    
    try {
      // Resolve the actual project path
      const fullPath = await this.resolveProjectPath(owner, repo);
      console.log(`GitLab: Resolved project path: ${fullPath}`);
      
      // First get the default branch
      const branch = await this.getDefaultBranch(owner, repo);
      console.log(`GitLab: Using branch: ${branch} for repository contents`);
      
      // Get GitLab instance URL
      let gitlabBaseUrl = 'https://gitlab.com';
      try {
        const storedUrl = localStorage.getItem('gitlabInstanceUrl');
        if (storedUrl) {
          gitlabBaseUrl = storedUrl;
          console.log(`GitLab: Using custom instance URL: ${gitlabBaseUrl}`);
        }
      } catch (error) {
        console.log('GitLab: Could not access localStorage for instance URL, using default');
      }
      
      // Encode the repository path - decode first to normalize any encoded values
      const decodedPath = decodeURIComponent(fullPath);
      const encodedRepo = encodeURIComponent(decodedPath);
      const apiUrl = `${gitlabBaseUrl}/api/v4/projects/${encodedRepo}/repository/tree`;
      console.log(`GitLab: Making API request to: ${apiUrl}`);
      
      const response = await axios.get(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        params: {
          path,
          ref: branch,
          per_page: 100
        }
      });
      
      console.log(`GitLab: Repository contents response status: ${response.status}`);
      
      if (!Array.isArray(response.data)) {
        console.error('GitLab: Unexpected response format:', response.data);
        throw new Error('Unexpected response format from GitLab API');
      }
      
      console.log(`GitLab: Successfully fetched ${response.data.length} items`);
      return this.transformFileData(response.data);
    } catch (error: any) {
      console.error('GitLab: Error fetching repository contents:', error);
      if (error.response) {
        console.error(`GitLab: API error status: ${error.response.status}`, error.response.data);
      }
      throw error;
    }
  }
  
  async getRepositoryTree(owner: string, repo: string): Promise<TreeNode[]> {
    const token = await this.getAccessToken();
    if (!token) {
      throw new Error('GitLab access token not found. Please add your GitLab token in settings.');
    }
    
    // Resolve the actual project path
    const fullPath = await this.resolveProjectPath(owner, repo);
    console.log(`GitLab: Resolved project path for tree: ${fullPath}`);
    
    // First get the default branch
    const branch = await this.getDefaultBranch(owner, repo);
    
    // Get GitLab instance URL
    let gitlabBaseUrl = 'https://gitlab.com';
    try {
      const storedUrl = localStorage.getItem('gitlabInstanceUrl');
      if (storedUrl) {
        gitlabBaseUrl = storedUrl;
        console.log(`GitLab: Using custom instance URL: ${gitlabBaseUrl} for repository tree`);
      }
    } catch (error) {
      console.log('GitLab: Could not access localStorage for instance URL, using default');
    }
    
    // Proper encoding - first decode any URL-encoded values, then encode properly
    const decodedPath = decodeURIComponent(fullPath);
    const encodedRepo = encodeURIComponent(decodedPath);
    
    // Get repository tree (recursive)
    const response = await axios.get(
      `${gitlabBaseUrl}/api/v4/projects/${encodedRepo}/repository/tree`, 
      {
        headers: { 'Authorization': `Bearer ${token}` },
        params: { 
          recursive: true, 
          per_page: 100,
          ref: branch
        }
      }
    );
    
    if (!Array.isArray(response.data)) {
      throw new Error('Unexpected response format from GitLab API');
    }
    
    return this.transformTreeData(response.data);
  }
  
  async getFileContent(owner: string, repo: string, path: string, branch?: string): Promise<string> {
    const token = await this.getAccessToken();
    if (!token) {
      throw new Error('GitLab access token not found. Please add your GitLab token in settings.');
    }
    
    // Resolve the actual project path
    const fullPath = await this.resolveProjectPath(owner, repo);
    console.log(`GitLab: Resolved project path for file content: ${fullPath}, file: ${path}`);
    
    // Use the specified branch or get the default branch
    const branchToUse = branch || await this.getDefaultBranch(owner, repo);
    
    // Check cache first
    const cacheKey = getCacheKey(this.name, fullPath, repo, path, branchToUse);
    const cachedContent = getFromCache(cacheKey);
    
    if (cachedContent) {
      return cachedContent;
    }
    
    // Get GitLab instance URL
    let gitlabBaseUrl = 'https://gitlab.com';
    try {
      const storedUrl = localStorage.getItem('gitlabInstanceUrl');
      if (storedUrl) {
        gitlabBaseUrl = storedUrl;
        console.log(`GitLab: Using custom instance URL: ${gitlabBaseUrl} for file content`);
      }
    } catch (error) {
      console.log('GitLab: Could not access localStorage for instance URL, using default');
    }
    
    // Proper encoding - decode first to handle any already-encoded characters
    const decodedRepoPath = decodeURIComponent(fullPath);
    const encodedRepo = encodeURIComponent(decodedRepoPath);
    const decodedFilePath = decodeURIComponent(path);
    const encodedPath = encodeURIComponent(decodedFilePath);
    
    try {
      const response = await axios.get(
        `${gitlabBaseUrl}/api/v4/projects/${encodedRepo}/repository/files/${encodedPath}/raw`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
          params: { ref: branchToUse },
          responseType: 'text'
        }
      );
      
      // Save to cache and return
      saveToCache(cacheKey, response.data);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error(`File not found: ${path}`);
      } else if (error.response?.status === 401 || error.response?.status === 403) {
        throw new Error('GitLab authentication failed. Your token may be invalid or expired.');
      }
      throw error;
    }
  }
  
  async getDefaultBranch(owner: string, repo: string): Promise<string> {
    console.log(`GitLab: Getting default branch for ${owner}/${repo}`);
    const token = await this.getAccessToken();
    if (!token) {
      console.error('GitLab: No access token available for API call');
      throw new Error('GitLab access token not found. Please add your GitLab token in settings.');
    }
    
    // Get GitLab instance URL
    let gitlabBaseUrl = 'https://gitlab.com';
    try {
      const storedUrl = localStorage.getItem('gitlabInstanceUrl');
      if (storedUrl) {
        gitlabBaseUrl = storedUrl;
        console.log(`GitLab: Using custom instance URL: ${gitlabBaseUrl}`);
      }
    } catch (error) {
      console.log('GitLab: Could not access localStorage for instance URL, using default');
    }
    
    // Try to resolve the full path if we don't already have it
    try {
      const fullPath = await this.resolveProjectPath(owner, repo);
      console.log(`GitLab: Resolved path for default branch: ${fullPath}`);
      
      // Proper encoding - decode first to normalize any encoded values
      const decodedPath = decodeURIComponent(fullPath);
      const encodedRepo = encodeURIComponent(decodedPath);
      const apiUrl = `${gitlabBaseUrl}/api/v4/projects/${encodedRepo}`;
      console.log(`GitLab: Making API request to: ${apiUrl}`);
      
      const response = await axios.get(apiUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      console.log(`GitLab: Successfully retrieved project info, default branch: ${response.data.default_branch || 'main'}`);
      return response.data.default_branch || 'main';
    } catch (error: any) {
      console.error('GitLab: Error retrieving default branch:', error);
      
      if (error.response?.status === 404) {
        throw new Error(`Repository ${owner}/${repo} not found on GitLab. Please check the repository name or try setting a custom GitLab instance URL in settings.`);
      } else if (error.response?.status === 401 || error.response?.status === 403) {
        throw new Error('GitLab authentication failed. Your token may be invalid or expired.');
      }
      
      // Default to 'main' if we couldn't determine the default branch
      console.log('GitLab: Defaulting to "main" branch');
      return 'main';
    }
  }
  
  // Utility methods
  transformTreeData(data: any[]): TreeNode[] {
    // Convert flat tree to hierarchical structure
    const pathMap: Record<string, TreeNode> = {};
    const rootNodes: TreeNode[] = [];
    
    // First pass: create nodes for all items
    data.forEach(item => {
      const isFile = item.type === 'blob';
      const pathParts = item.path.split('/');
      const name = pathParts[pathParts.length - 1];
      
      const node: TreeNode = {
        name,
        path: item.path,
        type: isFile ? 'file' : 'dir',
        sha: item.id || '',
        children: [],
        level: pathParts.length - 1
      };
      
      pathMap[item.path] = node;
      
      if (pathParts.length === 1) {
        rootNodes.push(node);
      }
    });
    
    // Second pass: build the tree structure
    data.forEach(item => {
      const pathParts = item.path.split('/');
      
      if (pathParts.length > 1) {
        const parentPath = pathParts.slice(0, -1).join('/');
        const parentNode = pathMap[parentPath];
        
        if (parentNode) {
          const node = pathMap[item.path];
          if (node) {
            parentNode.children.push(node);
          }
        } else {
          // Create missing parent directories
          let currentPath = '';
          let previousNode: TreeNode | null = null;
          
          for (let i = 0; i < pathParts.length - 1; i++) {
            const part = pathParts[i];
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            
            if (!pathMap[currentPath]) {
              const node: TreeNode = {
                name: part,
                path: currentPath,
                type: 'dir',
                sha: '',
                children: [],
                level: i
              };
              
              pathMap[currentPath] = node;
              
              if (i === 0) {
                rootNodes.push(node);
              } else if (previousNode) {
                previousNode.children.push(node);
              }
            }
            
            previousNode = pathMap[currentPath];
          }
          
          // Add the current item to the last created parent
          if (previousNode) {
            const node = pathMap[item.path];
            if (node) {
              previousNode.children.push(node);
            }
          }
        }
      }
    });
    
    // Sort the nodes
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
  }
  
  transformFileData(data: any[]): FileItem[] {
    return data.map(item => ({
      name: item.name,
      path: item.path,
      type: item.type === 'tree' ? 'dir' : 'file',
      sha: item.id || '',
      size: item.size || 0,
      url: '' // GitLab API doesn't provide this directly
    }));
  }
} 