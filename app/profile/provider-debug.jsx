'use client';

import { useState, useEffect } from 'react';
import useProviderTokens from '../hooks/useProviderTokens';
import { useSession } from 'next-auth/react';

export default function ProviderDebugInfo() {
  const { data: session, status } = useSession();
  const { 
    tokens, 
    loading: tokensLoading, 
    hasProviderToken, 
    isTokenValid,
    initialized,
    refreshTokenIfNeeded
  } = useProviderTokens();
  
  const [debugInfo, setDebugInfo] = useState({
    tokensFound: false,
    providers: {},
    fetchAttempted: false,
    fetchError: null,
    refreshStatus: null
  });
  
  // Function to check provider status
  const checkProviderStatus = () => {
    const providers = {
      github: {
        hasToken: hasProviderToken('github'),
        isValid: isTokenValid('github'),
        tokenInState: !!tokens?.github,
        sessionMatches: session?.provider === 'github',
        isConnected: !!session?.githubConnected
      },
      gitlab: {
        hasToken: hasProviderToken('gitlab'),
        isValid: isTokenValid('gitlab'),
        tokenInState: !!tokens?.gitlab,
        sessionMatches: session?.provider === 'gitlab',
        isConnected: !!session?.gitlabConnected
      }
    };
    
    setDebugInfo(prev => ({
      ...prev,
      providers
    }));
  };
  
  // Function to fetch tokens directly from API
  const fetchTokensFromAPI = async () => {
    try {
      setDebugInfo(prev => ({ ...prev, fetchAttempted: true, fetchError: null }));
      
      const response = await fetch('/api/auth/token');
      const data = await response.json();
      
      setDebugInfo(prev => ({
        ...prev,
        tokensFound: data.tokens && Object.keys(data.tokens).length > 0,
        apiResponse: {
          status: response.status,
          tokens: data.tokens ? Object.keys(data.tokens) : []
        }
      }));
    } catch (error) {
      setDebugInfo(prev => ({
        ...prev,
        fetchError: error.message
      }));
    }
  };

  // Function to force refresh a specific provider token
  const forceRefreshToken = async (provider) => {
    try {
      setDebugInfo(prev => ({ 
        ...prev, 
        refreshStatus: `Refreshing ${provider} token...` 
      }));
      
      const refreshResult = await fetch('/api/auth/token/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ provider })
      });
      
      const data = await refreshResult.json();
      
      if (refreshResult.ok && data.isValid) {
        setDebugInfo(prev => ({ 
          ...prev, 
          refreshStatus: `${provider} token refreshed successfully!` 
        }));
        
        // Trigger a token refresh in the hook
        window.dispatchEvent(new Event('force-token-refresh'));
        
        // Check status again after a short delay
        setTimeout(checkProviderStatus, 500);
      } else {
        setDebugInfo(prev => ({ 
          ...prev, 
          refreshStatus: `Failed to refresh ${provider} token: ${data.error || 'Unknown error'}`
        }));
      }
    } catch (error) {
      setDebugInfo(prev => ({ 
        ...prev, 
        refreshStatus: `Error refreshing ${provider} token: ${error.message}`
      }));
    }
  };
  
  // Function to validate token
  const validateToken = async (provider) => {
    try {
      setDebugInfo(prev => ({ 
        ...prev, 
        refreshStatus: `Validating ${provider} token...` 
      }));
      
      const result = await refreshTokenIfNeeded(provider);
      
      setDebugInfo(prev => ({ 
        ...prev, 
        refreshStatus: result 
          ? `${provider} token validation successful!` 
          : `${provider} token validation failed.`
      }));
      
      // Check status again after a short delay
      setTimeout(checkProviderStatus, 500);
    } catch (error) {
      setDebugInfo(prev => ({ 
        ...prev, 
        refreshStatus: `Error validating ${provider} token: ${error.message}`
      }));
    }
  };
  
  // Load tokens on first render
  useEffect(() => {
    if (!tokensLoading && initialized) {
      checkProviderStatus();
    }
  }, [tokensLoading, tokens, initialized]);
  
  // Listen for token updates
  useEffect(() => {
    const handleTokensUpdated = () => {
      console.log('Token update detected, refreshing status...');
      checkProviderStatus();
    };
    
    window.addEventListener('provider-tokens-updated', handleTokensUpdated);
    
    return () => {
      window.removeEventListener('provider-tokens-updated', handleTokensUpdated);
    };
  }, []);
  
  // Render debug info
  return (
    <div className="bg-yellow-100 dark:bg-yellow-900 p-4 my-4 rounded-lg text-sm">
      <h3 className="font-bold mb-2">Provider Connection Debug</h3>
      
      <div className="space-y-2">
        <div>
          <div><strong>Session Status:</strong> {status}</div>
          <div><strong>Provider:</strong> {session?.provider || 'None'}</div>
          <div><strong>Tokens Initialized:</strong> {initialized ? 'Yes' : 'No'}</div>
          <div><strong>Tokens Loading:</strong> {tokensLoading ? 'Yes' : 'No'}</div>
        </div>
        
        <div className="border-t pt-2 border-yellow-200 dark:border-yellow-800">
          <h4 className="font-semibold">Provider Status:</h4>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div>
              <strong>GitHub:</strong>
              <ul className="list-disc list-inside ml-2">
                <li>Has Token: {debugInfo.providers.github?.hasToken ? 'Yes' : 'No'}</li>
                <li>Token Valid: {debugInfo.providers.github?.isValid ? 'Yes' : 'No'}</li>
                <li>In State: {debugInfo.providers.github?.tokenInState ? 'Yes' : 'No'}</li>
                <li>Session: {debugInfo.providers.github?.sessionMatches ? 'Primary' : 'Secondary'}</li>
                <li>Connected: {debugInfo.providers.github?.isConnected ? 'Yes' : 'No'}</li>
              </ul>
              <div className="mt-2 flex gap-2">
                <button 
                  onClick={() => forceRefreshToken('github')}
                  className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600"
                >
                  Refresh Token
                </button>
                <button 
                  onClick={() => validateToken('github')}
                  className="bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600"
                >
                  Validate
                </button>
              </div>
            </div>
            <div>
              <strong>GitLab:</strong>
              <ul className="list-disc list-inside ml-2">
                <li>Has Token: {debugInfo.providers.gitlab?.hasToken ? 'Yes' : 'No'}</li>
                <li>Token Valid: {debugInfo.providers.gitlab?.isValid ? 'Yes' : 'No'}</li>
                <li>In State: {debugInfo.providers.gitlab?.tokenInState ? 'Yes' : 'No'}</li>
                <li>Session: {debugInfo.providers.gitlab?.sessionMatches ? 'Primary' : 'Secondary'}</li>
                <li>Connected: {debugInfo.providers.gitlab?.isConnected ? 'Yes' : 'No'}</li>
              </ul>
              <div className="mt-2 flex gap-2">
                <button 
                  onClick={() => forceRefreshToken('gitlab')}
                  className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600"
                >
                  Refresh Token
                </button>
                <button 
                  onClick={() => validateToken('gitlab')}
                  className="bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600"
                >
                  Validate
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="border-t pt-2 border-yellow-200 dark:border-yellow-800">
          <div className="flex gap-2">
            <button 
              onClick={fetchTokensFromAPI}
              className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600"
            >
              Fetch Tokens from API
            </button>
            <button 
              onClick={() => window.dispatchEvent(new Event('force-token-refresh'))}
              className="bg-purple-500 text-white px-2 py-1 rounded text-xs hover:bg-purple-600"
            >
              Force Global Refresh
            </button>
          </div>
          
          {debugInfo.refreshStatus && (
            <div className="mt-2 px-3 py-2 bg-amber-200 dark:bg-amber-800 rounded">
              <strong>Status:</strong> {debugInfo.refreshStatus}
            </div>
          )}
          
          {debugInfo.fetchAttempted && (
            <div className="mt-2">
              {debugInfo.fetchError ? (
                <div className="text-red-500">Error: {debugInfo.fetchError}</div>
              ) : (
                <div>
                  <div><strong>API Status:</strong> {debugInfo.apiResponse?.status}</div>
                  <div><strong>Tokens Found:</strong> {debugInfo.tokensFound ? 'Yes' : 'No'}</div>
                  {debugInfo.apiResponse?.tokens.length > 0 && (
                    <div><strong>Providers:</strong> {debugInfo.apiResponse.tokens.join(', ')}</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 