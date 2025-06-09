'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import useProviderTokens from '../hooks/useProviderTokens';

export default function TokenUpdater() {
  const { data: session, status } = useSession();
  const { 
    tokens, 
    hasProviderToken, 
    initialized,
    fetchProviderToken,
    setToken,
    refreshTokenIfNeeded,
    validateToken
  } = useProviderTokens();
  
  // Log session state on change
  useEffect(() => {
    console.log('TokenUpdater: Session status:', status);
    if (status === 'authenticated' && session) {
      console.log('TokenUpdater: Session provider:', session.provider);
      console.log('TokenUpdater: Session has accessToken:', !!session.accessToken);
    }
  }, [session, status]);
  
  // Log tokens hook state
  useEffect(() => {
    if (initialized) {
      try {
        // Safely get connected providers
        const connectedProviders = [];
        
        if (typeof hasProviderToken === 'function') {
          ['github', 'gitlab', 'azure', 'bitbucket'].forEach(provider => {
            if (hasProviderToken(provider)) {
              connectedProviders.push(provider);
            }
          });
        }
        
        // console.log('TokenUpdater: Providers connected:', connectedProviders);
        
        if (hasProviderToken && hasProviderToken('gitlab')) {
        // console.log('TokenUpdater: GitLab token available in hook');
      } else {
        // console.log('TokenUpdater: GitLab token NOT available in hook');
        }
      } catch (error) {
        // console.error('TokenUpdater: Error checking provider tokens:', error);
      }
    }
  }, [tokens, hasProviderToken, initialized]);
  
  /**
   * Initialize provider tokens when user is authenticated
   */
  useEffect(() => {
    if (status === 'authenticated' && initialized) {
      // console.log('TokenUpdater: Session is authenticated')
      
      const initializeProviderTokens = async () => {
        try {
          // Get GitHub token either from the session, localStorage, or the hook
          if (session?.provider === 'github' && (session as any).accessToken) {
            // console.log('TokenUpdater: Setting GitHub token from session')
            await fetchProviderToken('github')
          } else {
            // console.log('TokenUpdater: Checking for GitHub token')
            await fetchProviderToken('github')
          }

          // Get GitLab token either from the session, localStorage, or the hook
          if (session?.provider === 'gitlab' && (session as any).gitlabAccessToken) {
            // console.log('TokenUpdater: Setting GitLab token from session')
            await fetchProviderToken('gitlab')
          } else {
            // console.log('TokenUpdater: Checking for GitLab token')
            await fetchProviderToken('gitlab')
          }
          
          // Also try to fetch tokens directly from API
          try {
            const response = await fetch('/api/auth/token')
            if (response.ok) {
              const data = await response.json()
              if (data.tokens) {
                // console.log('TokenUpdater: Loaded additional tokens from server API')
                
                // Process any server tokens we didn't already have
                if (data.tokens.github && !hasProviderToken('github')) {
                  setToken('github', data.tokens.github.token)
                }
                
                if (data.tokens.gitlab && !hasProviderToken('gitlab')) {
                  setToken('gitlab', data.tokens.gitlab.token)
                }
              }
            }
          } catch (serverError) {
            console.warn('TokenUpdater: Could not fetch additional tokens from server', serverError)
          }
        } catch (error) {
          console.error('TokenUpdater: Error initializing provider tokens:', error)
        }
      }
      
      initializeProviderTokens()
    }
  }, [status, session, initialized, fetchProviderToken, hasProviderToken, setToken])
  
  // Regular validation for GitLab token to prevent expired token issues
  useEffect(() => {
    if (typeof window === 'undefined' || !initialized || !hasProviderToken) return;
    
    let timeout: NodeJS.Timeout;
    
    // Check GitLab token every 10 minutes to catch expiring tokens
    const checkGitLabToken = async () => {
      if (hasProviderToken('gitlab')) {
        console.log('TokenUpdater: Running periodic GitLab token validation');
        await validateToken('gitlab');
      }
      
      // Schedule next check
      timeout = setTimeout(checkGitLabToken, 10 * 60 * 1000);
    };
    
    // Start checking after a short delay
    timeout = setTimeout(checkGitLabToken, 30 * 1000);
    
    return () => {
      clearTimeout(timeout);
    };
  }, [initialized, hasProviderToken, validateToken]);
  
  // This is a non-visible component that just handles the token initialization
  return null;
}