import { BaseGitProvider, ProviderType } from './base-provider';
import { GitHubProvider } from './github-provider';
import { GitLabProvider } from './gitlab-provider';

// Provider class instances (singleton pattern)
const providers: Record<ProviderType, BaseGitProvider> = {
  github: new GitHubProvider(),
  gitlab: new GitLabProvider(),
  azure: null,
  bitbucket: null
};

// Provider placeholders for providers that aren't fully implemented yet
const getPlaceholderProvider = (type: ProviderType): BaseGitProvider => {
  const notImplementedError = () => {
    throw new Error(`${type} provider integration is not yet fully implemented`);
  };
  
  return {
    name: type,
    displayName: type.charAt(0).toUpperCase() + type.slice(1),
    iconComponent: null,
    isAuthenticated: async () => false,
    getAccessToken: async () => null,
    getAuthUrl: () => `/settings?provider=${type}`,
    getRepositoryContents: notImplementedError,
    getRepositoryTree: notImplementedError,
    getFileContent: notImplementedError,
    getDefaultBranch: notImplementedError,
    transformTreeData: notImplementedError,
    transformFileData: notImplementedError
  } as BaseGitProvider;
};

// Initialize placeholder providers
if (!providers.azure) {
  providers.azure = getPlaceholderProvider('azure');
}
if (!providers.bitbucket) {
  providers.bitbucket = getPlaceholderProvider('bitbucket');
}

export function getProvider(type: ProviderType): BaseGitProvider {
  if (!providers[type]) {
    throw new Error(`Unknown provider type: ${type}`);
  }
  return providers[type];
}

export function getAllProviders(): BaseGitProvider[] {
  return Object.values(providers).filter(Boolean);
}

export function getSupportedProviders(): ProviderType[] {
  return Object.keys(providers).filter(key => 
    providers[key as ProviderType] !== null
  ) as ProviderType[];
} 