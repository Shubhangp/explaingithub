import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { FaGithub } from 'react-icons/fa';
import { useTheme } from '../context/ThemeContext.js';

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { theme } = useTheme();

  const handleGitHubLogin = () => {
    // Generate a random state value with more entropy
    const state = Math.random().toString(36).substring(2) + Date.now().toString(36);
    
    try {
      // Store the state in both localStorage and sessionStorage for redundancy
      localStorage.setItem('github_oauth_state', state);
      sessionStorage.setItem('github_oauth_state', state);
      
      // Get the callback URL from environment variables
      const callbackUrl = process.env.REACT_APP_GITHUB_CALLBACK_URL;
      
      if (!callbackUrl) {
        console.error('GitHub callback URL is not configured');
        return;
      }
      
      // Construct GitHub OAuth URL with state parameter
      const githubAuthUrl = `https://github.com/login/oauth/authorize?` +
        `client_id=${process.env.REACT_APP_GITHUB_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
        `&scope=repo user` +
        `&state=${state}`;
      
      // Log for debugging
      console.log('Redirecting to:', githubAuthUrl);
      console.log('Stored state:', state);
      
      window.location.href = githubAuthUrl;
    } catch (error) {
      console.error('Failed to store OAuth state:', error);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center ${
      theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
    }`}>
      <div className={`max-w-md w-full mx-4 p-8 rounded-xl shadow-lg ${
        theme === 'dark' ? 'bg-gray-800' : 'bg-white'
      }`}>
        <div className="text-center mb-8">
          <h1 className={`text-3xl font-bold mb-2 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            Welcome Back
          </h1>
          <p className={`text-lg ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
          }`}>
            Log in to access private repositories and chat features
          </p>
        </div>

        <button
          onClick={handleGitHubLogin}
          className={`w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg text-white bg-[#24292F] hover:bg-[#1C2024] transition-colors ${
            theme === 'dark' ? 'hover:bg-[#1C2024]' : 'hover:bg-[#1C2024]'
          }`}
        >
          <FaGithub className="text-xl" />
          <span>Continue with GitHub</span>
        </button>

        <p className={`mt-6 text-center text-sm ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
        }`}>
          By continuing, you agree to our{' '}
          <a href="/terms" className="text-blue-500 hover:text-blue-600">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" className="text-blue-500 hover:text-blue-600">
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
}

export default Login; 