'use client'

import { useState, useEffect } from 'react'
import { useSession, signIn } from 'next-auth/react'
import Image from 'next/image'
import axios from 'axios'
import { 
  FaGithub, 
  FaGitlab, 
  FaMicrosoft, 
  FaBitbucket, 
  FaUser, 
  FaEnvelope,
  FaExclamationTriangle,
  FaPlus,
  FaCheck,
  FaEdit
} from 'react-icons/fa'
import Link from 'next/link'
import useProviderTokens from '../hooks/useProviderTokens'
import ProviderDebugInfo from './provider-debug'
import { useSearchParams } from 'next/navigation'

interface UserProfile {
  name: string
  email: string
  image: string
  username: string
}

interface RepoProvider {
  id: string
  name: string
  icon: React.ReactNode
  connected: boolean
  buttonText: string
}

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()
  const { 
    tokens, 
    loading: tokensLoading, 
    hasProviderToken, 
    isTokenValid,
    error: tokensError 
  } = useProviderTokens()
  
  // Add a helper function for checking connection status
  const isConnected = (providerId: string) => {
    return hasProviderToken(providerId) && isTokenValid(providerId);
  }
  
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [providers, setProviders] = useState<RepoProvider[]>([
    {
      id: 'github',
      name: 'GitHub',
      icon: <FaGithub className="w-5 h-5" />,
      connected: false,
      buttonText: 'Connect'
    },
    {
      id: 'gitlab',
      name: 'GitLab',
      icon: <FaGitlab className="w-5 h-5" />,
      connected: false,
      buttonText: 'Connect'
    },
    {
      id: 'azure',
      name: 'Azure DevOps',
      icon: <FaMicrosoft className="w-5 h-5" />,
      connected: false,
      buttonText: 'Connect'
    },
    {
      id: 'bitbucket',
      name: 'Bitbucket',
      icon: <FaBitbucket className="w-5 h-5" />,
      connected: false,
      buttonText: 'Connect'
    }
  ])

  useEffect(() => {
    if (status === 'authenticated' && session) {
      // Set the user profile from session data
      setUserProfile({
        name: session.user?.name || 'Unknown User',
        email: session.user?.email || 'No email available',
        image: session.user?.image || '/placeholder-avatar.png',
        username: (session as any)?.githubUsername || 
                 (session as any)?.gitlabUsername || 
                 'No username available'
      })
    }
  }, [session, status])

  // Update provider connection status based on available tokens
  useEffect(() => {
    if (!tokensLoading) {
      // Only update if provider connection status has actually changed
      const shouldUpdate = providers.some(provider => {
        const isProviderConnected = isConnected(provider.id);
        return provider.connected !== isProviderConnected;
      });
      
      if (shouldUpdate) {
        const updatedProviders = providers.map(provider => {
          const isProviderConnected = isConnected(provider.id);
          return {
            ...provider,
            connected: isProviderConnected,
            buttonText: isProviderConnected ? 'Connected' : 'Connect'
          };
        });
        
        setProviders(updatedProviders);
      }
      
      // If user is authenticated but no tokens are found, try to fetch once from server
      if (status === 'authenticated' && !providers.some(p => p.connected)) {
        const fetchTokensFromServer = async () => {
          try {
            // Prevent repeated fetching by adding a state flag
            if (window.tokenFetchAttempted) return;
            window.tokenFetchAttempted = true;
            
            const response = await fetch('/api/auth/token');
            if (response.ok) {
              const data = await response.json();
              if (data.tokens && Object.keys(data.tokens).length > 0) {
                // Force refresh the tokens state through the hook
                window.dispatchEvent(new Event('force-token-refresh'));
              }
            }
          } catch (error) {
            // console.error('Error fetching tokens from server:', error);
          }
        };
        
        fetchTokensFromServer();
      }
    }
  }, [tokens, tokensLoading, isConnected, providers, status]);

  // Handle refresh-tokens parameter in URL (from provider linking)
  useEffect(() => {
    const shouldRefreshTokens = searchParams.get('refresh-tokens') === 'true'
    
    if (shouldRefreshTokens && status === 'authenticated') {
      console.log('URL parameter detected: refreshing provider tokens')
      
      // Force refresh the tokens state through the hook
      window.dispatchEvent(new Event('force-token-refresh'))
      
      // Remove the parameter from URL to prevent repeated refreshes
      // This requires Next.js App Router and Client Components
      const url = new URL(window.location.href)
      url.searchParams.delete('refresh-tokens')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams, status])

  const handleConnectProvider = (providerId: string) => {
    // If the user is already logged in, add this as a secondary provider
    if (status === 'authenticated' && session?.user?.email) {
      console.log(`Adding ${providerId} as a secondary provider...`);
      
      // Set the callbackUrl to signal we're doing a link, not a primary auth
      // This will redirect back to profile page after linking
      const callbackUrl = `/api/auth/callback/link-provider?provider=${providerId}&redirect=/profile`;
      
      switch (providerId) {
        case 'github':
          signIn('github', { 
            callbackUrl,
            redirect: true
          });
          break;
        case 'gitlab':
          signIn('gitlab', { 
            callbackUrl,
            redirect: true 
          });
          break;
        case 'azure':
        case 'bitbucket':
          // Still placeholder for Azure and Bitbucket
          alert(`Connect to ${providerId} - This feature is coming soon!`);
          break;
      }
    } else {
      // If not logged in at all, this will be the primary auth
      switch (providerId) {
        case 'github':
          signIn('github', { callbackUrl: '/profile' });
          break;
        case 'gitlab':
          signIn('gitlab', { callbackUrl: '/profile' });
          break;
        case 'azure':
        case 'bitbucket':
          alert(`Connect to ${providerId} - This feature is coming soon!`);
          break;
      }
    }
  }

  if (status === 'loading' || tokensLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <div className="text-center py-12">
        <div className="mb-6">
          <FaExclamationTriangle className="w-12 h-12 mx-auto text-yellow-500" />
        </div>
        <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
        <p className="mb-6">Please sign in to view your profile</p>
        <Link 
          href="/login" 
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Sign In
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Profile Overview */}
      <div className="lg:col-span-1">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
          <div className="relative mx-auto mb-6 w-32 h-32">
            <div className="w-full h-full rounded-full overflow-hidden border-4 border-white dark:border-gray-700 shadow-lg">
              {userProfile?.image ? (
                <Image
                  src={userProfile.image}
                  alt={userProfile.name}
                  fill
                  className="object-cover rounded-full"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-100 to-blue-300 dark:from-blue-800 dark:to-blue-900 flex items-center justify-center">
                  <FaUser className="w-16 h-16 rounded-full text-blue-500 dark:text-blue-300" />
                </div>
              )}
            </div>
          </div>
          
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
              {userProfile?.name}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              @{userProfile?.username}
            </p>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3 justify-center">
                <FaEnvelope className="text-gray-500 dark:text-gray-400" />
                <span className="text-gray-700 dark:text-gray-300">
                  {userProfile?.email}
                </span>
              </div>
            </div>
            
            <div className="mt-6">
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md transition-colors flex items-center justify-center gap-2">
                <FaEdit className="w-4 h-4" />
                Edit Profile
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Repository Providers and Debug Info */}
      <div className="lg:col-span-2 space-y-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
              Repository Providers
            </h2>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Manage your connected providers
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {providers.map(provider => (
              <div
                key={provider.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="text-gray-700 dark:text-gray-300">
                    {provider.icon}
                  </div>
                  <div>
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      {provider.name}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {provider.connected ? 'Connected' : 'Not Connected'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleConnectProvider(provider.id)}
                  disabled={provider.connected}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    provider.connected
                      ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 cursor-default'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {provider.connected ? (
                    <FaCheck className="w-4 h-4" />
                  ) : (
                    <FaPlus className="w-3 h-3" />
                  )}
                  {provider.buttonText}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
  )
}