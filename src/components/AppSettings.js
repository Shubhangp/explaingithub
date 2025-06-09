import React, { useState, useEffect } from 'react';
import { Octokit } from '@octokit/rest';
import { FaCog, FaGithub, FaCheck, FaTimes } from 'react-icons/fa';

const AppSettings = () => {
  const [installations, setInstallations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchInstallations = async () => {
      try {
        const token = localStorage.getItem('github_token');
        if (!token) {
          throw new Error('Authentication token not found');
        }

        const octokit = new Octokit({ auth: token });
        const response = await octokit.rest.apps.listInstallationsForAuthenticatedUser();
        
        // Ensure installations is always an array
        const installationsData = response.data.installations || [];
        setInstallations(installationsData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching installations:', error);
        setError(error.message || 'Failed to fetch installations');
        setLoading(false);
        // Initialize installations as an empty array on error
        setInstallations([]);
      }
    };

    fetchInstallations();
  }, []);

  const handleInstallApp = () => {
    window.location.href = '/install-app';
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      </div>
    );
  }

  // Check if installations is an array before using find()
  const hasAppInstalled = Array.isArray(installations) && installations.length > 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 flex items-center">
        <FaCog className="mr-2" /> Application Settings
      </h1>

      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <FaGithub className="mr-2" /> GitHub App Installation
        </h2>

        <div className="mb-4">
          <div className="flex items-center">
            <div className={`mr-3 ${hasAppInstalled ? 'text-green-500' : 'text-red-500'}`}>
              {hasAppInstalled ? <FaCheck /> : <FaTimes />}
            </div>
            <div>
              <p className="font-medium">GitHub App</p>
              <p className="text-sm text-gray-600">
                {hasAppInstalled 
                  ? 'App is installed and configured correctly.' 
                  : 'App is not installed. Install the app to enable repository access.'}
              </p>
            </div>
          </div>
        </div>

        {!hasAppInstalled && (
          <button
            onClick={handleInstallApp}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
          >
            Install GitHub App
          </button>
        )}
      </div>

      {/* Additional settings sections can be added here */}
    </div>
  );
};

export default AppSettings; 