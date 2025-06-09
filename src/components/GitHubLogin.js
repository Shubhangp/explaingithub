import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MarkGithubIcon } from '@primer/octicons-react'

export default function GitHubLogin() {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('github_token');
    if (token) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const handleLogin = () => {
    console.log('Initiating login with GitHub');
    
    const clientId = process.env.REACT_APP_GITHUB_CLIENT_ID;
    const redirectUri = encodeURIComponent(process.env.REACT_APP_GITHUB_REDIRECT_URI);
    
    // Generate a more secure state parameter using a combination of timestamp and random values
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    const state = `${timestamp}-${randomPart}`;
    
    // Clear any existing state first
    localStorage.removeItem('oauth_state');
    sessionStorage.removeItem('oauth_state');
    
    // Store state in both localStorage and sessionStorage
    localStorage.setItem('oauth_state', state);
    sessionStorage.setItem('oauth_state', state);
    
    console.log('Generated OAuth state:', state);
    console.log('Stored in localStorage:', localStorage.getItem('oauth_state'));
    console.log('Stored in sessionStorage:', sessionStorage.getItem('oauth_state'));
    
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'repo',
      state: state
    });
    
    const githubAuthUrl = `https://github.com/login/oauth/authorize?${params}`;
    console.log('Redirecting to:', githubAuthUrl);
    window.location.href = githubAuthUrl;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-md w-full">
        <MarkGithubIcon className="h-16 w-16 text-gray-900 mx-auto mb-6" />
        <h1 className="text-3xl font-bold text-gray-900 mb-4">explaingithub</h1>
        <p className="text-gray-600 mb-8">
          Sign in with GitHub to explore and understand repositories
        </p>
        <button
          onClick={handleLogin}
          className="bg-gray-900 text-white px-6 py-3 rounded-md font-medium hover:bg-gray-800 transition-colors duration-200 flex items-center justify-center mx-auto gap-2"
        >
          <MarkGithubIcon className="h-5 w-5" />
          Sign in with GitHub
        </button>
        <p className="text-sm text-gray-500 mt-6">
          You'll need to authorize access to your public repositories
        </p>
      </div>
    </div>
  );
} 