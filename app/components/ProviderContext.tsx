'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useLocalStorage } from 'usehooks-ts';
import useProviderTokens from '@/hooks/useProviderTokens';

export type ProviderType = 'github' | 'gitlab' | 'azure' | 'bitbucket';

interface ProviderContextType {
  provider: ProviderType;
  setProvider: (provider: ProviderType) => void;
  isConnected: (provider: ProviderType) => boolean;
  connectedProviders: ProviderType[];
  checkForToken: (provider: ProviderType) => Promise<boolean>;
}

const ProviderContext = createContext<ProviderContextType | undefined>(undefined);

export const ProviderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [provider, setProviderState] = useLocalStorage<ProviderType>('selectedProvider', 'github');
  const [connectedProviders, setConnectedProviders] = useState<ProviderType[]>([]);
  const { data: session } = useSession();
  const { isConnected, getToken, refreshTokenIfNeeded } = useProviderTokens();

  const updateConnectedProviders = useCallback(() => {
    const connected: ProviderType[] = [];
    
    ['github', 'gitlab', 'azure', 'bitbucket'].forEach((p) => {
      if (isConnected(p)) {
        connected.push(p as ProviderType);
      }
    });
    
    setConnectedProviders(connected);
    
    // Make sure the selected provider is connected, or switch to a connected one
    if (connected.length > 0 && !connected.includes(provider)) {
      console.log(`Selected provider ${provider} not connected. Switching to ${connected[0]}`);
      setProviderState(connected[0]);
    }
  }, [isConnected, provider, setProviderState]);

  // Set provider and ensure it's properly tracked
  const setProvider = useCallback((newProvider: ProviderType) => {
    console.log(`Setting provider to ${newProvider}`);
    setProviderState(newProvider);
    
    // Attempt to refresh token for this provider
    refreshTokenIfNeeded(newProvider, 0);
  }, [setProviderState, refreshTokenIfNeeded]);

  // Check for token and refresh if needed
  const checkForToken = useCallback(async (providerToCheck: ProviderType): Promise<boolean> => {
    // Try to get current token
    let token = getToken(providerToCheck);
    
    // If no token, try to refresh from server
    if (!token) {
      token = await refreshTokenIfNeeded(providerToCheck, 0);
    }
    
    // If still no token, check localStorage directly
    if (!token) {
      try {
        if (providerToCheck === 'github') {
          token = localStorage.getItem('github_token');
        } else if (providerToCheck === 'gitlab') {
          token = localStorage.getItem('gitlabToken');
        }
      } catch (e) {
        console.warn(`Error checking localStorage for ${providerToCheck} token:`, e);
      }
    }
    
    return !!token;
  }, [getToken, refreshTokenIfNeeded]);

  // Update connected providers when session changes
  useEffect(() => {
    updateConnectedProviders();
  }, [updateConnectedProviders, session]);

  // Set initial provider based on session
  useEffect(() => {
    if (session?.provider) {
      const sessionProvider = session.provider as ProviderType;
      
      // Check if we should switch to the session provider
      if (sessionProvider && !connectedProviders.includes(provider) && connectedProviders.includes(sessionProvider)) {
        console.log(`Auto-switching to session provider: ${sessionProvider}`);
        setProviderState(sessionProvider);
      }
    }
  }, [session, connectedProviders, provider, setProviderState]);

  // Sync with localStorage when possible
  useEffect(() => {
    try {
      // Try to fetch tokens on mount to ensure we have the latest
      ['github', 'gitlab'].forEach(provider => {
        refreshTokenIfNeeded(provider, 0);
      });
    } catch (e) {
      console.warn('Error syncing provider tokens with localStorage:', e);
    }
  }, [refreshTokenIfNeeded]);

  return (
    <ProviderContext.Provider
      value={{
        provider,
        setProvider,
        isConnected,
        connectedProviders,
        checkForToken
      }}
    >
      {children}
    </ProviderContext.Provider>
  );
};

export function useProvider() {
  const context = useContext(ProviderContext);
  if (context === undefined) {
    throw new Error('useProvider must be used within a ProviderProvider');
  }
  return context;
} 