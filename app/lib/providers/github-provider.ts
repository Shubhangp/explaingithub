import { Octokit } from '@octokit/rest';
import { FaGithub } from 'react-icons/fa';
import { 
  BaseGitProvider, 
  ProviderType, 
  getCacheKey, 
  getFromCache, 
  saveToCache 
} from './base-provider';
import { FileItem, TreeNode } from '@/app/types/repository';
import { getSession } from 'next-auth/react';

export class GitHubProvider implements BaseGitProvider {
  name: ProviderType = 'github';
  displayName = 'GitHub';
  iconComponent = FaGithub;
  
  // Internal methods
  private async getOctokit(): Promise<Octokit> {
    const token = await this.getAccessToken();
    if (!token) {
      throw new Error('No GitHub token available. Please login with GitHub.');
    }
    return new Octokit({ auth: token });
  }
  
  // Authentication methods
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getAccessToken();
    return !!token;
  }
  
  async getAccessToken(): Promise<string | null> {
    try {
      const session = await getSession();
      
      if (!session) {
        console.log('GitHub: No session found');
        return null;
      }
      
      if (session?.accessToken && session?.provider === 'github') {
        console.log('GitHub: Found token in session');
        // Validate token by making a simple API call
        try {
          const octokit = new Octokit({ auth: session.accessToken });
          const { data } = await octokit.rest.users.getAuthenticated();
          
          if (data && data.login) {
            console.log(`GitHub: Token validated successfully for user: ${data.login}`);
            // Store the token in localStorage as a backup
            localStorage.setItem('github_session_token', session.accessToken as string);
            return session.accessToken as string;
          }
        } catch (validationError) {
          console.error('GitHub: Token validation failed:', validationError);
          // Try to get token from localStorage as fallback
          const localToken = localStorage.getItem('github_session_token');
          if (localToken) {
            console.log('GitHub: Trying fallback token from localStorage');
            return localToken;
          }
        }
      } else {
        console.log(`GitHub: Session found but either no token (${!!session.accessToken}) or wrong provider (${session.provider})`);
        
        // Check localStorage as fallback
        const localToken = localStorage.getItem('github_session_token');
        if (localToken) {
          console.log('GitHub: Using fallback token from localStorage');
          return localToken;
        }
      }
      
      return null;
    } catch (error) {
      console.error('GitHub: Error getting access token:', error);
      return null;
    }
  }
  
  getAuthUrl(): string {
    return '/api/auth/signin/github';
  }
  
  // Repository methods
  async getRepositoryContents(owner: string, repo: string, path: string = ''): Promise<FileItem[]> {
    const octokit = await this.getOctokit();
    
    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path,
      });
      
      if (!Array.isArray(data)) {
        throw new Error('Expected directory content but got a file');
      }
      
      return this.transformFileData(data);
    } catch (error: any) {
      console.error(`GitHub: Error fetching repository contents: ${error.message}`);
      
      if (error.status === 403) {
        const resetTime = error.response?.headers?.['x-ratelimit-reset'];
        if (resetTime) {
          const resetDate = new Date(parseInt(resetTime) * 1000);
          const minutes = Math.ceil((resetDate.getTime() - Date.now()) / 60000);
          
          throw new Error(
            `GitHub API rate limit exceeded. Reset in ${minutes} minute${minutes !== 1 ? 's' : ''}. ` +
            `Try again later or use a token with higher rate limits.`
          );
        } else {
          throw new Error(
            `GitHub API access forbidden (403). Possible causes: ` +
            `1) API rate limit exceeded, 2) Repository is private, or 3) Authentication issue. ` +
            `Try logging in again or checking repository permissions.`
          );
        }
      } else if (error.status === 404) {
        throw new Error(`Repository ${owner}/${repo}${path ? `/${path}` : ''} not found or is private.`);
      }
      
      throw error;
    }
  }
  
  async getRepositoryTree(owner: string, repo: string): Promise<TreeNode[]> {
    const octokit = await this.getOctokit();
    
    // First, get the default branch
    const { data: repoData } = await octokit.repos.get({
      owner,
      repo
    });
    
    const defaultBranch = repoData.default_branch;
    
    // Get the reference to the head of the default branch
    const { data: refData } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${defaultBranch}`
    });
    
    // Get the commit that the reference points to
    const { data: commitData } = await octokit.git.getCommit({
      owner,
      repo,
      commit_sha: refData.object.sha
    });
    
    // Get the tree that the commit points to (recursive)
    const { data: treeData } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: commitData.tree.sha,
      recursive: 'true'
    });
    
    return this.transformTreeData(treeData.tree);
  }
  
  async getFileContent(owner: string, repo: string, path: string, branch?: string): Promise<string> {
    const cacheKey = getCacheKey(this.name, owner, repo, path, branch);
    const cachedContent = getFromCache(cacheKey);
    
    if (cachedContent) {
      return cachedContent;
    }
    
    const octokit = await this.getOctokit();
    
    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path,
        ref: branch
      });
      
      if ('content' in data && data.encoding === 'base64') {
        const content = atob(data.content);
        saveToCache(cacheKey, content);
        return content;
      }
      
      throw new Error('Invalid GitHub API response format');
    } catch (error: any) {
      console.error(`GitHub: Error fetching file content: ${error.message}`);
      
      if (error.status === 403) {
        const resetTime = error.response?.headers?.['x-ratelimit-reset'];
        if (resetTime) {
          const resetDate = new Date(parseInt(resetTime) * 1000);
          const minutes = Math.ceil((resetDate.getTime() - Date.now()) / 60000);
          
          throw new Error(
            `GitHub API rate limit exceeded. Reset in ${minutes} minute${minutes !== 1 ? 's' : ''}. ` +
            `Try again later or use a token with higher rate limits.`
          );
        } else {
          throw new Error(
            `GitHub API access forbidden (403). Possible causes: ` +
            `1) API rate limit exceeded, 2) Repository is private, or 3) Authentication issue. ` +
            `Try logging in again or checking repository permissions.`
          );
        }
      } else if (error.status === 404) {
        throw new Error(`File not found: ${path}`);
      }
      
      throw error;
    }
  }
  
  async getDefaultBranch(owner: string, repo: string): Promise<string> {
    const octokit = await this.getOctokit();
    const { data } = await octokit.repos.get({
      owner,
      repo
    });
    
    return data.default_branch;
  }
  
  // Utility methods
  transformTreeData(data: any[]): TreeNode[] {
    // Convert flat tree to hierarchical structure
    const pathMap: Record<string, TreeNode> = {};
    const rootNodes: TreeNode[] = [];
    
    // First pass: create nodes
    data.forEach(item => {
      const isBlob = item.type === 'blob';
      const pathParts = item.path.split('/');
      const name = pathParts[pathParts.length - 1];
      
      const node: TreeNode = {
        name,
        path: item.path,
        type: isBlob ? 'file' : 'dir',
        sha: item.sha,
        children: [],
        level: pathParts.length - 1,
        size: item.size || 0
      };
      
      pathMap[item.path] = node;
      
      if (pathParts.length === 1) {
        rootNodes.push(node);
      }
    });
    
    // Second pass: build tree
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
          // Create parent directories that don't exist in the tree data
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
          
          // Now add the current item to the last created parent
          if (previousNode) {
            const node = pathMap[item.path];
            if (node) {
              previousNode.children.push(node);
            }
          }
        }
      }
    });
    
    // Sort all nodes
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
      type: item.type === 'dir' ? 'dir' : 'file',
      sha: item.sha || '',
      size: item.size || 0,
      url: item.html_url || ''
    }));
  }
} 