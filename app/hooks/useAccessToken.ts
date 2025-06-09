import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

type AccessTokenState = {
  token: string | null;
  isLoading: boolean;
  error: Error | null;
};

/**
 * Custom hook to retrieve the user's access token from Google Sheets
 * 
 * @deprecated Use useGitHubAuth instead for a more comprehensive authentication approach
 * @returns {Object} The access token state
 * @returns {string|null} token - The access token or null if not available
 * @returns {boolean} isLoading - Whether the token is being loaded
 * @returns {Error|null} error - Any error that occurred during token retrieval
 */
export const useAccessToken = () => {
  const { data: session, status } = useSession();
  const [state, setState] = useState<AccessTokenState>({
    token: null,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    // Only fetch the token if the user is authenticated
    if (status === 'authenticated' && session?.user?.email) {
      setState(prev => ({ ...prev, isLoading: true }));
      
      fetch('/api/get-access-token')
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to fetch access token: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          if (data.success && data.accessToken) {
            setState({
              token: data.accessToken,
              isLoading: false,
              error: null,
            });
          } else {
            throw new Error(data.error || 'Failed to retrieve access token');
          }
        })
        .catch(error => {
          console.error('Error fetching access token:', error);
          setState({
            token: null,
            isLoading: false,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        });
    }
  }, [status, session?.user?.email]);

  // Log a deprecation warning
  useEffect(() => {
    console.warn(
      'The useAccessToken hook is deprecated and will be removed in a future version. ' +
      'Please use the useGitHubAuth hook instead for a more comprehensive authentication approach.'
    );
  }, []);

  return state;
}; 