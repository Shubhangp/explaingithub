import { FileItem, TreeNode } from '@/app/types/repository';

export type ProviderType = 'github' | 'gitlab' | 'azure' | 'bitbucket';

export interface BaseGitProvider {
  name: ProviderType;
  displayName: string;
  iconComponent: React.ComponentType;
  
  // Authentication methods
  isAuthenticated(): Promise<boolean>;
  getAccessToken(): Promise<string | null>;
  getAuthUrl(): string;
  
  // Repository methods
  getRepositoryContents(owner: string, repo: string, path?: string): Promise<FileItem[]>;
  getRepositoryTree(owner: string, repo: string): Promise<TreeNode[]>;
  getFileContent(owner: string, repo: string, path: string, branch?: string): Promise<string>;
  getDefaultBranch(owner: string, repo: string): Promise<string>;
  
  // Utility methods
  transformTreeData(data: any[]): TreeNode[];
  transformFileData(data: any[]): FileItem[];
}

// Common utility functions that can be used by different providers
export const sortItems = (items: FileItem[]): FileItem[] => {
  return [...items].sort((a, b) => {
    if (a.type === b.type) {
      return a.name.localeCompare(b.name);
    }
    return a.type === 'dir' ? -1 : 1;
  });
};

// Cache management for file content
export const fileContentCache = new Map<string, { content: string; timestamp: number }>();
export const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const getCacheKey = (provider: ProviderType, owner: string, repo: string, path: string, branch?: string): string => {
  return `${provider}:${owner}:${repo}:${path}:${branch || 'default'}`;
};

export const getFromCache = (key: string): string | null => {
  const cached = fileContentCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.content;
  }
  return null;
};

export const saveToCache = (key: string, content: string): void => {
  fileContentCache.set(key, {
    content,
    timestamp: Date.now()
  });
}; 