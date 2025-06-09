'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { ProviderType } from '@/app/lib/providers/base-provider';
import { getProvider, getSupportedProviders } from '@/app/lib/providers/provider-factory';

interface ProviderContextType {
  currentProvider: ProviderType;
  setCurrentProvider: (provider: ProviderType) => void;
  availableProviders: ProviderType[];
  isProviderAuthenticated: (provider: ProviderType) => Promise<boolean>;
  getProviderDisplayName: (provider: ProviderType) => string;
  getProviderAuthUrl: (provider: ProviderType) => string;
}

const defaultContext: ProviderContextType = {
  currentProvider: 'github',
  setCurrentProvider: () => {},
  availableProviders: [],
  isProviderAuthenticated: async () => false,
  getProviderDisplayName: () => '',
  getProviderAuthUrl: () => '',
};

const ProviderContext = createContext<ProviderContextType>(defaultContext);

export function useProvider() {
  return useContext(ProviderContext);
}

export function ProviderContextProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [currentProvider, setCurrentProvider] = useState<ProviderType>('github');
  const [availableProviders, setAvailableProviders] = useState<ProviderType[]>(['github']);
  
  // Get provider from URL query parameter or default to github
  useEffect(() => {
    const providerParam = searchParams.get('provider');
    if (providerParam && ['github', 'gitlab', 'azure', 'bitbucket'].includes(providerParam)) {
      setCurrentProvider(providerParam as ProviderType);
    }
    
    // Get the list of supported providers
    setAvailableProviders(getSupportedProviders());
  }, [searchParams]);
  
  // Check if a provider is authenticated
  const isProviderAuthenticated = async (provider: ProviderType): Promise<boolean> => {
    try {
      const providerInstance = getProvider(provider);
      return await providerInstance.isAuthenticated();
    } catch (error) {
      console.error(`Error checking if provider ${provider} is authenticated:`, error);
      return false;
    }
  };
  
  // Get the display name of a provider
  const getProviderDisplayName = (provider: ProviderType): string => {
    try {
      const providerInstance = getProvider(provider);
      return providerInstance.displayName;
    } catch (error) {
      return provider.charAt(0).toUpperCase() + provider.slice(1);
    }
  };
  
  // Get the auth URL for a provider
  const getProviderAuthUrl = (provider: ProviderType): string => {
    try {
      const providerInstance = getProvider(provider);
      return providerInstance.getAuthUrl();
    } catch (error) {
      return `/settings?provider=${provider}`;
    }
  };
  
  const contextValue: ProviderContextType = {
    currentProvider,
    setCurrentProvider,
    availableProviders,
    isProviderAuthenticated,
    getProviderDisplayName,
    getProviderAuthUrl,
  };
  
  return (
    <ProviderContext.Provider value={contextValue}>
      {children}
    </ProviderContext.Provider>
  );
} 