import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

function InstallationPrompt() {
  const [installing, setInstalling] = useState(false);
  const navigate = useNavigate();
  
  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('github_token');
    if (!token) {
      navigate('/login');
      return;
    }
  }, [navigate]);
  
  const handleInstall = () => {
    setInstalling(true);
    
    // Clear pending installation flag
    localStorage.removeItem('pending_installation');
    
    // Redirect to GitHub app installation
    const appName = process.env.REACT_APP_GITHUB_APP_NAME;
    if (!appName) {
      console.error('GitHub App name is not configured');
      return;
    }
    
    const installUrl = `https://github.com/apps/${appName}/installations/new`;
    window.location.href = installUrl;
  };
  
  const handleSkip = () => {
    // Clear pending installation flag
    localStorage.removeItem('pending_installation');
    navigate('/');
  };
  
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center bg-white p-8 rounded-xl shadow-lg max-w-md w-full mx-4">
        <h1 className="text-2xl font-bold mb-4">Install GitHub App</h1>
        <p className="text-gray-600 mb-8">
          Almost there! Install our GitHub App to access private repositories and get enhanced features.
        </p>
        
        {installing ? (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p>Redirecting to GitHub...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <button
              onClick={handleInstall}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Install GitHub App
            </button>
            
            <button
              onClick={handleSkip}
              className="w-full bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors duration-200"
            >
              Skip Installation
            </button>
            
            <p className="text-xs text-gray-500 mt-2">
              You can always install the app later from the settings page.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default InstallationPrompt; 