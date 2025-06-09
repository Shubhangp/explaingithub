'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { FaGitlab, FaSpinner } from 'react-icons/fa'

interface GitLabSignInButtonProps {
  callbackUrl?: string
  message?: string
  className?: string
  buttonText?: string
  reload?: boolean
  onSuccess?: () => void
  onError?: (error: Error) => void
}

/**
 * A production-ready GitLab authentication button component
 * Handles sign-in flow, loading states, and error handling
 */
export default function GitLabSignInButton({ 
  callbackUrl = '/repositories', 
  message, 
  className = '',
  buttonText = 'Sign in with GitLab',
  reload = false,
  onSuccess,
  onError
}: GitLabSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(message || null)

  /**
   * Clean up storage from any existing tokens
   * to ensure a fresh authentication state
   */
  const cleanupStorage = () => {
    if (typeof window === 'undefined') return
    
    try {
      // Define all possible token storage keys
      const tokenKeys = [
        // New centralized storage
        'provider_tokens',
        // Token backups
        'token_backup_gitlab',
        // Legacy keys
        'gitlab_token_backup',
        'gitlab_token_backup_time',
        'gitlab_access_token',
        'gitlab_token',
        'gitlabToken',
        'GITLAB_TOKEN'
      ]
      
      // Remove each key
      tokenKeys.forEach(key => {
        try {
          localStorage.removeItem(key)
        } catch (err) {
          console.warn(`Failed to remove token storage: ${key}`, err)
        }
      })
      
      // Handle nested tokens in provider_tokens_cache if it exists
      try {
        const cacheKey = 'provider_tokens_cache'
        const cachedData = localStorage.getItem(cacheKey)
        if (cachedData) {
          const cache = JSON.parse(cachedData)
          if (cache.gitlab) {
            delete cache.gitlab
            localStorage.setItem(cacheKey, JSON.stringify(cache))
          }
        }
      } catch (err) {
        console.warn('Failed to clean up nested token cache', err)
      }
      
      console.log('GitLab token storage cleaned successfully')
    } catch (error) {
      console.error('Error clearing stored GitLab tokens:', error)
    }
  }

  /**
   * Handle the GitLab sign-in process
   */
  const handleSignIn = async () => {
    setIsLoading(true)
    setErrorMessage(null)
    
    try {
      // Clean up storage before sign-in
      cleanupStorage()
      
      // Add provider parameter to callback URL
      let finalCallbackUrl = callbackUrl
      
      // Add provider parameter if not already present
      if (finalCallbackUrl) {
        const url = new URL(finalCallbackUrl, window.location.origin)
        url.searchParams.set('provider', 'gitlab')
        finalCallbackUrl = url.pathname + url.search
      }
      
      console.log('Starting GitLab sign-in process with callback:', finalCallbackUrl)
      const result = await signIn('gitlab', { 
        callbackUrl: finalCallbackUrl,
        redirect: reload // Only redirect if explicitly requested
      })
      
      // Handle successful authentication but no redirect
      if (!reload && result?.ok) {
        console.log('GitLab sign-in successful')
        
        // Call success callback if provided
        if (onSuccess) {
          onSuccess()
        } else {
          // Default behavior - reload the page with provider parameter
          const currentUrl = new URL(window.location.href)
          currentUrl.searchParams.set('provider', 'gitlab')
          window.location.href = currentUrl.toString()
        }
      } else if (result?.error) {
        // Handle authentication error
        console.error('GitLab sign-in error:', result.error)
        setErrorMessage('Authentication failed. Please try again.')
        
        if (onError) {
          onError(new Error(result.error))
        }
      }
    } catch (error) {
      console.error('Error during GitLab sign-in:', error)
      setErrorMessage('Authentication failed. Please try again.')
      
      if (onError && error instanceof Error) {
        onError(error)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center">
      {/* Display error message */}
      {errorMessage && (
        <p className="text-sm text-red-500 mb-2">{errorMessage}</p>
      )}
      
      {/* Sign-in button with loading state */}
      <button
        onClick={handleSignIn}
        disabled={isLoading}
        className={`flex items-center justify-center space-x-2 px-4 py-2 text-white 
                   bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400
                   rounded-md shadow transition-colors duration-200 ${className}`}
        aria-busy={isLoading}
      >
        {isLoading ? (
          <FaSpinner className="text-lg animate-spin mr-2" />
        ) : (
          <FaGitlab className="text-lg mr-2" />
        )}
        <span>{isLoading ? 'Signing in...' : buttonText}</span>
      </button>
    </div>
  )
} 