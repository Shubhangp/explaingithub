import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';

const GitHubCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setIsAuthenticated } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const error = params.get('error');

    if (error) {
      console.error('Authentication error:', error);
      navigate('/login', { state: { error } });
      return;
    }

    if (token) {
      localStorage.setItem('github_token', token);
      setIsAuthenticated(true);
      navigate('/');
    } else {
      navigate('/login', { 
        state: { error: 'No authentication token received' } 
      });
    }
  }, [navigate, setIsAuthenticated, location]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-blue-500 border-blue-200"></div>
    </div>
  );
};

export default GitHubCallback; 