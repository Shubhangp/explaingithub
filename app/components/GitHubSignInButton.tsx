'use client';

import { signIn } from 'next-auth/react';
import { FaGithub } from 'react-icons/fa';

interface GitHubSignInButtonProps {
  callbackUrl?: string;
  message?: string;
  buttonText?: string;
  className?: string;
  reload?: boolean;
}

/**
 * A reusable GitHub sign-in button that behaves consistently across the application
 */
export default function GitHubSignInButton({
  callbackUrl = '/repositories',
  message,
  buttonText = 'Sign in with GitHub',
  className = '',
  reload = false
}: GitHubSignInButtonProps) {
  const handleSignIn = async () => {
    try {
      // Add provider parameter to callback URL
      let finalCallbackUrl = callbackUrl
      
      // Add provider parameter if not already present
      if (finalCallbackUrl) {
        const url = new URL(finalCallbackUrl, window.location.origin)
        url.searchParams.set('provider', 'github')
        finalCallbackUrl = url.pathname + url.search
      }
      
      console.log('Starting GitHub sign-in process with callback:', finalCallbackUrl)
      const result = await signIn('github', { 
        callbackUrl: finalCallbackUrl,
        redirect: reload // Only redirect if explicitly requested
      });
      
      // If the sign-in was successful but we're not redirecting automatically,
      // we can use the result to determine what to do
      if (!reload && result?.ok) {
        console.log('GitHub sign-in successful, no redirect');
        // Reload with provider parameter
        const currentUrl = new URL(window.location.href)
        currentUrl.searchParams.set('provider', 'github')
        window.location.href = currentUrl.toString()
      }
    } catch (error) {
      console.error('Error during GitHub sign-in:', error);
    }
  };

  return (
    <div className="flex flex-col items-center">
      {message && (
        <p className="text-sm text-red-500 mb-2">{message}</p>
      )}
      <button
        onClick={handleSignIn}
        className={`flex items-center space-x-2 px-4 py-2 text-white bg-gray-800 hover:bg-gray-900 rounded-md shadow ${className}`}
      >
        <FaGithub className="text-lg" />
        <span>{buttonText}</span>
      </button>
    </div>
  );
} 