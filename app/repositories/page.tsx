'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  FaSearch,
  FaLock,
  FaGithub,
  FaGitlab,
  FaMicrosoft,
  FaBitbucket,
  FaCloudUploadAlt,
  FaCheck,
  FaCircle,
  FaStar,
  FaCodeBranch,
} from 'react-icons/fa'
import Link from 'next/link'
import { Octokit } from 'octokit'
import axios from 'axios'
import GitHubSignInButton from '../components/GitHubSignInButton'
import GitLabSignInButton from '../components/GitLabSignInButton'
import useProviderTokens from '../hooks/useProviderTokens'
import LoadingState from '../components/LoadingState'
import { checkRepositoryUploadStatus } from '../lib/repository-upload'

// Repository interface for GitHub
interface Repository {
  id: number
  name: string
  private: boolean
  html_url: string
  description: string | null
  language: string | null
  updated_at: string | null
  stargazers_count: number
  forks_count: number
  owner: {
    login: string
  }
}

// Generic repository interface for all providers
interface GenericRepository {
  id: string | number
  name: string
  private: boolean
  url: string
  description: string | null
  language: string | null
  updated_at: string | null
  stars?: number
  forks?: number
  owner: string
  provider: 'github' | 'gitlab' | 'azure' | 'bitbucket'
  uploaded?: boolean
}

type RepoProvider = 'github' | 'gitlab' | 'azure' | 'bitbucket'

export default function RepositoriesPage() {
  const { data: session, status } = useSession()
  const {
    tokens,
    hasProviderToken,
    isTokenValid,
    invalidateToken,
    initialized
  } = useProviderTokens()

  const [searchQuery, setSearchQuery] = useState('')
  const [githubRepositories, setGithubRepositories] = useState<Repository[]>([])
  const [gitlabRepositories, setGitlabRepositories] = useState<any[]>([])
  const [azureRepositories, setAzureRepositories] = useState<any[]>([])
  const [bitbucketRepositories, setBitbucketRepositories] = useState<any[]>([])
  const [activeProvider, setActiveProvider] = useState<RepoProvider>('github')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [userName, setUserName] = useState('')
  const [githubUsername, setGithubUsername] = useState('')
  const [initialLoadStarted, setInitialLoadStarted] = useState(false)
  const [fetchAttempted, setFetchAttempted] = useState(false)
  const [lastTokenCheck, setLastTokenCheck] = useState<number>(0)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [uploadStatuses, setUploadStatuses] = useState<Record<string, boolean>>({})

  // Cache repositories to avoid unnecessary refetching
  const REPO_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

  // Function to get cached repos or set cache
  const getCachedRepos = (provider: RepoProvider) => {
    try {
      if (typeof window === 'undefined') return null;

      const cacheKey = `repos_cache_${provider}`;
      const cachedData = localStorage.getItem(cacheKey);

      if (cachedData) {
        const { data, timestamp } = JSON.parse(cachedData);
        const now = Date.now();

        // Check if cache is still valid
        if (now - timestamp < REPO_CACHE_DURATION) {
          console.log(`Using cached ${provider} repositories`);
          return data;
        }
      }

      return null;
    } catch (e) {
      console.error(`Error getting cached repos for ${provider}:`, e);
      return null;
    }
  };

  // Function to set repos cache
  const setCachedRepos = (provider: RepoProvider, data: any) => {
    try {
      if (typeof window === 'undefined') return;

      const cacheKey = `repos_cache_${provider}`;
      const cacheData = {
        data,
        timestamp: Date.now()
      };

      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      console.log(`Cached ${provider} repositories`);
    } catch (e) {
      console.error(`Error caching ${provider} repositories:`, e);
    }
  };

  // Add debugging for the getConnectedProviders function
  const getConnectedProviders = (): RepoProvider[] => {
    if (!hasProviderToken) {
      console.log('hasProviderToken function is not available');
      return [];
    }

    // Check each provider individually to avoid potential issues
    const connectedProviders: RepoProvider[] = [];

    try {
      if (hasProviderToken('github')) {
        console.log('GitHub provider connected');
        connectedProviders.push('github');
      } else {
        console.log('GitHub provider NOT connected');
      }

      if (hasProviderToken('gitlab')) {
        console.log('GitLab provider connected');
        connectedProviders.push('gitlab');
      } else {
        console.log('GitLab provider NOT connected');
      }

      // Check other providers as well
      ['azure', 'bitbucket'].forEach(provider => {
        if (hasProviderToken(provider as RepoProvider)) {
          connectedProviders.push(provider as RepoProvider);
        }
      });
    } catch (error) {
      console.error('Error checking connected providers:', error);
    }

    console.log('Connected providers:', connectedProviders);
    return connectedProviders;
  }

  const connectedProviders = getConnectedProviders();

  // Add effect to check upload status for repositories
  useEffect(() => {
    const checkUploadStatuses = async () => {
      const repos = getGenericRepositories()
      const statuses: Record<string, boolean> = {}

      // Check upload status for each repository
      for (const repo of repos) {
        const key = `${repo.provider}:${repo.owner}/${repo.name}`
        const status = await checkRepositoryUploadStatus(repo.owner, repo.name, repo.provider)
        statuses[key] = status.uploaded
      }

      setUploadStatuses(statuses)
    }

    // Only check when we have repositories
    if (filteredRepos.length > 0) {
      checkUploadStatuses()
    }
  }, [githubRepositories, gitlabRepositories, activeProvider])

  // Add a periodic token check for GitLab to proactively handle expiration
  useEffect(() => {
    // Don't run on server
    if (typeof window === 'undefined') return;

    // Only check if GitLab is the active provider
    if (activeProvider !== 'gitlab') return;

    // Skip if we've checked recently (within 2 minutes)
    const now = Date.now();
    if (now - lastTokenCheck < 2 * 60 * 1000) return;

    // Set last check time
    setLastTokenCheck(now);

    const checkGitLabToken = async () => {
      console.log('Proactively checking GitLab token validity');
      // Use our direct token getter instead
      const token = getGitLabToken();

      if (!token) {
        console.log('No GitLab token found during proactive check');
        return;
      }

      try {
        // Make a lightweight API call to check token
        await axios.get('https://gitlab.com/api/v4/user', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        // Token is valid, update backup
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('gitlab_token_backup', token);
            localStorage.setItem('gitlab_token_backup_time', Date.now().toString());
          } catch (e) {
            console.error('Error saving token backup:', e);
          }
        }
        console.log('GitLab token is valid (proactive check)');
      } catch (error: any) {
        if (error.response?.status === 401) {
          console.log('GitLab token expired detected during proactive check');

          // Clear GitLab invalid state but don't show error message yet
          // We'll let the normal fetch repositories flow handle the UI
          invalidateToken('gitlab');

          // Try to fallback to GitHub if available and we're not in a loop
          if (hasProviderToken('github') && !fetchAttempted) {
            console.log('Switching to GitHub as fallback after proactive token check');
            setActiveProvider('github');
            setFetchAttempted(true);
            fetchRepositories('github');
          }
        }
      }
    };

    checkGitLabToken();

    // Set up interval for checking while the page is open
    const intervalId = setInterval(checkGitLabToken, 10 * 60 * 1000); // Check every 10 minutes

    return () => clearInterval(intervalId);
  }, [activeProvider, lastTokenCheck, hasProviderToken, invalidateToken, fetchAttempted]);

  useEffect(() => {
    // Wait for the tokens to be initialized before starting the fetch
    if (!initialized) {
      console.log('Waiting for tokens to be initialized...')
      return
    }

    // Only proceed if we haven't started the initial load yet
    if (!initialLoadStarted && status !== 'loading') {
      console.log('Starting initial repositories load...')
      setInitialLoadStarted(true)

      if (status === 'authenticated') {
        // Determine which provider to show by default based on connections
        console.log('User is authenticated, checking available providers')

        // Check URL for provider preference (if user just signed in)
        const urlParams = new URLSearchParams(window.location.search);
        const providerParam = urlParams.get('provider');

        // Check session for provider info
        const sessionProvider = (session as any)?.provider;

        // Prioritize in this order:
        // 1. URL parameter (user just signed in with this provider)
        // 2. Session provider (user is authenticated with this provider)
        // 3. Last used provider from localStorage
        // 4. First connected provider
        // 5. Default to GitHub

        // Check localStorage for last used provider
        const lastUsedProvider = localStorage.getItem('last_used_provider') as RepoProvider | null;

        // Find the best provider to use
        let preferredProvider: RepoProvider = 'github';

        // First check URL parameter
        if (providerParam && ['github', 'gitlab', 'azure', 'bitbucket'].includes(providerParam)) {
          preferredProvider = providerParam as RepoProvider;
          console.log(`Provider from URL: ${preferredProvider}`);
        }
        // Then check session provider (if it's available)
        else if (sessionProvider && hasProviderToken(sessionProvider)) {
          preferredProvider = sessionProvider as RepoProvider;
          console.log(`Provider from session: ${preferredProvider}`);
        }
        // Then check last used provider
        else if (lastUsedProvider && hasProviderToken(lastUsedProvider)) {
          preferredProvider = lastUsedProvider;
          console.log(`Provider from localStorage: ${preferredProvider}`);
        }
        // Then check connected providers
        else {
          const connectedProvs = getConnectedProviders();
          if (connectedProvs.length > 0) {
            preferredProvider = connectedProvs[0];
            console.log(`Provider from connected list: ${preferredProvider}`);
          }
        }

        // Save the chosen provider for next time
        localStorage.setItem('last_used_provider', preferredProvider);

        console.log(`Selected provider: ${preferredProvider}`)
        setActiveProvider(preferredProvider)
        setFetchAttempted(true)

        // If we have tokens for multiple providers, fetch all of them in the background
        const connectedProviders = getConnectedProviders();

        // Always fetch the preferred provider first
        fetchRepositories(preferredProvider);

        // Then fetch others in the background if we have multiple tokens
        if (connectedProviders.length > 1) {
          connectedProviders
            .filter(provider => provider !== preferredProvider)
            .forEach(provider => {
              // Small delay to prioritize the main provider
              setTimeout(() => {
                console.log(`Background fetching ${provider} repositories`);
                if (provider === 'github') {
                  fetchGithubRepositories();
                } else if (provider === 'gitlab') {
                  fetchGitlabRepositories();
                }
              }, 500);
            });
        }

        // Clear provider param from URL if it exists (to avoid persistence on refresh)
        if (providerParam && window.history.replaceState) {
          urlParams.delete('provider');
          const newUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : '');
          window.history.replaceState({}, '', newUrl);
        }
      } else {
        console.log('User is not authenticated, showing unauthenticated view')
        setLoading(false)
      }
    }
  }, [status, initialized, initialLoadStarted, session, hasProviderToken])

  // Save active provider when it changes
  useEffect(() => {
    if (activeProvider) {
      localStorage.setItem('last_used_provider', activeProvider);
    }
  }, [activeProvider]);

  // Direct version that doesn't use the problematic hook function
  const getGitLabToken = (): string | null => {
    // First check localStorage (simplest approach)
    if (typeof window !== 'undefined') {
      const localToken = localStorage.getItem('gitlab_token_backup') ||
        localStorage.getItem('gitlab_token') ||
        localStorage.getItem('gitlabToken');
      if (localToken) return localToken;
    }

    // Check our tokens state
    if (tokens && tokens.gitlab && tokens.gitlab.token) {
      return tokens.gitlab.token;
    }

    // Check session data with proper type casting
    const typedSession = session as any;
    if (typedSession?.provider === 'gitlab' && typedSession.gitlabAccessToken) {
      return typedSession.gitlabAccessToken;
    }

    return null;
  };

  // Make a simpler version for GitHub too
  const getGitHubToken = (): string | null => {
    // First check localStorage (simplest approach)
    if (typeof window !== 'undefined') {
      const localToken = localStorage.getItem('token_backup_github') ||
        localStorage.getItem('github_token');
      if (localToken) return localToken;
    }

    // Check our tokens state
    if (tokens && tokens.github && tokens.github.token) {
      return tokens.github.token;
    }

    // Check session data with proper type casting
    const typedSession = session as any;
    if (typedSession?.provider === 'github' && typedSession.accessToken) {
      return typedSession.accessToken;
    }

    return null;
  };

  const fetchRepositories = async (provider: RepoProvider) => {
    console.log(`Attempting to fetch repositories for ${provider}...`);

    // First check if we have cached repositories
    const cachedRepos = getCachedRepos(provider);
    if (cachedRepos) {
      // Use cached data based on the provider
      if (provider === 'github' && cachedRepos.length > 0) {
        setGithubRepositories(cachedRepos);
        setLoading(false);
        return;
      } else if (provider === 'gitlab' && cachedRepos.length > 0) {
        setGitlabRepositories(cachedRepos);
        setLoading(false);
        return;
      }
    }

    // First, verify provider connection directly
    let isConnected = false;

    try {
      // For GitHub, check if we have a token directly
      if (provider === 'github') {
        const token = getGitHubToken();
        isConnected = !!token;
        console.log(`GitHub token available: ${isConnected}`);
      }
      // For GitLab, check if we have a token directly
      else if (provider === 'gitlab') {
        const token = getGitLabToken();
        isConnected = !!token;
        console.log(`GitLab token available: ${isConnected}`);
      }
      // For other providers, fall back to the hook
      else if (typeof hasProviderToken === 'function') {
        isConnected = hasProviderToken(provider);
        console.log(`${provider} connected (via hook): ${isConnected}`);
      }
    } catch (error) {
      console.error(`Error checking if ${provider} is connected:`, error);
      isConnected = false;
    }

    // Don't fetch if the provider is not connected
    if (!isConnected) {
      console.log(`${provider} is not connected`);
      setError(`You need to connect to ${provider} first.`);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log(`Fetching repositories for ${provider}...`);
      switch (provider) {
        case 'github':
          await fetchGithubRepositories();
          break;
        case 'gitlab':
          await fetchGitlabRepositories();
          break;
        case 'azure':
          await fetchAzureRepositories();
          break;
        case 'bitbucket':
          await fetchBitbucketRepositories();
          break;
      }
    } catch (err) {
      console.error(`Error fetching ${provider} repositories:`, err);
      setError(`Failed to fetch ${provider} repositories. Please try again later.`);
    } finally {
      setLoading(false);
    }
  }

  const fetchGithubRepositories = async () => {
    try {
      // Get the GitHub token directly
      const accessToken = getGitHubToken();
      if (!accessToken) {
        console.log('No GitHub access token available')
        setError('Please sign in with GitHub to view your repositories')
        return
      }

      console.log('Fetching GitHub repositories...')

      try {
        // Use authorization header format expected by GitHub
        const octokit = new Octokit({
          auth: accessToken,
          request: {
            headers: {
              authorization: `token ${accessToken}`
            }
          }
        })

        // First test if the token is valid with a simple request
        try {
          // Fetch user information
          const userResponse = await octokit.rest.users.getAuthenticated()
          setUserName(userResponse.data.name || userResponse.data.login)
          setGithubUsername(userResponse.data.login)
          console.log('GitHub user fetched:', userResponse.data.login)

          // Fetch repositories
          const { data } = await octokit.rest.repos.listForAuthenticatedUser({
            sort: 'updated',
            per_page: 100
          })
          console.log(`GitHub repos fetched: ${data.length}`)
          setGithubRepositories(data)

          // Cache the repositories for faster loading next time
          setCachedRepos('github', data);

          // Clear any previous error since we're now successful
          setError('')
        } catch (innerError: any) {
          console.error('GitHub API authentication error:', innerError)
          if (innerError.status === 401) {
            console.log('GitHub token may be invalid - attempting retry with refreshed token')

            // Instead of immediately invalidating, try a second attempt with a fresh token
            try {
              // Don't invalidate yet, but try to get a fresh token from session if available
              const freshToken = session?.accessToken || accessToken;

              // Create a new Octokit instance with the fresh token
              const retryOctokit = new Octokit({
                auth: freshToken,
                request: {
                  headers: {
                    authorization: `token ${freshToken}`
                  }
                }
              });

              // Retry fetching repositories
              console.log('Retrying GitHub API call with fresh token');
              const retryResponse = await retryOctokit.rest.repos.listForAuthenticatedUser({
                sort: 'updated',
                per_page: 100
              });

              // If we get here, the retry worked
              console.log(`GitHub repos fetched on retry: ${retryResponse.data.length}`);
              setGithubRepositories(retryResponse.data);

              // Cache the repositories
              setCachedRepos('github', retryResponse.data);

              // Also update user info
              const userRetryResponse = await retryOctokit.rest.users.getAuthenticated();
              setUserName(userRetryResponse.data.name || userRetryResponse.data.login);
              setGithubUsername(userRetryResponse.data.login);

              // Clear error since we recovered
              setError('');
            } catch (retryError: any) {
              // Only now do we consider the token truly invalid
              console.error('GitHub retry failed, token is likely invalid:', retryError);

              // Now invalidate the token
              invalidateToken('github')

              // Clear any cached tokens and force clear the state
              if (typeof window !== 'undefined') {
                try {
                  // Clear any GitHub token in localStorage
                  const cachedData = localStorage.getItem('provider_tokens_cache')
                  if (cachedData) {
                    const tokenCache = JSON.parse(cachedData);
                    delete tokenCache.github;
                    localStorage.setItem('provider_tokens_cache', JSON.stringify(tokenCache));
                  }

                  // Clear session storage too if present
                  sessionStorage.removeItem('github_token');

                  // Ensure state is cleared
                  setGithubRepositories([]);
                } catch (e) {
                  console.error('Error clearing cached tokens:', e);
                }
              }

              // Only show error if we couldn't recover and have no repositories
              if (githubRepositories.length === 0) {
                setError('Your GitHub session has expired. Please sign in again to access your repositories.')
              }

              // Swap to GitLab if connected, otherwise stay on GitHub to show the sign-in button
              if (hasProviderToken('gitlab') && !fetchAttempted) {
                console.log('Switching to GitLab as fallback');
                setActiveProvider('gitlab');
                fetchRepositories('gitlab');
              }
            }
          } else {
            // For other errors, don't invalidate token but still show error
            setError(`GitHub API error: ${innerError.message || 'Unknown error'}`)
            throw innerError
          }
        }
      } catch (apiError: any) {
        console.error('GitHub API error:', apiError)

        // Handle specific error cases
        if (apiError.status === 401 && githubRepositories.length === 0) {
          // Only show error if we have no repositories to display
          setError('Your GitHub session has expired. Please sign in again to access your repositories.')
          invalidateToken('github')
        } else if (githubRepositories.length === 0) {
          // Only set error if we have no repos to show
          setError(`Failed to fetch GitHub repositories: ${apiError.message || 'Unknown error'}`)
        }
      }
    } catch (err) {
      console.error('Error fetching GitHub repositories:', err)
      // Only show error if we have no repositories to display
      if (githubRepositories.length === 0) {
        setError('Failed to fetch GitHub repositories. Please try again later.')
      }
    }
  }

  const fetchGitlabRepositories = async () => {
    try {
      // Get the GitLab token directly
      const token = getGitLabToken();

      if (!token) {
        console.log('No GitLab access token available')
        setError('Please sign in with GitLab to view your repositories')
        return
      }

      console.log('Fetching GitLab repositories with token')

      try {
        // Use direct token - no async issues
        const authHeaders = { 'Authorization': `Bearer ${token}` };

        // Fetch repositories (projects in GitLab terminology)
        const response = await axios.get('https://gitlab.com/api/v4/projects', {
          headers: authHeaders,
          params: {
            owned: true,
            per_page: 100,
            order_by: 'updated_at',
            membership: true
          }
        });

        console.log('GitLab repos fetched:', response.data.length)

        // Make sure we get all the necessary fields and format them precisely like GitHub
        const formattedRepos = response.data.map((repo: any) => ({
          id: repo.id,
          name: repo.name || repo.path || 'Unnamed Repository',
          visibility: repo.visibility || (repo.public ? 'public' : 'private'),
          private: repo.visibility !== 'public',
          web_url: repo.web_url || `https://gitlab.com/${repo.path_with_namespace}`,
          html_url: repo.web_url || `https://gitlab.com/${repo.path_with_namespace}`,
          description: repo.description || null,
          language: repo.language || null,
          updated_at: repo.last_activity_at || repo.updated_at || new Date().toISOString(),
          last_activity_at: repo.last_activity_at || repo.updated_at || new Date().toISOString(),
          stargazers_count: repo.star_count || 0,
          star_count: repo.star_count || 0,
          forks_count: repo.forks_count || 0,
          namespace: {
            ...repo.namespace,
            path: repo.namespace?.path || repo.namespace?.name || repo.owner?.name || 'Unknown'
          },
          owner: {
            login: repo.namespace?.path || repo.namespace?.name || repo.owner?.name || 'Unknown'
          }
        }));

        setGitlabRepositories(formattedRepos)

        // Cache the repositories for faster loading next time
        setCachedRepos('gitlab', formattedRepos);

        // Also fetch user data to display username
        const userResponse = await axios.get('https://gitlab.com/api/v4/user', {
          headers: authHeaders
        });

        const userData = userResponse.data
        setUserName(userData.name || userData.username)
        console.log('GitLab user data:', userData.username)

        // Clear any previous error since we're now successful
        setError('')
      } catch (apiError: any) {
        console.error('GitLab API error:', apiError)

        if (apiError.response?.status === 401) {
          console.log('GitLab authentication failed - token is invalid')
          invalidateToken('gitlab')
          setError('Your GitLab session has expired. Please sign in again to view your repositories.')
        } else {
          const errorMessage = apiError.response?.data?.message || apiError.message || 'Unknown error'
          setError(`Failed to fetch GitLab repositories: ${errorMessage}`)
          throw apiError
        }
      }
    } catch (err) {
      console.error('Error fetching GitLab repositories:', err)
      if (!error) {
        setError('Failed to fetch GitLab repositories. Please try again later.')
      }
    }
  }

  const fetchAzureRepositories = async () => {
    try {
      // This is a placeholder - you'll need to implement the Azure DevOps API call
      setAzureRepositories([])
      console.log('Azure DevOps integration not implemented yet')
    } catch (err) {
      throw err
    }
  }

  const fetchBitbucketRepositories = async () => {
    try {
      // This is a placeholder - you'll need to implement the Bitbucket API call
      setBitbucketRepositories([])
      console.log('Bitbucket integration not implemented yet')
    } catch (err) {
      throw err
    }
  }

  // Convert repositories to a generic format based on the active provider
  const getGenericRepositories = (): GenericRepository[] => {
    switch (activeProvider) {
      case 'github':
        return githubRepositories.map(repo => ({
          id: repo.id,
          name: repo.name,
          private: repo.private,
          url: repo.html_url,
          description: repo.description,
          language: repo.language,
          updated_at: repo.updated_at,
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          owner: repo.owner.login,
          provider: 'github'
        }))
      case 'gitlab':
        return gitlabRepositories.map(repo => ({
          id: repo.id,
          name: repo.name,
          private: repo.private, // Now properly formatted from API
          url: repo.html_url || repo.web_url,
          description: repo.description,
          language: repo.language,
          updated_at: repo.updated_at || repo.last_activity_at,
          stars: repo.stargazers_count || repo.star_count,
          forks: repo.forks_count,
          owner: repo.owner?.login || (repo.namespace?.path || repo.namespace?.name || 'Unknown'),
          provider: 'gitlab'
        }))
      case 'azure':
        return azureRepositories.map(repo => ({
          id: repo.id,
          name: repo.name,
          private: true, // Azure DevOps repos are typically private
          url: repo.url || '',
          description: repo.description || null,
          language: null,
          updated_at: null,
          owner: 'Azure DevOps',
          provider: 'azure'
        }))
      case 'bitbucket':
        return bitbucketRepositories.map(repo => ({
          id: repo.uuid,
          name: repo.name,
          private: repo.is_private,
          url: repo.links?.html?.href || '',
          description: repo.description,
          language: null,
          updated_at: repo.updated_on,
          owner: repo.owner?.display_name || 'Unknown',
          provider: 'bitbucket'
        }))
      default:
        return []
    }
  }

  const filteredRepos = getGenericRepositories().filter(repo =>
    repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (repo.description && repo.description.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const getProviderIcon = (provider: RepoProvider) => {
    switch (provider) {
      case 'github':
        return <FaGithub className="w-5 h-5" />
      case 'gitlab':
        return <FaGitlab className="w-5 h-5" />
      case 'azure':
        return <FaMicrosoft className="w-5 h-5" />
      case 'bitbucket':
        return <FaBitbucket className="w-5 h-5" />
    }
  }

  const getProviderName = (provider: RepoProvider) => {
    switch (provider) {
      case 'github':
        return 'GitHub'
      case 'gitlab':
        return 'GitLab'
      case 'azure':
        return 'Azure DevOps'
      case 'bitbucket':
        return 'Bitbucket'
    }
  }

  // Show loading state
  if (status === 'loading' || loading || !initialized) {
    return <LoadingState message="Loading repositories..." />
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center space-y-6">
          <h2 className="text-2xl font-bold">Please Sign In</h2>
          <p className="text-gray-600 dark:text-gray-400">Sign in to view your repositories</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <GitHubSignInButton
              buttonText="Sign in with GitHub"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
                       bg-primary dark:bg-gray-100 text-black dark:text-gray-900 
                       hover:opacity-90 dark:hover:opacity-90
                       transition-all duration-200 shadow-sm hover:shadow"
              reload={false}
            />
            <GitLabSignInButton
              buttonText="Sign in with GitLab"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
                       hover:opacity-90
                       transition-all duration-200 shadow-sm hover:shadow"
              reload={false}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* User Info */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Your Repositories</h1>
          <p className="text-gray-600 dark:text-gray-400">
            You have {activeProvider === 'github' ? githubRepositories.length : gitlabRepositories.length}
            {activeProvider === 'github' ? ' GitHub' : ' GitLab'} repositories
          </p>
        </div>

        {/* Provider Selector */}
        <div className="mb-6 max-w-md mx-auto">
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full flex items-center justify-between px-4 py-2 border border-gray-200 rounded-md bg-white text-gray-700"
            >
              <span className="flex items-center">
                {getProviderIcon(activeProvider)}
                <span className="ml-2">{getProviderName(activeProvider)}</span>
              </span>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>

            {isDropdownOpen && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
                <ul>
                  {['github', 'gitlab'].map((provider) => {
                    const isConnected = hasProviderToken(provider as RepoProvider);
                    const isValid = isTokenValid(provider);

                    if (isConnected && isValid) {
                      return (
                        <li key={provider}>
                          <button
                            onClick={() => {
                              setActiveProvider(provider as RepoProvider);
                              fetchRepositories(provider as RepoProvider);
                              setIsDropdownOpen(false);
                            }}
                            className={`flex items-center w-full px-4 py-2 text-sm ${activeProvider === provider
                              ? 'bg-gray-100 text-gray-900'
                              : 'text-gray-700 hover:bg-gray-50'
                              }`}
                          >
                            {getProviderIcon(provider as RepoProvider)}
                            <span className="ml-2">{getProviderName(provider as RepoProvider)}</span>
                          </button>
                        </li>
                      );
                    } else {
                      return (
                        <li key={provider} className="px-4 py-2">
                          {provider === 'github' ? (
                            <GitHubSignInButton
                              callbackUrl="/repositories"
                              className="text-sm w-full"
                              reload={false}
                            />
                          ) : provider === 'gitlab' ? (
                            <GitLabSignInButton
                              callbackUrl="/repositories"
                              className="text-sm w-full"
                              message={!isValid && hasProviderToken(provider) ? "Your GitLab session has expired" : ""}
                              reload={false}
                            />
                          ) : null}
                        </li>
                      );
                    }
                  })}
                  <li className="border-t border-gray-100 p-2 text-xs text-gray-500 text-center">
                    <Link href="/profile" className="hover:underline text-blue-600">
                      Visit your profile to manage connections
                    </Link>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Search Box */}
        <div className="mb-6 max-w-lg mx-auto">
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <FaSearch className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${getProviderName(activeProvider)} repositories...`}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-full border border-gray-200 bg-gray-50"
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 text-sm bg-red-50 border-l-4 border-red-400 p-4 text-red-700">
            <p>{error}</p>
            {error.includes('GitLab session has expired') && (
              <div className="mt-2">
                <GitLabSignInButton callbackUrl="/repositories" reload={false} />
              </div>
            )}
            {error.includes('GitHub session has expired') && (
              <div className="mt-2">
                <GitHubSignInButton callbackUrl="/repositories" reload={false} />
              </div>
            )}
          </div>
        )}

        {/* Repository List with Wide Cards */}
        {loading ? (
          <div className="text-center py-12">
            <LoadingState message="Loading repositories..." />
          </div>
        ) : filteredRepos.length === 0 && !error ? (
          <div className="text-center py-12 text-gray-500">
            {searchQuery ? (
              <p>No repositories found matching "{searchQuery}"</p>
            ) : (
              activeProvider === 'gitlab' && !hasProviderToken('gitlab') ? (
                <div className="flex flex-col items-center">
                  <p className="mb-4">Connect your GitLab account to see your repositories</p>
                  <GitLabSignInButton className="w-full md:w-auto" reload={false} />
                </div>
              ) : activeProvider === 'github' && !hasProviderToken('github') ? (
                <div className="flex flex-col items-center">
                  <p className="mb-4">Connect your GitHub account to see your repositories</p>
                  <GitHubSignInButton className="w-full md:w-auto" reload={false} />
                </div>
              ) : (
                <p>No repositories found for {getProviderName(activeProvider)}</p>
              )
            )}
          </div>
        ) : (
          <div className="flex flex-wrap -mx-3">
            {filteredRepos.map((repo) => {
              const uploadKey = `${repo.provider}:${repo.owner}/${repo.name}`
              const isUploaded = uploadStatuses[uploadKey] || false

              return (
                <div key={`${repo.provider}-${repo.id}`} className="w-full md:w-1/2 px-3 mb-6">
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all">
                    <Link
                      href={repo.provider === 'github'
                        ? `/${repo.owner}/${repo.name}`
                        : `/${repo.owner}/${repo.name}?provider=${repo.provider}`
                      }
                    >
                      <div className="p-6 h-full">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center flex-1 min-w-0">
                            {getProviderIcon(repo.provider)}
                            <h3 className="ml-2 text-base text-[#442326] dark:text-white font-medium truncate">
                              {repo.name}
                              {repo.private && (
                                <FaLock className="inline ml-2 text-gray-400 text-xs" />
                              )}
                            </h3>
                          </div>
                          {/* Upload status indicator */}
                          <div className="ml-2 flex-shrink-0">
                            {isUploaded ? (
                              <div className="flex items-center text-green-500 text-xs" title="Repository uploaded">
                                <FaCheck size={12} className="mr-1" />
                                <span>Uploaded</span>
                              </div>
                            ) : (
                              <div className="flex items-center text-gray-400 text-xs" title="Repository will be uploaded on first access">
                                <FaCloudUploadAlt size={12} className="mr-1" />
                                <span>Not uploaded</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {repo.description && (
                          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                            {repo.description}
                          </p>
                        )}

                        <div className="flex justify-between mt-4 text-sm text-gray-500">
                          <div className="flex items-center gap-4">
                            {repo.language && (
                              <span className="flex items-center gap-1">
                                <FaCircle className="text-xs" style={{ color: getLanguageColor(repo.language) }} />
                                {repo.language}
                              </span>
                            )}
                            {repo.stars !== undefined && repo.stars > 0 && (
                              <span className="flex items-center gap-1">
                                <FaStar className="text-xs" />
                                {repo.stars}
                              </span>
                            )}
                            {repo.forks !== undefined && repo.forks > 0 && (
                              <span className="flex items-center gap-1">
                                <FaCodeBranch className="text-xs" />
                                {repo.forks}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-400">
                            {repo.updated_at && `Updated ${new Date(repo.updated_at).toLocaleDateString()}`}
                          </span>
                        </div>
                      </div>
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// Add helper function for language colors
function getLanguageColor(language: string): string {
  const colors: Record<string, string> = {
    JavaScript: '#f1e05a',
    TypeScript: '#2b7489',
    Python: '#3572A5',
    Java: '#b07219',
    Go: '#00ADD8',
    Rust: '#dea584',
    Ruby: '#701516',
    PHP: '#4F5D95',
    'C++': '#f34b7d',
    C: '#555555',
    'C#': '#178600',
    Swift: '#FA7343',
    Kotlin: '#A97BFF',
    Dart: '#00B4AB',
    HTML: '#C084FC',
    CSS: '#00E4AB'
  }
  return colors[language] || '#6e7681'
}