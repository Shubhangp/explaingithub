'use client';

import { useState, useEffect } from 'react';
import { FaGithub, FaGitlab, FaSave } from 'react-icons/fa';

export default function TokenSettings() {
  const [githubToken, setGithubToken] = useState('');
  const [gitlabToken, setGitlabToken] = useState('');
  const [gitlabInstanceUrl, setGitlabInstanceUrl] = useState('https://gitlab.com');
  const [savedMessage, setSavedMessage] = useState('');
  
  // Load tokens from localStorage on mount
  useEffect(() => {
    try {
      const storedGithubToken = localStorage.getItem('github_token') || '';
      const storedGitlabToken = localStorage.getItem('gitlabToken') || '';
      const storedGitlabInstanceUrl = localStorage.getItem('gitlabInstanceUrl') || 'https://gitlab.com';
      
      setGithubToken(storedGithubToken);
      setGitlabToken(storedGitlabToken);
      setGitlabInstanceUrl(storedGitlabInstanceUrl);
    } catch (e) {
      console.error('Error loading tokens from localStorage:', e);
    }
  }, []);
  
  const saveTokens = () => {
    try {
      if (githubToken) {
        localStorage.setItem('github_token', githubToken);
      } else {
        localStorage.removeItem('github_token');
      }
      
      if (gitlabToken) {
        localStorage.setItem('gitlabToken', gitlabToken);
      } else {
        localStorage.removeItem('gitlabToken');
      }
      
      localStorage.setItem('gitlabInstanceUrl', gitlabInstanceUrl);
      
      setSavedMessage('Tokens saved successfully');
      window.dispatchEvent(new Event('provider-settings-updated'));
      
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (e) {
      console.error('Error saving tokens:', e);
      setSavedMessage('Error saving tokens');
      setTimeout(() => setSavedMessage(''), 3000);
    }
  };
  
  return (
    <div className="w-full max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Provider Tokens</h2>
      
      <p className="text-gray-600 dark:text-gray-300 mb-6">
        Add your GitHub and GitLab tokens to access repositories. These tokens are stored locally in your browser.
      </p>
      
      {savedMessage && (
        <div className="bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200 px-4 py-2 rounded mb-4">
          {savedMessage}
        </div>
      )}
      
      <div className="space-y-6">
        {/* GitHub Token */}
        <div className="p-4 border rounded dark:border-gray-700">
          <div className="flex items-center mb-4">
            <FaGithub className="text-gray-700 dark:text-gray-300 text-xl mr-2" />
            <h3 className="text-lg font-medium">GitHub Token</h3>
          </div>
          
          <div className="mb-4">
            <label htmlFor="github-token" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Personal Access Token
            </label>
            <input
              id="github-token"
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxx"
              className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Need a token? <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Create one</a> with <code>repo</code> and <code>read:user</code> scopes.
            </p>
          </div>
        </div>
        
        {/* GitLab Token */}
        <div className="p-4 border rounded dark:border-gray-700">
          <div className="flex items-center mb-4">
            <FaGitlab className="text-orange-500 text-xl mr-2" />
            <h3 className="text-lg font-medium">GitLab Settings</h3>
          </div>
          
          <div className="mb-4">
            <label htmlFor="gitlab-token" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Personal Access Token
            </label>
            <input
              id="gitlab-token"
              type="password"
              value={gitlabToken}
              onChange={(e) => setGitlabToken(e.target.value)}
              placeholder="glpat-xxxxxxxxxxxxxxxx"
              className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Need a token? <a href="https://gitlab.com/-/profile/personal_access_tokens" target="_blank" rel="noopener noreferrer" className="text-orange-600 dark:text-orange-400 hover:underline">Create one</a> with <code>read_api</code>, <code>read_repository</code>, and <code>read_user</code> scopes.
            </p>
          </div>
          
          <div>
            <label htmlFor="gitlab-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              GitLab Instance URL
            </label>
            <input
              id="gitlab-url"
              type="text"
              value={gitlabInstanceUrl}
              onChange={(e) => setGitlabInstanceUrl(e.target.value)}
              placeholder="https://gitlab.com"
              className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              For self-hosted GitLab instances, enter the base URL.
            </p>
          </div>
        </div>
      </div>
      
      <div className="mt-6 text-right">
        <button
          onClick={saveTokens}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center ml-auto"
        >
          <FaSave className="mr-2" /> Save Tokens
        </button>
      </div>
    </div>
  );
} 