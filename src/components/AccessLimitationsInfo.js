import React from 'react';
import { Link } from 'react-router-dom';
import { FaLock } from 'react-icons/fa';

const AccessLimitationsInfo = ({ theme }) => {
  return (
    <div className={`mt-6 p-4 rounded-lg border ${
      theme === 'dark' 
        ? 'bg-gray-800 border-gray-700 text-gray-300' 
        : 'bg-gray-50 border-gray-200 text-gray-700'
    }`}>
      <div className="flex items-center">
        <FaLock className="text-yellow-500 mr-3 flex-shrink-0" />
        <div>
          <h3 className="font-medium mb-1">Sign in to access AI chat features</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            GitHub authentication is required to use the AI chat assistant.
          </p>
          <div className="mt-3">
            <Link
              to="/login"
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Sign in with GitHub
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccessLimitationsInfo; 