import React, { createContext, useContext, useState, useEffect } from 'react';
import { Octokit } from '@octokit/rest';

// Create the auth context
const AuthContext = createContext();

// Custom hook to use the auth context
export const useAuth = () => {
  return useContext(AuthContext);
};

// Provider component that wraps your app and makes auth object available to any child component that calls useAuth()
export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = localStorage.getItem('github_token');
        
        if (token) {
          console.log('Found token in localStorage, validating...');
          
          // Validate token by making a simple API request
          const octokit = new Octokit({ auth: token });
          const { data } = await octokit.users.getAuthenticated();
          
          setAuth({
            token,
            access_token: token,
            user: data,
            displayName: data.name || data.login
          });
          
          console.log('Token validated successfully');
        } else {
          console.log('No authentication token found');
          setAuth(null);
        }
      } catch (error) {
        console.error('Error validating token:', error);
        // Token is invalid or expired
        localStorage.removeItem('github_token');
        setAuth(null);
      } finally {
        setLoading(false);
      }
    };
    
    initAuth();
  }, []);

  const login = async (token) => {
    try {
      const octokit = new Octokit({ auth: token });
      const { data } = await octokit.users.getAuthenticated();
      
      const authData = {
        token,
        access_token: token,
        user: data,
        displayName: data.name || data.login
      };
      
      setAuth(authData);
      return authData;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('github_token');
    setAuth(null);
  };

  const isAuthenticated = () => {
    return !!auth?.token;
  };

  // Context values to be provided
  const value = {
    auth,
    loading,
    login,
    logout,
    isAuthenticated
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
} 