'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import axios from 'axios'

type ProviderType = 'github' | 'gitlab' | 'azure' | 'bitbucket'

interface TokenData {
  token: string
  refreshToken?: string
  expiresAt?: number // Timestamp for expiration
  lastValidated?: number // Timestamp for last validation
  provider: ProviderType
  userId?: string
  username?: string
}

interface ProviderTokensState {
  tokens: Record<ProviderType, TokenData | null>
  validationStatus: Record<ProviderType, 'valid' | 'invalid' | 'unknown'>
  initialized: boolean
}

// Constants for token management
const TOKEN_CACHE_KEY = 'provider_tokens'
const TOKEN_BACKUP_PREFIX = 'token_backup_'
const TOKEN_VALIDATION_INTERVAL = 5 * 60 * 1000 // 5 minutes
const TOKEN_REFRESH_THRESHOLD = 10 * 60 * 1000 // 10 minutes before expiry
const TOKEN_GITLAB_EXPIRY = 2 * 60 * 60 * 1000 // 2 hours default for GitLab

/**
 * Hook for managing provider tokens with proper lifecycle and validation
 */
export default function useProviderTokens() {
  const { data: session, status } = useSession()
  const [state, setState] = useState<ProviderTokensState>({
    tokens: {
      github: null,
      gitlab: null,
      azure: null,
      bitbucket: null
    },
    validationStatus: {
      github: 'unknown',
      gitlab: 'unknown',
      azure: 'unknown',
      bitbucket: 'unknown'
    },
    initialized: false
  })

  /**
   * Initialize tokens from storage and session
   */
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const initializeTokens = async () => {
      try {
        // Add debug logging
        console.log('Initializing provider tokens...');

        // First load tokens from localStorage for immediate use
        const cachedTokens = loadTokensFromStorage()
        // Add debug logging
        console.log('Cached tokens from localStorage:', Object.keys(cachedTokens).filter(k => cachedTokens[k as ProviderType]));
        
        const sessionTokens = extractTokensFromSession(session)
        // Add debug logging
        console.log('Tokens from session:', Object.keys(sessionTokens).filter(k => sessionTokens[k as ProviderType]));
        
        // Merge stored tokens with session tokens (session takes precedence)
        let mergedTokens = {
          ...state.tokens,
          ...cachedTokens,
          ...sessionTokens
        }

        // Set initial tokens from local data
        setState(prev => ({
          ...prev,
          tokens: mergedTokens,
          initialized: true
        }))
        
        // Then attempt to fetch tokens from the server API
        try {
          const response = await fetch('/api/auth/token')
          if (response.ok) {
            const data = await response.json()
            
            if (data.tokens) {
              console.log('Loaded tokens from server API')
              
              // Update with server tokens which take highest precedence
              mergedTokens = {
                ...mergedTokens,
                ...data.tokens
              }
              
              // Add debug logging
              console.log('Tokens from server:', Object.keys(data.tokens).filter(k => data.tokens[k]));
              console.log('Final merged tokens:', Object.keys(mergedTokens).filter(k => mergedTokens[k as ProviderType]));
              
              // Save the updated tokens to storage
              saveTokensToStorage(mergedTokens)
              
              // Update state with server tokens
              setState(prev => ({
                ...prev,
                tokens: mergedTokens
              }))
            }
          }
        } catch (serverError) {
          console.warn('Could not fetch tokens from server, using local tokens', serverError)
        }

        // Validate tokens after initialization
        for (const provider of Object.keys(mergedTokens) as ProviderType[]) {
          if (mergedTokens[provider]) {
            validateToken(provider, mergedTokens[provider]?.token)
          }
        }
      } catch (error) {
        console.error('Failed to initialize tokens:', error)
        setState(prev => ({ ...prev, initialized: true }))
      }
    }

    // Only run initialization if authenticated or if we're initializing for the first time
    if (status === 'authenticated' || !state.initialized) {
      initializeTokens()
    }
  }, [session, status])

  /**
   * Load tokens from localStorage with fallbacks
   */
  const loadTokensFromStorage = useCallback((): Record<ProviderType, TokenData | null> => {
    try {
      // Try to load from our central storage first
      const cached = localStorage.getItem(TOKEN_CACHE_KEY)
      const tokens: Record<ProviderType, TokenData | null> = {
        github: null,
        gitlab: null,
        azure: null,
        bitbucket: null
      }

      if (cached) {
        const parsedCache = JSON.parse(cached)
        
        // Validate structure and copy valid tokens
        Object.keys(parsedCache).forEach(key => {
          const provider = key as ProviderType
          if (parsedCache[provider] && typeof parsedCache[provider].token === 'string') {
            tokens[provider] = parsedCache[provider]
          }
        })
      }

      // Look for backup tokens
      for (const provider of ['github', 'gitlab'] as ProviderType[]) {
        if (!tokens[provider]) {
          const backupKey = `${TOKEN_BACKUP_PREFIX}${provider}`
          const backupToken = localStorage.getItem(backupKey)
          
          if (backupToken) {
            try {
              const tokenData = JSON.parse(backupToken)
              if (tokenData.token && (!tokenData.expiresAt || tokenData.expiresAt > Date.now())) {
                tokens[provider] = tokenData
              }
            } catch (e) {
              // If it's just a string token (old format), convert to our format
              tokens[provider] = {
                token: backupToken,
                provider,
                lastValidated: Date.now()
          }
            }
          }
        }
      }

      // Legacy fallbacks for GitLab
      if (!tokens.gitlab) {
        const legacyKeys = ['gitlab_token_backup', 'gitlab_access_token', 'gitlabToken', 'gitlab_token']
        for (const key of legacyKeys) {
          const token = localStorage.getItem(key)
          if (token) {
            tokens.gitlab = {
              token,
              provider: 'gitlab',
              lastValidated: Date.now()
        }
            break
          }
        }
      }

      return tokens
    } catch (error) {
      console.error('Failed to load tokens from storage:', error)
      return {
        github: null,
        gitlab: null,
        azure: null,
        bitbucket: null
      }
    }
  }, [])

  /**
   * Extract tokens from NextAuth session
   */
  const extractTokensFromSession = useCallback((session: any): Record<ProviderType, TokenData | null> => {
    const tokens: Record<ProviderType, TokenData | null> = {
      github: null,
      gitlab: null,
      azure: null,
      bitbucket: null
    }

    if (!session) return tokens

    // Check for GitHub token (regardless of current provider)
    if (session.githubAccessToken || (session.accessToken && session.provider === 'github')) {
      tokens.github = {
        token: session.githubAccessToken || session.accessToken,
        provider: 'github',
        userId: session.githubUsername || session.user?.name,
        lastValidated: Date.now()
      }
      console.log('Found GitHub token in session');
    }

    // Check for GitLab token (regardless of current provider)
    if (session.gitlabAccessToken || (session.accessToken && session.provider === 'gitlab')) {
      tokens.gitlab = {
        token: session.gitlabAccessToken || session.accessToken,
        provider: 'gitlab',
        userId: session.gitlabUsername || session.user?.name,
        refreshToken: session.gitlabRefreshToken,
        lastValidated: Date.now(),
        // GitLab tokens typically have a 2-hour expiry
        expiresAt: session.gitlabTokenExpiry 
          ? new Date(session.gitlabTokenExpiry * 1000).getTime()
          : (Date.now() + TOKEN_GITLAB_EXPIRY)
      }
      console.log('Found GitLab token in session');
    }

    return tokens
  }, [])

  /**
   * Save tokens to localStorage
   */
  const saveTokensToStorage = useCallback((tokens: Record<ProviderType, TokenData | null>) => {
    try {
      // Only save tokens that have a value
      const filteredTokens = Object.entries(tokens).reduce((acc, [key, value]) => {
        if (value && value.token) {
          acc[key as ProviderType] = value
        }
        return acc
      }, {} as Record<ProviderType, TokenData>)
      
      localStorage.setItem(TOKEN_CACHE_KEY, JSON.stringify(filteredTokens))
      
      // Also save individual token backups for resilience
      Object.entries(filteredTokens).forEach(([key, value]) => {
        if (value && value.token) {
          localStorage.setItem(`${TOKEN_BACKUP_PREFIX}${key}`, JSON.stringify(value))
        }
      })
    } catch (error) {
      console.error('Failed to save tokens to storage:', error)
    }
  }, [])

  /**
   * Save a backup of a specific token
   */
  const saveTokenBackup = useCallback((provider: ProviderType, token: string) => {
    try {
      const backupKey = `${TOKEN_BACKUP_PREFIX}${provider}`
      const tokenData: TokenData = {
        token,
        provider,
        lastValidated: Date.now(),
        expiresAt: provider === 'gitlab' ? Date.now() + TOKEN_GITLAB_EXPIRY : undefined
      }
      
      localStorage.setItem(backupKey, JSON.stringify(tokenData))
    } catch (error) {
      console.error(`Failed to save backup token for ${provider}:`, error)
    }
  }, [])

  /**
   * Validate a token with the server
   */
  const validateToken = useCallback(async (provider: ProviderType, token?: string): Promise<boolean> => {
    if (!token) {
      token = state.tokens[provider]?.token
    }
    
    if (!token) {
      setState(prev => ({
        ...prev,
        validationStatus: {
          ...prev.validationStatus,
          [provider]: 'invalid'
        }
      }))
      return false
    }
    
    try {
      const response = await fetch('/api/auth/token/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider,
          token
        })
      })
      
      const data = await response.json()
      
      if (data.isValid) {
        console.log(`${provider} token is valid`);
        
        // Update validation status and save last validated time
        const tokenData = { 
          ...state.tokens[provider], 
          token,
          lastValidated: Date.now(),
          // Keep the existing username or use from response
          username: data.username || state.tokens[provider]?.username
        } as TokenData;
        
        setState(prev => ({
          ...prev,
          tokens: {
            ...prev.tokens,
            [provider]: tokenData
          },
          validationStatus: {
            ...prev.validationStatus,
            [provider]: 'valid' 
          }
        }))
        
        return true
      } else {
        // console.log(`${provider} token is invalid`);
        
        // If the error indicates token needs refresh, handle it
        if (data.needsRefresh) {
          console.log(`${provider} token needs refresh, attempting to refresh...`);
          
          // For GitLab expired tokens that need refresh
          if (provider === 'gitlab' && data.error === 'GitLab token is expired') {
            const refreshed = await refreshGitLabToken();
            if (refreshed) {
              console.log('GitLab token successfully refreshed');
              return true;
            }
            console.log('GitLab token refresh failed');
          }
        }
        
        // Mark as invalid in state
        setState(prev => ({
          ...prev,
          validationStatus: {
            ...prev.validationStatus,
            [provider]: 'invalid'
          }
        }))
        
        return false
      }
    } catch (error) {
      console.error(`Error validating ${provider} token:`, error)
      setState(prev => ({
        ...prev,
        validationStatus: {
          ...prev.validationStatus,
          [provider]: 'invalid'
        }
      }))
      return false
    }
  }, [state.tokens])

  /**
   * Explicitly refresh GitLab token when it becomes expired
   */
  const refreshGitLabToken = useCallback(async (): Promise<boolean> => {
    try {
      console.log('Explicitly refreshing GitLab token via API');
      
      const response = await fetch('/api/auth/token/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider: 'gitlab'
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('GitLab token refresh failed:', errorData);
        return false;
      }
      
      const data = await response.json();
      
      if (data.token && data.isValid) {
        console.log('GitLab token refresh succeeded, saving new token');
        
        // Create updated token data
        const tokenData: TokenData = {
          token: data.token,
          provider: 'gitlab',
          refreshToken: data.refreshToken,
          lastValidated: Date.now(),
          expiresAt: data.expiresAt ? new Date(data.expiresAt).getTime() : (Date.now() + TOKEN_GITLAB_EXPIRY)
        };
        
        // Update state
        setState(prev => ({
          ...prev,
          tokens: {
            ...prev.tokens,
            gitlab: tokenData
          },
          validationStatus: {
            ...prev.validationStatus,
            gitlab: 'valid'
          }
        }));
        
        // Save tokens to storage
        saveTokensToStorage({
          ...state.tokens,
          gitlab: tokenData
        });
        
        // Save token backup
        saveTokenBackup('gitlab', data.token);
        
        // Dispatch an event to notify other components
        window.dispatchEvent(new CustomEvent('gitlab-token-refreshed'));
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error refreshing GitLab token:', error);
      return false;
    }
  }, [state.tokens, saveTokensToStorage, saveTokenBackup]);

  /**
   * Fetch token from API or storage
   */
  const fetchProviderToken = useCallback(async (
    provider: ProviderType, 
    force: boolean = false
  ): Promise<string | null> => {
    // If not forcing refresh, check if we have a valid token already
    if (!force && state.tokens[provider] && state.validationStatus[provider] === 'valid') {
      return state.tokens[provider]?.token || null
    }
    
    try {
      // Check session first
      if (session?.provider === provider) {
        if (provider === 'github' && session.accessToken) {
          return session.accessToken as string
        } else if (provider === 'gitlab' && session.gitlabAccessToken) {
          return session.gitlabAccessToken as string
        }
      }
      
      // Try to load from storage as fallback
      const storedTokens = loadTokensFromStorage()
      if (storedTokens[provider]) {
        const token = storedTokens[provider]?.token
        if (token) {
          // Validate the token before returning
          const isValid = await validateToken(provider, token)
          return isValid ? token : null
        }
      }
      
      // If we get here, we don't have a valid token
      return null
    } catch (error) {
      console.error(`Error fetching ${provider} token:`, error)
      return null
    }
  }, [session, loadTokensFromStorage, validateToken, state.tokens, state.validationStatus])

  /**
   * Get token for a provider with validation if needed
   */
  const getToken = useCallback(async (
    provider: ProviderType, 
    options?: { skipCache?: boolean; validateIfOlderThan?: number }
  ): Promise<string | null> => {
    const skipCache = options?.skipCache || false
    const validateThreshold = options?.validateIfOlderThan || TOKEN_VALIDATION_INTERVAL
    
    // If we want to skip cache or if we haven't initialized, try to fetch directly
    if (skipCache || !state.initialized) {
      return fetchProviderToken(provider)
    }

    const tokenData = state.tokens[provider]
    
    // No token available
    if (!tokenData) {
      console.log(`No ${provider} token available, attempting to fetch from server API`);
      // Try to fetch from server as a last resort
      try {
        const response = await fetch('/api/auth/token');
        if (response.ok) {
          const data = await response.json();
          if (data.tokens && data.tokens[provider]) {
            console.log(`Found ${provider} token from server API`);
            // Update our local token state
            const updatedTokens = {
              ...state.tokens,
              [provider]: {
                token: data.tokens[provider].token,
                provider,
                refreshToken: data.tokens[provider].refreshToken,
                expiresAt: data.tokens[provider].expiresAt,
                lastValidated: Date.now(),
                userId: data.tokens[provider].userId
              }
            };
            
            // Update state
            setState(prev => ({
              ...prev,
              tokens: updatedTokens
            }));
            
            // Save tokens to storage
            saveTokensToStorage(updatedTokens);
            
            return data.tokens[provider].token;
          }
        }
      } catch (error) {
        console.error('Error fetching token from server API:', error);
      }
      return null;
    }
    
    // Check if token has expired
    if (tokenData.expiresAt && tokenData.expiresAt < Date.now()) {
      console.log(`Token for ${provider} has expired, attempting refresh`)
      // Using the function directly instead of through the dependency
      return refreshToken(provider)
    }
    
    // Check if token is close to expiring - refresh proactively
    if (tokenData.expiresAt && 
        tokenData.expiresAt - Date.now() < TOKEN_REFRESH_THRESHOLD) {
      console.log(`Token for ${provider} will expire soon, refreshing proactively`);
      // Try to refresh but fall back to current token if refresh fails
      const refreshedToken = await refreshToken(provider);
      return refreshedToken || tokenData.token;
    }

    // Check if we need to validate the token
    const now = Date.now()
    const needsValidation = !tokenData.lastValidated || 
      (now - tokenData.lastValidated > validateThreshold)
    
    if (needsValidation) {
      console.log(`Validating ${provider} token...`)
      const isValid = await validateToken(provider, tokenData.token)
      
      if (!isValid) {
        return refreshToken(provider)
      }
    }

    return tokenData.token
  }, [state.tokens, state.initialized, validateToken, saveTokensToStorage, fetchProviderToken])

  /**
   * Mark a token as invalid and clear it
   */
  const invalidateToken = useCallback((provider: ProviderType) => {
    console.log(`Invalidating ${provider} token`)
    
    // Update state to mark token as invalid
    setState(prev => ({
      ...prev,
      tokens: {
        ...prev.tokens,
        [provider]: null
      },
      validationStatus: {
        ...prev.validationStatus,
        [provider]: 'invalid'
      }
    }))
      
    // Update storage
    const updatedTokens = { ...state.tokens, [provider]: null }
    saveTokensToStorage(updatedTokens)
    
    // Clean up any backup tokens
    try {
      localStorage.removeItem(`${TOKEN_BACKUP_PREFIX}${provider}`)
    } catch (e) {
      console.error(`Error removing backup token for ${provider}:`, e)
    }
  }, [state.tokens, saveTokensToStorage])

  /**
   * Try to refresh an expired token
   */
  const refreshToken = useCallback(async (provider: ProviderType): Promise<string | null> => {
    console.log(`Attempting to refresh ${provider} token`)
    
    try {
      // Check if we have the token data with a refresh token (for GitLab)
      const tokenData = state.tokens[provider]
      
      if (tokenData) {
        // Use the API refresh endpoint to get a new token
        try {
          console.log(`Calling token refresh API for ${provider}...`);
          
          const refreshResponse = await fetch('/api/auth/token/refresh', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              provider
            })
          })
          
          // Log more details about the response for debugging
          console.log(`Refresh API response status: ${refreshResponse.status}`);
          
          if (refreshResponse.ok) {
            const data = await refreshResponse.json()
            console.log(`Refresh API response data:`, data);
            
            if (data.token && data.isValid) {
              console.log(`Successfully refreshed ${provider} token via API`)
              
              // Calculate expires time correctly from the API response
              let expiresAt;
              if (data.expiresAt) {
                // Convert ISO string to timestamp if provided
                expiresAt = new Date(data.expiresAt).getTime();
              } else if (provider === 'gitlab') {
                // Use default expiry for GitLab
                expiresAt = Date.now() + TOKEN_GITLAB_EXPIRY;
              }
              
              // Create updated token data
              const updatedTokenData: TokenData = {
                token: data.token,
                provider,
                refreshToken: data.refreshToken || tokenData.refreshToken,
                expiresAt,
                lastValidated: Date.now(),
                userId: data.username || tokenData.userId
              }
              
              console.log(`Updated token data for ${provider}:`, {
                hasToken: !!updatedTokenData.token,
                hasRefreshToken: !!updatedTokenData.refreshToken,
                expiresAt: updatedTokenData.expiresAt ? new Date(updatedTokenData.expiresAt).toISOString() : 'none'
              });
              
              // Update state
              const updatedTokens = { ...state.tokens, [provider]: updatedTokenData }
              setState(prev => ({
                ...prev,
                tokens: updatedTokens,
                validationStatus: {
                  ...prev.validationStatus,
                  [provider]: 'valid'
                }
              }))
              
              // Save to storage
              saveTokensToStorage(updatedTokens)
              saveTokenBackup(provider, data.token)
              
              // Force a window event to notify other components that tokens were updated
      if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('provider-tokens-updated'));
              }
              
              return data.token
            } else {
              console.log(`${provider} token refresh failed, token is invalid`)
              // Call invalidateToken directly instead of through dependency
              invalidateToken(provider)
              return null
            }
          } else {
            let errorText;
            try {
              const errorData = await refreshResponse.text();
              console.error(`Failed to refresh ${provider} token:`, errorData);
              errorText = errorData;
            } catch (parseError) {
              console.error(`Error parsing refresh error response:`, parseError);
              errorText = `Status ${refreshResponse.status}`;
            }
            
            // If the token is definitely invalid (401/403), invalidate it
            if (refreshResponse.status === 401 || refreshResponse.status === 403) {
              // Call invalidateToken directly instead of through dependency
              invalidateToken(provider)
            }
            
            return null
          }
        } catch (error) {
          console.error(`Error during ${provider} token refresh API call:`, error)
          return fetchProviderToken(provider, true)
        }
      } else {
        // Fallback to direct fetch if we don't have token data
        return fetchProviderToken(provider, true)
      }
    } catch (error) {
      console.error(`Failed to refresh ${provider} token:`, error)
      return null
    }
  }, [state.tokens, fetchProviderToken, saveTokensToStorage, saveTokenBackup])

  /**
   * Check if a provider has a token available
   */
  const hasProviderToken = useCallback((provider: string): boolean => {
    return !!state.tokens[provider as ProviderType]
  }, [state.tokens])

  /**
   * Check if a provider's token is valid based on our validation status
   */
  const isTokenValid = useCallback((provider: string): boolean => {
    return state.validationStatus[provider as ProviderType] === 'valid'
  }, [state.validationStatus])

  /**
   * Refresh token if it's older than maxAge
   */
  const refreshTokenIfNeeded = useCallback(async (
    provider: ProviderType,
    maxAge: number = TOKEN_VALIDATION_INTERVAL
  ): Promise<boolean> => {
    const tokenData = state.tokens[provider]
    if (!tokenData) return false
    
    const now = Date.now()
    const needsRefresh = !tokenData.lastValidated || 
      (now - tokenData.lastValidated > maxAge)
    
    if (needsRefresh) {
      const token = await getToken(provider, { validateIfOlderThan: 0 })
      return !!token
    }
    
    return true
  }, [state.tokens, getToken])

  /**
   * Directly set a token for a provider
   */
  const setToken = useCallback(async (provider: ProviderType, token: string, saveToServer: boolean = true) => {
    console.log(`Setting ${provider} token directly`);
    
    // Create token data object
    const tokenData: TokenData = {
      token,
      provider,
      lastValidated: Date.now(),
      expiresAt: provider === 'gitlab' ? Date.now() + TOKEN_GITLAB_EXPIRY : undefined
    };
    
    // Update state
    setState(prev => ({
      ...prev,
      tokens: {
        ...prev.tokens,
        [provider]: tokenData
      },
      validationStatus: {
        ...prev.validationStatus,
        [provider]: 'valid'
      }
    }));
    
    // Save to storage
    saveTokensToStorage({
      ...state.tokens,
      [provider]: tokenData
    });

    // Save backup
    saveTokenBackup(provider, token);
    
    // Save to server if requested and we have session
    if (saveToServer && status === 'authenticated' && session?.user?.email) {
      try {
        const username = provider === 'github' ? 
          (session as any)?.githubUsername : 
          (session as any)?.gitlabUsername || session.user.name;
        
        const response = await fetch('/api/auth/token', {
          method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            provider,
            token,
          username
          })
        });
      
        if (response.ok) {
          console.log(`Successfully saved ${provider} token to server`);
        } else {
          console.error(`Failed to save ${provider} token to server:`, await response.text());
        }
      } catch (error) {
        console.error(`Error saving ${provider} token to server:`, error);
      }
    }
    
    return token;
  }, [state.tokens, saveTokensToStorage, saveTokenBackup, status, session]);

  // Force token refresh handler
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    // Add debounce mechanism to prevent rapid consecutive refreshes
    let refreshTimeout: NodeJS.Timeout | null = null;
    let isRefreshing = false;

    const handleForceRefresh = async () => {
      // Prevent concurrent refreshes
      if (isRefreshing) return;
      
      console.log('Force refreshing tokens from server');
      isRefreshing = true;
      
      // Clear any existing timeout
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
      
      // Set a timeout to actually do the refresh
      refreshTimeout = setTimeout(async () => {
        try {
          const response = await fetch('/api/auth/token');
          if (response.ok) {
            const data = await response.json();
            
            if (data.tokens) {
              // Update tokens from server data
              const updatedTokens = {
                ...state.tokens,
                ...data.tokens
              };
              
              // Save the tokens to storage
              saveTokensToStorage(updatedTokens);
              
              // Update state
              setState(prev => ({
                ...prev,
                tokens: updatedTokens
              }));
              
              console.log('Tokens refreshed from server');
            }
          }
    } catch (error) {
          console.error('Error during force token refresh:', error);
        } finally {
          isRefreshing = false;
    }
      }, 300); // Debounce for 300ms
    };

    // Add event listener for force refresh
    window.addEventListener('force-token-refresh', handleForceRefresh);
    
    // Clean up
    return () => {
      window.removeEventListener('force-token-refresh', handleForceRefresh);
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
    };
  }, [saveTokensToStorage]);

  // Add debug logging to hasProviderToken function
  const hasProviderTokenDebug = useCallback((provider: string): boolean => {
    const hasToken = !!state.tokens[provider as ProviderType];
    // console.log(`Checking if provider ${provider} has token: ${hasToken}`);
    return hasToken;
  }, [state.tokens]);

  return {
    tokens: state.tokens,
    validationStatus: state.validationStatus,
    initialized: state.initialized,
    loading: !state.initialized, // Add loading state
    getToken,
    fetchProviderToken,
    hasProviderToken: hasProviderTokenDebug, // Use the debug version
    isTokenValid,
    invalidateToken,
    refreshTokenIfNeeded,
    setToken,
    error: null // Add error state for consistency
  }
}