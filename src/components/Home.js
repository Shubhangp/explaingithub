import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Octokit } from '@octokit/rest';
import { MarkGithubIcon } from '@primer/octicons-react';
import { FaSearch, FaGithub, FaStar, FaCodeBranch, FaEye, FaHistory } from 'react-icons/fa';
import PermissionBanner from './PermissionBanner.js';
import { useTheme } from '../context/ThemeContext.js';
import { useAuth } from '../context/AuthContext.js';

const Home = () => {
  const [repoUrl, setRepoUrl] = useState('');
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentRepos, setRecentRepos] = useState([]);
  const [filteredRepos, setFilteredRepos] = useState([]);
  const [showRepoDropdown, setShowRepoDropdown] = useState(false);
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    const fetchRepositories = async () => {
      try {
        const token = localStorage.getItem('github_token');
        if (!token) {
          throw new Error('No GitHub token found. Please login again.');
        }

        console.log('Fetching repositories with token:', token);
        
        const response = await fetch('https://api.github.com/user/repos', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });

        if (!response.ok) {
          if (response.status === 401) {
            localStorage.removeItem('github_token');
            navigate('/login');
            throw new Error('Authentication token expired. Please login again.');
          }
          throw new Error(`GitHub API error: ${response.statusText}`);
        }

        const data = await response.json();
        setRepos(data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching repositories:', error);
        setError(error.message);
        setLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchRepositories();
    } else {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  // Load recent repositories from localStorage on component mount
  useEffect(() => {
    const savedRepos = localStorage.getItem('recentRepos');
    if (savedRepos) {
      try {
        setRecentRepos(JSON.parse(savedRepos));
      } catch (e) {
        console.error('Error parsing recent repos:', e);
        setRecentRepos([]);
      }
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!repoUrl.trim()) {
      setError('Please enter a repository URL or name');
      return;
    }
    
    // Case 1: Full GitHub URL (github.com/username/repo)
    const urlMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (urlMatch) {
      const [, owner, repo] = urlMatch;
      navigate(`/${owner}/${repo}`);
      return;
    }
    
    // Case 2: Simple username/repo format
    const simpleMatch = repoUrl.match(/^([^/\s]+)\/([^/\s]+)$/);
    if (simpleMatch) {
      const [, owner, repo] = simpleMatch;
      navigate(`/${owner}/${repo}`);
      return;
    }
    
    // Case 3: Search in user's repositories
    const searchInUserRepos = repos.find(repo => 
      repo.name.toLowerCase() === repoUrl.toLowerCase() || 
      repo.full_name.toLowerCase() === repoUrl.toLowerCase()
    );
    
    if (searchInUserRepos) {
      navigate(`/${searchInUserRepos.full_name}`);
      return;
    }
    
    // If no match found, show error
    setError('Please enter a valid GitHub repository URL or name (username/repo)');
  };

  // Handle search form submission
  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setSearchResults([]);
    
    try {
      // Check if the query is in the format username/repo
      if (searchQuery.includes('/')) {
        const [username, repo] = searchQuery.split('/');
        if (username && repo) {
          navigate(`/${username}/${repo}`);
          return;
        }
      }
      
      // Otherwise, search GitHub API
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      const response = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(searchQuery)}&sort=stars&order=desc`, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to search repositories');
      }
      
      const data = await response.json();
      setSearchResults(data.items.slice(0, 10)); // Limit to top 10 results
    } catch (error) {
      console.error('Error searching repositories:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Navigate to a repository and save it to recent repos
  const navigateToRepo = (repo) => {
    // Add to recent repos
    const newRecentRepos = [
      {
        id: repo.id,
        full_name: repo.full_name,
        description: repo.description,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        watchers: repo.watchers_count,
        avatar_url: repo.owner.avatar_url
      },
      ...recentRepos.filter(r => r.id !== repo.id).slice(0, 4) // Keep only 5 most recent
    ];
    
    setRecentRepos(newRecentRepos);
    localStorage.setItem('recentRepos', JSON.stringify(newRecentRepos));
    
    // Navigate to the repo
    navigate(`/${repo.full_name}`);
  };

  // Update the input change handler to filter repositories
  const handleRepoInputChange = (e) => {
    const value = e.target.value;
    setRepoUrl(value);
    setError(null);
    
    if (value.trim().length > 0) {
      // Filter user's repositories based on input
      const filtered = repos.filter(repo => 
        repo.name.toLowerCase().includes(value.toLowerCase()) || 
        repo.full_name.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 5); // Limit to 5 results for better UX
      
      setFilteredRepos(filtered);
      setShowRepoDropdown(true);
    } else {
      setFilteredRepos([]);
      setShowRepoDropdown(false);
    }
  };

  // Add a function to handle repository selection from dropdown
  const handleRepoSelect = (repo) => {
    navigate(`/${repo.full_name}`);
    setShowRepoDropdown(false);
  };

  // Add a function to close the dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (event.target.closest('.repo-search-container') === null) {
        setShowRepoDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Loading repositories...</h1>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4 text-red-600">Error: {error}</h1>
        <Link to="/login" className="text-blue-500 hover:text-blue-700">
          Return to login
        </Link>
      </div>
    );
  }

  return (
    <div className={`min-h-screen pt-24 pb-12 ${
      theme === 'dark' 
        ? 'bg-[var(--color-dark-bg)] text-[var(--color-dark-text)]' 
        : 'bg-[var(--color-light-bg)] text-[var(--color-light-text)]'
    }`}>
      <div className="container mx-auto px-4">
        <PermissionBanner />
        
        <div className="text-center mb-12">
          <div className="inline-block p-4 bg-white rounded-full shadow-lg mb-6">
            <MarkGithubIcon size={48} className="text-gray-900" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            GitHub Repository Explorer
          </h1>
          <p className="text-xl text-gray-600">
            Explore and analyze GitHub repositories with ease
          </p>
        </div>

        <div className={`rounded-xl border overflow-hidden mb-12 ${
          theme === 'dark' ? 'bg-[var(--color-dark-surface)] border-[var(--color-dark-border)]' : 'bg-white border-gray-200'
        }`}>
          <div className="p-8">
            <form onSubmit={handleSubmit} className="mb-8">
              <label className="block text-lg font-semibold mb-3">
                Enter Repository URL or Name
              </label>
              <div className="flex gap-4">
                <div className="relative flex-1 repo-search-container">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaGithub className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} />
                  </div>
                  <input
                    type="text"
                    value={repoUrl}
                    onChange={handleRepoInputChange}
                    placeholder="github.com/username/repo or username/repo"
                    className={`w-full py-3 pl-10 pr-4 rounded-lg border focus:outline-none focus:ring-2 ${
                      theme === 'dark'
                        ? 'bg-[var(--color-dark-bg)] border-[var(--color-dark-border)] text-white focus:ring-[var(--color-primary-light)]'
                        : 'bg-white border-gray-300 focus:ring-[var(--color-primary)]'
                    }`}
                  />
                  
                  {/* Repository search dropdown */}
                  {showRepoDropdown && filteredRepos.length > 0 && (
                    <div className={`absolute left-0 right-0 mt-1 border rounded-lg shadow-lg z-10 overflow-hidden ${
                      theme === 'dark' 
                        ? 'bg-[var(--color-dark-surface)] border-[var(--color-dark-border)]' 
                        : 'bg-white border-gray-200'
                    }`}>
                      {filteredRepos.map(repo => (
                        <div
                          key={repo.id}
                          className={`p-3 cursor-pointer transition-colors ${
                            theme === 'dark' 
                              ? 'hover:bg-[var(--color-dark-bg)] border-b border-[var(--color-dark-border)] last:border-b-0' 
                              : 'hover:bg-gray-50 border-b border-gray-100 last:border-b-0'
                          }`}
                          onClick={() => handleRepoSelect(repo)}
                        >
                          <div className="flex items-center">
                            <FaGithub className={`mr-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                            <div>
                              <div className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                {repo.full_name}
                              </div>
                              {repo.description && (
                                <div className={`text-xs truncate max-w-md ${
                                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                }`}>
                                  {repo.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <button
                  type="submit"
                  className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] text-white px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center"
                >
                  <FaSearch className="mr-2" />
                  Explore
                </button>
              </div>
              {error && (
                <p className="mt-2 text-red-600 text-sm">{error}</p>
              )}
            </form>

            <div>
              <h2 className={`text-xl font-semibold mb-6 ${
                theme === 'dark' ? 'text-[var(--color-dark-text)]' : 'text-gray-800'
              }`}>
                Your Repositories
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {repos.map(repo => (
                  <Link
                    key={repo.id}
                    to={`/${repo.full_name}`}
                    className={`p-4 border rounded-lg hover:shadow-lg transition-shadow ${
                      theme === 'dark' 
                        ? 'bg-[var(--color-dark-bg)] border-[var(--color-dark-border)] hover:bg-[var(--color-dark-surface)]' 
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <h2 className={`text-xl font-semibold ${
                      theme === 'dark' ? 'text-[var(--color-dark-text)]' : 'text-gray-900'
                    }`}>{repo.name}</h2>
                    <p className={`text-sm mt-1 ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}>{repo.description}</p>
                    <div className={`mt-2 text-sm flex items-center gap-4 ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {repo.language && (
                        <span className="flex items-center">
                          <span className="w-3 h-3 rounded-full bg-gray-400 mr-2"></span>
                          {repo.language}
                        </span>
                      )}
                      <span className="flex items-center">
                        <FaStar className={`mr-1 ${
                          theme === 'dark' ? 'text-yellow-400' : 'text-yellow-500'
                        }`} />
                        {repo.stargazers_count}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Recent Repositories */}
        {recentRepos.length > 0 && (
          <div className="max-w-3xl mx-auto">
            <div className="mb-4 flex items-center">
              <FaHistory className={`mr-2 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`} />
              <h2 className="text-xl font-semibold">Recently Viewed</h2>
            </div>
            
            <div className={`rounded-xl border overflow-hidden ${
              theme === 'dark' ? 'border-[var(--color-dark-border)]' : 'border-gray-200'
            }`}>
              <div className={theme === 'dark' ? 'bg-[var(--color-dark-surface)]' : 'bg-white'}>
                {recentRepos.map(repo => (
                  <div 
                    key={repo.id}
                    className={`p-4 border-b last:border-b-0 cursor-pointer transition-colors ${
                      theme === 'dark' 
                        ? 'border-[var(--color-dark-border)] hover:bg-[var(--color-dark-bg)]' 
                        : 'border-gray-100 hover:bg-gray-50'
                    }`}
                    onClick={() => navigate(`/${repo.full_name}`)}
                  >
                    <div className="flex items-start">
                      <img 
                        src={repo.avatar_url} 
                        alt={repo.full_name.split('/')[0]}
                        className="w-10 h-10 rounded-full mr-3"
                      />
                      <div className="flex-1">
                        <h3 className="font-medium text-[var(--color-primary)]">
                          {repo.full_name}
                        </h3>
                        <p className={`text-sm mt-1 ${
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {repo.description || 'No description available'}
                        </p>
                        <div className="flex items-center mt-2 text-xs">
                          <div className="flex items-center mr-4">
                            <FaStar className={`mr-1 ${
                              theme === 'dark' ? 'text-yellow-400' : 'text-yellow-500'
                            }`} />
                            <span>{repo.stars.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center mr-4">
                            <FaCodeBranch className={`mr-1 ${
                              theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                            }`} />
                            <span>{repo.forks.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center">
                            <FaEye className={`mr-1 ${
                              theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                            }`} />
                            <span>{repo.watchers.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home; 