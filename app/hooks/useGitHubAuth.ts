'use client';

import { useState, useCallback } from 'react';
import { useSession, signIn } from 'next-auth/react';

type GitHubUser = {
  id: number;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
};

type GitHubAuthState = {
  user: GitHubUser | null;
  isLoading: boolean;
  error: Error | null;
};

/**
 * Hook for accessing GitHub authentication
 * Uses the access token stored in Google Sheets
 */
export function useGitHubAuth() {
  const { data: session, status } = useSession();
  const [state, setState] = useState<GitHubAuthState>({
    user: null,
    isLoading: false,
    error: null,
  });

  // Function to authenticate with GitHub using email and stored token
  const authenticateWithEmail = useCallback(async (email: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const response = await fetch('/api/github-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to authenticate with GitHub');
      }
      
      if (data.success && data.user) {
        setState({
          user: data.user,
          isLoading: false,
          error: null,
        });
        return data.user;
      } else {
        throw new Error('No user data returned from GitHub authentication');
      }
    } catch (error) {
      console.error('GitHub authentication error:', error);
      setState({
        user: null,
        isLoading: false,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return null;
    }
  }, []);

  // Function to sign in with GitHub through NextAuth
  const signInWithGitHub = useCallback(async (callbackUrl = '/') => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      await signIn('github', { callbackUrl });
      // Note: This function will redirect, so the following code won't execute
      // unless there's an error
    } catch (error) {
      console.error('GitHub sign-in error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }));
    }
  }, []);

  return {
    user: state.user,
    isLoading: state.isLoading || status === 'loading',
    error: state.error,
    isAuthenticated: !!session?.user,
    session,
    authenticateWithEmail,
    signInWithGitHub,
  };
} 