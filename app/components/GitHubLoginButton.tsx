'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { FaGithub } from 'react-icons/fa';

interface GitHubLoginButtonProps {
  callbackUrl?: string;
  className?: string;
}

export default function GitHubLoginButton({ 
  callbackUrl = '/',
  className = '',
}: GitHubLoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      await signIn('github', { callbackUrl });
    } catch (error) {
      console.error('Login error:', error);
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogin}
      disabled={isLoading}
      className={`flex items-center justify-center gap-2 px-6 py-3 text-white bg-black rounded-md hover:bg-gray-800 transition-colors ${isLoading ? 'opacity-70 cursor-not-allowed' : ''} ${className}`}
      data-testid="github-login-button"
    >
      <FaGithub className="w-5 h-5" />
      <span>{isLoading ? 'Connecting...' : 'Continue with GitHub'}</span>
    </button>
  );
} 