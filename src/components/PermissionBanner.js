import { useState, useEffect } from 'react';
import { Octokit } from '@octokit/rest';

function PermissionBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const token = localStorage.getItem('github_token');
        if (!token) {
          setShowBanner(false);
          setLoading(false);
          return;
        }
        
        // Check what permissions the token has
        const octokit = new Octokit({ auth: token });
        const { data } = await octokit.users.getAuthenticated();
        
        // If the scopes stored with the token include 'repo', they have private access
        const tokenScopes = localStorage.getItem('token_scopes') || '';
        const hasPrivateAccess = tokenScopes.includes('repo') && !tokenScopes.includes('public_repo');
        
        // Only show banner if they don't have private access
        // and haven't explicitly declined the upgrade
        const declinedUpgrade = localStorage.getItem('declined_upgrade') === 'true';
        setShowBanner(!hasPrivateAccess && !declinedUpgrade);
        setLoading(false);
      } catch (error) {
        console.error('Error checking permissions:', error);
        setShowBanner(false);
        setLoading(false);
      }
    };
    
    checkPermissions();
  }, []);
  
  const handleUpgrade = () => {
    const state = Math.random().toString(36).substring(7);
    localStorage.setItem('oauth_state', state);
    
    const params = new URLSearchParams({
      client_id: process.env.REACT_APP_GITHUB_CLIENT_ID,
      redirect_uri: process.env.REACT_APP_GITHUB_REDIRECT_URI,
      scope: 'repo',
      state: state
    });
    
    window.location.href = `https://github.com/login/oauth/authorize?${params}`;
  };
  
  const handleDecline = () => {
    localStorage.setItem('declined_upgrade', 'true');
    setShowBanner(false);
  };
  
  if (loading || !showBanner) return null;
  
  return (
    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
      <div className="flex items-start">
        <div className="ml-3">
          <h3 className="text-sm font-medium text-blue-800">Access private repositories</h3>
          <div className="mt-1 text-sm text-blue-700">
            <p>Upgrade your permissions to view and explore your private repositories.</p>
            <div className="mt-2 flex space-x-2">
              <button
                onClick={handleUpgrade}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded"
              >
                Upgrade Access
              </button>
              <button
                onClick={handleDecline}
                className="text-blue-700 hover:text-blue-900 text-xs"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PermissionBanner; 