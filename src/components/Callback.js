import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

function Callback() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    const exchangeCodeForToken = async () => {
      try {
        // Extract code and state from URL
        const searchParams = new URLSearchParams(location.search);
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        
        if (!code) {
          throw new Error('No code parameter found in callback URL');
        }
        
        // Verify state parameter if necessary
        const storedState = sessionStorage.getItem('oauth_state');
        if (state && storedState && state !== storedState) {
          throw new Error('State validation failed. Possible CSRF attack.');
        }
        
        console.log('Exchanging code for token...');
        
        // Exchange the code for a token using our API
        const response = await fetch('/api/auth/github', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          console.error('Token exchange failed:', data);
          throw new Error(data.message || 'Failed to exchange code for token');
        }
        
        console.log('Token received successfully');
        
        // Store the token in localStorage
        if (data.token) {
          localStorage.setItem('github_token', data.token);
          
          // Clean up state
          sessionStorage.removeItem('oauth_state');
          
          // Redirect to home or the repository page
          navigate('/');
        } else {
          throw new Error('No token received from server');
        }
      } catch (error) {
        console.error('Authentication error:', error);
        setError(error.message);
        setLoading(false);
      }
    };
    
    exchangeCodeForToken();
  }, [location, navigate]);
  
  // Show loading spinner while processing the code exchange
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Authenticating with GitHub...</p>
        </div>
      </div>
    );
  }
  
  // Show error message if something went wrong
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          <div className="text-red-500 text-center mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-center mb-4">Authentication Error</h2>
          <p className="text-gray-700 mb-6">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }
  
  return null;
}

export default Callback; 