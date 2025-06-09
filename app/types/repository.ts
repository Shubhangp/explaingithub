// Basic file item returned by Git providers
export interface FileItem {
  name: string;
  path: string;
  type: 'dir' | 'file';
  sha: string;
  size?: number;
  url?: string;
}

// Tree node for hierarchical repository structure
export interface TreeNode {
  name: string;
  path: string;
  type: 'dir' | 'file';
  sha: string;
  children: TreeNode[];
  level: number;
  size?: number;
}

// File with content for context operations
export interface FileWithContent {
  path: string;
  content: string;
}

// Repository context information
export interface RepoContext {
  structure: any;
  readme: string;
  taggedFiles: Record<string, string>;
  defaultBranch?: string;
  provider?: string;
}

// Error state information
export interface ErrorState {
  message: string;
  code: string;
  retry?: boolean;
}

// Loading state type
export type LoadingState = 'IDLE' | 'LOADING' | 'LOADED' | 'ERROR'; 